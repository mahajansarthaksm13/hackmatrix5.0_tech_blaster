// Demo feeder — every number here mirrors "MVP scope and setup" in the PRD.
// The Python engine (pandapower) reads the same values from one config file.

export type BusId = "B0" | "B1" | "B2" | "B3" | "B4" | "B5";
export type LineId = "A1" | "A2" | "A3" | "BL1" | "BL2" | "TIE";

export const FEEDER = {
  voltageKv: 0.415,
  transformerKva: 100,
  powerFactor: 0.95,
  vMin: 0.95,
  vMax: 1.05,
  stepMinutes: 15,
  steps: 96,
};

/** Rooftop solar (kW) per bus. 60 kW in total. */
export const PV: Partial<Record<BusId, number>> = { B2: 20, B3: 25, B5: 15 };
export const PV_BUSES: BusId[] = ["B2", "B3", "B5"];

export const BATTERY = {
  bus: "B3" as BusId,
  kWh: 50,
  kW: 20,
  socMin: 0.2,
  socMax: 0.9,
};

/** Share of the total feeder demand drawn at each bus. */
export const LOAD_SHARE: Record<Exclude<BusId, "B0">, number> = {
  B1: 0.22,
  B2: 0.2,
  B3: 0.18,
  B4: 0.2,
  B5: 0.2,
};

/** Line data: thermal rating (kW) and a lumped voltage sensitivity (p.u. per kW). */
export const LINES: Record<LineId, { from: BusId; to: BusId; ratingKw: number; r: number; label: string }> = {
  A1: { from: "B0", to: "B1", ratingKw: 60, r: 0.00058, label: "Feeder A · B0→B1" },
  A2: { from: "B1", to: "B2", ratingKw: 50, r: 0.00066, label: "Feeder A · B1→B2" },
  A3: { from: "B2", to: "B3", ratingKw: 42, r: 0.00074, label: "Feeder A · B2→B3" },
  BL1: { from: "B0", to: "B4", ratingKw: 70, r: 0.0005, label: "Feeder B · B0→B4" },
  BL2: { from: "B4", to: "B5", ratingKw: 50, r: 0.00056, label: "Feeder B · B4→B5" },
  TIE: { from: "B5", to: "B3", ratingKw: 40, r: 0.0006, label: "Tie switch B5↔B3" },
};

/** Peak feeder demand on a normal weekday (kW). Demand runs 24–90 kW across the day. */
export const PEAK_LOAD_KW = 90;

/** Normalised hourly demand shape (home + small business), 00:00 … 23:00. */
export const LOAD_SHAPE = [
  0.29, 0.28, 0.27, 0.27, 0.28, 0.32, 0.42, 0.55, 0.6, 0.55, 0.46, 0.4, 0.37, 0.37, 0.39, 0.43, 0.5,
  0.6, 0.76, 0.92, 1.0, 0.84, 0.6, 0.4,
];

/** Pune clear-sky capacity factor (shape of NREL PVWatts hourly output, interpolated to 15 min). */
export function pvCapacityFactor(hour: number): number {
  const rise = 6.35;
  const set = 18.55;
  if (hour <= rise || hour >= set) return 0;
  const x = (hour - rise) / (set - rise);
  return 0.83 * Math.pow(Math.sin(Math.PI * x), 1.25);
}

/** Forecast uncertainty bands (PRD F4). Shown on screen as assumptions. */
export const BANDS = { solar: 0.25, load: 0.1 };

export type ScenarioId = "S1" | "S2" | "S3" | "S4";

export interface Scenario {
  id: ScenarioId;
  name: string;
  emoji: string;
  tagline: string;
  setup: string;
  tests: string;
  loadFactor: number;
  solarFactor: number;
  cloudDip?: { startHour: number; endHour: number; drop: number };
  startSoc: number;
  tieAvailable: boolean;
  curtailCap: number; // max curtailment fraction
  focusStep: number; // most interesting moment for the demo
}

export const SCENARIOS: Scenario[] = [
  {
    id: "S1",
    name: "Sunny noon",
    emoji: "☀️",
    tagline: "Too much sun, too little demand",
    setup: "Clear-sky Pune solar, normal weekday demand",
    tests: "Stopping high voltage with the smallest solar cut",
    loadFactor: 1,
    solarFactor: 1,
    startSoc: 0.4,
    tieAvailable: true,
    curtailCap: 0.5,
    focusStep: 50,
  },
  {
    id: "S2",
    name: "Evening peak",
    emoji: "🌆",
    tagline: "Sun is gone, everyone is home",
    setup: "No solar, demand × 1.15",
    tests: "Easing overload with battery discharge and tie-switch transfer",
    loadFactor: 1.15,
    solarFactor: 0,
    startSoc: 0.9,
    tieAvailable: true,
    curtailCap: 0.5,
    focusStep: 80,
  },
  {
    id: "S3",
    name: "Cloud ramp",
    emoji: "⛅",
    tagline: "A cloud passes at 12:30",
    setup: "Solar drops 70% for 30 minutes at 12:30, then recovers",
    tests: "Forecast uncertainty, the risk score and the P10/P90 range",
    loadFactor: 1,
    solarFactor: 1,
    cloudDip: { startHour: 12.5, endHour: 13, drop: 0.7 },
    startSoc: 0.5,
    tieAvailable: true,
    curtailCap: 0.5,
    focusStep: 49,
  },
  {
    id: "S4",
    name: "Critical holiday",
    emoji: "🚨",
    tagline: "Holiday, full battery, switch broken",
    setup: "Holiday demand × 0.7, battery starts 90% full, tie switch unavailable, solar cut capped at 20%",
    tests: "An honest failure — and the upgrade plan",
    loadFactor: 0.7,
    solarFactor: 1,
    startSoc: 0.9,
    tieAvailable: false,
    curtailCap: 0.2,
    focusStep: 50,
  },
];

export const scenarioById = (id: ScenarioId) => SCENARIOS.find((s) => s.id === id)!;

export function stepToTime(step: number): string {
  const mins = step * FEEDER.stepMinutes;
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
