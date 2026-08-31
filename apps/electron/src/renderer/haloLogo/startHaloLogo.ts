import * as errore from "errore";
import {
  clock,
  draw,
  effect,
  frameLoop,
  geometry,
  init,
  target,
  type FrameLoopHandle,
  type Gpu,
  type Target,
} from "vgpu";
import { perspectiveCamera } from "vgpu/scene";
import haloDonutSource from "../assets/halo-donut-3d.obj?raw";
import donutShader from "./HaloDonut.wgsl";
import presentShader from "./HaloPresent.wgsl";
import { parseObj } from "./parseObj.ts";
import { cornerPixelation, rotationX } from "./pixelation.ts";

class HaloLogoInitError extends errore.createTaggedError({
  name: "HaloLogoInitError",
  message: "Halo logo WebGPU init failed",
}) {}

const CAMERA_POSITION = [0, 0.42, 4.15] as const;
const RADIANS_PER_SECOND = 0.2;

export function startHaloLogo(canvas: HTMLCanvasElement) {
  let disposed = false;
  let loop: FrameLoopHandle | undefined;
  let gpu: Gpu | undefined;
  let observer: ResizeObserver | undefined;
  let reading = false;

  void start().catch((e) => {
    console.warn(new HaloLogoInitError({ cause: e }).message);
  });

  async function start() {
    const mesh = parseObj(haloDonutSource);
    if (mesh instanceof Error) {
      console.warn(mesh.message);
      return;
    }

    const ctx = canvas.getContext("2d", { alpha: true });
    if (ctx === null) {
      console.warn("Halo logo canvas 2d context failed");
      return;
    }

    const gpuResult = await init().catch(
      (e) => new HaloLogoInitError({ cause: e }),
    );
    if (disposed) {
      if (gpuResult instanceof Error) return;
      gpuResult.dispose();
      return;
    }
    if (gpuResult instanceof Error) {
      console.warn(gpuResult.message);
      return;
    }
    gpu = gpuResult;
    gpu.gpu.lost.then((info) => {
      if (disposed) return;
      console.warn(`Halo logo GPU lost (${info.reason}): ${info.message}`);
    });
    gpu.onError((error) => {
      if (disposed) return;
      const cause = error.cause;
      console.warn(
        error.message,
        error.where,
        cause instanceof Error ? `${cause.name}: ${cause.message}` : cause,
      );
    });

    const size = drawingBufferSize(canvas);
    const sceneTarget = target(gpu, {
      size,
      depth: true,
      clearColor: [0, 0, 0, 0],
    });
    const output = target(gpu, {
      size,
      clearColor: [0, 0, 0, 0],
    });
    const camera = perspectiveCamera({
      fov: 38,
      aspect: size[0] / size[1],
      position: CAMERA_POSITION,
      target: [0, 0, 0],
    });
    const donut = draw(gpu, {
      shader: donutShader,
      geometry: geometry(gpu, {
        buffers: [
          {
            data: mesh.vertices,
            stride: 24,
            attributes: {
              position: "float32x3",
              normal: "float32x3",
            },
          },
        ],
        indices: mesh.indices,
      }),
      cull: "back",
    });
    donut.set({
      camera: {
        viewProjection: camera.viewProjection,
        position: camera.worldPosition,
      },
      model: { model: rotationX(0), pixelation: 0 },
    });
    const present = effect(gpu, presentShader, {
      set: {
        scene: sceneTarget,
        params: { pixelation: 0 },
      },
    });

    const compiledDonut = await donut
      .compile(sceneTarget)
      .catch((e) => new HaloLogoInitError({ cause: e }));
    if (disposed) return;
    if (compiledDonut instanceof Error) {
      console.warn(compiledDonut.message);
      return;
    }
    const compiledPresent = await present
      .compile(output)
      .catch((e) => new HaloLogoInitError({ cause: e }));
    if (disposed) return;
    if (compiledPresent instanceof Error) {
      console.warn(compiledPresent.message);
      return;
    }

    const resize = () => {
      if (disposed) return;
      const next = drawingBufferSize(canvas);
      if (next[0] === output.size[0] && next[1] === output.size[1]) return;
      sceneTarget.resize(next);
      output.resize(next);
      camera.set({ aspect: next[0] / next[1] });
      donut.set({
        camera: {
          viewProjection: camera.viewProjection,
          position: camera.worldPosition,
        },
      });
      present.set({ scene: sceneTarget });
    };
    observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const time = clock(gpu);
    loop = frameLoop(gpu, (currentFrame) => {
      if (disposed) return;
      if (reading) return;
      const width = output.size[0];
      const height = output.size[1];
      if (width < 2) return;
      if (height < 2) return;
      const angle = time.time * RADIANS_PER_SECOND;
      const pixelation = cornerPixelation(angle);
      donut.set({
        model: { model: rotationX(angle), pixelation },
      });
      present.set({ params: { pixelation } });
      currentFrame.pass(
        { target: sceneTarget, clear: [0, 0, 0, 0], clearDepth: 1 },
        (pass) => {
          pass.draw(donut);
        },
      );
      currentFrame.pass(output, present);
      reading = true;
      queueMicrotask(() => {
        void gpu
          .settled()
          .then(() => blit(output, ctx, width, height))
          .finally(() => {
            reading = false;
          });
      });
    });
  }

  return () => {
    disposed = true;
    if (observer !== undefined) {
      observer.disconnect();
      observer = undefined;
    }
    if (loop !== undefined) {
      loop.stop();
      loop = undefined;
    }
    if (gpu !== undefined) {
      gpu.dispose();
      gpu = undefined;
    }
  };
}

function drawingBufferSize(canvas: HTMLCanvasElement) {
  const raw = window.devicePixelRatio;
  const dpr = raw > 2 ? 2 : raw < 1 ? 1 : raw;
  const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  return [width, height] as const;
}

async function blit(
  output: Target,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const pixels = await output.read();
  ctx.putImageData(
    new ImageData(new Uint8ClampedArray(pixels), width, height),
    0,
    0,
  );
}
