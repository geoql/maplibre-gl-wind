export interface WindDataPoint {
  lat: number;
  lon: number;
  /** Wind speed, in the unit you want the layer to show (m/s for example). */
  speed: number;
  /**
   * Direction the wind blows TOWARD, in degrees clockwise from north.
   * Weather APIs usually report where the wind comes FROM; add 180 to those.
   */
  direction: number;
}

export interface WindFieldRaster {
  /** RGBA pixels: R = U, G = V, both scaled into `imageUnscale`. */
  data: Uint8ClampedArray;
  width: number;
  height: number;
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
  /**
   * The shared velocity range both channels are scaled into. Pass it to
   * `WindParticleLayer` as `imageUnscale`.
   */
  imageUnscale: [number, number];
  bounds: [number, number, number, number];
}

export interface WindTextureResult extends Omit<WindFieldRaster, 'data'> {
  canvas: HTMLCanvasElement;
  imageData: ImageData;
}

export interface GenerateWindTextureOptions {
  width?: number;
  height?: number;
  bounds?: [number, number, number, number];
  power?: number;
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function windToUV(speed: number, direction: number): { u: number; v: number } {
  const rad = degToRad(direction);
  return {
    u: speed * Math.sin(rad),
    v: speed * Math.cos(rad),
  };
}

function idwInterpolate(
  x: number,
  y: number,
  points: Array<{ x: number; y: number; u: number; v: number }>,
  power: number,
): { u: number; v: number } {
  let sumWeightU = 0;
  let sumWeightV = 0;
  let sumWeight = 0;

  for (const point of points) {
    const dx = x - point.x;
    const dy = y - point.y;
    const distSq = dx * dx + dy * dy;

    if (distSq < 0.0001) {
      return { u: point.u, v: point.v };
    }

    const weight = 1 / Math.pow(Math.sqrt(distSq), power);
    sumWeightU += point.u * weight;
    sumWeightV += point.v * weight;
    sumWeight += weight;
  }

  if (sumWeight === 0) {
    return { u: 0, v: 0 };
  }

  return {
    u: sumWeightU / sumWeight,
    v: sumWeightV / sumWeight,
  };
}

/**
 * Interpolate wind points onto a grid (IDW) and encode U/V as RGBA pixels.
 * Pure: no DOM, so it also runs in workers and on the server.
 */
export function rasterizeWindField(
  windData: WindDataPoint[],
  options: GenerateWindTextureOptions = {},
): WindFieldRaster {
  const {
    width = 360,
    height = 180,
    bounds = [-180, -90, 180, 90],
    power = 2,
  } = options;

  const [west, south, east, north] = bounds;

  const uvPoints = windData.map((point) => {
    const { u, v } = windToUV(point.speed, point.direction);
    const x = ((point.lon - west) / (east - west)) * width;
    const y = ((north - point.lat) / (north - south)) * height;
    return { x, y, u, v };
  });

  let uMin = Infinity;
  let uMax = -Infinity;
  let vMin = Infinity;
  let vMax = -Infinity;

  const uvGrid: Array<{ u: number; v: number }> = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const { u, v } = idwInterpolate(x + 0.5, y + 0.5, uvPoints, power);
      uvGrid.push({ u, v });

      uMin = Math.min(uMin, u);
      uMax = Math.max(uMax, u);
      vMin = Math.min(vMin, v);
      vMax = Math.max(vMax, v);
    }
  }

  // The layer decodes both channels with ONE range (`imageUnscale`), so both
  // must be encoded with that same range. Scaling U and V separately skews
  // every direction and speed.
  const min = Math.min(uMin, vMin);
  const max = Math.max(uMax, vMax);
  const range = max - min || 1;

  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < uvGrid.length; i++) {
    const { u, v } = uvGrid[i];
    const idx = i * 4;
    data[idx] = Math.round(((u - min) / range) * 255);
    data[idx + 1] = Math.round(((v - min) / range) * 255);
    data[idx + 2] = 0;
    data[idx + 3] = 255;
  }

  return {
    data,
    width,
    height,
    uMin,
    uMax,
    vMin,
    vMax,
    imageUnscale: [min, max],
    bounds,
  };
}

/** `rasterizeWindField`, drawn into a canvas (browser only). */
export function generateWindTexture(
  windData: WindDataPoint[],
  options: GenerateWindTextureOptions = {},
): WindTextureResult {
  const { data, ...raster } = rasterizeWindField(windData, options);

  const canvas = document.createElement('canvas');
  canvas.width = raster.width;
  canvas.height = raster.height;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(raster.width, raster.height);
  imageData.data.set(data);
  ctx.putImageData(imageData, 0, 0);

  return { ...raster, canvas, imageData };
}

export function createWindDataFromOpenWeatherMap(
  weatherResponses: Array<{
    coord: { lat: number; lon: number };
    wind?: { speed?: number; deg?: number };
  }>,
): WindDataPoint[] {
  return weatherResponses
    .filter((r) => r.wind && typeof r.wind.speed === 'number')
    .map((r) => ({
      lat: r.coord.lat,
      lon: r.coord.lon,
      speed: r.wind!.speed ?? 0,
      direction: r.wind!.deg ?? 0,
    }));
}
