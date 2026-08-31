struct Camera {
  viewProjection: mat4x4f,
  position: vec3f,
}

struct Model {
  model: mat4x4f,
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<uniform> model: Model;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) worldPosition: vec3f,
  @location(1) normal: vec3f,
  @location(2) objectZ: f32,
}

@vertex fn vs_main(
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
) -> VertexOut {
  var out: VertexOut;
  let world = model.model * vec4f(position, 1.0);
  out.worldPosition = world.xyz;
  out.normal = (model.model * vec4f(normal, 0.0)).xyz;
  out.objectZ = position.z;
  out.position = camera.viewProjection * world;
  return out;
}

const CELL = 12.0;
const BANDS = 4.0;
const LEVELS = 6.0;

fn snap3(v: vec3f, fragXy: vec2f) -> vec3f {
  let center = floor(fragXy / CELL) * CELL + CELL * 0.5;
  let d = center - fragXy;
  return v + dpdx(v) * d.x + dpdy(v) * d.y;
}

@fragment fn fs_main(
  @builtin(position) frag: vec4f,
  @location(0) worldPosition: vec3f,
  @location(1) normal: vec3f,
  @location(2) objectZ: f32,
) -> @location(0) vec4f {
  let revealed = objectZ < 0.0;
  let p = select(worldPosition, snap3(worldPosition, frag.xy), revealed);
  let nRaw = select(normal, snap3(normal, frag.xy), revealed);
  let nFacet = normalize(round(nRaw * BANDS) / BANDS);
  let n = normalize(select(nRaw, nFacet, revealed));

  let lightDir = normalize(vec3f(0.35, 0.8, 0.45));
  let viewDir = normalize(camera.position - p);
  let ambient = 0.18;
  let diffuse = max(dot(n, lightDir), 0.0);
  let halfVec = normalize(lightDir + viewDir);
  let specular = pow(max(dot(n, halfVec), 0.0), 28.0) * 0.22;
  let rim = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0) * 0.28;

  let albedo = vec3f(0.765, 0.471, 0.906);
  let lit = albedo * (ambient + diffuse) + vec3f(specular) + albedo * rim;
  let poster = floor(lit * LEVELS + 0.5) / LEVELS;
  let color = select(lit, poster, revealed);
  return vec4f(color, 1.0);
}
