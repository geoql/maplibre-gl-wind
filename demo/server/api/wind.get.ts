import type { WindPayload } from '#shared/types/wind';
import snapshot from '../data/wind-snapshot.json';

/**
 * Open-Meteo updates every 15 minutes. Cache a successful fetch for an hour
 * per isolate so visitors share one upstream request. A failed fetch throws,
 * so it is never cached and the next request tries again.
 */
const cachedWind = defineCachedFunction(fetchOpenMeteoWind, {
  maxAge: 60 * 60,
  name: 'wind',
  getKey: () => 'global-15deg',
});

/** Current global 10 m wind; the bundled snapshot if Open-Meteo is unreachable. */
export default defineEventHandler(async (event): Promise<WindPayload> => {
  try {
    const wind = await cachedWind();
    setResponseHeader(event, 'Cache-Control', 'public, max-age=900');
    return wind;
  } catch (error) {
    console.error('open-meteo wind fetch failed', error);
    setResponseHeader(event, 'Cache-Control', 'no-store');
    return snapshot as WindPayload;
  }
});
