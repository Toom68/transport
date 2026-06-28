import { useEffect, useRef, useState, useCallback } from 'react';

interface StreetViewProps {
  lat: number;
  lng: number;
  heading: number;
  accessToken: string;
  isMoving: boolean;
}

interface SVImage {
  url: string;
  id: string;
  compassAngle: number;
}

const FETCH_INTERVAL_MS = 2500;
const RADIUS_M = 50;
const SEARCH_LIMIT = 10;
const HEADING_TOLERANCE = 60;

export function StreetView({ lat, lng, heading, accessToken, isMoving }: StreetViewProps) {
  const [current, setCurrent] = useState<SVImage | null>(null);
  const [next, setNext] = useState<SVImage | null>(null);
  const [loading, setLoading] = useState(true);
  const [noCoverage, setNoCoverage] = useState(false);
  const lastFetchRef = useRef(0);
  const rafRef = useRef<number>(0);
  const lastImageIdRef = useRef<string | null>(null);

  const fetchNearestImage = useCallback(async (svLat: number, svLng: number, svHeading: number): Promise<SVImage | null> => {
    const url = `https://graph.mapillary.com/images?access_token=${accessToken}` +
      `&fields=id,compass_angle,thumb_2048_url,thumb_1024_url,is_pano` +
      `&lat=${svLat}&lng=${svLng}&radius=${RADIUS_M}&limit=${SEARCH_LIMIT}`;

    try {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const data = await resp.json();
      if (!data.data || data.data.length === 0) return null;

      // Score each image: prefer ones facing the same direction as our heading,
      // and prefer 360 panoramas (they work from any angle)
      let best: typeof data.data[0] | null = null;
      let bestScore = Infinity;

      for (const img of data.data) {
        if (!img.thumb_2048_url && !img.thumb_1024_url) continue;

        let headingDiff: number;
        if (img.is_pano) {
          headingDiff = 0;
        } else {
          headingDiff = Math.abs(((img.compass_angle - svHeading + 540) % 360) - 180);
        }

        if (!img.is_pano && headingDiff > HEADING_TOLERANCE) continue;
        if (img.id === lastImageIdRef.current) continue;

        if (headingDiff < bestScore) {
          bestScore = headingDiff;
          best = img;
        }
      }

      if (!best) {
        for (const img of data.data) {
          if (img.id === lastImageIdRef.current) continue;
          if (img.thumb_2048_url || img.thumb_1024_url) {
            best = img;
            break;
          }
        }
      }

      if (!best) return null;

      return {
        id: best.id,
        url: best.thumb_2048_url || best.thumb_1024_url,
        compassAngle: best.compass_angle ?? 0,
      };
    } catch {
      return null;
    }
  }, [accessToken]);

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetchNearestImage(lat, lng, heading);
      if (cancelled) return;
      if (result) {
        lastImageIdRef.current = result.id;
        const img = new Image();
        img.onload = () => {
          if (cancelled) return;
          setCurrent(result);
          setLoading(false);
        };
        img.onerror = () => {
          if (cancelled) return;
          setNoCoverage(true);
          setLoading(false);
        };
        img.src = result.url;
      } else {
        setNoCoverage(true);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic fetch for new images as the car moves
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      if (now - lastFetchRef.current >= FETCH_INTERVAL_MS && isMoving) {
        lastFetchRef.current = now;
        (async () => {
          const result = await fetchNearestImage(lat, lng, heading);
          if (!result) return;
          const img = new Image();
          img.onload = () => {
            setNext(result);
          };
          img.src = result.url;
        })();
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [lat, lng, heading, isMoving, fetchNearestImage]);

  // Crossfade: when next image is preloaded, swap it in
  useEffect(() => {
    if (!next) return;
    const timer = setTimeout(() => {
      lastImageIdRef.current = next.id;
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
          <p className="text-xs text-theme-muted">No street view coverage at this location</p>
          <p className="text-[10px] text-theme-muted/60">Try switching to Windshield view</p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {current && (
        <img
          key={current.url}
          src={current.url}
          alt="Street view"
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out"
          style={{ opacity: next ? 0 : 1 }}
        />
      )}
      {next && (
        <img
          src={next.url}
          alt="Street view loading"
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out"
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
