import { useEffect, useRef, useState, useCallback } from 'react';

interface StreetViewProps {
  lat: number;
  lng: number;
  heading: number;
  accessToken: string;
  isMoving: boolean;
}

interface CachedImage {
  id: string;
  url: string;
  lat: number;
  lng: number;
  compassAngle: number;
  isPano: boolean;
  distance: number; // distance from car position when fetched
}

const FETCH_BATCH_INTERVAL_MS = 4000; // re-fetch corridor every 4s
const MIN_IMAGE_SWAP_MS = 800; // min time between image swaps
const CORRIDOR_RADIUS_DEG = 0.005; // ~500m half-width bbox
const SEARCH_LIMIT = 50; // grab more images per batch
const HEADING_TOLERANCE = 90; // relaxed — accept more images
const NEARBY_THRESHOLD_M = 80; // show image when car is within this distance

// Haversine distance in meters
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

export function StreetView({ lat, lng, heading, accessToken, isMoving }: StreetViewProps) {
  const [current, setCurrent] = useState<CachedImage | null>(null);
  const [next, setNext] = useState<CachedImage | null>(null);
  const [loading, setLoading] = useState(true);
  const [noCoverage, setNoCoverage] = useState(false);
  const 
    cacheRef = useRef<CachedImage[]>([]),
    lastBatchFetchRef = useRef(0),
    lastSwapRef = useRef(0),
    rafRef = useRef<number>(0),
    lastCarPosRef = useRef({ lat, lng }),
    shownIdsRef = useRef<Set<string>>(new Set());

  // Fetch a batch of images in a bounding box corridor ahead of the car
  const fetchCorridor = useCallback(async (carLat: number, carLng: number, carHeading: number): Promise<CachedImage[]> => {
    // Build a bounding box centered on the car, extended ahead in the direction of travel
    const headingRad = carHeading * Math.PI / 180;
    const aheadDist = CORRIDOR_RADIUS_DEG * 1.5;
    const sideDist = CORRIDOR_RADIUS_DEG;

    // Approximate offsets (good enough for small distances)
    const latOffset = aheadDist * Math.cos(headingRad);
    const lngOffset = aheadDist * Math.sin(headingRad) / Math.cos(carLat * Math.PI / 180);

    const centerLat = carLat + latOffset;
    const centerLng = carLng + lngOffset;

    const minLat = Math.min(carLat, centerLat) - sideDist;
    const maxLat = Math.max(carLat, centerLat) + sideDist;
    const minLng = Math.min(carLng, centerLng) - sideDist;
    const maxLng = Math.max(carLng, centerLng) + sideDist;

    const url = `https://graph.mapillary.com/images?access_token=${accessToken}` +
      `&fields=id,compass_angle,thumb_2048_url,thumb_1024_url,is_pano,geometry` +
      `&bbox=${minLng},${minLat},${maxLng},${maxLat}` +
      `&limit=${SEARCH_LIMIT}`;

    try {
      const resp = await fetch(url);
      if (!resp.ok) return [];
      const data = await resp.json();
      if (!data.data || data.data.length === 0) return [];

      return data.data
        .filter((img: any) => img.thumb_2048_url || img.thumb_1024_url)
        .map((img: any) => ({
          id: img.id,
          url: img.thumb_2048_url || img.thumb_1024_url,
          lat: img.geometry?.coordinates?.[1] ?? carLat,
          lng: img.geometry?.coordinates?.[0] ?? carLng,
          compassAngle: img.compass_angle ?? 0,
          isPano: img.is_pano ?? false,
          distance: haversineMeters(carLat, carLng, img.geometry?.coordinates?.[1] ?? carLat, img.geometry?.coordinates?.[0] ?? carLng),
        }))
        .sort((a: CachedImage, b: CachedImage) => {
          // Sort by distance from car, but prefer images facing the right direction
          const aScore = a.distance + (a.isPano ? 0 : headingDiff(a.compassAngle, carHeading) * 2);
          const bScore = b.distance + (b.isPano ? 0 : headingDiff(b.compassAngle, carHeading) * 2);
          return aScore - bScore;
        });
    } catch {
      return [];
    }
  }, [accessToken]);

  // Pick the best image from cache for the current car position
  const pickBestFromCache = useCallback((carLat: number, carLng: number, carHeading: number): CachedImage | null => {
    const cache = cacheRef.current;
    if (cache.length === 0) return null;

    let best: CachedImage | null = null;
    let bestScore = Infinity;

    for (const img of cache) {
      if (shownIdsRef.current.has(img.id)) continue;

      const dist = haversineMeters(carLat, carLng, img.lat, img.lng);
      // Only consider images within a reasonable distance
      if (dist > 300) continue;

      const hDiff = img.isPano ? 0 : headingDiff(img.compassAngle, carHeading);
      // Score: prefer closer images and ones facing the right direction
      const score = dist + hDiff * 3;

      if (score < bestScore) {
        bestScore = score;
        best = img;
      }
    }

    // If all images in cache have been shown, reset and pick the closest
    if (!best && cache.length > 0) {
      shownIdsRef.current.clear();
      best = cache[0];
    }

    return best;
  }, []);

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const images = await fetchCorridor(lat, lng, heading);
      if (cancelled) return;
      if (images.length > 0) {
        cacheRef.current = images;
        const best = images[0];
        shownIdsRef.current.add(best.id);
        const img = new Image();
        img.onload = () => {
          if (cancelled) return;
          setCurrent(best);
          setLoading(false);
        };
        img.onerror = () => {
          if (cancelled) return;
          setNoCoverage(true);
          setLoading(false);
        };
        img.src = best.url;
      } else {
        setNoCoverage(true);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Main loop: fetch corridors + advance through cached images
  useEffect(() => {
    const tick = () => {
      const now = Date.now();

      // Re-fetch corridor if cache is running low or enough time has passed
      if (isMoving && now - lastBatchFetchRef.current >= FETCH_BATCH_INTERVAL_MS) {
        lastBatchFetchRef.current = now;
        (async () => {
          const images = await fetchCorridor(lat, lng, heading);
          if (images.length > 0) {
            // Merge new images into cache, avoiding duplicates
            const existingIds = new Set(cacheRef.current.map(i => i.id));
            const newOnes = images.filter(i => !existingIds.has(i.id));
            cacheRef.current = [...cacheRef.current, ...newOnes].slice(0, 100);
          }
        })();
      }

      // Check if we should advance to the next image
      if (isMoving && !next && now - lastSwapRef.current >= MIN_IMAGE_SWAP_MS) {
        const best = pickBestFromCache(lat, lng, heading);
        if (best && best.id !== current?.id) {
          lastSwapRef.current = now;
          shownIdsRef.current.add(best.id);
          const img = new Image();
          img.onload = () => {
            setNext(best);
          };
          img.src = best.url;
        }
      }

      // If not moving and no image, try to show one
      if (!isMoving && !current && cacheRef.current.length > 0) {
        const best = cacheRef.current[0];
        shownIdsRef.current.add(best.id);
        const img = new Image();
        img.onload = () => setCurrent(best);
        img.src = best.url;
      }

      lastCarPosRef.current = { lat, lng };
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [lat, lng, heading, isMoving, current, next, fetchCorridor, pickBestFromCache]);

  // Crossfade: when next image is preloaded, swap it in
  useEffect(() => {
    if (!next) return;
    const timer = setTimeout(() => {
      setCurrent(next);
      setNext(null);
    }, 100);
    return () => clearTimeout(timer);
  }, [next]);

  if (loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-theme-dim">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-theme-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-theme-muted">Loading street view…</p>
        </div>
      </div>
    );
  }

  if (noCoverage) {
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
      {current && (
        <img
          key={current.id}
          src={current.url}
          alt="Street view"
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out"
          style={{ opacity: next ? 0 : 1 }}
        />
      )}
      {next && (
        <img
          src={next.url}
          alt="Street view loading"
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out"
          style={{ opacity: 1 }}
        />
      )}
      {/* Subtle motion blur overlay when moving fast */}
      {isMoving && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.15) 100%)',
          }}
        />
      )}
      {/* Mapillary attribution — required by terms */}
      <div className="absolute bottom-1 right-1 pointer-events-none z-10">
        <span className="text-[8px] text-white/40">© Mapillary</span>
      </div>
    </div>
  );
}
