import type { WindDataPoint } from 'maplibre-gl-wind';
import type { WindSample } from '#shared/types/wind';

/**
 * Open-Meteo samples → points for `generateWindTexture`.
 *
 * - Open-Meteo reports where the wind comes FROM; the layer wants where it
 *   blows TOWARD, so add 180°.
 * - Each point is repeated one world to the west and east, so interpolation
 *   near ±180° sees its neighbours across the antimeridian (no seam).
 */
export function toWindPoints(samples: WindSample[]): WindDataPoint[] {
  const points: WindDataPoint[] = [];
  for (const [lat, lon, speed, from] of samples) {
    const direction = (from + 180) % 360;
    for (const shift of [-360, 0, 360]) {
      points.push({ lat, lon: lon + shift, speed, direction });
    }
  }
  return points;
}

export interface StrongestWind {
  speed: number;
  lat: number;
  lon: number;
}

export function strongestWind(samples: WindSample[]): StrongestWind | null {
  let best: StrongestWind | null = null;
  for (const [lat, lon, speed] of samples) {
    if (!best || speed > best.speed) best = { speed, lat, lon };
  }
  return best;
}

export function formatCoordinate(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat)}°${ns} ${Math.abs(lon)}°${ew}`;
}
