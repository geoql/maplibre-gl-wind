import { utils } from '@sakitam-gis/vis-engine';

const { clamp } = utils;

export const earthRadius = 6371008.8;
export const earthCircumference = 2 * Math.PI * earthRadius;
export const halfEarthCircumference = earthCircumference / 2;

export function circumferenceAtLatitude(latitude: number) {
  return earthCircumference * Math.cos((latitude * Math.PI) / 180);
}

export function mercatorXfromLng(lng: number) {
  return (180 + lng) / 360;
}

export function mercatorYfromLat(lat: number) {
  return (
    (180 -
      (180 / Math.PI) *
        Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) /
    360
  );
}

export function mercatorZfromAltitude(altitude: number, lat: number) {
  return altitude / circumferenceAtLatitude(lat);
}

export function lngFromMercatorX(x: number, wrap = 0) {
  return x * 360 - 180 + wrap * 360;
}

export function latFromMercatorY(y: number) {
  const y2 = 180 - y * 360;
  return (360 / Math.PI) * Math.atan(Math.exp((y2 * Math.PI) / 180)) - 90;
}

export function altitudeFromMercatorZ(z: number, y: number) {
  return z * circumferenceAtLatitude(latFromMercatorY(y));
}

export function mercatorScale(lat: number) {
  return 1 / Math.cos((lat * Math.PI) / 180);
}

export function meterInMercatorCoordinateUnits(y: number) {
  return (1 / earthCircumference) * mercatorScale(latFromMercatorY(y));
}

export function pixelsInMercatorCoordinateUnits(
  lat: number,
  pixelsPerMeter: number,
) {
  return (1 / earthCircumference) * mercatorScale(lat) * pixelsPerMeter;
}

export const MAX_MERCATOR_LATITUDE = 85.051129;

export function fromLngLat(
  lngLatLike: { lng: number; lat: number },
  altitude = 0,
) {
  const lat = clamp(
    lngLatLike.lat,
    -MAX_MERCATOR_LATITUDE,
    MAX_MERCATOR_LATITUDE,
  );
  return {
    x: mercatorXfromLng(lngLatLike.lng),
    y: mercatorYfromLat(lat),
    z: mercatorZfromAltitude(altitude, lat),
  };
}

export function toLngLat(mercatorCoordinate: { x: number; y: number }) {
  return {
    lng: lngFromMercatorX(mercatorCoordinate.x),
    lat: latFromMercatorY(mercatorCoordinate.y),
  };
}

export function getTileCenter(x: number, y: number, z: number) {
  const numTiles = Math.pow(2, z);
  return {
    x: (x * earthCircumference) / numTiles - halfEarthCircumference,
    y: -((y * earthCircumference) / numTiles - halfEarthCircumference),
  };
}

export function getCoordinatesCenterTileID(
  coords: Array<{ x: number; y: number }>,
) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const coord of coords) {
    minX = Math.min(minX, coord.x);
    minY = Math.min(minY, coord.y);
    maxX = Math.max(maxX, coord.x);
    maxY = Math.max(maxY, coord.y);
  }

  const dx = maxX - minX;
  const dy = maxY - minY;
  const dMax = Math.max(dx, dy);
  const zoom = Math.max(0, Math.floor(-Math.log(dMax) / Math.LN2));
  const tilesAtZoom = Math.pow(2, zoom);

  return {
    z: zoom,
    x: Math.floor(((minX + maxX) / 2) * tilesAtZoom),
    y: Math.floor(((minY + maxY) / 2) * tilesAtZoom),
    extent: [minX, minY, maxX, maxY] as [number, number, number, number],
  };
}
