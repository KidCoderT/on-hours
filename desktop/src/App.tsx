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

    const id = setInterval(() => { setClock(Date.now() - start) }, 1000);
    return () => clearInterval(id)
  }, [start, running])

  const resetTimer = () => {
    setClock(0);
    setStart(Date.now())
  }

  const pauseOrPlay = (val: boolean) => {
    if (val) {
      setStart(Date.now() - clock)
    }
    setRunning(val)
  }

  return (
    <main className="container">
      <h1>Simple Timer</h1>

      {Math.floor((clock / 1000) / (60 * 60))}:
      {Math.floor((clock / 1000) / (60)) % 60}:
      {Math.floor(clock / 1000) % (60)}

      <button onClick={() => resetTimer()}>Reset</button>
      <button onClick={() => pauseOrPlay(!running)}>{!running ? "Start" : "Stop"}</button>
    </main>
  );
}

export default App;
