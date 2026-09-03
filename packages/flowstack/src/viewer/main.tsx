import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MauiProvider } from "maui";
import { FlowstackApp } from "./FlowstackApp.tsx";
import "./styles.css";

const root = document.getElementById("root");
if (root === null) throw new Error("flowstack root element is missing");

createRoot(root).render(
  <StrictMode>
    <MauiProvider>
      <FlowstackApp />
    </MauiProvider>
  </StrictMode>,
);
