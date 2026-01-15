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

A MapLibre GL JS custom layer for rendering animated wind particle visualizations. Works with **MapLibre GL JS v4+** (WebGL2).

Built on top of [wind-gl-core](https://github.com/sakitam-fdd/wind-layer) for GPU-accelerated wind field rendering.

## Features

- Animated wind particle flow visualization
- Support for tile-based and image-based wind data sources
- Compatible with MapLibre GL JS v4 and v5
- Simple self-contained wind layer for basic use cases
- Full wind-gl-core integration for advanced features

## Installation

```bash
# npm
npm install maplibre-gl-wind maplibre-gl

# bun
bun add maplibre-gl-wind maplibre-gl

# JSR
bunx jsr add @geoql/maplibre-gl-wind
```

## Usage

### Simple Wind Layer

For basic wind visualization with a wind texture image:

```typescript
import maplibregl from 'maplibre-gl';
import { SimpleWindLayer } from 'maplibre-gl-wind';
import 'maplibre-gl/dist/maplibre-gl.css';

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://demotiles.maplibre.org/style.json',
  center: [0, 20],
  zoom: 2,
});

map.on('load', () => {
  const windLayer = new SimpleWindLayer('wind', {
    numParticles: 65536,
    fadeOpacity: 0.996,
    speedFactor: 0.25,
    dropRate: 0.003,
    dropRateBump: 0.01,
    colors: {
      0.0: '#3288bd',
      0.1: '#66c2a5',
      0.2: '#abdda4',
      0.3: '#e6f598',
      0.4: '#fee08b',
      0.5: '#fdae61',
      0.6: '#f46d43',
      1.0: '#d53e4f',
    },
  });

  // Load wind data image
  const windImage = new Image();
  windImage.onload = () => {
    windLayer.setWindData({
      image: windImage,
      width: 360,
      height: 180,
      uMin: -50,
      uMax: 50,
      vMin: -50,
      vMax: 50,
    });
  };
  windImage.src = 'path/to/wind-texture.png';

  map.addLayer(windLayer);
});
```

### Advanced Wind Layer (wind-gl-core)

For full features including tile sources, timeline animations, and custom styling:

```typescript
import maplibregl from 'maplibre-gl';
import {
  WindLayer,
  ImageSource,
  RenderType,
  DecodeType,
} from 'maplibre-gl-wind';
import 'maplibre-gl/dist/maplibre-gl.css';

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://demotiles.maplibre.org/style.json',
  center: [0, 20],
  zoom: 2,
});

map.on('load', async () => {
  const source = new ImageSource('wind', {
    url: 'path/to/wind-texture.png',
    coordinates: [
      [-180, 85],
      [180, 85],
      [180, -85],
      [-180, -85],
    ],
    decodeType: DecodeType.imageRgba,
    wrapX: true,
  });

  const layer = new WindLayer('wind-layer', source, {
    renderType: RenderType.particles,
    styleSpec: {
      'fill-color': [
        'interpolate',
        ['linear'],
        ['get', 'value'],
        0,
        '#3288bd',
        100,
        '#d53e4f',
      ],
      numParticles: 65536,
      maxAge: 100,
      speedFactor: 0.01,
      dropRate: 0.003,
      dropRateBump: 0.01,
    },
  });

  map.addLayer(layer);
});
```

## API

### SimpleWindLayer

Simple self-contained wind particle layer.

#### Constructor Options

| Option         | Type                     | Default   | Description                          |
| -------------- | ------------------------ | --------- | ------------------------------------ |
| `numParticles` | `number`                 | `65536`   | Number of particles to render        |
| `fadeOpacity`  | `number`                 | `0.996`   | Opacity fade per frame (0-1)         |
| `speedFactor`  | `number`                 | `0.25`    | Particle speed multiplier            |
| `dropRate`     | `number`                 | `0.003`   | Particle drop/respawn rate           |
| `dropRateBump` | `number`                 | `0.01`    | Additional drop rate based on speed  |
| `colors`       | `Record<number, string>` | See above | Color ramp stops (0-1 mapped colors) |

#### Methods

- `setWindData(data: WindData)` - Set wind texture data

### WindLayer

Full-featured wind layer using wind-gl-core.

#### Constructor

```typescript
new WindLayer(id: string, source: SourceType, options?: LayerOptions)
```

#### Source Types

- `ImageSource` - Single image wind texture
- `TileSource` - Tiled wind data
- `TimelineSource` - Time-series wind data

## Wind Data Format

Wind textures encode U (horizontal) and V (vertical) wind components in the R and G channels respectively. Values are normalized to 0-255.

## Requirements

- **Node.js** >= 24.0.0
- **MapLibre GL JS** >= 4.0.0

## Contributing

1. Fork and create a feature branch from `main`
2. Make changes following [conventional commits](https://www.conventionalcommits.org/)
3. Ensure commits are signed
4. Submit a PR

```bash
bun install
bun run build
bun run lint
bun run format
```

## License

MIT © [Vinayak Kulkarni](https://github.com/vinayakkulkarni)

## Credits

Built with:

- [wind-gl-core](https://github.com/sakitam-fdd/wind-layer) - GPU wind rendering engine
- [MapLibre GL JS](https://maplibre.org/) - WebGL map rendering
- [@sakitam-gis/vis-engine](https://github.com/sakitam-fdd/vis-engine) - 3D rendering utilities
