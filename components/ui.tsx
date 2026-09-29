"use client";

import { useState } from "react";
import { FEEDER, SCENARIOS, stepToTime } from "@/lib/config";
import { DayResult } from "@/lib/engine";
import { useTwin } from "@/lib/useTwin";

// ───────── simple building blocks ─────────

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-bold uppercase tracking-[0.2em] text-flow">{children}</div>;
}

export function PageHeader({ eyebrow, title, slogan, children }: { eyebrow: string; title: string; slogan: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h1>
        <p className="mt-1 text-lg text-dim">{slogan}</p>
      </div>
      {children}
    </div>
  );
}

export function Pill({ tone = "flow", children }: { tone?: "flow" | "safe" | "watch" | "risk" | "dim"; children: React.ReactNode }) {
  const cls = {
    flow: "bg-flow/10 text-flow ring-flow/30",
    safe: "bg-safe/10 text-safe ring-safe/30",
    watch: "bg-watch/10 text-watch ring-watch/30",
    risk: "bg-risk/10 text-risk ring-risk/30",
    dim: "bg-white/5 text-dim ring-white/10",
  }[tone];
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${cls}`}>{children}</span>;
}

export function Stat({ label, value, sub, tone = "ink" }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "ink" | "safe" | "watch" | "risk" | "flow" }) {
  const col = { ink: "text-ink", safe: "text-safe", watch: "text-watch", risk: "text-risk", flow: "text-flow" }[tone];
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-faint">{label}</div>
      <div className={`num mt-1 text-2xl font-bold ${col}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-dim">{sub}</div>}
    </div>
  );
}

/** A term with its plain-words meaning on hover/tap. */
export function Term({ children, tip }: { children: React.ReactNode; tip: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="cursor-help border-b border-dashed border-flow/60 text-inherit"
      >
        {children}
      </button>
      {open && (
        <span className="absolute bottom-full left-1/2 z-50 mb-2 w-60 -translate-x-1/2 rounded-lg border border-line bg-panel2 p-2.5 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-ink shadow-xl">
          {tip}
        </span>
      )}
    </span>
  );
}

// ───────── scenario tabs ─────────

export function ScenarioTabs() {
  const { scenarioId, setScenario } = useTwin();
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {SCENARIOS.map((s) => {
        const on = s.id === scenarioId;
        return (
          <button
            key={s.id}
            onClick={() => setScenario(s.id)}
            className={`rounded-xl border px-3 py-2.5 text-left transition ${
              on ? "border-flow/60 bg-flow/10 shadow-[0_0_20px_rgba(34,211,238,0.15)]" : "border-line bg-panel hover:border-flow/30"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{s.emoji}</span>
              <span className="num text-xs text-faint">{s.id}</span>
              <span className="font-semibold">{s.name}</span>
            </div>
            <div className="mt-0.5 text-xs text-dim">{s.tagline}</div>
          </button>
        );
      })}
    </div>
  );
}

// ───────── GridGuard on/off switch ─────────

export function GGToggle() {
  const { withGG, setWithGG } = useTwin();
  return (
    <div className="inline-flex rounded-full border border-line bg-panel p-1 text-sm">
      <button
        onClick={() => setWithGG(false)}
        className={`rounded-full px-3 py-1.5 font-semibold transition ${!withGG ? "bg-risk/15 text-risk" : "text-dim hover:text-ink"}`}
      >
        Without GridGuard
      </button>
      <button
        onClick={() => setWithGG(true)}
        className={`rounded-full px-3 py-1.5 font-semibold transition ${withGG ? "bg-safe/15 text-safe" : "text-dim hover:text-ink"}`}
      >
        With GridGuard ✓
      </button>
    </div>
  );
}

// ───────── 24-hour time scrubber ─────────

export function TimeScrubber({ day }: { day: DayResult }) {
  const { step, setStep, playing, setPlaying, withGG } = useTwin();
  return (
    <div className="card p-4">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setPlaying(!playing)}
          aria-label={playing ? "Pause" : "Play the day"}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-flow text-night shadow-[0_0_18px_rgba(34,211,238,0.5)] hover:brightness-110"
        >
          {playing ? (
            <svg width="16" height="16" viewBox="0 0 16 16"><rect x="3" y="2" width="3.5" height="12" rx="1" fill="currentColor" /><rect x="9.5" y="2" width="3.5" height="12" rx="1" fill="currentColor" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 2 L14 8 L4 14 Z" fill="currentColor" /></svg>
          )}
        </button>
        <div className="num w-20 shrink-0 text-3xl font-bold tracking-tight">{stepToTime(step)}</div>
        <div className="flex-1">
          <input
            type="range"
            className="scrub"
            min={0}
            max={FEEDER.steps - 1}
            value={step}
            onChange={(e) => {
              setPlaying(false);
              setStep(+e.target.value);
            }}
            aria-label="Time of day"
          />
          {/* problem strip: where limits break without / with GridGuard */}
          <div className="mt-2 flex h-2 gap-px overflow-hidden rounded-full">
            {day.steps.map((s) => {
              const bad = withGG ? s.gg.violations.length > 0 : s.base.violations.length > 0;
              const warn = s.forecast.level !== "safe";
              return (
                <button
                  key={s.step}
                  onClick={() => setStep(s.step)}
                  title={`${s.time}${bad ? " · limit broken" : warn ? " · risk rising" : ""}`}
                  className="h-full flex-1"
                  style={{ background: bad ? "#f43f5e" : warn && !withGG ? "#fbbf2466" : s.step === step ? "#22d3ee" : "#1c2738" }}
                />
              );
            })}
          </div>
          <div className="num mt-1 flex justify-between text-[10px] text-faint">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>24:00</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────── risk gauge ─────────

export function RiskGauge({ risk, minutes, level }: { risk: number; minutes: number | null; level: "safe" | "watch" | "critical" }) {
  const col = level === "critical" ? "#f43f5e" : level === "watch" ? "#fbbf24" : "#34d399";
  const a = Math.PI * (1 - risk / 100);
  const r = 80;
  const nx = 100 + r * Math.cos(a);
  const ny = 100 - r * Math.sin(a);
  const arc = (from: number, to: number) => {
    const a0 = Math.PI * (1 - from / 100);
    const a1 = Math.PI * (1 - to / 100);
    return `M ${100 + r * Math.cos(a0)} ${100 - r * Math.sin(a0)} A ${r} ${r} 0 0 1 ${100 + r * Math.cos(a1)} ${100 - r * Math.sin(a1)}`;
  };
  const label = level === "critical" ? "CRITICAL" : level === "watch" ? "WATCH" : "SAFE";
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 118" className="w-full max-w-[240px]">
        <path d={arc(0, 30)} stroke="#34d399" strokeOpacity="0.25" strokeWidth="14" fill="none" />
        <path d={arc(30, 60)} stroke="#fbbf24" strokeOpacity="0.25" strokeWidth="14" fill="none" />
        <path d={arc(60, 100)} stroke="#f43f5e" strokeOpacity="0.25" strokeWidth="14" fill="none" />
        {risk > 0 && <path d={arc(0, Math.max(0.5, risk))} stroke={col} strokeWidth="14" fill="none" style={{ filter: `drop-shadow(0 0 6px ${col})` }} />}
        <line x1="100" y1="100" x2={nx} y2={ny} stroke="#e7eef8" strokeWidth="3" strokeLinecap="round" />
        <circle cx="100" cy="100" r="6" fill="#e7eef8" />
        <text x="100" y="80" textAnchor="middle" className="num" fontSize="30" fontWeight="800" fill={col}>
          {risk}
        </text>
      </svg>
      <div className="-mt-1 text-sm font-extrabold tracking-[0.25em]" style={{ color: col }}>
        {label}
      </div>
      <div className="mt-1 text-center text-sm text-dim">
        {minutes !== null ? (
          <>
            ⏱ Problem expected in <span className="num font-bold text-ink">{minutes} min</span>
          </>
        ) : (
          "No problem in the next 60 min"
        )}
      </div>
    </div>
  );
}
