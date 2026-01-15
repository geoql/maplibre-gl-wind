export { default as WindLayer } from './layer';
export type { LayerOptions } from './layer';

export { SimpleWindLayer } from './simple-wind';
export type { SimpleWindLayerOptions, WindData } from './simple-wind';

export {
  RenderType,
  RenderFrom,
  DecodeType,
  LayerSourceType,
  MaskType,
  TileSource,
  ImageSource,
  TimelineSource,
  TileID,
  configDeps,
  type SourceType,
  type UserOptions,
  type TileSourceOptions,
  type ImageSourceOptions,
} from 'wind-gl-core';
