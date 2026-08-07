import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Agentation } from "agentation";
import { MauiProvider } from "maui";
import { App } from "./App.tsx";
import { ApiProvider } from "./api/ApiProvider.tsx";
import { getElectronApi } from "./api/electron.js";
import "./styles.css";

const root = createRoot(document.getElementById("root")!);

void getElectronApi().then((api) => {
  root.render(
    <StrictMode>
      <ApiProvider api={api}>
        <MauiProvider>
          <App />
          {import.meta.env.DEV && <Agentation />}
        </MauiProvider>
      </ApiProvider>
    </StrictMode>,
  );
});
