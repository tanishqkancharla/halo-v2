import { startHaloLogo } from "./haloLogo/startHaloLogo.ts";

const canvas = document.querySelector("canvas");
if (canvas instanceof HTMLCanvasElement) {
  const stop = startHaloLogo(canvas);
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      stop();
    });
  }
}
