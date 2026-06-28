import { useEffect, useRef, useState, useCallback } from 'react';
import { Viewer } from 'mapillary-js';
import 'mapillary-js/dist/mapillary.css';

interface StreetViewProps {
  lat: number;
  lng: number;
  heading: number;
  accessToken: string;
  googleApiKey?: string;
  isMoving: boolean;
}

const CORRIDOR_RADIUS_DEG = 0.01; // ~1km half-width
const SEARCH_RADIUS_M = 500; // search within 500m of car
const SEARCH_LIMIT = 50;
const MIN_MOVE_MS = 2000; // min time between viewer moves
const MIN_DIST_M = 50; // min distance car must travel before re-searching
const GOOGLE_FETCH_MS = 3000;
const GOOGLE_IMG_SIZE = 640;

type Provider = 'mapillary' | 'google' | 'none';

interface GoogleImg {
  url: string;
  lat: number;
  lng: number;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function headingDiff(imgAngle: number, carHeading: number): number {
  return Math.abs(((imgAngle - carHeading + 540) % 360) - 180);
}

export function StreetView({ lat, lng, heading, accessToken, googleApiKey, isMoving }: StreetViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const currentImageIdRef = useRef<string | null>(null);
  const lastMoveRef = useRef(0);
  const rafRef = useRef<number>(0);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<Provider>('mapillary');

  // Refs for position data — updated every render without retriggering the RAF loop
  const latRef = useRef(lat);
  const lngRef = useRef(lng);
  const headingRef = useRef(heading);
  const isMovingRef = useRef(isMoving);
  const providerRef = useRef<Provider>('mapillary');
  const lastSearchLatRef = useRef(lat);
  const lastSearchLngRef = useRef(lng);

  // Google fallback state
  const [googleCurrent, setGoogleCurrent] = useState<GoogleImg | null>(null);
  const [googleNext, setGoogleNext] = useState<GoogleImg | null>(null);
  const googleLastFetchRef = useRef(0);
  const googleLastUrlRef = useRef<string | null>(null);

  // Sync refs every render
  latRef.current = lat;
  lngRef.current = lng;
  headingRef.current = heading;
  isMovingRef.current = isMoving;
  providerRef.current = provider;

  // Find nearest image ID via Mapillary API
  const findNearestImageId = useCallback(async (carLat: number, carLng: number, carHeading: number): Promise<{ id: string; lat: number; lng: number } | null> => {
    const radiusUrl = `https://graph.mapillary.com/images?access_token=${accessToken}` +
      `&fields=id,compass_angle,is_pano,geometry` +
      `&lat=${carLat}&lng=${carLng}&radius=${SEARCH_RADIUS_M}&limit=50`;

    try {
      const resp = await fetch(radiusUrl);
      if (resp.ok) {
        const data = await resp.json();
        if (data.data && data.data.length > 0) {
          let best: any = null;
          let bestScore = Infinity;
          for (const img of data.data) {
            const hDiff = img.is_pano ? 0 : headingDiff(img.compass_angle ?? 0, carHeading);
            const imgLat = img.geometry?.coordinates?.[1] ?? carLat;
            const imgLng = img.geometry?.coordinates?.[0] ?? carLng;
            const dist = haversineMeters(carLat, carLng, imgLat, imgLng);
            // Weight distance heavily — we want the closest image that roughly faces the right way
            const score = dist + hDiff * 2;
            if (score < bestScore) {
              bestScore = score;
              best = img;
            }
          }
          if (best) {
            return {
              id: best.id,
              lat: best.geometry?.coordinates?.[1] ?? carLat,
              lng: best.geometry?.coordinates?.[0] ?? carLng,
            };
          }
        }
      }
    } catch {}

    // Fallback: bbox search with larger area
    const d = CORRIDOR_RADIUS_DEG;
    const bboxUrl = `https://graph.mapillary.com/images?access_token=${accessToken}` +
      `&fields=id,compass_angle,is_pano,geometry` +
      `&bbox=${carLng - d},${carLat - d},${carLng + d},${carLat + d}` +
      `&limit=${SEARCH_LIMIT}`;

    try {
      const resp = await fetch(bboxUrl);
      if (resp.ok) {
        const data = await resp.json();
        if (data.data && data.data.length > 0) {
          let best: any = null;
          let bestScore = Infinity;
          for (const img of data.data) {
            const imgLat = img.geometry?.coordinates?.[1] ?? carLat;
            const imgLng = img.geometry?.coordinates?.[0] ?? carLng;
            const dist = haversineMeters(carLat, carLng, imgLat, imgLng);
            const hDiff = img.is_pano ? 0 : headingDiff(img.compass_angle ?? 0, carHeading);
            const score = dist + hDiff * 2;
            if (score < bestScore) {
              bestScore = score;
              best = img;
            }
          }
          if (best) {
            return {
              id: best.id,
              lat: best.geometry?.coordinates?.[1] ?? carLat,
              lng: best.geometry?.coordinates?.[0] ?? carLng,
            };
          }
        }
      }
    } catch {}

    return null;
  }, [accessToken]);

  // Fetch Google Street View static image
  const fetchGoogleStreetView = useCallback(async (svLat: number, svLng: number, svHeading: number): Promise<GoogleImg | null> => {
    if (!googleApiKey) return null;
    // Check metadata first (free, unlimited)
    const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${svLat},${svLng}&radius=50&key=${googleApiKey}`;
    try {
      const resp = await fetch(metaUrl);
      const data = await resp.json();
      if (data.status !== 'OK') return null;
      const panoLat = data.location?.lat ?? svLat;
      const panoLng = data.location?.lng ?? svLng;
      const imgUrl = `https://maps.googleapis.com/maps/api/streetview?size=${GOOGLE_IMG_SIZE}x${GOOGLE_IMG_SIZE}&location=${panoLat},${panoLng}&heading=${svHeading.toFixed(0)}&pitch=-5&fov=90&key=${googleApiKey}`;
      return { url: imgUrl, lat: panoLat, lng: panoLng };
    } catch {
      return null;
    }
  }, [googleApiKey]);

  // Initialize: try Mapillary first, fall back to Google
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const result = await findNearestImageId(lat, lng, heading);
      if (cancelled) return;

      if (result && containerRef.current) {
        // Mapillary has coverage — use WebGL viewer
        setProvider('mapillary');
        providerRef.current = 'mapillary';
        const viewer = new Viewer({
          accessToken,
          container: containerRef.current!,
          imageId: result.id,
          component: { cover: false },
        });
        viewerRef.current = viewer;
        currentImageIdRef.current = result.id;
        lastSearchLatRef.current = result.lat;
        lastSearchLngRef.current = result.lng;
        viewer.on('image', () => setLoading(false));
      } else if (googleApiKey) {
        // No Mapillary coverage — try Google
        const result = await fetchGoogleStreetView(lat, lng, heading);
        if (cancelled) return;
        if (result) {
          setProvider('google');
          const img = new Image();
          img.onload = () => {
            if (cancelled) return;
            googleLastUrlRef.current = result.url;
            setGoogleCurrent(result);
            setLoading(false);
          };
          img.onerror = () => {
            if (cancelled) return;
            setProvider('none');
            setLoading(false);
          };
          img.src = result.url;
        } else {
          setProvider('none');
          setLoading(false);
        }
      } else {
        setProvider('none');
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (viewerRef.current) {
        viewerRef.current.remove();
        viewerRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Main loop: advance street view as car moves
  // Uses refs so the RAF loop runs continuously without being cancelled on every position change
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const curLat = latRef.current;
      const curLng = lngRef.current;
      const curHeading = headingRef.current;
      const curProvider = providerRef.current;
      const moving = isMovingRef.current;

      if (moving && now - lastMoveRef.current >= MIN_MOVE_MS) {
        // Check if car has moved enough from last searched position
        const distFromLastSearch = haversineMeters(curLat, curLng, lastSearchLatRef.current, lastSearchLngRef.current);

        if (distFromLastSearch >= MIN_DIST_M || !currentImageIdRef.current) {
          lastMoveRef.current = now;

          if (curProvider === 'mapillary' && viewerRef.current) {
            (async () => {
              const result = await findNearestImageId(curLat, curLng, curHeading);
              if (!result || result.id === currentImageIdRef.current) return;
              try {
                await viewerRef.current?.moveTo(result.id);
                currentImageIdRef.current = result.id;
                lastSearchLatRef.current = result.lat;
                lastSearchLngRef.current = result.lng;
              } catch {}
            })();
          } else if (curProvider === 'google' && googleApiKey && now - googleLastFetchRef.current >= GOOGLE_FETCH_MS) {
            googleLastFetchRef.current = now;
            (async () => {
              const result = await fetchGoogleStreetView(curLat, curLng, curHeading);
              if (!result || result.url === googleLastUrlRef.current) return;
              const img = new Image();
              img.onload = () => setGoogleNext(result);
              img.src = result.url;
            })();
          }
        } else {
          // Not far enough yet — reset timer so we check again promptly
          lastMoveRef.current = now - MIN_MOVE_MS + 500;
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [findNearestImageId, fetchGoogleStreetView, googleApiKey]);

  // Google crossfade
  useEffect(() => {
    if (!googleNext) return;
    const timer = setTimeout(() => {
      googleLastUrlRef.current = googleNext.url;
      setGoogleCurrent(googleNext);
      setGoogleNext(null);
    }, 100);
    return () => clearTimeout(timer);
  }, [googleNext]);

  if (provider === 'none') {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-theme-dim">
        <div className="flex flex-col items-center gap-2 text-center px-6">
          <svg className="w-10 h-10 text-theme-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5l9-4.5 9 4.5M3 7.5v9l9 4.5 9-4.5v-9M3 7.5L12 12m0 0l9-4.5M12 12v9.5" />
          </svg>
          <p className="text-xs text-theme-muted">No street view coverage along this route</p>
          <p className="text-[10px] text-theme-muted/60">Try switching to Windshield view</p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {/* Mapillary WebGL viewer */}
      {provider === 'mapillary' && (
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      )}

      {/* Google Street View static images */}
      {provider === 'google' && googleCurrent && (
        <img
          key={googleCurrent.url}
          src={googleCurrent.url}
          alt="Street view"
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out"
          style={{ opacity: googleNext ? 0 : 1 }}
        />
      )}
      {provider === 'google' && googleNext && (
        <img
          src={googleNext.url}
          alt="Street view loading"
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out"
          style={{ opacity: 1 }}
        />
      )}

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-theme-dim z-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-theme-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-theme-muted">Loading street view…</p>
          </div>
        </div>
      )}

      {/* Attribution */}
      <div className="absolute bottom-1 right-1 pointer-events-none z-10">
        <span className="text-[8px] text-white/40">
          {provider === 'mapillary' ? '© Mapillary' : provider === 'google' ? '© Google' : ''}
        </span>
      </div>
    </div>
  );
}
