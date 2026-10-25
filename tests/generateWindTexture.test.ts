import { describe, expect, it } from 'vite-plus/test';
import {
  createWindDataFromOpenWeatherMap,
  rasterizeWindField,
} from '../src/generateWindTexture';

/** Decode one pixel the way the layer's shader does (single shared range). */
function decode(
  data: Uint8ClampedArray,
  index: number,
  [min, max]: [number, number],
) {
  const u = min + (data[index * 4] / 255) * (max - min);
  const v = min + (data[index * 4 + 1] / 255) * (max - min);
  return { u, v };
}

describe('rasterizeWindField', () => {
  it('encodes U and V with one shared range so the shader decodes them back', () => {
    // East wind 10 m/s everywhere (blowing toward 90°): u = 10, v = 0.
    const points = [
      { lat: 10, lon: -10, speed: 10, direction: 90 },
      { lat: -10, lon: 10, speed: 10, direction: 90 },
    ];
    const raster = rasterizeWindField(points, { width: 8, height: 4 });

    expect(raster.imageUnscale[0]).toBeLessThanOrEqual(
      Math.min(raster.uMin, raster.vMin),
    );
    expect(raster.imageUnscale[1]).toBeGreaterThanOrEqual(
      Math.max(raster.uMax, raster.vMax),
    );

    const { u, v } = decode(raster.data, 0, raster.imageUnscale);
    expect(u).toBeCloseTo(10, 0);
    expect(v).toBeCloseTo(0, 0);
  });

  it('keeps the direction of a diagonal wind (north-east, toward 45°)', () => {
    const points = [
      { lat: 0, lon: 0, speed: Math.SQRT2 * 5, direction: 45 },
      { lat: 40, lon: 100, speed: 1, direction: 225 },
    ];
    const raster = rasterizeWindField(points, { width: 36, height: 18 });
    // Pixel nearest (0°, 0°): column 18, row 9.
    const { u, v } = decode(raster.data, 9 * 36 + 18, raster.imageUnscale);
    expect(u).toBeGreaterThan(0);
    expect(v).toBeGreaterThan(0);
    expect(u / v).toBeCloseTo(1, 1);
  });

  it('returns RGBA pixels sized width × height with opaque alpha', () => {
    const raster = rasterizeWindField(
      [{ lat: 0, lon: 0, speed: 3, direction: 0 }],
      { width: 4, height: 2 },
    );
    expect(raster.data).toHaveLength(4 * 2 * 4);
    expect(raster.data[3]).toBe(255);
    expect(raster.bounds).toEqual([-180, -90, 180, 90]);
  });
});

describe('createWindDataFromOpenWeatherMap', () => {
  it('keeps responses with a wind speed and maps fields', () => {
    expect(
      createWindDataFromOpenWeatherMap([
        { coord: { lat: 1, lon: 2 }, wind: { speed: 4, deg: 90 } },
        { coord: { lat: 3, lon: 4 } },
      ]),
    ).toEqual([{ lat: 1, lon: 2, speed: 4, direction: 90 }]);
  });
});
