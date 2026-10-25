import type { WindPayload, WindSample } from '#shared/types/wind';

/** 15° global grid between 75°S and 75°N: 11 rows × 24 columns = 264 samples. */
export const GRID_STEP = 15;

export function gridCoordinates(): { lats: number[]; lons: number[] } {
  const lats: number[] = [];
  const lons: number[] = [];
  for (let lat = -75; lat <= 75; lat += GRID_STEP) {
    for (let lon = -180; lon < 180; lon += GRID_STEP) {
      lats.push(lat);
      lons.push(lon);
    }
  }
  return { lats, lons };
}

interface OpenMeteoCurrent {
  current?: {
    time?: string;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
  };
}

/** Current 10 m wind for every grid point, in one Open-Meteo request. */
export async function fetchOpenMeteoWind(): Promise<WindPayload> {
  const { lats, lons } = gridCoordinates();
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', lats.join(','));
  url.searchParams.set('longitude', lons.join(','));
  url.searchParams.set('current', 'wind_speed_10m,wind_direction_10m');
  url.searchParams.set('wind_speed_unit', 'ms');

  const rows = await $fetch<OpenMeteoCurrent[]>(url.toString(), {
    timeout: 8000,
    retry: 1,
  });
  if (!Array.isArray(rows) || rows.length !== lats.length) {
    throw new Error(`Open-Meteo returned ${rows?.length ?? 0} rows`);
  }

  const points: WindSample[] = rows.map((row, i) => [
    lats[i]!,
    lons[i]!,
    row.current?.wind_speed_10m ?? 0,
    row.current?.wind_direction_10m ?? 0,
  ]);
  const time = rows[0]?.current?.time;
  return {
    source: 'open-meteo',
    time: time ? `${time}Z` : new Date().toISOString(),
    points,
  };
}
