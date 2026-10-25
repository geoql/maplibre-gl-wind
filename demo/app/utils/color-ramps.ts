import type { ColorStop } from 'maplibre-gl-wind';

export type RampId = 'auto' | 'spectral' | 'ember' | 'ink';

export const RAMP_LABEL: Record<RampId, string> = {
  auto: 'Auto',
  spectral: 'Spectral',
  ember: 'Ember',
  ink: 'Ink',
};

/**
 * Speed-based colour stops. `ink` follows the page theme; `auto` picks the
 * ramp that reads on the current basemap (Spectral on the dark map, Ember
 * against the blue water of the light one).
 */
export function colorRamp(id: RampId, dark: boolean): ColorStop[] {
  if (id === 'auto') return colorRamp(dark ? 'spectral' : 'ember', dark);
  if (id === 'ember') {
    return [
      [0, [255, 214, 170, 200]],
      [0.35, [246, 140, 64, 255]],
      [0.7, [214, 72, 40, 255]],
      [1, [140, 20, 60, 255]],
    ];
  }
  if (id === 'ink') {
    return dark
      ? [
          [0, [160, 170, 190, 150]],
          [1, [250, 246, 238, 255]],
        ]
      : [
          [0, [120, 128, 145, 150]],
          [1, [24, 28, 40, 255]],
        ];
  }
  return [
    [0, [59, 130, 189, 255]],
    [0.15, [102, 194, 165, 255]],
    [0.3, [171, 221, 164, 255]],
    [0.45, [254, 224, 139, 255]],
    [0.6, [253, 174, 97, 255]],
    [0.75, [244, 109, 67, 255]],
    [1, [213, 62, 79, 255]],
  ];
}
