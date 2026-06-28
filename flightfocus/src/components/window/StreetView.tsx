import { useEffect, useRef, useState, useCallback } from 'react';
import { Viewer } from 'mapillary-js';
import 'mapillary-js/dist/mapillary.css';

interface StreetViewProps {
  lat: number;
  lng: number;
  heading: number;
  accessToken: string;
  isMoving: boolean;
}

const FETCH_INTERVAL_MS = 3000;
const CORRIDOR_RADIUS_DEG = 0.004; // ~400m half-width
const SEARCH_LIMIT = 50;
const MIN_MOVE_MS = 1500; // min time between viewer moves

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
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const currentImageIdRef = useRef<string | null>(null);
  const lastMoveRef = useRef(0);
  const rafRef = useRef<number>(0);
  const [loading, setLoading] = useState(true);
  const [noCoverage, setNoCoverage] = useState(false);

  // Find nearest image ID via Mapillary API
  const findNearestImageId = useCallback(async (carLat: number, carLng: number, carHeading: number): Promise<string | null> => {
    // Try radius search first (most accurate)
    const radiusUrl = `https://graph.mapillary.com/images?access_token=${accessToken}` +
      `&fields=id,compass_angle,is_pano,geometry,sequence` +
      `&lat=${carLat}&lng=${carLng}&radius=50&limit=20`;

    try {
      const resp = await fetch(radiusUrl);
      if (resp.ok) {
        const data = await resp.json();
        if (data.data && data.data.length > 0) {
          // Pick best by heading match
          let best: any = null;
          let bestScore = Infinity;
          for (const img of data.data) {
            const hDiff = img.is_pano ? 0 : headingDiff(img.compass_angle ?? 0, carHeading);
            const score = hDiff;
            if (score < bestScore) {
              bestScore = score;
              best = img;
            }
          }
          if (best) return best.id;
        }
      }
    } catch {}

    // Fallback: bbox search
    const d = CORRIDOR_RADIUS_DEG;
    const bboxUrl = `https://graph.mapillary.com/images?access_token=${accessToken}` +
      `&fields=id,compass_angle,is_pano,geometry,sequence` +
      `&bbox=${carLng - d},${carLat - d},${carLng + d},${carLat + d}` +
      `&limit=${SEARCH_LIMIT}`;

    try {
      const resp = await fetch(bboxUrl);
      if (resp.ok) {
        const data = await resp.json();
        if (data.data && data.data.length > 0) {
          // Find closest by distance
          let best: any = null;
          let bestDist = Infinity;
          for (const img of data.data) {
            const imgLat = img.geometry?.coordinates?.[1] ?? carLat;
            const imgLng = img.geometry?.coordinates?.[0] ?? carLng;
            const dist = haversineMeters(carLat, carLng, imgLat, imgLng);
            const hDiff = img.is_pano ? 0 : headingDiff(img.compass_angle ?? 0, carHeading);
            const score = dist + hDiff * 3;
            if (score < bestDist) {
              bestDist = score;
              best = img;
            }
          }
          if (best) return best.id;
        }
      }
    } catch {}

    return null;
  }, [accessToken]);

  // Initialize MapillaryJS viewer
  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    (async () => {
      const imageId = await findNearestImageId(lat, lng, heading);
      if (cancelled || !imageId) {
        setNoCoverage(true);
        setLoading(false);
        return;
      }

      const viewer = new Viewer({
        accessToken,
        container: containerRef.current!,
        imageId,
        component: { cover: false },
      });

      viewerRef.current = viewer;
      currentImageIdRef.current = imageId;

      viewer.on('image', () => {
        setLoading(false);
      });
    })();

    return () => {
      cancelled = true;
      if (viewerRef.current) {
        viewerRef.current.remove();
        viewerRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Main loop: find nearest image and move viewer to it as car moves
  useEffect(() => {
    const tick = () => {
      const now = Date.now();

      if (isMoving && viewerRef.current && now - lastMoveRef.current >= MIN_MOVE_MS) {
        lastMoveRef.current = now;
        (async () => {
          const imageId = await findNearestImageId(lat, lng, heading);
          if (!imageId || imageId === currentImageIdRef.current) return;

          // Smoothly move to the new image
          try {
            await viewerRef.current?.moveTo(imageId);
            currentImageIdRef.current = imageId;
          } catch {}
        })();
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [lat, lng, heading, isMoving, findNearestImageId]);

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
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-theme-dim z-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-theme-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-theme-muted">Loading street view…</p>
          </div>
        </div>
      )}
      {/* Mapillary attribution — required by terms */}
      <div className="absolute bottom-1 right-1 pointer-events-none z-10">
        <span className="text-[8px] text-white/40">© Mapillary</span>
      </div>
    </div>
  );
}
