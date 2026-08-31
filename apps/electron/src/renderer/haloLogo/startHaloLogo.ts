import * as errore from "errore";
import {
  clock,
  draw,
  effect,
  frameLoop,
  geometry,
  init,
  surface,
  target,
  type FrameLoopHandle,
  type Gpu,
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

  void start();

  async function start() {
    const mesh = parseObj(haloDonutSource);
    if (mesh instanceof Error) {
      console.warn(mesh.message);
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

    const canvasSurface = surface(gpu, canvas, {
      dpr: [1, 2],
      alphaMode: "premultiplied",
    });
    const sceneTarget = target(gpu, {
      size: [canvasSurface.size[0], canvasSurface.size[1]],
      depth: true,
      clearColor: [0, 0, 0, 0],
    });
    const camera = perspectiveCamera({
      fov: 38,
      aspect: canvasSurface.size[0] / canvasSurface.size[1],
      position: CAMERA_POSITION,
      target: [0, 0, 0],
    });
    const donutGeometry = geometry(gpu, {
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
    });
    const donut = draw(gpu, {
      shader: donutShader,
      geometry: donutGeometry,
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
      blend: "premultiplied",
      set: {
        scene: sceneTarget,
        params: { pixelation: 0 },
      },
    });

    canvasSurface.onResize(({ width, height }) => {
      if (disposed) return;
      if (width < 2) return;
      if (height < 2) return;
      sceneTarget.resize([width, height]);
      camera.set({ aspect: width / height });
      donut.set({
        camera: {
          viewProjection: camera.viewProjection,
          position: camera.worldPosition,
        },
      });
      present.set({ scene: sceneTarget });
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
      .compile({ colors: [canvasSurface.format] })
      .catch((e) => new HaloLogoInitError({ cause: e }));
    if (disposed) return;
    if (compiledPresent instanceof Error) {
      console.warn(compiledPresent.message);
      return;
    }

    const time = clock(gpu);
    loop = frameLoop(gpu, (frame) => {
      if (disposed) return;
      if (canvasSurface.size[0] < 2) return;
      if (canvasSurface.size[1] < 2) return;
      const angle = time.time * RADIANS_PER_SECOND;
      const pixelation = cornerPixelation(angle);
      donut.set({
        model: { model: rotationX(angle), pixelation },
      });
      present.set({ params: { pixelation } });
      frame.pass(
        { target: sceneTarget, clear: [0, 0, 0, 0], clearDepth: 1 },
        (pass) => {
          pass.draw(donut);
        },
      );
      frame.pass(canvasSurface, present);
    });
  }

  return () => {
    disposed = true;
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
