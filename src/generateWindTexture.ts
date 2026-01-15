export interface WindDataPoint {
  lat: number;
  lon: number;
  speed: number;
  direction: number;
}

export interface WindTextureResult {
  canvas: HTMLCanvasElement;
  imageData: ImageData;
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
  bounds: [number, number, number, number];
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

export function generateWindTexture(
  windData: WindDataPoint[],
  options: GenerateWindTextureOptions = {},
): WindTextureResult {
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

  const uRange = uMax - uMin || 1;
  const vRange = vMax - vMin || 1;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(width, height);

  for (let i = 0; i < uvGrid.length; i++) {
    const { u, v } = uvGrid[i];
    const normalizedU = (u - uMin) / uRange;
    const normalizedV = (v - vMin) / vRange;

    const idx = i * 4;
    imageData.data[idx] = Math.round(normalizedU * 255);
    imageData.data[idx + 1] = Math.round(normalizedV * 255);
    imageData.data[idx + 2] = 0;
    imageData.data[idx + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);

  return {
    canvas,
    imageData,
    uMin,
    uMax,
    vMin,
    vMax,
    bounds,
  };
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
