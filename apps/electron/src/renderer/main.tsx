import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Agentation } from "agentation";
import { MauiProvider } from "maui";
import { App } from "./App.tsx";
import { ApiProvider } from "./api/ApiProvider.tsx";
import { createElectronApi } from "./api/electron.js";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ApiProvider createApi={createElectronApi}>
      <MauiProvider>
        <App />
        {import.meta.env.DEV && <Agentation />}
      </MauiProvider>
    </ApiProvider>
  </StrictMode>,
);
