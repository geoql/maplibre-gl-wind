import type {
  Color,
  DefaultProps,
  LayerContext,
  UpdateParameters,
} from '@deck.gl/core';
import { LineLayer } from '@deck.gl/layers';
import type { LineLayerProps } from '@deck.gl/layers';
import type { Buffer, Texture } from '@luma.gl/core';
import { BufferTransform } from '@luma.gl/engine';
import type { Model } from '@luma.gl/engine';
import type { ShaderModule } from '@luma.gl/shadertools';
import shader from './wind-particle-transform.glsl';

const FPS = 60;
const DEFAULT_COLOR: [number, number, number, number] = [255, 255, 255, 255];
const COLOR_RAMP_WIDTH = 256;

export type ColorStop = [number, Color];

export type WindUniformProps = {
  numParticles: number;
  maxAge: number;
  speedFactor: number;
  time: number;
  seed: number;
  viewportBounds: number[];
  viewportZoomChangeFactor: number;
  imageUnscale: number[];
  bounds: number[];
  windTexture: Texture;
};

const uniformBlock = `\
uniform windUniforms {
  float numParticles;
  float maxAge;
  float speedFactor;
  float time;
  float seed;
  vec4 viewportBounds;
  float viewportZoomChangeFactor;
  vec2 imageUnscale;
  vec4 bounds;
} wind;
`;

export const windUniforms = {
  name: 'wind',
  vs: uniformBlock,
  fs: uniformBlock,
  uniformTypes: {
    numParticles: 'f32',
    maxAge: 'f32',
    speedFactor: 'f32',
    time: 'f32',
    seed: 'f32',
    viewportBounds: 'vec4<f32>' as const,
    viewportZoomChangeFactor: 'f32',
    imageUnscale: 'vec2<f32>' as const,
    bounds: 'vec4<f32>' as const,
  },
} as ShaderModule<WindUniformProps>;

export type WindParticleLayerProps<D = unknown> = LineLayerProps<D> & {
  image: string | Texture | null;
  bounds: number[];
  imageUnscale: number[];
  numParticles: number;
  maxAge: number;
  speedFactor: number;
  color: Color;
  colorRamp?: ColorStop[];
  speedRange?: [number, number];
  width: number;
  animate?: boolean;
  wrapLongitude: boolean;
};

const defaultColorRamp: ColorStop[] = [
  [0.0, [59, 130, 189, 255]],
  [0.1, [102, 194, 165, 255]],
  [0.2, [171, 221, 164, 255]],
  [0.3, [230, 245, 152, 255]],
  [0.4, [254, 224, 139, 255]],
  [0.5, [253, 174, 97, 255]],
  [0.6, [244, 109, 67, 255]],
  [1.0, [213, 62, 79, 255]],
];

const defaultProps: DefaultProps<WindParticleLayerProps> = {
  ...LineLayer.defaultProps,
  image: { type: 'image', value: null, async: true },
  imageUnscale: { type: 'array', value: [0, 0] },
  numParticles: { type: 'number', min: 1, max: 1000000, value: 8192 },
  maxAge: { type: 'number', min: 1, max: 255, value: 50 },
  speedFactor: { type: 'number', min: 0, max: 1000, value: 50 },
  color: { type: 'color', value: DEFAULT_COLOR },
  colorRamp: { type: 'array', value: defaultColorRamp, compare: true },
  speedRange: { type: 'array', value: [0, 30], compare: true },
  width: { type: 'number', value: 1.5 },
  animate: { type: 'boolean', value: true },
  bounds: { type: 'array', value: [-180, -90, 180, 90], compare: true },
  wrapLongitude: true,
};

interface WindParticleState {
  [key: string]: unknown;
  model?: Model;
  initialized: boolean;
  numInstances: number;
  numAgedInstances: number;
  sourcePositions: Buffer;
  targetPositions: Buffer;
  sourcePositions64Low: Float32Array;
  targetPositions64Low: Float32Array;
  colors: Buffer;
  widths: Float32Array;
  transform: BufferTransform;
  previousViewportZoom: number;
  previousTime: number;
  texture: Texture;
  colorRampTexture: Texture;
  stepRequested: boolean;
}

function modulo(x: number, y: number): number {
  return ((x % y) + y) % y;
}

function wrapLongitude(
  lng: number,
  minLng: number | undefined = undefined,
): number {
  let wrappedLng = modulo(lng + 180, 360) - 180;
  if (typeof minLng === 'number' && wrappedLng < minLng) {
    wrappedLng += 360;
  }
  return wrappedLng;
}

function wrapBounds(bounds: [number, number, number, number]): number[] {
  const minLng = bounds[2] - bounds[0] < 360 ? wrapLongitude(bounds[0]) : -180;
  const maxLng =
    bounds[2] - bounds[0] < 360 ? wrapLongitude(bounds[2], minLng) : 180;
  const minLat = Math.max(bounds[1], -90);
  const maxLat = Math.min(bounds[3], 90);
  return [minLng, minLat, maxLng, maxLat];
}

function getViewportBounds(viewport: { getBounds: () => number[] }): number[] {
  return wrapBounds(viewport.getBounds() as [number, number, number, number]);
}

function createColorRampData(colorRamp: ColorStop[]): Uint8Array {
  const data = new Uint8Array(COLOR_RAMP_WIDTH * 4);
  const sortedStops = [...colorRamp].sort((a, b) => a[0] - b[0]);

  for (let i = 0; i < COLOR_RAMP_WIDTH; i++) {
    const t = i / (COLOR_RAMP_WIDTH - 1);
    let color: Color = sortedStops[0][1];

    for (let j = 0; j < sortedStops.length - 1; j++) {
      const [t0, c0] = sortedStops[j];
      const [t1, c1] = sortedStops[j + 1];
      if (t >= t0 && t <= t1) {
        const localT = (t - t0) / (t1 - t0);
        color = [
          Math.round(c0[0] + (c1[0] - c0[0]) * localT),
          Math.round(c0[1] + (c1[1] - c0[1]) * localT),
          Math.round(c0[2] + (c1[2] - c0[2]) * localT),
          Math.round(
            (c0[3] ?? 255) + ((c1[3] ?? 255) - (c0[3] ?? 255)) * localT,
          ),
        ];
        break;
      }
    }

    if (t > sortedStops[sortedStops.length - 1][0]) {
      color = sortedStops[sortedStops.length - 1][1];
    }

    data[i * 4] = color[0];
    data[i * 4 + 1] = color[1];
    data[i * 4 + 2] = color[2];
    data[i * 4 + 3] = color[3] ?? 255;
  }

  return data;
}

export default class WindParticleLayer<
  D = unknown,
  ExtraPropsT = WindParticleLayerProps<D>,
> extends LineLayer<D, ExtraPropsT & WindParticleLayerProps<D>> {
  static layerName = 'WindParticleLayer';
  static defaultProps = defaultProps;

  declare state: WindParticleState;

  getNumInstances(): number {
    return this.state?.numInstances || 0;
  }

  getShaders() {
    const oldShaders = super.getShaders();
    const { speedRange, imageUnscale, bounds } = this.props;
    const [minSpeed, maxSpeed] = speedRange || [0, 30];

    return {
      ...oldShaders,
      inject: {
        'vs:#decl': `
          uniform sampler2D windTexture;
          uniform sampler2D colorRampTexture;
          out float vDrop;
          out float vSpeed;
          out vec4 vSpeedColor;
          const vec2 DROP_POSITION = vec2(0);

          vec2 getWindUV(vec2 pos) {
            vec4 b = vec4(${bounds[0].toFixed(6)}, ${bounds[1].toFixed(6)}, ${bounds[2].toFixed(6)}, ${bounds[3].toFixed(6)});
            return vec2(
              (pos.x - b[0]) / (b[2] - b[0]),
              (pos.y - b[3]) / (b[1] - b[3])
            );
          }

          vec2 getWindVelocity(vec4 windColor) {
            vec2 unscale = vec2(${imageUnscale[0].toFixed(6)}, ${imageUnscale[1].toFixed(6)});
            if(unscale[0] < unscale[1]) {
              return mix(vec2(unscale[0]), vec2(unscale[1]), windColor.xy);
            } else {
              return windColor.xy;
            }
          }
        `,
        'vs:#main-start': `
          vDrop = float(instanceSourcePositions.xy == DROP_POSITION || instanceTargetPositions.xy == DROP_POSITION);

          vec2 midPos = (instanceSourcePositions.xy + instanceTargetPositions.xy) * 0.5;
          vec2 windUV = getWindUV(midPos);
          vec4 windColor = texture(windTexture, windUV);
          vec2 velocity = getWindVelocity(windColor);
          float speed = length(velocity);

          float minSpd = ${minSpeed.toFixed(6)};
          float maxSpd = ${maxSpeed.toFixed(6)};
          float speedNorm = clamp((speed - minSpd) / (maxSpd - minSpd), 0.0, 1.0);
          vSpeed = speedNorm;
          vSpeedColor = texture(colorRampTexture, vec2(speedNorm, 0.5));
        `,
        'fs:#decl': `
          in float vDrop;
          in float vSpeed;
          in vec4 vSpeedColor;
        `,
        'fs:#main-start': `
          if (vDrop > 0.5) discard;
        `,
        'fs:DECKGL_FILTER_COLOR': `
          color = vSpeedColor;
          color.a *= geometry.uv.x;
        `,
      },
    };
  }

  initializeState() {
    super.initializeState();
    this._setupTransformFeedback();
    const attributeManager = this.getAttributeManager();
    attributeManager!.remove([
      'instanceSourcePositions',
      'instanceTargetPositions',
      'instanceColors',
      'instanceWidths',
    ]);
    attributeManager!.addInstanced({
      instanceSourcePositions: {
        size: 3,
        type: 'float32',
        noAlloc: true,
      },
      instanceTargetPositions: {
        size: 3,
        type: 'float32',
        noAlloc: true,
      },
      instanceColors: {
        size: 4,
        type: 'float32',
        noAlloc: true,
      },
    });
  }

  updateState(params: UpdateParameters<this>) {
    super.updateState(params);
    const { props, oldProps } = params;
    const { numParticles, maxAge, width, image, colorRamp } = props;
    if (!numParticles || !maxAge || !width) {
      this._deleteTransformFeedback();
      return;
    }

    if (
      image !== oldProps.image ||
      numParticles !== oldProps.numParticles ||
      maxAge !== oldProps.maxAge ||
      width !== oldProps.width ||
      colorRamp !== oldProps.colorRamp
    ) {
      this._setupTransformFeedback();
    }
  }

  finalizeState(context: LayerContext) {
    this._deleteTransformFeedback();
    super.finalizeState(context);
  }

  draw({ uniforms }: { uniforms: Record<string, unknown> }) {
    const { initialized } = this.state;
    if (!initialized) {
      return;
    }

    const { animate } = this.props;
    const {
      sourcePositions,
      targetPositions,
      sourcePositions64Low,
      targetPositions64Low,
      colors,
      widths,
      model,
      texture,
      colorRampTexture,
    } = this.state;

    model!.setAttributes({
      instanceSourcePositions: sourcePositions,
      instanceTargetPositions: targetPositions,
      instanceColors: colors,
    });
    model!.setConstantAttributes({
      instanceSourcePositions64Low: sourcePositions64Low,
      instanceTargetPositions64Low: targetPositions64Low,
      instanceWidths: widths,
    });

    model!.setBindings({
      windTexture: texture,
      colorRampTexture: colorRampTexture,
    });

    super.draw({ uniforms });

    if (animate) {
      this.requestStep();
    }
  }

  _setupTransformFeedback() {
    const { initialized } = this.state || {};
    if (initialized) {
      this._deleteTransformFeedback();
    }

    const { image, numParticles, maxAge, width, colorRamp } = this.props;
    if (typeof image === 'string' || image === null) {
      return;
    }

    const numInstances = numParticles * maxAge;
    const numAgedInstances = numParticles * (maxAge - 1);
    const sourcePositions = this.context.device.createBuffer(
      new Float32Array(numInstances * 3),
    );
    const targetPositions = this.context.device.createBuffer(
      new Float32Array(numInstances * 3),
    );

    const colors = this.context.device.createBuffer(
      new Float32Array(
        new Array(numInstances)
          .fill(undefined)
          .map((_, i) => {
            const age = Math.floor(i / numParticles);
            return [1.0, 1.0, 1.0, 1.0 * (1 - age / maxAge)];
          })
          .flat(),
      ),
    );

    const colorRampData = createColorRampData(colorRamp || defaultColorRamp);
    const colorRampTexture = this.context.device.createTexture({
      width: COLOR_RAMP_WIDTH,
      height: 1,
      format: 'rgba8unorm',
      sampler: {
        minFilter: 'linear',
        magFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
      },
      data: colorRampData,
    });

    const sourcePositions64Low = new Float32Array([0, 0, 0]);
    const targetPositions64Low = new Float32Array([0, 0, 0]);
    const widths = new Float32Array([width]);

    const transform = new BufferTransform(this.context.device, {
      attributes: {
        sourcePosition: sourcePositions,
      },
      bufferLayout: [
        {
          name: 'sourcePosition',
          format: 'float32x3',
        },
      ],
      feedbackBuffers: {
        targetPosition: targetPositions,
      },
      vs: shader,
      varyings: ['targetPosition'],
      modules: [windUniforms as ShaderModule],
      vertexCount: numParticles,
    });

    this.setState({
      initialized: true,
      numInstances,
      numAgedInstances,
      sourcePositions,
      targetPositions,
      sourcePositions64Low,
      targetPositions64Low,
      colors,
      widths,
      transform,
      texture: image,
      colorRampTexture,
      previousViewportZoom: 0,
      previousTime: 0,
    });
  }

  _runTransformFeedback() {
    const { initialized } = this.state || {};
    if (!initialized) {
      return;
    }

    const { viewport, timeline } = this.context;
    const { imageUnscale, bounds, numParticles, speedFactor, maxAge } =
      this.props;
    const {
      previousTime,
      previousViewportZoom,
      transform,
      sourcePositions,
      targetPositions,
      numAgedInstances,
      texture,
    } = this.state;

    const time = timeline.getTime();
    if (time === previousTime) {
      return;
    }

    const viewportBounds = getViewportBounds(viewport);
    const viewportZoomChangeFactor =
      2 ** ((previousViewportZoom - viewport.zoom) * 4);
    const currentSpeedFactor =
      (speedFactor * 0.01) / Math.pow(2, viewport.zoom);

    const moduleUniforms: WindUniformProps = {
      windTexture: texture,
      viewportBounds: viewportBounds || [0, 0, 0, 0],
      viewportZoomChangeFactor: viewportZoomChangeFactor || 0,
      imageUnscale: imageUnscale || [0, 0],
      bounds,
      numParticles,
      maxAge,
      speedFactor: currentSpeedFactor,
      time,
      seed: Math.random(),
    };
    transform.model.shaderInputs.setProps({ wind: moduleUniforms });
    transform.run({
      clearColor: false,
      clearDepth: false,
      clearStencil: false,
      depthReadOnly: true,
      stencilReadOnly: true,
    });

    const encoder = this.context.device.createCommandEncoder();
    encoder.copyBufferToBuffer({
      sourceBuffer: sourcePositions,
      sourceOffset: 0,
      destinationBuffer: targetPositions,
      destinationOffset: numParticles * 4 * 3,
      size: numAgedInstances * 4 * 3,
    });
    encoder.finish();
    encoder.destroy();

    this.state.sourcePositions = targetPositions;
    this.state.targetPositions = sourcePositions;
    transform.model.setAttributes({
      sourcePosition: targetPositions,
    });
    transform.transformFeedback.setBuffers({
      targetPosition: sourcePositions,
    });

    this.state.previousViewportZoom = viewport.zoom;
    this.state.previousTime = time;
  }

  _resetTransformFeedback() {
    const { initialized } = this.state || {};
    if (!initialized) {
      return;
    }

    const { sourcePositions, targetPositions, numInstances } = this.state;
    sourcePositions.write(new Float32Array(numInstances * 3));
    targetPositions.write(new Float32Array(numInstances * 3));
  }

  _deleteTransformFeedback() {
    const { initialized } = this.state || {};
    if (!initialized) {
      return;
    }

    const {
      sourcePositions,
      targetPositions,
      colors,
      transform,
      colorRampTexture,
    } = this.state;
    sourcePositions?.destroy();
    targetPositions?.destroy();
    colors?.destroy();
    transform?.destroy();
    colorRampTexture?.destroy();

    this.setState({
      initialized: false,
      sourcePositions: undefined,
      targetPositions: undefined,
      colors: undefined,
      transform: undefined,
      colorRampTexture: undefined,
    });
  }

  requestStep() {
    const { stepRequested } = this.state || {};
    if (stepRequested) {
      return;
    }

    this.state.stepRequested = true;
    setTimeout(() => {
      this.step();
      this.state.stepRequested = false;
    }, 1000 / FPS);
  }

  step() {
    this._runTransformFeedback();
    this.setNeedsRedraw();
  }

  clear() {
    this._resetTransformFeedback();
    this.setNeedsRedraw();
  }
}
