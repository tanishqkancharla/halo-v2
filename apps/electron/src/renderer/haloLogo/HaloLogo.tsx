import { useEffect, useRef } from "react";
import { style, useStyles } from "purse-styles";
import { startHaloLogo } from "./startHaloLogo.ts";

export function HaloLogo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasClassName = useStyles(canvasClass);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    return startHaloLogo(canvas);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={canvasClassName}
      role="img"
      aria-label="Halo"
      data-testid="halo-logo"
    />
  );
}

const canvasClass = style({
  display: "block",
  width: "100%",
  height: "100%",
});
