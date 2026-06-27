import { CITY_SKETCHES, GENERIC_SKETCH } from '@/data/citySketchData';

interface CitySketchProps {
  sketchKey: string;     // 'GENERIC' or an IATA present in CITY_SKETCHES
  className?: string;
}

export function CitySketch({ sketchKey, className }: CitySketchProps) {
  const inner = sketchKey === 'GENERIC' ? GENERIC_SKETCH : CITY_SKETCHES[sketchKey] ?? GENERIC_SKETCH;
  return (
    <svg
      viewBox="0 0 120 80"
      className={className}
      role="img"
      aria-hidden="true"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}
