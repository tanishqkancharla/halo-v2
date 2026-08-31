struct Params {
  pixelation: f32,
  texel: vec2f,
}

@group(0) @binding(0) var scene: texture_2d<f32>;
@group(0) @binding(1) var sceneSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let cellPx = mix(1.0, 14.0, params.pixelation * params.pixelation);
  let cell = params.texel * cellPx;
  let snapped = floor(uv / cell) * cell + cell * 0.5;
  let sampleUv = mix(uv, snapped, step(0.001, params.pixelation));
  let sampled = textureSampleLevel(scene, sceneSampler, sampleUv, 0.0);

  let levels = mix(64.0, 5.0, params.pixelation);
  let rgb = floor(sampled.rgb * levels + 0.5) / levels;
  return vec4f(rgb * sampled.a, sampled.a);
}
