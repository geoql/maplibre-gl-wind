# MapLibre GL Wind

[![CI](https://img.shields.io/github/actions/workflow/status/geoql/maplibre-gl-wind/ci.yml?branch=main&logo=github-actions&logoColor=white)](https://github.com/geoql/maplibre-gl-wind/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/maplibre-gl-wind?logo=npm)](https://www.npmjs.com/package/maplibre-gl-wind)
[![JSR](https://jsr.io/badges/@geoql/maplibre-gl-wind)](https://jsr.io/@geoql/maplibre-gl-wind)
[![npm](https://img.shields.io/npm/dm/maplibre-gl-wind?logo=npm)](http://npm-stat.com/charts.html?package=maplibre-gl-wind)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/maplibre-gl-wind)](https://bundlephobia.com/package/maplibre-gl-wind)

[![oxlint](https://img.shields.io/badge/linter-oxlint-7c5dfa?logo=oxc)](https://oxc.rs)
[![prettier](https://img.shields.io/badge/formatter-prettier-f7b93e?logo=prettier)](https://prettier.io/)
[![tsdown](https://img.shields.io/badge/bundler-tsdown-3178c6)](https://tsdown.dev/)
[![typescript](https://img.shields.io/npm/dependency-version/maplibre-gl-wind/dev/typescript?logo=TypeScript)](https://www.typescriptlang.org/)

---

A high-performance wind particle visualization layer for deck.gl. Renders animated wind flow particles with speed-based coloring using GPU transform feedback.

Based on [Az's deck.gl 9.x particle layer implementation](https://az.id.au/dev/wind-particle-layer-in-deckgl-9.x/).

## Features

- GPU-accelerated particle animation using transform feedback
- Speed-based color ramps (Windy.com style)
- Configurable particle count, speed, and lifetime
- IDW interpolation for wind data points
- Works with deck.gl 9.x and MapLibre GL JS

## Installation

```bash
# npm
npm install maplibre-gl-wind @deck.gl/core @deck.gl/layers

# bun
bun add maplibre-gl-wind @deck.gl/core @deck.gl/layers

# JSR
bunx jsr add @geoql/maplibre-gl-wind
```

## Usage

### With Wind Texture Image

```typescript
import { Deck } from '@deck.gl/core';
import { WindParticleLayer } from 'maplibre-gl-wind';

const deck = new Deck({
  initialViewState: {
    longitude: 0,
    latitude: 20,
    zoom: 2,
  },
  controller: true,
  layers: [
    new WindParticleLayer({
      id: 'wind',
      image: 'path/to/wind-texture.png',
      bounds: [-180, -90, 180, 90],
      imageUnscale: [-50, 50],
      numParticles: 8192,
      maxAge: 50,
      speedFactor: 50,
      colorRamp: [
        [0.0, [59, 130, 189, 255]],
        [0.5, [253, 174, 97, 255]],
        [1.0, [213, 62, 79, 255]],
      ],
      speedRange: [0, 30],
    }),
  ],
});
```

### With Wind Data Points (IDW Interpolation)

```typescript
import { WindParticleLayer, generateWindTexture } from 'maplibre-gl-wind';

const windData = [
  { lat: 40.7, lon: -74.0, speed: 5.2, direction: 180 },
  { lat: 34.0, lon: -118.2, speed: 3.1, direction: 270 },
  // ... more points
];

const { canvas, uMin, uMax, vMin, vMax } = generateWindTexture(windData, {
  width: 360,
  height: 180,
  bounds: [-180, -90, 180, 90],
});

const layer = new WindParticleLayer({
  id: 'wind',
  image: canvas.toDataURL(),
  bounds: [-180, -90, 180, 90],
  imageUnscale: [Math.min(uMin, vMin), Math.max(uMax, vMax)],
  numParticles: 8192,
  colorRamp: [
    [0.0, [59, 130, 189, 255]],
    [1.0, [213, 62, 79, 255]],
  ],
});
```

### With MapLibre GL JS

```typescript
import maplibregl from 'maplibre-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { WindParticleLayer } from 'maplibre-gl-wind';

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://demotiles.maplibre.org/style.json',
  center: [0, 20],
  zoom: 2,
});

map.on('load', () => {
  const overlay = new MapboxOverlay({
    layers: [
      new WindParticleLayer({
        id: 'wind',
        image: 'path/to/wind-texture.png',
        bounds: [-180, -90, 180, 90],
        imageUnscale: [-50, 50],
        numParticles: 8192,
      }),
    ],
  });

  map.addControl(overlay);
});
```

## API

### WindParticleLayer

| Option         | Type          | Default                | Description                                  |
| -------------- | ------------- | ---------------------- | -------------------------------------------- |
| `image`        | `string`      | -                      | URL or data URL of wind texture              |
| `bounds`       | `number[]`    | `[-180, -90, 180, 90]` | Geographic bounds [west, south, east, north] |
| `imageUnscale` | `number[]`    | `[0, 0]`               | Wind velocity range [min, max]               |
| `numParticles` | `number`      | `8192`                 | Number of particles                          |
| `maxAge`       | `number`      | `50`                   | Particle lifetime in frames                  |
| `speedFactor`  | `number`      | `50`                   | Particle speed multiplier                    |
| `colorRamp`    | `ColorStop[]` | Blue to red gradient   | Speed-based color stops `[position, color]`  |
| `speedRange`   | `number[]`    | `[0, 30]`              | Speed range for color mapping [min, max]     |
| `width`        | `number`      | `1.5`                  | Particle trail width                         |
| `animate`      | `boolean`     | `true`                 | Enable animation                             |

### generateWindTexture

Converts wind data points to a texture using IDW interpolation.

```typescript
function generateWindTexture(
  windData: WindDataPoint[],
  options?: {
    width?: number;
    height?: number;
    bounds?: [number, number, number, number];
    power?: number;
  },
): WindTextureResult;
```

### createWindDataFromOpenWeatherMap

Helper to convert OpenWeatherMap API responses to wind data points.

```typescript
function createWindDataFromOpenWeatherMap(
  responses: Array<{
    coord: { lat: number; lon: number };
    wind?: { speed?: number; deg?: number };
  }>,
): WindDataPoint[];
```

## Wind Texture Format

Wind textures encode U (east-west) and V (north-south) velocity components:

- **R channel**: U component (normalized 0-255)
- **G channel**: V component (normalized 0-255)
- **A channel**: Should be 255 for valid data

## Requirements

- **Node.js** >= 24.0.0
- **deck.gl** >= 9.0.0

## Contributing

1. Fork and create a feature branch from `main`
2. Make changes following [conventional commits](https://www.conventionalcommits.org/)
3. Ensure commits are signed
4. Submit a PR

```bash
bun install
bun run build
bun run lint
bun run typecheck
```

## License

MIT © [Vinayak Kulkarni](https://github.com/vinayakkulkarni)

## Credits

- [Az's deck.gl particle layer](https://az.id.au/dev/wind-particle-layer-in-deckgl-9.x/) - Original implementation
- [deck.gl](https://deck.gl/) - WebGL visualization framework
- [luma.gl](https://luma.gl/) - WebGL2 engine
