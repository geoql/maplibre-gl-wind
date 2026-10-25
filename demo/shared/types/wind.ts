/** One sample: [latitude, longitude, speed m/s, direction the wind comes FROM in degrees]. */
export type WindSample = [number, number, number, number];

export interface WindPayload {
  /** `open-meteo` = fetched within the last hour; `snapshot` = bundled fallback. */
  source: 'open-meteo' | 'snapshot';
  /** ISO-8601 UTC time of the model step the samples describe. */
  time: string;
  points: WindSample[];
}
