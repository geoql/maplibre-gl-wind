import maplibregl from 'maplibre-gl';

const drawVert = `
precision highp float;

attribute float a_index;

uniform sampler2D u_particles;
uniform float u_particles_res;
uniform mat4 u_matrix;

varying vec2 v_particle_pos;

const float PI = 3.141592653589793;

void main() {
    vec4 color = texture2D(u_particles, vec2(
        fract(a_index / u_particles_res),
        floor(a_index / u_particles_res) / u_particles_res));

    // Decode particle position (0-1 UV space)
    v_particle_pos = vec2(
        color.r / 255.0 + color.b,
        color.g / 255.0 + color.a);

    // UV to lon/lat: wind data covers -180 to 180 lon, ~85 to -85 lat
    float lon = v_particle_pos.x * 360.0 - 180.0;
    float lat = (1.0 - v_particle_pos.y) * 170.0 - 85.0;

    // Clamp latitude for Mercator
    lat = clamp(lat, -85.0, 85.0);

    // Lon/lat to Mercator (0-1 world coordinates)
    float x = (lon + 180.0) / 360.0;
    float latRad = lat * PI / 180.0;
    float y = (1.0 - log(tan(PI / 4.0 + latRad / 2.0)) / PI) / 2.0;

    gl_PointSize = 1.0;
    gl_Position = u_matrix * vec4(x, y, 0.0, 1.0);
}
`;

const drawFrag = `
precision highp float;

uniform sampler2D u_wind;
uniform vec2 u_wind_min;
uniform vec2 u_wind_max;
uniform sampler2D u_color_ramp;

varying vec2 v_particle_pos;

void main() {
    vec2 velocity = mix(u_wind_min, u_wind_max, texture2D(u_wind, v_particle_pos).rg);
    float speed_t = length(velocity) / length(u_wind_max);
    vec2 ramp_pos = vec2(fract(16.0 * speed_t), floor(16.0 * speed_t) / 16.0);
    gl_FragColor = texture2D(u_color_ramp, ramp_pos);
}
`;

const quadVert = `
precision highp float;

attribute vec2 a_pos;

varying vec2 v_tex_pos;

void main() {
    v_tex_pos = a_pos;
    gl_Position = vec4(1.0 - 2.0 * a_pos, 0, 1);
}
`;

const updateFrag = `
precision highp float;

uniform sampler2D u_particles;
uniform sampler2D u_wind;
uniform vec2 u_wind_res;
uniform vec2 u_wind_min;
uniform vec2 u_wind_max;
uniform float u_rand_seed;
uniform float u_speed_factor;
uniform float u_drop_rate;
uniform float u_drop_rate_bump;

varying vec2 v_tex_pos;

const vec3 rand_constants = vec3(12.9898, 78.233, 4375.85453);

float rand(const vec2 co) {
    float t = dot(rand_constants.xy, co);
    return fract(sin(t) * (rand_constants.z + t));
}

vec2 lookup_wind(const vec2 uv) {
    vec2 px = 1.0 / u_wind_res;
    vec2 vc = (floor(uv * u_wind_res)) * px;
    vec2 f = fract(uv * u_wind_res);
    vec2 tl = texture2D(u_wind, vc).rg;
    vec2 tr = texture2D(u_wind, vc + vec2(px.x, 0)).rg;
    vec2 bl = texture2D(u_wind, vc + vec2(0, px.y)).rg;
    vec2 br = texture2D(u_wind, vc + px).rg;
    return mix(mix(tl, tr, f.x), mix(bl, br, f.x), f.y);
}

void main() {
    vec4 color = texture2D(u_particles, v_tex_pos);
    vec2 pos = vec2(color.r / 255.0 + color.b, color.g / 255.0 + color.a);
    vec2 velocity = mix(u_wind_min, u_wind_max, lookup_wind(pos));
    float speed_t = length(velocity) / length(u_wind_max);
    vec2 offset = vec2(velocity.x, -velocity.y) * 0.0001 * u_speed_factor;
    pos = fract(1.0 + pos + offset);
    vec2 seed = (pos + v_tex_pos) * u_rand_seed;
    float drop_rate = u_drop_rate + speed_t * u_drop_rate_bump;
    float drop = step(1.0 - drop_rate, rand(seed));
    vec2 random_pos = vec2(rand(seed + 1.3), rand(seed + 2.1));
    pos = mix(pos, random_pos, drop);
    gl_FragColor = vec4(fract(pos * 255.0), floor(pos * 255.0) / 255.0);
}
`;

function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertSource: string,
  fragSource: string,
) {
  const vert = createShader(gl, gl.VERTEX_SHADER, vertSource);
  const frag = createShader(gl, gl.FRAGMENT_SHADER, fragSource);
  if (!vert || !frag) return null;

  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    return null;
  }

  const wrapper: any = { program };
  const numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
  for (let i = 0; i < numAttributes; i++) {
    const attr = gl.getActiveAttrib(program, i);
    if (attr) wrapper[attr.name] = gl.getAttribLocation(program, attr.name);
  }
  const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < numUniforms; i++) {
    const uniform = gl.getActiveUniform(program, i);
    if (uniform)
      wrapper[uniform.name] = gl.getUniformLocation(program, uniform.name);
  }
  return wrapper;
}

function createTexture(
  gl: WebGL2RenderingContext,
  filter: number,
  data: Uint8Array | HTMLImageElement,
  width?: number,
  height?: number,
) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  if (data instanceof HTMLImageElement) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);
  } else {
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width!,
      height!,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data,
    );
  }
  return texture;
}

function bindTexture(
  gl: WebGL2RenderingContext,
  texture: WebGLTexture | null,
  unit: number,
) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
}

function createBuffer(gl: WebGL2RenderingContext, data: Float32Array) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return buffer;
}

function bindAttribute(
  gl: WebGL2RenderingContext,
  buffer: WebGLBuffer | null,
  attribute: number,
  numComponents: number,
) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(attribute);
  gl.vertexAttribPointer(attribute, numComponents, gl.FLOAT, false, 0, 0);
}

function bindFramebuffer(
  gl: WebGL2RenderingContext,
  framebuffer: WebGLFramebuffer | null,
  texture?: WebGLTexture | null,
) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  if (texture) {
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0,
    );
  }
}

function getColorRamp(colors: Record<number, string>): Uint8Array {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = 256;
  canvas.height = 1;
  const gradient = ctx.createLinearGradient(0, 0, 256, 0);
  for (const stop in colors) {
    gradient.addColorStop(+stop, colors[stop]);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 1);
  return new Uint8Array(ctx.getImageData(0, 0, 256, 1).data);
}

export interface SimpleWindLayerOptions {
  numParticles?: number;
  fadeOpacity?: number;
  speedFactor?: number;
  dropRate?: number;
  dropRateBump?: number;
  colors?: Record<number, string>;
}

export interface WindData {
  image: HTMLImageElement;
  width: number;
  height: number;
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
}

const defaultColors: Record<number, string> = {
  0.0: '#3288bd',
  0.1: '#66c2a5',
  0.2: '#abdda4',
  0.3: '#e6f598',
  0.4: '#fee08b',
  0.5: '#fdae61',
  0.6: '#f46d43',
  1.0: '#d53e4f',
};

export class SimpleWindLayer implements maplibregl.CustomLayerInterface {
  id: string;
  type: 'custom' = 'custom';
  renderingMode: '2d' | '3d' = '2d';

  private gl: WebGL2RenderingContext | null = null;
  private map: maplibregl.Map | null = null;
  private windData: WindData | null = null;
  private options: Required<SimpleWindLayerOptions>;

  private drawProgram: any = null;
  private updateProgram: any = null;

  private quadBuffer: WebGLBuffer | null = null;
  private particleIndexBuffer: WebGLBuffer | null = null;
  private framebuffer: WebGLFramebuffer | null = null;

  private windTexture: WebGLTexture | null = null;
  private particleStateTexture0: WebGLTexture | null = null;
  private particleStateTexture1: WebGLTexture | null = null;
  private colorRampTexture: WebGLTexture | null = null;

  private particleStateResolution: number = 0;
  private _numParticles: number = 0;

  constructor(id: string, options?: SimpleWindLayerOptions) {
    this.id = id;
    this.options = {
      numParticles: options?.numParticles ?? 65536,
      fadeOpacity: options?.fadeOpacity ?? 0.996,
      speedFactor: options?.speedFactor ?? 0.25,
      dropRate: options?.dropRate ?? 0.003,
      dropRateBump: options?.dropRateBump ?? 0.01,
      colors: options?.colors ?? defaultColors,
    };
  }

  setWindData(data: WindData) {
    this.windData = data;
    if (this.gl && data.image) {
      this.windTexture = createTexture(this.gl, this.gl.LINEAR, data.image);
    }
  }

  onAdd(map: maplibregl.Map, gl: WebGLRenderingContext) {
    this.map = map;
    this.gl = gl as WebGL2RenderingContext;

    this.drawProgram = createProgram(this.gl, drawVert, drawFrag);
    this.updateProgram = createProgram(this.gl, quadVert, updateFrag);

    if (!this.drawProgram || !this.updateProgram) {
      console.error('[SimpleWindLayer] Failed to create shaders');
      return;
    }

    console.log('[SimpleWindLayer] Shaders created successfully');

    this.quadBuffer = createBuffer(
      this.gl,
      new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
    );
    this.framebuffer = this.gl.createFramebuffer();

    this.colorRampTexture = createTexture(
      this.gl,
      this.gl.LINEAR,
      getColorRamp(this.options.colors),
      16,
      16,
    );

    this.setNumParticles(this.options.numParticles);

    if (this.windData?.image) {
      this.windTexture = createTexture(
        this.gl,
        this.gl.LINEAR,
        this.windData.image,
      );
    }
  }

  onRemove() {
    this.map = null;
    this.gl = null;
  }

  private setNumParticles(numParticles: number) {
    if (!this.gl) return;

    const particleRes = (this.particleStateResolution = Math.ceil(
      Math.sqrt(numParticles),
    ));
    this._numParticles = particleRes * particleRes;

    const particleState = new Uint8Array(this._numParticles * 4);
    for (let i = 0; i < particleState.length; i++) {
      particleState[i] = Math.floor(Math.random() * 256);
    }

    this.particleStateTexture0 = createTexture(
      this.gl,
      this.gl.NEAREST,
      particleState,
      particleRes,
      particleRes,
    );
    this.particleStateTexture1 = createTexture(
      this.gl,
      this.gl.NEAREST,
      particleState,
      particleRes,
      particleRes,
    );

    const particleIndices = new Float32Array(this._numParticles);
    for (let i = 0; i < this._numParticles; i++) particleIndices[i] = i;
    this.particleIndexBuffer = createBuffer(this.gl, particleIndices);
  }

  render(
    _gl: WebGLRenderingContext | WebGL2RenderingContext,
    options: maplibregl.CustomRenderMethodInput,
  ) {
    if (!this.gl || !this.windData || !this.windTexture || !this.map) return;

    const gl = this.gl;
    const matrix = options.modelViewProjectionMatrix;

    bindTexture(gl, this.windTexture, 0);
    bindTexture(gl, this.particleStateTexture0, 1);

    this.drawParticles(new Float32Array(matrix));
    this.updateParticles();

    this.map.triggerRepaint();
  }

  private drawParticles(matrix: Float32Array) {
    const gl = this.gl!;
    const program = this.drawProgram;
    gl.useProgram(program.program);

    bindAttribute(gl, this.particleIndexBuffer, program.a_index, 1);
    bindTexture(gl, this.colorRampTexture, 2);

    gl.uniform1i(program.u_wind, 0);
    gl.uniform1i(program.u_particles, 1);
    gl.uniform1i(program.u_color_ramp, 2);

    gl.uniform1f(program.u_particles_res, this.particleStateResolution);
    gl.uniform2f(program.u_wind_min, this.windData!.uMin, this.windData!.vMin);
    gl.uniform2f(program.u_wind_max, this.windData!.uMax, this.windData!.vMax);

    gl.uniformMatrix4fv(program.u_matrix, false, matrix);

    gl.drawArrays(gl.POINTS, 0, this._numParticles);
  }

  private updateParticles() {
    const gl = this.gl!;

    const savedViewport = gl.getParameter(gl.VIEWPORT);
    const savedFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);

    bindFramebuffer(gl, this.framebuffer, this.particleStateTexture1);
    gl.viewport(
      0,
      0,
      this.particleStateResolution,
      this.particleStateResolution,
    );

    const program = this.updateProgram;
    gl.useProgram(program.program);

    bindAttribute(gl, this.quadBuffer, program.a_pos, 2);

    gl.uniform1i(program.u_wind, 0);
    gl.uniform1i(program.u_particles, 1);

    gl.uniform1f(program.u_rand_seed, Math.random());
    gl.uniform2f(
      program.u_wind_res,
      this.windData!.width,
      this.windData!.height,
    );
    gl.uniform2f(program.u_wind_min, this.windData!.uMin, this.windData!.vMin);
    gl.uniform2f(program.u_wind_max, this.windData!.uMax, this.windData!.vMax);
    gl.uniform1f(program.u_speed_factor, this.options.speedFactor);
    gl.uniform1f(program.u_drop_rate, this.options.dropRate);
    gl.uniform1f(program.u_drop_rate_bump, this.options.dropRateBump);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindFramebuffer(gl.FRAMEBUFFER, savedFramebuffer);
    gl.viewport(
      savedViewport[0],
      savedViewport[1],
      savedViewport[2],
      savedViewport[3],
    );

    const temp = this.particleStateTexture0;
    this.particleStateTexture0 = this.particleStateTexture1;
    this.particleStateTexture1 = temp;
  }
}
