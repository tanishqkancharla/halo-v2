@group(0) @binding(0) var scene: texture_2d<f32>;

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let dims = vec2f(textureDimensions(scene));
  let pixel = uv * dims;
  let maxCoord = max(dims - vec2f(1.0), vec2f(0.0));
  let coord = vec2i(clamp(pixel, vec2f(0.0), maxCoord));
  return textureLoad(scene, coord, 0);
}
