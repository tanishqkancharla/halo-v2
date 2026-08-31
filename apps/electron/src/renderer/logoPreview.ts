import { startHaloLogo } from "./haloLogo/startHaloLogo.ts";

const canvas = document.querySelector("canvas");
if (canvas instanceof HTMLCanvasElement) {
  startHaloLogo(canvas);
}
