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
    <MauiProvider>
      <ApiProvider createApi={createElectronApi}>
        <App />
        {import.meta.env.DEV && <Agentation endpoint="http://127.0.0.1:4747" />}
      </ApiProvider>
    </MauiProvider>
  </StrictMode>,
);
