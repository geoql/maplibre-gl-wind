import type { TileBounds, Bounds } from 'wind-gl-core';
import { TileID, mod } from 'wind-gl-core';
import { utils } from '@sakitam-gis/vis-engine';
import RBush, { type BBoxLike } from '@sakitam-gis/rbush';
import {
  mercatorXfromLng,
  mercatorYfromLat,
  latFromMercatorY,
  lngFromMercatorX,
} from './mercator-coordinates';

type TileNodeItem = BBoxLike & { tileKey: string };

export function zoomScale(z: number) {
  return Math.pow(2, z);
}

export function scaleZoom(scale: number) {
  return Math.log(scale) / Math.LN2;
}

function coveringZoomLevel(options: {
  zoom: number;
  tileSize: number;
  roundZoom?: boolean;
}) {
  const z = (options.roundZoom ? Math.round : Math.floor)(
    options.zoom + scaleZoom(512 / options.tileSize),
  );
  return Math.max(0, z);
}

export function containsStrict(a: TileBounds, b: TileBounds): boolean {
  return a[0] <= b[0] && a[1] <= b[1] && b[2] <= a[2] && b[3] <= a[3];
}

const TILE_SIZE = 512;

function lngLatToTile(lng: number, lat: number, zoom: number) {
  const worldSize = TILE_SIZE * zoomScale(zoom);
  const x = mercatorXfromLng(lng) * worldSize;
  const y = utils.clamp(mercatorYfromLat(lat), 0, 1) * worldSize;
  const tileX = Math.floor(x / TILE_SIZE);
  const tileY = Math.floor(y / TILE_SIZE);
  return { x: tileX, y: tileY, z: zoom };
}

export function getTileProjBounds(tileID: TileID) {
  const numTiles = 1 << tileID.z;
  return {
    left: tileID.wrapedX / numTiles,
    top: tileID.wrapedY / numTiles,
    right: (tileID.wrapedX + 1) / numTiles,
    bottom: (tileID.wrapedY + 1) / numTiles,
  };
}

export function createTileID(
  z: number,
  wrapedX: number,
  wrapedY: number,
  wrap: number,
) {
  const max = Math.pow(2, z);
  return new TileID(
    z,
    wrap,
    z,
    (wrapedX - max * wrap) % max,
    (wrapedY + max) % max,
  );
}

export function getBoundsTiles(
  bounds: TileBounds,
  zoom: number,
  options: {
    tileSize: number;
    minZoom?: number;
    maxZoom?: number;
    roundZoom?: boolean;
  },
) {
  const topLeft = { lng: bounds[0], lat: bounds[3] };
  const bottomRight = { lng: bounds[2], lat: bounds[1] };

  let z = coveringZoomLevel({
    zoom,
    tileSize: options.tileSize,
    roundZoom: options.roundZoom,
  });

  if (options.minZoom !== undefined && z < options.minZoom) return [];
  if (options.maxZoom !== undefined && z > options.maxZoom) z = options.maxZoom;

  const max = Math.pow(2, z);

  const minTile = lngLatToTile(topLeft.lng, topLeft.lat, z);
  const maxTile = lngLatToTile(bottomRight.lng, bottomRight.lat, z);

  const ts: TileID[] = [];
  const maxX = maxTile.x;
  const maxY = maxTile.y >= 1 && z === 0 ? maxTile.y - 1 : maxTile.y;

  for (let x = minTile.x; x <= maxX; x++) {
    for (let y = minTile.y; y <= maxY; y++) {
      const wrap = Math.floor(x / max);

      const tile = new TileID(
        z,
        wrap,
        z,
        (x - max * wrap) % max,
        (y + max) % max,
        {
          getTileProjBounds,
        },
      );

      ts.push(tile);
    }
  }

  return ts;
}

function wrapX(
  x: number,
  minx: number | undefined | null,
  min: number,
  max: number,
) {
  let wrappedX = mod(x + max, max - min) + min;
  if (minx !== undefined && minx !== null && wrappedX < minx) {
    wrappedX += max - min;
  }
  return wrappedX;
}

export function calcBounds(
  bounds: number[][],
  yRange: [number, number],
): Bounds {
  const xmin = bounds[0][0];
  const ymin = bounds[0][1];
  const xmax = bounds[1][0];
  const ymax = bounds[1][1];

  const min = -180;
  const max = 180;

  const dx = xmax - xmin;
  const minX = dx < max - min ? wrapX(xmin, undefined, min, max) : min;
  const maxX = dx < max - min ? wrapX(xmax, minX, min, max) : max;

  const minY = Math.max(ymin, yRange[0]);
  const maxY = Math.min(ymax, yRange[1]);

  return [minX, minY, maxX, maxY];
}

export function getTileBounds(tileID: TileID): TileBounds {
  const { z, x, y } = tileID;
  const wrap = tileID.wrap;
  const numTiles = 1 << z;
  const leftLng = lngFromMercatorX(x / numTiles, wrap);
  const rightLng = lngFromMercatorX((x + 1) / numTiles, wrap);
  const topLat = latFromMercatorY(y / numTiles);
  const bottomLat = latFromMercatorY((y + 1) / numTiles);

  return [leftLng, bottomLat, rightLng, topLat];
}

function intersects(a: BBoxLike, b: BBoxLike) {
  return (
    b.minX < a.maxX && b.minY < a.maxY && b.maxX > a.minX && b.maxY > a.minY
  );
}

export function expandTiles(tiles: TileID[]) {
  if (!tiles || tiles.length === 0) return [];

  let xmin = Infinity;
  let xmax = -Infinity;
  let ymin = Infinity;
  let ymax = -Infinity;
  let zmin = Infinity;
  let zmax = -Infinity;

  const level = new Map<number, TileID[]>();
  const tree = new RBush(9);

  for (let i = 0; i < tiles.length; i++) {
    const tileID = tiles[i];
    const { z, wrapedX, wrapedY } = tileID;

    const [left, top, right, bottom] = [
      wrapedX,
      wrapedY,
      wrapedX + 1,
      wrapedY + 1,
    ];
    xmin = Math.min(left, xmin);
    xmax = Math.max(right, xmax);
    ymin = Math.min(top, ymin);
    ymax = Math.max(bottom, ymax);
    zmin = Math.min(z, zmin);
    zmax = Math.max(z, zmax);

    const cache = level.get(z);
    if (!cache) {
      level.set(z, [tileID]);
    } else {
      level.set(z, [...cache, tileID]);
    }
  }

  const levelConfig: Record<number, { baseTileID: TileID; config: number[] }> =
    {};

  for (const [lk, lv] of level) {
    let lxmin = Infinity;
    let lymin = Infinity;
    let lxmax = -Infinity;
    let lymax = -Infinity;
    let wrapMin = Infinity;

    for (let j = 0; j < lv.length; j++) {
      const litem = lv[j];
      const item: TileNodeItem = {
        minX: litem.wrapedX,
        minY: litem.wrapedY,
        maxX: litem.wrapedX + 1,
        maxY: litem.wrapedY + 1,
        tileKey: litem.tileKey,
      };
      tree.insert(item as unknown as Parameters<typeof tree.insert>[0]);
      lxmin = Math.min(item.minX, lxmin);
      lxmax = Math.max(item.maxX, lxmax);
      lymin = Math.min(item.minY, lymin);
      lymax = Math.max(item.maxY, lymax);
      wrapMin = Math.min(litem.wrap, wrapMin);
    }

    let baseTileID = lv.find(
      (t) => t.wrapedX === lxmin && t.wrapedY === lymin && t.z === lk,
    );
    if (!baseTileID) {
      const max = Math.pow(2, lk);
      baseTileID = new TileID(
        lk,
        wrapMin,
        lk,
        lxmin - max * wrapMin,
        lymin,
        lv[0].options,
      );
    }

    levelConfig[lk] = {
      baseTileID,
      config: [lxmin, lymin, lxmax, lymax],
    };
  }

  const keys = Object.keys(levelConfig).sort().reverse().map(Number);

  const addTiles: TileID[] = [];
  for (let k = 0; k < keys.length; k++) {
    const { config, baseTileID } = levelConfig[keys[k]];

    const xd = config[2] - config[0];
    const yd = config[3] - config[1];

    for (let x = 0; x < xd; x++) {
      for (let y = 0; y < yd; y++) {
        const tile = (baseTileID as TileID).neighbor(x, y);
        if (!tiles.find((t) => t.tileKey === tile.tileKey)) {
          const result = tree.collides(
            {
              minX: tile.wrapedX,
              minY: tile.wrapedY,
              maxX: tile.wrapedX + 1,
              maxY: tile.wrapedY + 1,
              tileKey: tile.tileKey,
            },
            { intersects },
          );

          if (!result) {
            addTiles.push(tile);
          }
        }
      }
    }
  }

  return addTiles;
}
