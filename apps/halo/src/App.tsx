import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export function App() {
  const [message, setMessage] = useState("Ready when you are.");

  async function checkHalo() {
    setMessage(await invoke<string>("greet", { name: "Halo" }));
  }

  return (
    <main>
      <div className="mark" aria-hidden="true">
        H
      </div>
      <p className="eyebrow">Saffron Health</p>
      <h1>Halo</h1>
      <p className="status">{message}</p>
      <button type="button" onClick={checkHalo}>
        Check connection
      </button>
    </main>
  );
}
