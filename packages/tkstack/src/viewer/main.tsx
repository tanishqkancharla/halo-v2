import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MauiProvider } from "maui";
import { ViewerApp } from "./ViewerApp.tsx";
import "./styles.css";

const root = document.getElementById("root");
if (root === null) throw new Error("tkstack root element is missing");

createRoot(root).render(
  <StrictMode>
    <MauiProvider>
      <ViewerApp />
    </MauiProvider>
  </StrictMode>,
);
