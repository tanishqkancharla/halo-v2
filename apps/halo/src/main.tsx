import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Agentation } from "agentation";
import { MauiProvider } from "maui";
import { App } from "./App.tsx";
import { ApiProvider } from "./api/ApiProvider.tsx";
import { tauriApi } from "./api/tauri.ts";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ApiProvider api={tauriApi}>
      <MauiProvider>
        <App />
        {import.meta.env.DEV && <Agentation />}
      </MauiProvider>
    </ApiProvider>
  </StrictMode>,
);
