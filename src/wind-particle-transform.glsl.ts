const shader = `\
#version 300 es
#define SHADER_NAME wind-particle-transform-vertex-shader

precision highp float;

in vec3 sourcePosition;
out vec3 targetPosition;

uniform sampler2D windTexture;

const vec2 DROP_POSITION = vec2(0);

bool isNaN(float value) {
  return !(value <= 0.f || 0.f <= value);
}

float wrapLongitude(float lng) {
  float wrappedLng = mod(lng + 180.f, 360.f) - 180.f;
  return wrappedLng;
}

float wrapLongitude(float lng, float minLng) {
  float wrappedLng = wrapLongitude(lng);
  if(wrappedLng < minLng) {
    wrappedLng += 360.f;
  }
  return wrappedLng;
}

float randFloat(vec2 seed) {
  return fract(sin(dot(seed.xy, vec2(12.9898f, 78.233f))) * 43758.5453f);
}

vec2 randPoint(vec2 seed) {
  return vec2(randFloat(seed + 1.3f), randFloat(seed + 2.1f));
}

vec2 pointToPosition(vec2 point) {
  point.y = smoothstep(0.f, 1.f, point.y);
  vec2 viewportBoundsMin = wind.viewportBounds.xy;
  vec2 viewportBoundsMax = wind.viewportBounds.zw;
  return mix(viewportBoundsMin, viewportBoundsMax, point);
}

bool isPositionInBounds(vec2 position, vec4 bounds) {
  vec2 boundsMin = bounds.xy;
  vec2 boundsMax = bounds.zw;
  float lng = wrapLongitude(position.x, boundsMin.x);
  float lat = position.y;
  return (boundsMin.x <= lng && lng <= boundsMax.x &&
    boundsMin.y <= lat && lat <= boundsMax.y);
}

bool isPositionInViewport(vec2 position) {
  return isPositionInBounds(position, wind.viewportBounds);
}

vec2 getUV(vec2 pos) {
  return vec2(
    (pos.x - wind.bounds[0]) / (wind.bounds[2] - wind.bounds[0]),
    (pos.y - wind.bounds[3]) / (wind.bounds[1] - wind.bounds[3])
  );
}

bool rasterHasValues(vec4 values) {
  if(wind.imageUnscale[0] < wind.imageUnscale[1]) {
    return values.a >= 1.f;
  } else {
    return !isNaN(values.x);
  }
}

vec2 rasterGetValues(vec4 colour) {
  if(wind.imageUnscale[0] < wind.imageUnscale[1]) {
    return mix(vec2(wind.imageUnscale[0]), vec2(wind.imageUnscale[1]), colour.xy);
  } else {
    return colour.xy;
  }
}

vec2 updatedPosition(vec2 position, vec2 speed) {
  float distortion = cos(radians(position.y));
  vec2 offset;
  offset = vec2(speed.x, speed.y * distortion);
  return position + offset;
}

void main() {
  float particleIndex = mod(float(gl_VertexID), wind.numParticles);
  float particleAge = floor(float(gl_VertexID) / wind.numParticles);

  if(particleAge > 0.f) {
    return;
  }

  if(sourcePosition.xy == DROP_POSITION) {
    vec2 particleSeed = vec2(particleIndex * wind.seed / wind.numParticles);
    vec2 point = randPoint(particleSeed);
    vec2 position = pointToPosition(point);
    targetPosition.xy = position;
    targetPosition.x = wrapLongitude(targetPosition.x);
    return;
  }

  if(wind.viewportZoomChangeFactor > 1.f && mod(particleIndex, wind.viewportZoomChangeFactor) >= 1.f) {
    targetPosition.xy = DROP_POSITION;
    return;
  }

  if(abs(mod(particleIndex, wind.maxAge + 2.f) - mod(wind.time, wind.maxAge + 2.f)) < 1.f) {
    targetPosition.xy = DROP_POSITION;
    return;
  }

  if(!isPositionInBounds(sourcePosition.xy, wind.bounds)) {
    targetPosition.xy = sourcePosition.xy;
    return;
  }

  if(!isPositionInViewport(sourcePosition.xy)) {
    targetPosition.xy = DROP_POSITION;
    return;
  }

  vec2 uv = getUV(sourcePosition.xy);
  vec4 windColour = texture(windTexture, uv);

  if(!rasterHasValues(windColour)) {
    targetPosition.xy = DROP_POSITION;
    return;
  }

  vec2 speed = rasterGetValues(windColour) * wind.speedFactor;
  targetPosition.xy = updatedPosition(sourcePosition.xy, speed);
  targetPosition.x = wrapLongitude(targetPosition.x);
}
`;

export default shader;
