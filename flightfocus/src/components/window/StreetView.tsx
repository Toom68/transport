import { useEffect, useRef, useState, useCallback } from 'react';
import { Viewer } from 'mapillary-js';
import 'mapillary-js/dist/mapillary.css';
import type { RoutePoint } from '@/types/journey';

interface StreetViewProps {
  lat: number;
  lng: number;
  heading: number;
  accessToken: string;
  googleApiKey?: string;
  isMoving: boolean;
  routePoints: RoutePoint[];
}

const MIN_MOVE_MS = 2000;
const MIN_DIST_M = 30;
const GOOGLE_FETCH_MS = 3000;
const GOOGLE_IMG_SIZE = 640;
const MAX_MAPILLARY_DIST_M = 100;
const SEARCH_RADII = [15, 30, 50];
const MAX_CROSS_TRACK_M = 15;
const STICKY_SEQUENCE_END_M = 50; // how far past last image before switching sequences
const STICKY_SEQUENCE_MAX_GAP_M = 200; // max gap before abandoning current sequence
const BEARING_MATCH_DEG = 90; // image compass_angle must be within this of route bearing
const COVERAGE_CHECK_MS = 1000; // how often to poll for Mapillary coverage
const GOOGLE_COVERAGE_CHECK_MS = 5000; // less frequent Google checks to limit API costs

// Decompose distance into along-track (forward/back) and cross-track (left/right) relative to heading
function crossTrackDistance(carLat: number, carLng: number, imgLat: number, imgLng: number, headingDeg: number): { along: number; cross: number; total: number } {
  const latM = 111320;
  const lngM = 111320 * Math.cos(carLat * Math.PI / 180);
  const dx = (imgLng - carLng) * lngM;
  const dy = (imgLat - carLat) * latM;
  const h = headingDeg * Math.PI / 180;
  const along = dx * Math.sin(h) + dy * Math.cos(h);
  const cross = dx * Math.cos(h) - dy * Math.sin(h);
  return { along, cross: Math.abs(cross), total: Math.sqrt(dx * dx + dy * dy) };
}

type Provider = 'mapillary' | 'google' | 'none';

interface GoogleImg {
  url: string;
  lat: number;
  lng: number;
}

interface SeqImage {
  id: string;
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

function headingDiff(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

// Find the nearest route segment to the car's position.
// Returns the segment's bearing and cross-track distance for filtering.
function findNearestRouteSegment(
  carLat: number,
  carLng: number,
  points: RoutePoint[]
): { bearing: number; crossTrack: number; index: number } | null {
  if (points.length < 2) return null;

  let bestIndex = 0;
  let bestCross = Infinity;
  let bestBearing = points[0].bearing;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    // Use the segment's midpoint bearing
    const segBearing = p1.bearing;
    const track = crossTrackDistance(carLat, carLng, (p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2, segBearing);
    if (track.cross < bestCross) {
      bestCross = track.cross;
      bestIndex = i;
      bestBearing = segBearing;
    }
  }

  return { bearing: bestBearing, crossTrack: bestCross, index: bestIndex };
}

export function StreetView({ lat, lng, heading, accessToken, googleApiKey, isMoving, routePoints }: StreetViewProps) {
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
  const routePointsRef = useRef<RoutePoint[]>(routePoints);

  // Sequence state
  const currentSequenceIdRef = useRef<string | null>(null);
  const sequenceImagesRef = useRef<SeqImage[]>([]);
  const sequenceIndexRef = useRef(0);

  // Google fallback state
  const [googleCurrent, setGoogleCurrent] = useState<GoogleImg | null>(null);
  const [googleNext, setGoogleNext] = useState<GoogleImg | null>(null);
  const googleLastFetchRef = useRef(0);
  const googleLastUrlRef = useRef<string | null>(null);
  const lastCoverageCheckRef = useRef(0);
  const lastGoogleCheckRef = useRef(0);
  const coverageCheckInProgressRef = useRef(false);

  // Sync refs every render
  latRef.current = lat;
  lngRef.current = lng;
  headingRef.current = heading;
  isMovingRef.current = isMoving;
  providerRef.current = provider;
  routePointsRef.current = routePoints;

  // Find the best Mapillary sequence near the car's position.
  // Uses route segment bearing for cross-track filtering and direction matching.
  const findBestSequence = useCallback(async (
    carLat: number,
    carLng: number,
  ): Promise<{ sequenceId: string; firstImageId: string; firstImageLat: number; firstImageLng: number } | null> => {
    const segment = findNearestRouteSegment(carLat, carLng, routePointsRef.current);
    const routeBearing = segment?.bearing ?? heading;

    for (const radius of SEARCH_RADII) {
      const url = `https://graph.mapillary.com/images?access_token=${accessToken}` +
        `&fields=id,compass_angle,is_pano,geometry,sequence` +
        `&lat=${carLat}&lng=${carLng}&radius=${radius}&limit=50`;

      try {
        const resp = await fetch(url);
        if (resp.ok) {
          const data = await resp.json();
          if (data.data && data.data.length > 0) {
            // Filter: on-road (cross-track) + direction match (compass_angle vs route bearing)
            const onRoadSameDir: Array<{ img: any; track: { along: number; cross: number; total: number } }> = [];
            for (const img of data.data) {
              const imgLat = img.geometry?.coordinates?.[1] ?? carLat;
              const imgLng = img.geometry?.coordinates?.[0] ?? carLng;
              const track = crossTrackDistance(carLat, carLng, imgLat, imgLng, routeBearing);
              if (track.cross > MAX_CROSS_TRACK_M) continue;
              const hDiff = img.is_pano ? 0 : headingDiff(img.compass_angle ?? 0, routeBearing);
              if (hDiff > BEARING_MATCH_DEG) continue;
              onRoadSameDir.push({ img, track });
            }

            if (onRoadSameDir.length === 0) continue;

            // Group by sequence ID, count images per sequence
            const seqCounts = new Map<string, number>();
            const seqFirstImg = new Map<string, { img: any; track: { along: number; cross: number; total: number } }>();
            for (const entry of onRoadSameDir) {
              const seqId = entry.img.sequence;
              if (!seqId) continue;
              seqCounts.set(seqId, (seqCounts.get(seqId) ?? 0) + 1);
              // Keep the closest image as the first to show
              if (!seqFirstImg.has(seqId) || entry.track.total < seqFirstImg.get(seqId)!.track.total) {
                seqFirstImg.set(seqId, entry);
              }
            }

            // Pick the sequence with the most images near the car (best coverage ahead)
            let bestSeqId: string | null = null;
            let bestCount = 0;
            for (const [seqId, count] of seqCounts) {
              if (count > bestCount) {
                bestCount = count;
                bestSeqId = seqId;
              }
            }

            if (bestSeqId && seqFirstImg.has(bestSeqId)) {
              const first = seqFirstImg.get(bestSeqId)!;
              return {
                sequenceId: bestSeqId,
                firstImageId: first.img.id,
                firstImageLat: first.img.geometry?.coordinates?.[1] ?? carLat,
                firstImageLng: first.img.geometry?.coordinates?.[0] ?? carLng,
              };
            }
          }
        }
      } catch {}
    }

    return null;
  }, [accessToken, heading]);

  // Preload all image IDs in a sequence from Mapillary API
  const preloadSequence = useCallback(async (sequenceId: string): Promise<SeqImage[]> => {
    const url = `https://graph.mapillary.com/image_ids?access_token=${accessToken}&sequence_id=${sequenceId}`;
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        if (data.data && Array.isArray(data.data)) {
          return data.data.map((item: any) => ({
            id: item.id,
            lat: item.geometry?.coordinates?.[1] ?? 0,
            lng: item.geometry?.coordinates?.[0] ?? 0,
          }));
        }
      }
    } catch {}
    return [];
  }, [accessToken]);

  // Find the starting index in a sequence: the last image at or behind the car's position.
  // Uses along-track distance relative to route bearing — images ahead of the car are skipped.
  const findStartIndexForPosition = useCallback((
    carLat: number,
    carLng: number,
    images: SeqImage[],
  ): number => {
    if (images.length === 0) return 0;
    const segment = findNearestRouteSegment(carLat, carLng, routePointsRef.current);
    const routeBearing = segment?.bearing ?? heading;

    let bestIdx = 0;
    for (let i = 0; i < images.length; i++) {
      const track = crossTrackDistance(carLat, carLng, images[i].lat, images[i].lng, routeBearing);
      // along <= 0 means image is at or behind the car — pick the last such image
      if (track.along <= 0) {
        bestIdx = i;
      }
    }
    return bestIdx;
  }, [heading]);

  // Check if the car has reached or passed the next image in the sequence.
  // Only returns true when along-track distance to next image <= 0 (car is at/past it).
  const shouldAdvanceToNext = useCallback((
    carLat: number,
    carLng: number,
    images: SeqImage[],
    currentIndex: number,
  ): boolean => {
    if (images.length === 0) return false;
    if (currentIndex >= images.length - 1) return false; // no next image
    const nextImg = images[currentIndex + 1];
    const segment = findNearestRouteSegment(carLat, carLng, routePointsRef.current);
    const routeBearing = segment?.bearing ?? heading;
    const track = crossTrackDistance(carLat, carLng, nextImg.lat, nextImg.lng, routeBearing);
    // along <= 0 means car has reached or passed the next image
    return track.along <= 0;
  }, [heading]);

  // Check if the car has moved past the end of the current sequence
  const isSequenceExhausted = useCallback((
    carLat: number,
    carLng: number,
    images: SeqImage[],
    currentIndex: number
  ): boolean => {
    if (images.length === 0) return true;
    const lastImg = images[images.length - 1];
    const segment = findNearestRouteSegment(carLat, carLng, routePointsRef.current);
    const routeBearing = segment?.bearing ?? heading;
    // Along-track to last image: if car is well past it, sequence is exhausted
    const trackToEnd = crossTrackDistance(carLat, carLng, lastImg.lat, lastImg.lng, routeBearing);
    // If car is more than STICKY_SEQUENCE_END_M ahead of the last image
    if (trackToEnd.along < -STICKY_SEQUENCE_END_M) return true;
    // If nearest image in sequence is too far (gap in coverage)
    const currentImg = images[currentIndex];
    const distToCurrent = haversineMeters(carLat, carLng, currentImg.lat, currentImg.lng);
    if (distToCurrent > STICKY_SEQUENCE_MAX_GAP_M) return true;
    return false;
  }, [heading]);

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

  // Initialize Mapillary viewer from the best sequence near a position.
  // Returns true if successfully initialized, false if no coverage.
  // Container is always mounted (hidden when not active) so containerRef is available.
  const initMapillaryViewer = useCallback(async (
    carLat: number,
    carLng: number,
  ): Promise<boolean> => {
    if (!containerRef.current) return false;

    const seqResult = await findBestSequence(carLat, carLng);
    if (!seqResult || !containerRef.current) return false;

    const images = await preloadSequence(seqResult.sequenceId);
    if (images.length === 0 || !containerRef.current) return false;

    // Clean up any existing viewer
    if (viewerRef.current) {
      viewerRef.current.remove();
      viewerRef.current = null;
    }

    setProvider('mapillary');
    providerRef.current = 'mapillary';
    currentSequenceIdRef.current = seqResult.sequenceId;
    sequenceImagesRef.current = images;
    const startIndex = findStartIndexForPosition(carLat, carLng, images);
    const startId = images[startIndex]?.id ?? seqResult.firstImageId;
    sequenceIndexRef.current = startIndex;
    const viewer = new Viewer({
      accessToken,
      container: containerRef.current,
      imageId: startId,
      component: { cover: false },
    });
    viewerRef.current = viewer;
    currentImageIdRef.current = startId;
    lastSearchLatRef.current = images[startIndex]?.lat ?? carLat;
    lastSearchLngRef.current = images[startIndex]?.lng ?? carLng;
    viewer.on('image', () => setLoading(false));
    return true;
  }, [accessToken, findBestSequence, preloadSequence, findStartIndexForPosition]);

  // Initialize: find best Mapillary sequence, preload it, fall back to Google
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Try to find a Mapillary sequence on this road
      const seqResult = await findBestSequence(lat, lng);
      if (cancelled) return;

      if (seqResult && containerRef.current) {
        // Found a sequence — preload all its images
        const images = await preloadSequence(seqResult.sequenceId);
        if (cancelled) return;

        if (images.length > 0 && containerRef.current) {
          setProvider('mapillary');
          providerRef.current = 'mapillary';
          currentSequenceIdRef.current = seqResult.sequenceId;
          sequenceImagesRef.current = images;

          // Find the last image at or behind the car's starting position
          const startIndex = findStartIndexForPosition(lat, lng, images);
          const startImage = images[startIndex];
          const startImageId = startImage?.id ?? seqResult.firstImageId;
          sequenceIndexRef.current = startIndex;

          const viewer = new Viewer({
            accessToken,
            container: containerRef.current!,
            imageId: startImageId,
            component: { cover: false },
          });
          viewerRef.current = viewer;
          currentImageIdRef.current = startImageId;
          lastSearchLatRef.current = startImage?.lat ?? lat;
          lastSearchLngRef.current = startImage?.lng ?? lng;
          viewer.on('image', () => setLoading(false));
        } else if (googleApiKey) {
          // Sequence preload failed — try Google
          await initGoogle(lat, lng, heading, cancelled);
        } else {
          setProvider('none');
          setLoading(false);
        }
      } else if (googleApiKey) {
        // No Mapillary sequence found — try Google
        await initGoogle(lat, lng, heading, cancelled);
      } else {
        setProvider('none');
        setLoading(false);
      }
    })();

    async function initGoogle(gLat: number, gLng: number, gHeading: number, isCancelled: boolean) {
      const gResult = await fetchGoogleStreetView(gLat, gLng, gHeading);
      if (isCancelled) return;
      if (gResult) {
        setProvider('google');
        providerRef.current = 'google';
        const img = new Image();
        img.onload = () => {
          if (isCancelled) return;
          googleLastUrlRef.current = gResult.url;
          setGoogleCurrent(gResult);
          setLoading(false);
        };
        img.onerror = () => {
          if (isCancelled) return;
          setProvider('none');
          setLoading(false);
        };
        img.src = gResult.url;
      } else {
        setProvider('none');
        setLoading(false);
      }
    }

    return () => {
      cancelled = true;
      if (viewerRef.current) {
        viewerRef.current.remove();
        viewerRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Main loop: advance through preloaded sequence as car moves
  // Coverage check: polls for Mapillary every second regardless of movement
  // Google is strictly secondary — only used when Mapillary has no coverage
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const curLat = latRef.current;
      const curLng = lngRef.current;
      const curHeading = headingRef.current;
      const curProvider = providerRef.current;
      const moving = isMovingRef.current;

      // Coverage check — every ~1s, regardless of movement
      // When 'none': try Mapillary first, then Google as secondary fallback
      // When 'google': check if Mapillary coverage returned to switch back
      if (now - lastCoverageCheckRef.current >= COVERAGE_CHECK_MS && !coverageCheckInProgressRef.current) {
        lastCoverageCheckRef.current = now;

        if (curProvider === 'none') {
          coverageCheckInProgressRef.current = true;
          (async () => {
            // Try Mapillary first (primary provider)
            const switched = await initMapillaryViewer(curLat, curLng);
            coverageCheckInProgressRef.current = false;
            if (switched) return;

            // No Mapillary — try Google as secondary fallback (less frequently to limit API costs)
            if (googleApiKey && now - lastGoogleCheckRef.current >= GOOGLE_COVERAGE_CHECK_MS) {
              lastGoogleCheckRef.current = now;
              const gResult = await fetchGoogleStreetView(curLat, curLng, curHeading);
              if (gResult) {
                setProvider('google');
                providerRef.current = 'google';
                googleLastUrlRef.current = gResult.url;
                setGoogleCurrent(gResult);
                setLoading(false);
              }
            }
          })();
        } else if (curProvider === 'google') {
          coverageCheckInProgressRef.current = true;
          (async () => {
            // Check if Mapillary coverage has returned (switch back to primary)
            const switched = await initMapillaryViewer(curLat, curLng);
            coverageCheckInProgressRef.current = false;
            if (switched) {
              googleLastUrlRef.current = null;
              setGoogleCurrent(null);
              setGoogleNext(null);
            }
          })();
        }
      }

      // Movement-based logic: advance through sequences/images
      if (moving && now - lastMoveRef.current >= MIN_MOVE_MS) {
        const distFromLastSearch = haversineMeters(curLat, curLng, lastSearchLatRef.current, lastSearchLngRef.current);

        if (distFromLastSearch >= MIN_DIST_M || !currentImageIdRef.current) {
          lastMoveRef.current = now;

          if (curProvider === 'mapillary' && viewerRef.current) {
            (async () => {
              const images = sequenceImagesRef.current;

              // Check if current sequence is exhausted
              if (isSequenceExhausted(curLat, curLng, images, sequenceIndexRef.current)) {
                // Find a new sequence
                const newSeq = await findBestSequence(curLat, curLng);
                if (newSeq) {
                  const newImages = await preloadSequence(newSeq.sequenceId);
                  if (newImages.length > 0) {
                    currentSequenceIdRef.current = newSeq.sequenceId;
                    sequenceImagesRef.current = newImages;
                    const startIndex = findStartIndexForPosition(curLat, curLng, newImages);
                    const newId = newImages[startIndex]?.id ?? newSeq.firstImageId;
                    sequenceIndexRef.current = startIndex;
                    if (newId !== currentImageIdRef.current) {
                      try {
                        await viewerRef.current?.moveTo(newId);
                        currentImageIdRef.current = newId;
                        lastSearchLatRef.current = newImages[startIndex]?.lat ?? curLat;
                        lastSearchLngRef.current = newImages[startIndex]?.lng ?? curLng;
                      } catch {}
                    }
                    return;
                  }
                }

                // No new sequence found — try Google
                if (googleApiKey) {
                  const gResult = await fetchGoogleStreetView(curLat, curLng, curHeading);
                  if (gResult) {
                    viewerRef.current?.remove();
                    viewerRef.current = null;
                    currentImageIdRef.current = null;
                    currentSequenceIdRef.current = null;
                    sequenceImagesRef.current = [];
                    setProvider('google');
                    providerRef.current = 'google';
                    googleLastUrlRef.current = gResult.url;
                    setGoogleCurrent(gResult);
                    lastSearchLatRef.current = curLat;
                    lastSearchLngRef.current = curLng;
                    return;
                  }
                }
                return; // stay on last Mapillary image
              }

              // Sequence not exhausted — check if car has reached the next image
              if (shouldAdvanceToNext(curLat, curLng, images, sequenceIndexRef.current)) {
                const nextIndex = sequenceIndexRef.current + 1;
                const nextImg = images[nextIndex];
                sequenceIndexRef.current = nextIndex;
                try {
                  await viewerRef.current?.moveTo(nextImg.id);
                  currentImageIdRef.current = nextImg.id;
                  lastSearchLatRef.current = nextImg.lat;
                  lastSearchLngRef.current = nextImg.lng;
                } catch {}
              }
            })();
          } else if (curProvider === 'google' && googleApiKey && now - googleLastFetchRef.current >= GOOGLE_FETCH_MS) {
            googleLastFetchRef.current = now;
            (async () => {
              // Fetch next Google image (Mapillary coverage check is handled above)
              const gResult = await fetchGoogleStreetView(curLat, curLng, curHeading);
              if (!gResult || gResult.url === googleLastUrlRef.current) return;
              const img = new Image();
              img.onload = () => setGoogleNext(gResult);
              img.src = gResult.url;
            })();
          }
        } else {
          lastMoveRef.current = now - MIN_MOVE_MS + 500;
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [findBestSequence, preloadSequence, findStartIndexForPosition, shouldAdvanceToNext, isSequenceExhausted, fetchGoogleStreetView, initMapillaryViewer, googleApiKey, accessToken]);

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

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {/* Mapillary WebGL viewer — always mounted so containerRef is available for provider switches */}
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
        style={{ display: provider === 'mapillary' ? 'block' : 'none' }}
      />

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

      {provider === 'none' && (
        <div className="absolute inset-0 flex items-center justify-center bg-theme-dim">
          <div className="flex flex-col items-center gap-2 text-center px-6">
            <svg className="w-10 h-10 text-theme-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5l9-4.5 9 4.5M3 7.5v9l9 4.5 9-4.5v-9M3 7.5L12 12m0 0l9-4.5M12 12v9.5" />
            </svg>
            <p className="text-xs text-theme-muted">No street view coverage along this route</p>
            <p className="text-[10px] text-theme-muted/60">Try switching to Windshield view</p>
          </div>
        </div>
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
