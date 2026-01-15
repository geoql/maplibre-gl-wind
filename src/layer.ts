import maplibregl from 'maplibre-gl';
import rewind from '@mapbox/geojson-rewind';
import { OrthographicCamera, Renderer, Scene } from '@sakitam-gis/vis-engine';
import type { UserOptions, SourceType } from 'wind-gl-core';
import {
  BaseLayer,
  LayerSourceType,
  RenderType,
  TileID,
  polygon2buffer,
} from 'wind-gl-core';

import CameraSync from './utils/camera-sync';
import { getCoordinatesCenterTileID } from './utils/mercator-coordinates';
import { expandTiles, getTileBounds, getTileProjBounds } from './utils/tile';

export interface LayerOptions extends Partial<UserOptions> {
  renderingMode?: '2d' | '3d';
}

interface MaskData {
  features: Array<{
    geometry: {
      type: string;
      coordinates:
        | [number, number][]
        | [number, number][][]
        | [number, number][][][];
    };
  }>;
}

type WithNull<T> = T | null;

/**
 * Calculate covering tiles - replaces transform.coveringTiles which was removed in MapLibre v5
 */
function calculateCoveringTiles(
  map: maplibregl.Map,
  options: {
    tileSize: number;
    minzoom?: number;
    maxzoom?: number;
    roundZoom?: boolean;
  },
): Array<{ canonical: { x: number; y: number; z: number }; wrap: number }> {
  const bounds = map.getBounds();
  const zoom = options.roundZoom
    ? Math.round(map.getZoom())
    : Math.floor(map.getZoom());
  const clampedZoom = Math.max(
    options.minzoom ?? 0,
    Math.min(options.maxzoom ?? 22, zoom),
  );

  const tiles: Array<{
    canonical: { x: number; y: number; z: number };
    wrap: number;
  }> = [];
  const scale = Math.pow(2, clampedZoom);

  const nwLng = bounds.getWest();
  const nwLat = bounds.getNorth();
  const seLng = bounds.getEast();
  const seLat = bounds.getSouth();

  const minTileX = Math.floor(((nwLng + 180) / 360) * scale);
  const maxTileX = Math.floor(((seLng + 180) / 360) * scale);
  const minTileY = Math.floor(
    ((1 -
      Math.log(
        Math.tan((nwLat * Math.PI) / 180) +
          1 / Math.cos((nwLat * Math.PI) / 180),
      ) /
        Math.PI) /
      2) *
      scale,
  );
  const maxTileY = Math.floor(
    ((1 -
      Math.log(
        Math.tan((seLat * Math.PI) / 180) +
          1 / Math.cos((seLat * Math.PI) / 180),
      ) /
        Math.PI) /
      2) *
      scale,
  );

  for (let x = minTileX; x <= maxTileX; x++) {
    for (
      let y = Math.max(0, minTileY);
      y <= Math.min(scale - 1, maxTileY);
      y++
    ) {
      const wrap = Math.floor(x / scale);
      const canonicalX = ((x % scale) + scale) % scale;
      tiles.push({
        canonical: { x: canonicalX, y, z: clampedZoom },
        wrap,
      });
    }
  }

  return tiles;
}

function screenPointToMercator(
  map: maplibregl.Map,
  point: maplibregl.Point,
): { x: number; y: number } {
  const lngLat = map.unproject(point);
  const mercator = maplibregl.MercatorCoordinate.fromLngLat(lngLat);
  return { x: mercator.x, y: mercator.y };
}

export default class Layer {
  public gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  public map: WithNull<maplibregl.Map> = null;
  public id: string;
  public type: string;
  public renderingMode: '2d' | '3d';
  public sync!: CameraSync;
  public scene!: Scene;
  public planeCamera!: OrthographicCamera;
  public renderer!: Renderer;
  private options: LayerOptions;
  private source: SourceType;
  private layer: WithNull<BaseLayer> = null;

  constructor(id: string, source: SourceType, options?: LayerOptions) {
    this.id = id;
    this.type = 'custom';
    this.renderingMode = options?.renderingMode || '2d';
    this.options = { ...(options || {}) };
    this.source = source;

    this.update = this.update.bind(this);
    this.moveStart = this.moveStart.bind(this);
    this.moveEnd = this.moveEnd.bind(this);
    this.handleZoom = this.handleZoom.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  get camera() {
    return this.sync?.camera;
  }

  update() {
    this.sync.update();
    if (this.layer) {
      this.layer.update();
    }
  }

  moveStart() {
    if (this.layer) {
      this.layer.moveStart();
    }
  }

  moveEnd() {
    if (this.layer) {
      this.layer.moveEnd();
    }
  }

  handleResize() {
    if (this.renderer && this.gl && this.map) {
      const canvas = this.map.getCanvas();
      const width = canvas.width;
      const height = canvas.height;
      this.renderer.setSize(width, height);

      if (this.layer) {
        this.layer.resize(width, height);
      }
      this.update();
    }
  }

  handleZoom() {
    if (this.layer) {
      this.layer.handleZoom();
    }
  }

  updateOptions(options: Partial<LayerOptions>) {
    this.options = { ...this.options, ...(options || {}) };
    if (this.layer) {
      this.layer.updateOptions(options);
    }
  }

  public getMask() {
    return this.options.mask;
  }

  private processMask() {
    const mask = this.options.mask;
    if (!mask) return undefined;

    const data = mask.data as unknown as MaskData;
    rewind(data as unknown as GeoJSON.FeatureCollection, true);

    const tr = (coords: [number, number][]) => {
      const mercatorCoordinates: [number, number][] = [];
      for (let i = 0; i < coords.length; i++) {
        const coord = coords[i];
        const p = maplibregl.MercatorCoordinate.fromLngLat(coord);
        mercatorCoordinates.push([p.x, p.y]);
      }
      return mercatorCoordinates;
    };

    const features = data.features;
    const len = features.length;
    let i = 0;
    const fs: GeoJSON.Feature[] = [];
    for (; i < len; i++) {
      const feature = features[i];
      const coordinates = feature.geometry.coordinates;
      const type = feature.geometry.type;

      if (type === 'Polygon') {
        fs.push({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: (coordinates as [number, number][][]).map((c) =>
              tr(c),
            ),
          },
        });
      } else if (type === 'MultiPolygon') {
        const css: [number, number][][][] = [];
        const multiCoords = coordinates as [number, number][][][];
        for (let k = 0; k < multiCoords.length; k++) {
          const coordinate = multiCoords[k];
          const cs: [number, number][][] = [];
          for (let n = 0; n < coordinate.length; n++) {
            cs.push(tr(multiCoords[k][n]));
          }
          css.push(cs);
        }

        fs.push({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'MultiPolygon',
            coordinates: css,
          },
        });
      }
    }

    return {
      data: polygon2buffer(fs),
      type: mask.type,
    };
  }

  public setMask(mask: { data?: GeoJSON.FeatureCollection; type?: string }) {
    this.options.mask = Object.assign({}, this.options.mask, mask);
    if (this.layer) {
      this.layer.setMask(this.processMask());
    }
  }

  onAdd(m: maplibregl.Map, gl: WebGLRenderingContext) {
    this.gl = gl;
    this.map = m;
    const canvas = m.getCanvas();

    console.log('[WindLayer] onAdd called');
    console.log('[WindLayer] source:', this.source);
    console.log('[WindLayer] source.type:', this.source?.type);
    console.log('[WindLayer] options:', this.options);

    this.renderer = new Renderer(gl, {
      autoClear: false,
      extensions: [
        'OES_texture_float',
        'OES_texture_float_linear',
        'WEBGL_color_buffer_float',
        'EXT_color_buffer_float',
      ],
    });

    this.scene = new Scene();
    this.sync = new CameraSync(
      this.map as unknown as ConstructorParameters<typeof CameraSync>[0],
      'perspective',
      this.scene,
    );
    this.planeCamera = new OrthographicCamera(0, 1, 1, 0, 0, 1);

    console.log('[WindLayer] Creating BaseLayer...');
    this.layer = new BaseLayer(
      this.source,
      {
        renderer: this.renderer,
        scene: this.scene,
      },
      {
        renderType: this.options.renderType,
        renderFrom: this.options.renderFrom,
        styleSpec: this.options.styleSpec,
        displayRange: this.options.displayRange,
        widthSegments: this.options.widthSegments,
        heightSegments: this.options.heightSegments,
        wireframe: this.options.wireframe,
        picking: this.options.picking,
        mask: this.processMask(),
        getZoom: () => this.map?.getZoom() as number,
        triggerRepaint: () => {
          this.map?.triggerRepaint();
        },
        getTileProjSize: (z: number) => {
          const w = 1 / Math.pow(2, z);
          return [w, w];
        },
        getPixelsToUnits: (): [number, number] => {
          const pixel = 1;
          const y = canvas.clientHeight / 2 - pixel / 2;
          const x = canvas.clientWidth / 2 - pixel / 2;
          const left = maplibregl.MercatorCoordinate.fromLngLat(
            m.unproject([x, y]),
          );
          const right = maplibregl.MercatorCoordinate.fromLngLat(
            m.unproject([x + pixel, y + pixel]),
          );
          return [Math.abs(right.x - left.x), Math.abs(left.y - right.y)];
        },
        getPixelsToProjUnit: () => {
          const zoom = this.map?.getZoom() ?? 0;
          const scale = Math.pow(2, zoom) * 512;
          return [scale, scale];
        },
        getViewTiles: (source: SourceType, renderType: RenderType) => {
          let sourceType = source.type;
          if (sourceType === LayerSourceType.timeline) {
            sourceType = (
              source as SourceType & { privateType: LayerSourceType }
            ).privateType;
          }

          console.log(
            '[WindLayer] getViewTiles sourceType:',
            sourceType,
            'LayerSourceType.image:',
            LayerSourceType.image,
            'match:',
            sourceType === LayerSourceType.image,
          );

          if (!this.map) return [];
          const wrapTiles: TileID[] = [];

          if (sourceType === LayerSourceType.image) {
            const coords = (
              source as SourceType & { coordinates: [number, number][] }
            ).coordinates;
            console.log('[WindLayer] ImageSource coords:', coords);
            const cornerCoords = coords.map((c: [number, number]) =>
              maplibregl.MercatorCoordinate.fromLngLat(c),
            );
            console.log('[WindLayer] ImageSource cornerCoords:', cornerCoords);
            const tileID = getCoordinatesCenterTileID(cornerCoords);
            console.log(
              '[WindLayer] ImageSource tileID:',
              tileID,
              'extent:',
              tileID.extent,
            );

            const { x, y, z } = tileID;
            const wrap = 0;
            wrapTiles.push(
              new TileID(z, wrap, z, x, y, {
                getTileBounds: () => [
                  coords[0][0],
                  coords[2][1],
                  coords[1][0],
                  coords[0][1],
                ],
                getTileProjBounds: () => ({
                  left: tileID.extent[0] + wrap,
                  top: tileID.extent[1],
                  right: tileID.extent[2] + wrap,
                  bottom: tileID.extent[3],
                }),
              }),
            );

            if (source.wrapX) {
              [-1, 1].forEach((wrapOffset) => {
                wrapTiles.push(
                  new TileID(z, wrapOffset, z, x, y, {
                    getTileBounds: () => [
                      coords[0][0],
                      coords[2][1],
                      coords[1][0],
                      coords[0][1],
                    ],
                    getTileProjBounds: () => ({
                      left: tileID.extent[0] + wrapOffset,
                      top: tileID.extent[1],
                      right: tileID.extent[2] + wrapOffset,
                      bottom: tileID.extent[3],
                    }),
                  }),
                );
              });
            }
            console.log('[WindLayer] ImageSource wrapTiles:', wrapTiles.length);
          } else if (sourceType === LayerSourceType.tile) {
            const sourceTileSize = source.tileSize;
            const tileSize =
              typeof sourceTileSize === 'number'
                ? sourceTileSize
                : Array.isArray(sourceTileSize)
                  ? sourceTileSize[0]
                  : 512;
            const opts = {
              tileSize,
              minzoom: source.minZoom,
              maxzoom: source.maxZoom,
              roundZoom: source.roundZoom,
            };

            const tiles = calculateCoveringTiles(this.map, opts);

            for (let i = 0; i < tiles.length; i++) {
              const tile = tiles[i];
              const { canonical, wrap } = tile;
              const { x, y, z } = canonical;
              if (source.wrapX) {
                wrapTiles.push(
                  new TileID(z, wrap, z, x, y, {
                    getTileBounds,
                    getTileProjBounds,
                  }),
                );
              } else if (wrap === 0) {
                wrapTiles.push(
                  new TileID(z, wrap, z, x, y, {
                    getTileBounds,
                    getTileProjBounds,
                  }),
                );
              }
            }

            if (renderType === RenderType.particles) {
              wrapTiles.push(...expandTiles(wrapTiles));
            }
          }

          return wrapTiles;
        },
        getExtent: () => {
          const bounds = this.map?.getBounds();
          if (!bounds) return [0, 0, 1, 1];

          const xmin = bounds.getWest();
          const ymin = bounds.getSouth();
          const xmax = bounds.getEast();
          const ymax = bounds.getNorth();

          const minY = Math.max(ymin, -85.051129);
          const maxY = Math.min(ymax, 85.051129);

          const p0 = maplibregl.MercatorCoordinate.fromLngLat(
            new maplibregl.LngLat(xmin, maxY),
          );
          const p1 = maplibregl.MercatorCoordinate.fromLngLat(
            new maplibregl.LngLat(xmax, minY),
          );
          return [p0.x, p0.y, p1.x, p1.y];
        },
        getGridTiles: (source: { tileSize?: number; wrapX?: boolean }) => {
          const tileSize = source.tileSize ?? 256;
          const wrapX = source.wrapX;

          if (!this.map) return [];

          const opts = {
            tileSize,
            minzoom: this.map.getMinZoom(),
            maxzoom: this.map.getMaxZoom(),
            roundZoom: false,
          };

          const tiles = calculateCoveringTiles(this.map, opts);
          const wrapTiles: TileID[] = [];

          for (let i = 0; i < tiles.length; i++) {
            const tile = tiles[i];
            const { canonical, wrap } = tile;
            const { x, y, z } = canonical;
            if (wrapX) {
              wrapTiles.push(
                new TileID(z, wrap, z, x, y, {
                  getTileBounds,
                  getTileProjBounds,
                }),
              );
            } else if (wrap === 0) {
              wrapTiles.push(
                new TileID(z, wrap, z, x, y, {
                  getTileBounds,
                  getTileProjBounds,
                }),
              );
            }
          }

          return wrapTiles;
        },
      },
    );

    console.log('[WindLayer] BaseLayer created:', this.layer);

    // Initialize the layer - this triggers source loading
    this.layer.initialize();
    console.log('[WindLayer] BaseLayer initialized');

    setTimeout(() => {
      console.log('[WindLayer] renderer.width:', this.renderer?.width);
      console.log('[WindLayer] renderer.height:', this.renderer?.height);
      console.log(
        '[WindLayer] canvas size:',
        this.map?.getCanvas()?.width,
        this.map?.getCanvas()?.height,
      );
      console.log(
        '[WindLayer] gl.viewport:',
        this.gl?.getParameter(this.gl?.VIEWPORT),
      );
      console.log('[WindLayer] scene.localMatrix:', this.scene?.localMatrix);
      console.log(
        '[WindLayer] camera.projectionMatrix:',
        this.camera?.projectionMatrix,
      );
    }, 3000);

    this.map.on('movestart', this.moveStart);
    this.map.on('move', this.update);
    this.map.on('moveend', this.moveEnd);
    this.map.on('zoom', this.handleZoom);
    this.map.on('zoomend', this.handleZoom);
    this.map.on('resize', this.handleResize);
    this.handleResize();
    this.update();
    console.log('[WindLayer] onAdd complete');
  }

  calcWrappedWorlds() {
    const result = [0];

    if (this.source?.wrapX && this.map) {
      const canvas = this.map.getCanvas();
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      const utl = screenPointToMercator(this.map, new maplibregl.Point(0, 0));
      const utr = screenPointToMercator(
        this.map,
        new maplibregl.Point(width, 0),
      );
      const ubl = screenPointToMercator(
        this.map,
        new maplibregl.Point(width, height),
      );
      const ubr = screenPointToMercator(
        this.map,
        new maplibregl.Point(0, height),
      );

      const w0 = Math.floor(Math.min(utl.x, utr.x, ubl.x, ubr.x));
      const w1 = Math.floor(Math.max(utl.x, utr.x, ubl.x, ubr.x));

      const extraWorldCopy = 0;

      for (let w = w0 - extraWorldCopy; w <= w1 + extraWorldCopy; w++) {
        if (w === 0) {
          continue;
        }
        result.push(w);
      }
    }
    return result;
  }

  onRemove() {
    if (this.layer) {
      this.layer.destroy();
      this.layer = null;
    }
    this.map?.off('zoom', this.handleZoom);
    this.map?.off('zoomend', this.handleZoom);
    this.map?.off('movestart', this.moveStart);
    this.map?.off('move', this.update);
    this.map?.off('moveend', this.moveEnd);
    this.map?.off('resize', this.handleResize);
    this.map = null;
    this.gl = null;
  }

  prerender() {
    if (!this.camera || !this.gl) return;

    const gl = this.gl as WebGL2RenderingContext;
    const currentVAO = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
    gl.bindVertexArray(null);

    this.scene.worldMatrixNeedsUpdate = true;
    this.scene.updateMatrixWorld();
    this.camera.updateMatrixWorld();
    const worlds = this.calcWrappedWorlds();
    this.layer?.prerender({
      worlds,
      camera: this.camera,
      planeCamera: this.planeCamera,
    });

    gl.bindVertexArray(currentVAO);
  }

  async picker(coordinates: maplibregl.LngLatLike) {
    if (!this.options.picking) {
      console.warn('[Layer]: please enable picking options!');
      return null;
    }
    if (!this.layer || !coordinates || !this.map) {
      console.warn('[Layer]: layer not initialized!');
      return null;
    }
    const point = this.map.project(coordinates);
    return this.layer.picker([point.x, point.y]);
  }

  render() {
    if (!this.camera || !this.gl) return;

    const gl = this.gl as WebGL2RenderingContext;

    const currentProgram = gl.getParameter(gl.CURRENT_PROGRAM);
    const currentVAO = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
    const currentArrayBuffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
    const currentElementBuffer = gl.getParameter(
      gl.ELEMENT_ARRAY_BUFFER_BINDING,
    );
    const currentFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    const blendEnabled = gl.isEnabled(gl.BLEND);
    const depthTestEnabled = gl.isEnabled(gl.DEPTH_TEST);
    const cullFaceEnabled = gl.isEnabled(gl.CULL_FACE);
    const stencilTestEnabled = gl.isEnabled(gl.STENCIL_TEST);
    const scissorTestEnabled = gl.isEnabled(gl.SCISSOR_TEST);

    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(null);

    for (let i = 0; i < 16; i++) {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
    gl.activeTexture(gl.TEXTURE0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.STENCIL_TEST);

    if (this.renderer) {
      (this.renderer as any).state = {};
    }

    this.scene.worldMatrixNeedsUpdate = true;
    this.scene.updateMatrixWorld();
    this.camera.updateMatrixWorld();
    const worlds = this.calcWrappedWorlds();

    if (!this._lastRenderLog || Date.now() - this._lastRenderLog > 2000) {
      console.log('[WindLayer] render - layer:', !!this.layer);
      const sourceCache = (this.layer as any)?.source?.sourceCache;
      if (sourceCache) {
        console.log(
          '[WindLayer] render - sourceCache.loaded():',
          sourceCache.loaded?.(),
        );
        const visibleTiles = sourceCache.getVisibleCoordinates?.();
        console.log(
          '[WindLayer] render - visible tiles:',
          visibleTiles?.length,
        );
        const cacheTiles = (sourceCache as any)?.cacheTiles;
        if (cacheTiles) {
          const firstTileKey = Object.keys(cacheTiles)[0];
          if (firstTileKey) {
            const tile = cacheTiles[firstTileKey];
            console.log(`[WindLayer] tile ${firstTileKey}:`, {
              state: tile?.state,
              hasData: tile?.hasData?.(),
              texturesSize: tile?.textures?.size,
            });
          }
        }
      }
      const renderPipeline = (this.layer as any)?.renderPipeline;
      if (renderPipeline) {
        console.log(
          '[WindLayer] render - pipeline passes:',
          renderPipeline.passes?.length,
        );
      }
      const glError = gl.getError();
      if (glError !== gl.NO_ERROR) {
        console.error('[WindLayer] WebGL error before render:', glError);
      }
      this._lastRenderLog = Date.now();
    }

    this.layer?.render({
      worlds,
      camera: this.camera,
      planeCamera: this.planeCamera,
    });

    const glError = gl.getError();
    if (
      glError !== gl.NO_ERROR &&
      (!this._lastErrorLog || Date.now() - this._lastErrorLog > 2000)
    ) {
      console.error('[WindLayer] WebGL error after render:', glError);
      this._lastErrorLog = Date.now();
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, currentFramebuffer);
    gl.bindVertexArray(currentVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, currentArrayBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, currentElementBuffer);
    gl.useProgram(currentProgram);

    if (blendEnabled) gl.enable(gl.BLEND);
    else gl.disable(gl.BLEND);
    if (depthTestEnabled) gl.enable(gl.DEPTH_TEST);
    else gl.disable(gl.DEPTH_TEST);
    if (cullFaceEnabled) gl.enable(gl.CULL_FACE);
    else gl.disable(gl.CULL_FACE);
    if (stencilTestEnabled) gl.enable(gl.STENCIL_TEST);
    else gl.disable(gl.STENCIL_TEST);
    if (scissorTestEnabled) gl.enable(gl.SCISSOR_TEST);
    else gl.disable(gl.SCISSOR_TEST);
  }

  private _lastRenderLog?: number;
  private _lastErrorLog?: number;
}
