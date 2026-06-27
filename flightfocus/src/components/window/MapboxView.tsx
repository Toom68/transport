import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

type SolarData = { altitude: number; azimuth: number } | null;

interface MapboxViewProps {
  lat: number;
  lng: number;
  altitude: number;
  speed: number;
  heading: number;
  phase: string;
  mapboxToken: string;
  solarData?: SolarData;
}

// Fixed zoom — no changes during flight to avoid jank
const FIXED_ZOOM = 13;

// Altitude → pitch (0° = straight down, 85° = looking at horizon)
// Ground: 75° — looking across the runway at eye level
// Takeoff: races up toward horizon as altitude increases
// Cruise: 85° — looking out at the horizon
// Landing: reverses back down as altitude decreases
function altitudeToPitch(altitude: number): number {
  if (altitude < 50) return 75;                                          // boarding/taxi: eye-level on runway
  if (altitude < 500) return 75 + ((altitude - 50) / 450) * 7;           // takeoff roll: 75° → 82°
  if (altitude < 2000) return 82 + ((altitude - 500) / 1500) * 2;        // initial climb: 82° → 84°
  return Math.min(85, 84 + ((altitude - 2000) / 36000) * 1);             // cruise: 84° → 85°
}

// Sun altitude → sky colors for day/night
function getSkyColors(sunAlt: number): { sky: string; horizon: string; fog: string; fogHigh: string; space: string; stars: number } {
  if (sunAlt > 15) {
    // Full day
    return { sky: '#88aacd', horizon: '#c8d8e8', fog: '#c8d0e0', fogHigh: '#a0b8d0', space: '#081020', stars: 0 };
  }
  if (sunAlt > 0) {
    // Golden hour — warm tones
    const t = sunAlt / 15;
    return {
      sky: lerpHex('#e8954a', '#88aacd', t),
      horizon: lerpHex('#ffd9a0', '#c8d8e8', t),
      fog: lerpHex('#d4a070', '#c8d0e0', t),
      fogHigh: lerpHex('#c87850', '#a0b8d0', t),
      space: '#081020',
      stars: 0,
    };
  }
  if (sunAlt > -6) {
    // Sunset/sunrise transition
    const t = (sunAlt + 6) / 6;
    return {
      sky: lerpHex('#3a2a4a', '#e8954a', t),
      horizon: lerpHex('#7a3548', '#ffd9a0', t),
      fog: lerpHex('#5a3a5a', '#d4a070', t),
      fogHigh: lerpHex('#3a2048', '#c87850', t),
      space: '#080818',
      stars: t * 0.2,
    };
  }
  if (sunAlt > -12) {
    // Twilight
    const t = (sunAlt + 12) / 6;
    return {
      sky: lerpHex('#0a1530', '#3a2a4a', t),
      horizon: lerpHex('#1a1838', '#7a3548', t),
      fog: lerpHex('#1a1a30', '#5a3a5a', t),
      fogHigh: lerpHex('#0a0a20', '#3a2048', t),
      space: '#060810',
      stars: 0.2 + t * 0.3,
    };
  }
  // Night
  return { sky: '#060d20', horizon: '#0a1024', fog: '#0a1020', fogHigh: '#080a18', space: '#020408', stars: 0.5 };
}

function lerpHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 0xff) + (((pb >> 16) & 0xff) - ((pa >> 16) & 0xff)) * t);
  const g = Math.round(((pa >> 8) & 0xff) + (((pb >> 8) & 0xff) - ((pa >> 8) & 0xff)) * t);
  const bl = Math.round((pa & 0xff) + ((pb & 0xff) - (pa & 0xff)) * t);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

export function MapboxView({
  lat,
  lng,
  altitude,
  speed,
  heading,
  phase,
  mapboxToken,
  solarData,
}: MapboxViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const styleLoadedRef = useRef(false);
  const rafRef = useRef<number>(0);
  const smoothBearingRef = useRef(heading - 90);
  const preloadRef = useRef<{ lastPreload: number; preloaded: boolean }>({ lastPreload: 0, preloaded: false });

  // Target values updated every render — rAF loop reads these
  const targetRef = useRef({ lat, lng, altitude, heading, phase });
  targetRef.current = { lat, lng, altitude, heading, phase };

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [lng, lat],
      zoom: FIXED_ZOOM,
      pitch: altitudeToPitch(altitude),
      bearing: heading - 90, // Left window: perpendicular to travel direction
      interactive: false,
      attributionControl: false,
      antialias: true,
      maxPitch: 85,
      maxTileCacheSize: 500, // cache more tiles for smoother panning
      fadeDuration: 0, // instant tile fade-in, no blur during transitions
    });

    mapRef.current = map;

    map.on('style.load', () => {
      styleLoadedRef.current = true;

      // Remove all vector overlay layers (labels, roads, boundaries) for pure satellite view
      try {
        const layers = map.getStyle().layers;
        for (const layer of layers) {
          if (layer.type === 'symbol' || layer.type === 'line' || (layer.type === 'fill-extrusion' && layer.id !== '3d-buildings') || (layer.type === 'fill' && layer.source !== 'composite')) {
            map.removeLayer(layer.id);
          }
        }
      } catch {
        // ignore
      }

      // Add 3D terrain elevation
      try {
        map.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14,
        });
        map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
        console.log('[MapboxView] Terrain added successfully');
      } catch (e) {
        console.error('[MapboxView] Terrain failed:', e);
      }

      // Add 3D buildings — satellite-streets doesn't have building data,
        // so we fetch it from the composite building source
      try {
        // Add a separate source for building footprints
        map.addSource('buildings-src', {
          type: 'vector',
          url: 'mapbox://mapbox.mapbox-streets-v8',
        });
        const buildingLayer = {
          id: '3d-buildings',
          source: 'buildings-src',
          'source-layer': 'building',
          type: 'fill-extrusion',
          minzoom: 15,
          paint: {
            'fill-extrusion-color': [
              'interpolate',
              ['linear'],
              ['get', 'height'],
              0, '#c4b8a0',      // low buildings: warm concrete
              20, '#a8a090',      // light tan
              50, '#8a8278',      // mid: grey-brown
              100, '#6e6862',     // tall: dark concrete
              200, '#4a4640',     // skyscrapers: dark glass
            ],
            'fill-extrusion-height': [
              'interpolate',
              ['linear'],
              ['zoom'],
              15,
              0,
              15.5,
              ['get', 'height'],
            ],
            'fill-extrusion-base': [
              'interpolate',
              ['linear'],
              ['zoom'],
              15,
              0,
              15.5,
              ['get', 'min_height'],
            ],
            'fill-extrusion-opacity': 0.9,
            'fill-extrusion-vertical-gradient': true,
          },
        } as mapboxgl.AnyLayer;
        map.addLayer(buildingLayer);
        console.log('[MapboxView] 3D buildings added successfully');
      } catch (e) {
        console.error('[MapboxView] 3D buildings failed:', e);
      }

      // Add sky layer
      try {
        const skyLayer = {
          id: 'sky',
          type: 'sky',
          paint: {
            'sky-color': '#88aacd',
            'sky-horizon-blend': 0.5,
            'sky-gradient': [
              'interpolate',
              ['linear'],
              ['sky-radial-progress'],
              0.8,
              '#88aacd',
              1,
              '#c8d8e8',
            ],
            'sky-opacity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              5,
              0,
              8,
              1,
            ],
          },
        } as mapboxgl.AnyLayer;
        map.addLayer(skyLayer);
      } catch {
        // ignore
      }

      // Set initial fog
      try {
        map.setFog({
          color: '#c8d0e0',
          'high-color': '#a0b8d0',
          'horizon-blend': 0.3,
          'space-color': '#081020',
          'star-intensity': 0.4,
          range: [2, 10],
        });
      } catch {
        // ignore
      }
    });

    // Tile preloading: during ground phases, sweep camera around airport to cache tiles
    // within ~10km radius. Runs every 5 seconds during BOARDING/TAXI/TAKEOFF.
    const preloadTiles = () => {
      const now = Date.now();
      if (now - preloadRef.current.lastPreload < 5000) return;
      preloadRef.current.lastPreload = now;

      const t = targetRef.current;
      const groundPhases = ['BOARDING', 'TAXI', 'TAKEOFF'];
      if (!groundPhases.includes(t.phase)) return;

      // Save current camera to restore after preload sweep
      const savedCam = map.getFreeCameraOptions();
      const airportLng = t.lng;
      const airportLat = t.lat;

      // Sweep 8 directions around the airport at ~5km offset to cache tiles
      const directions = 8;
      for (let i = 0; i < directions; i++) {
        const angle = (i / directions) * Math.PI * 2;
        const offsetLat = (5 / 111) * Math.cos(angle);
        const offsetLng = (5 / (111 * Math.cos(airportLat * Math.PI / 180))) * Math.sin(angle);
        const pos = mapboxgl.MercatorCoordinate.fromLngLat(
          [airportLng + offsetLng, airportLat + offsetLat],
          50
        );
        const lookAt = mapboxgl.MercatorCoordinate.fromLngLat(
          [airportLng + offsetLng, airportLat + offsetLat],
          0
        );
        const cam = new mapboxgl.FreeCameraOptions(pos, lookAt);
        map.setFreeCameraOptions(cam);
      }

      // Restore saved camera
      map.setFreeCameraOptions(savedCam);
      console.log('[MapboxView] Preloaded tiles around airport');
    };

    // rAF camera tracking loop — physically positions camera at plane's real altitude
    const tick = () => {
      const tgt = targetRef.current;

      // Preload tiles during ground phases
      preloadTiles();

      // Plane altitude in meters above ground
      const altMeters = Math.max(1, tgt.altitude * 0.3048);

      // Ground elevation at plane's position (from terrain DEM)
      const groundElev = map.queryTerrainElevation([tgt.lng, tgt.lat]) ?? 0;

      // Camera position: at plane's lat/lng, at altitude above sea level
      const camAltMeters = groundElev + altMeters;
      const camPos = mapboxgl.MercatorCoordinate.fromLngLat([tgt.lng, tgt.lat], camAltMeters);

      // Pitch from altitude
      const pitch = altitudeToPitch(tgt.altitude);
      const pitchRad = (pitch * Math.PI) / 180;

      // Smooth bearing (left window: perpendicular to travel)
      const tgtBearing = tgt.heading - 90;
      let bDelta = tgtBearing - smoothBearingRef.current;
      while (bDelta > 180) bDelta -= 360;
      while (bDelta < -180) bDelta += 360;
      smoothBearingRef.current += bDelta * 0.1;
      const bearingRad = (smoothBearingRef.current * Math.PI) / 180;

      // Distance to look-at point on ground: h * tan(pitch from vertical)
      // pitch 0° = straight down (lookDist ≈ 0), pitch 85° = near horizon (lookDist very large)
      const lookDist = Math.max(1, altMeters * Math.tan(pitchRad));

      // Compute look-at point: forward in bearing direction at ground level
      const latOffset = (lookDist * Math.cos(bearingRad)) / 111320;
      const lngOffset = (lookDist * Math.sin(bearingRad)) / (111320 * Math.cos(tgt.lat * Math.PI / 180));
      const lookAt = mapboxgl.MercatorCoordinate.fromLngLat(
        [tgt.lng + lngOffset, tgt.lat + latOffset],
        groundElev
      );

      const camera = new mapboxgl.FreeCameraOptions(camPos, lookAt);
      map.setFreeCameraOptions(camera);

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      map.remove();
      mapRef.current = null;
      styleLoadedRef.current = false;
    };
  }, [mapboxToken]);

  // Day/night + weather — update sky and fog colors
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;

    const sunAlt = solarData?.altitude ?? 0;

    const sky = getSkyColors(sunAlt);

    try {
      map.setFog({
        color: sky.fog,
        'high-color': sky.fogHigh,
        'horizon-blend': 0.3,
        'space-color': sky.space,
        'star-intensity': sky.stars,
        range: [2, 10],
      });
    } catch {
      // ignore
    }

    // Update sky layer colors for day/night
    try {
      map.setPaintProperty('sky', 'sky-color' as any, sky.sky);
      map.setPaintProperty('sky', 'sky-gradient' as any, [
        'interpolate',
        ['linear'],
        ['sky-radial-progress'],
        0.8,
        sky.sky,
        1,
        sky.horizon,
      ]);
    } catch {
      // ignore
    }

    // Adjust map light for night — darken terrain
    try {
      if (sunAlt < -6) {
        map.setLight({
          anchor: 'viewport',
          color: '#3a4a6a',
          intensity: 0.3,
        });
      } else if (sunAlt < 5) {
        map.setLight({
          anchor: 'viewport',
          color: '#e8a060',
          intensity: 0.5,
        });
      } else {
        map.setLight({
          anchor: 'viewport',
          color: '#ffffff',
          intensity: 0.9,
        });
      }
    } catch {
      // ignore
    }
  }, [solarData]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{
        width: '100%',
        height: '100%',
        clipPath: 'ellipse(28% 42% at 50% 50%)',
      }}
    />
  );
}
