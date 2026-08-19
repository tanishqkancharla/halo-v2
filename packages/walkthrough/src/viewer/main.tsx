import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MauiProvider } from "maui";
import { WalkthroughApp } from "./WalkthroughApp.tsx";
import "./styles.css";

const root = document.getElementById("root");
if (root === null) throw new Error("Walkthrough root element is missing");

createRoot(root).render(
  <StrictMode>
    <MauiProvider>
      <WalkthroughApp />
    </MauiProvider>
  </StrictMode>,
);
