import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MauiProvider } from "maui";
import { App } from "./App.tsx";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MauiProvider>
      <App />
    </MauiProvider>
  </StrictMode>,
);
