import { useEffect, useRef } from "react";
import { style, useStyles } from "purse-styles";
import {
  AmbientLight,
  Color,
  DataTexture,
  DirectionalLight,
  Mesh,
  MeshToonMaterial,
  NearestFilter,
  NoToneMapping,
  PerspectiveCamera,
  RedFormat,
  Scene,
  WebGLRenderer,
} from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import haloModel from "./assets/halo-donut-3d.obj?url";

const logoSize = 20;

type HaloLogoProps = {
  className: string;
};

export function HaloLogo({ className }: HaloLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvas = useStyles(styles.canvas);

  useEffect(() => {
    // Chromium blocks WebGL on some software GL stacks (Xvfb/llvmpipe) unless
    // SwiftShader is forced. Keep the chrome UI up when the logo cannot draw.
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        canvas: canvasRef.current!,
        alpha: true,
        antialias: true,
      });
    } catch {
      return;
    }
    const scene = new Scene();
    const camera = new PerspectiveCamera(40, 1, 0.1, 100);
    const gradient = new DataTexture(
      new Uint8Array([176, 220, 255]),
      3,
      1,
      RedFormat,
    );
    const material = new MeshToonMaterial({
      color: new Color("#c378e7"),
      gradientMap: gradient,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(logoSize, logoSize, false);
    renderer.toneMapping = NoToneMapping;
    camera.position.set(0, 0.8, 5.75);
    camera.lookAt(0, 0, 0);
    scene.add(new AmbientLight(0xffffff, 0.6));

    const keyLight = new DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);

    const fillLight = new DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-3, 1, 2);
    scene.add(fillLight);

    gradient.minFilter = NearestFilter;
    gradient.magFilter = NearestFilter;
    gradient.needsUpdate = true;

    new OBJLoader().load(haloModel, (model) => {
      model.rotation.set(2.24, 0.45, -2.06, "XYZ");
      model.position.set(-0.09, 0.11, -0.17);
      model.traverse((object) => {
        if (object instanceof Mesh) object.material = material;
      });
      scene.add(model);
      renderer.render(scene, camera);
    });

    return () => {
      material.dispose();
      gradient.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <span className={className} aria-label="Halo" role="img">
      <canvas className={canvas} ref={canvasRef} aria-hidden="true" />
    </span>
  );
}

const styles = {
  canvas: style({
    display: "block",
    width: "100%",
    height: "100%",
  }),
};
