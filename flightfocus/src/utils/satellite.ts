// Esri World Imagery satellite tile helpers.
// Uses the ArcGIS World_Imagery MapServer `export` endpoint to fetch a single
// image for a lat/lng bounding box, sized according to altitude. No API key.

const ESRI_EXPORT_BASE =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export';

export interface GroundTileRequest {
  lat: number;
  lng: number;
  altitude: number;
}

// Convert altitude (ft) -> half-span of the visible ground bbox in degrees.
// Higher altitude shows a larger area. Tuned for plausible perspective.
function altitudeToSpanDeg(altitude: number): number {
  const clamped = Math.max(500, Math.min(40000, altitude));
  // ~0.15deg near ground up to ~6deg at cruise.
  const t = (clamped - 500) / (40000 - 500);
  return 0.12 + t * t * 6.0;
}

// Web Mercator conversion so the exported image isn't latitudinally stretched.
function lngToMercatorX(lng: number): number {
  return (lng * 20037508.34) / 180;
}

function latToMercatorY(lat: number): number {
  const clampedLat = Math.max(-85.05, Math.min(85.05, lat));
  const rad = (clampedLat * Math.PI) / 180;
  const y = Math.log(Math.tan(Math.PI / 4 + rad / 2));
  return (y * 20037508.34) / Math.PI;
}

export function buildEsriUrl(req: GroundTileRequest, sizePx = 1024): string {
  const span = altitudeToSpanDeg(req.altitude);

  const minLng = req.lng - span;
  const maxLng = req.lng + span;
  const minLat = req.lat - span;
  const maxLat = req.lat + span;

  const xMin = lngToMercatorX(minLng);
  const xMax = lngToMercatorX(maxLng);
  const yMin = latToMercatorY(minLat);
  const yMax = latToMercatorY(maxLat);

  const bbox = `${xMin},${yMin},${xMax},${yMax}`;

  const params = new URLSearchParams({
    bbox,
    bboxSR: '3857',
    imageSR: '3857',
    size: `${sizePx},${sizePx}`,
    format: 'jpg',
    f: 'image',
    transparent: 'false',
  });

  return `${ESRI_EXPORT_BASE}?${params.toString()}`;
}

// Decide whether the ground texture should be refreshed. We avoid hammering the
// API by only refetching when the aircraft has moved enough or changed altitude
// band significantly.
export interface GroundFetchState {
  lat: number;
  lng: number;
  altitude: number;
  timestamp: number;
}

export function shouldRefetch(
  prev: GroundFetchState | null,
  next: GroundTileRequest,
  now: number
): boolean {
  if (!prev) return true;

  // Minimum time between fetches (ms).
  if (now - prev.timestamp < 4000) return false;

  const span = altitudeToSpanDeg(next.altitude);
  // Refetch once we've moved ~30% of the current view span.
  const moveThreshold = span * 0.3;
  const dLat = Math.abs(next.lat - prev.lat);
  const dLng = Math.abs(next.lng - prev.lng);
  if (dLat > moveThreshold || dLng > moveThreshold) return true;

  // Refetch when altitude band changes meaningfully (zoom level shift).
  const prevSpan = altitudeToSpanDeg(prev.altitude);
  const spanRatio = span / prevSpan;
  if (spanRatio > 1.4 || spanRatio < 0.7) return true;

  return false;
}
