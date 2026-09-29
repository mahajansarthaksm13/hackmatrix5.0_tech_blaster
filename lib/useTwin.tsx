"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { FEEDER, ScenarioId, scenarioById } from "./config";
import { DayResult, simulateDay } from "./engine";

const dayCache = new Map<ScenarioId, DayResult>();
export function getDay(id: ScenarioId): DayResult {
  let d = dayCache.get(id);
  if (!d) {
    d = simulateDay(id);
    dayCache.set(id, d);
  }
  return d;
}

interface TwinState {
  scenarioId: ScenarioId;
  step: number;
  withGG: boolean;
  playing: boolean;
  setScenario: (id: ScenarioId) => void;
  setStep: (s: number) => void;
  setWithGG: (v: boolean) => void;
  setPlaying: (v: boolean) => void;
  day: DayResult;
}

const Ctx = createContext<TwinState | null>(null);

export function TwinProvider({ children }: { children: React.ReactNode }) {
  const [scenarioId, setScenarioId] = useState<ScenarioId>("S1");
  const [step, setStepRaw] = useState(scenarioById("S1").focusStep);
  const [withGG, setWithGG] = useState(true);
  const [playing, setPlaying] = useState(false);
  const day = useMemo(() => getDay(scenarioId), [scenarioId]);

  // Remember the last viewed moment per tab session (a convenience only).
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("gg-twin");
      if (raw) {
        const v = JSON.parse(raw);
        if (["S1", "S2", "S3", "S4"].includes(v.scenarioId)) setScenarioId(v.scenarioId);
        if (typeof v.step === "number") setStepRaw(Math.max(0, Math.min(FEEDER.steps - 1, v.step)));
        if (typeof v.withGG === "boolean") setWithGG(v.withGG);
      }
    } catch {}
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      sessionStorage.setItem("gg-twin", JSON.stringify({ scenarioId, step, withGG }));
    } catch {}
  }, [scenarioId, step, withGG]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setStepRaw((s) => (s + 1) % FEEDER.steps);
    }, 220);
    return () => clearInterval(id);
  }, [playing]);

  const setScenario = useCallback((id: ScenarioId) => {
    setScenarioId(id);
    setStepRaw(scenarioById(id).focusStep);
  }, []);
  const setStep = useCallback((s: number) => setStepRaw(Math.max(0, Math.min(FEEDER.steps - 1, s))), []);

  return (
    <Ctx.Provider value={{ scenarioId, step, withGG, playing, setScenario, setStep, setWithGG, setPlaying, day }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTwin() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTwin must be used inside TwinProvider");
  return v;
}
