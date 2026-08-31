struct Camera {
  viewProjection: mat4x4f,
  position: vec3f,
}

struct Model {
  model: mat4x4f,
  pixelation: f32,
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<uniform> model: Model;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) worldPosition: vec3f,
  @location(1) normal: vec3f,
}

@vertex fn vs_main(
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
) -> VertexOut {
  var out: VertexOut;
  let world = model.model * vec4f(position, 1.0);
  out.worldPosition = world.xyz;
  out.normal = (model.model * vec4f(normal, 0.0)).xyz;
  out.position = camera.viewProjection * world;
  return out;
}

@fragment fn fs_main(
  @location(0) worldPosition: vec3f,
  @location(1) normal: vec3f,
) -> @location(0) vec4f {
  var n = normalize(normal);
  if (model.pixelation > 0.001) {
    let bands = mix(24.0, 3.0, model.pixelation);
    n = normalize(round(n * bands) / bands);
  }

  let lightDir = normalize(vec3f(0.35, 0.8, 0.45));
  let viewDir = normalize(camera.position - worldPosition);
  let ambient = 0.18;
  let diffuse = max(dot(n, lightDir), 0.0);
  let halfVec = normalize(lightDir + viewDir);
  let specular = pow(max(dot(n, halfVec), 0.0), 28.0) * 0.22;
  let rim = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0) * 0.28;

  let albedo = vec3f(0.765, 0.471, 0.906);
  let color = albedo * (ambient + diffuse) + vec3f(specular) + albedo * rim;
  return vec4f(color, 1.0);
}
