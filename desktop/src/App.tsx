import { useEffect, useState } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  const [start, setStart] = useState(Date.now());
  const [clock, setClock] = useState(0)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!running) return
    // note: set interval will run ever second continuously until its cleared
    const id = setInterval(() => { setClock(Date.now() - start) }, 1000);
    return () => clearInterval(id)
  }, [start, running]) // we dont use clock because if its clock. every second we create
  // and destroy the interval and it gets messy... it works but not ass efficiently

  const resetTimer = () => {
    setClock(0);
    setStart(Date.now())
  }

  const toggle = () => {
    if (running) setClock(Date.now() - start) // pausing
    else setStart(Date.now() - clock) // running
    setRunning(!running)
  }

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  };

  return (
    <main className="container">
      <h1>Simple Timer</h1>

      {fmt(clock)}

      <button onClick={() => resetTimer()}>Reset</button>
      <button onClick={() => toggle()}>{!running ? "Start" : "Stop"}</button>
    </main>
  );
}

export default App;
