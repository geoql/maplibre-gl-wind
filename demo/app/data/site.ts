export const SITE = {
  name: 'maplibre-gl-wind',
  url: 'https://maplibre-gl-wind.geoql.in',
  title: 'maplibre-gl-wind — GPU wind particles for deck.gl and MapLibre',
  description:
    'Live demo of maplibre-gl-wind: animated wind particles on a MapLibre map, drawn by the GPU with deck.gl transform feedback, fed by current Open-Meteo wind.',
  github: 'https://github.com/geoql/maplibre-gl-wind',
  npm: 'https://www.npmjs.com/package/maplibre-gl-wind',
  jsr: 'https://jsr.io/@geoql/maplibre-gl-wind',
  geoql: 'https://geoql.in',
  openMeteo: 'https://open-meteo.com/',
} as const;

export const INSTALL = {
  npm: 'npm install maplibre-gl-wind @deck.gl/core @deck.gl/layers @deck.gl/mapbox',
  pnpm: 'pnpm add maplibre-gl-wind @deck.gl/core @deck.gl/layers @deck.gl/mapbox',
  jsr: 'pnpm dlx jsr add @geoql/maplibre-gl-wind',
} as const;

export type InstallManager = keyof typeof INSTALL;
