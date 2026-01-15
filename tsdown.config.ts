import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist',
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  external: ['maplibre-gl'],
  noExternal: [
    '@mapbox/geojson-rewind',
    '@sakitam-gis/rbush',
    '@sakitam-gis/vis-engine',
    'wind-gl-core',
  ],
});
