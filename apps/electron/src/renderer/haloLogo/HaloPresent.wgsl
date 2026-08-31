struct Params {
  pixelation: f32,
}

@group(0) @binding(0) var scene: texture_2d<f32>;
@group(0) @binding(1) var<uniform> params: Params;

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let dims = vec2f(textureDimensions(scene));
  let cellPx = mix(1.0, 14.0, params.pixelation);
  let pixel = uv * dims;
  let snapped = floor(pixel / cellPx) * cellPx + cellPx * 0.5;
  let samplePx = mix(pixel, snapped, step(0.001, params.pixelation));
  let maxCoord = max(dims - vec2f(1.0), vec2f(0.0));
  let coord = vec2i(clamp(samplePx, vec2f(0.0), maxCoord));
  let sampled = textureLoad(scene, coord, 0);

  let levels = mix(256.0, 5.0, params.pixelation);
  let poster = floor(sampled.rgb * levels + 0.5) / levels;
  let rgb = mix(sampled.rgb, poster, params.pixelation);
  return vec4f(rgb * sampled.a, sampled.a);
}
