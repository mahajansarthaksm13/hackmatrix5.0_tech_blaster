/*
 * GridGuard Twin — browser engine.
 *
 * A light TypeScript mirror of the Python/pandapower engine described in the PRD.
 * It uses a linearised radial power flow (voltage change = sensitivity × power flow),
 * which is enough to replay the four demo scenarios instantly in the browser.
 * When precompute.py lands, the same shapes can be loaded from JSON instead.
 */
import {
  BANDS,
  BATTERY,
  BusId,
  FEEDER,
  LINES,
  LineId,
  LOAD_SHAPE,
  LOAD_SHARE,
  PEAK_LOAD_KW,
  PV,
  PV_BUSES,
  pvCapacityFactor,
  Scenario,
  ScenarioId,
  scenarioById,
  stepToTime,
} from "./config";

export const LOAD_BUSES: Exclude<BusId, "B0">[] = ["B1", "B2", "B3", "B4", "B5"];
const X_OVER_R = 0.45; // reactive power effect on voltage relative to active power
const Q_RATIO = 0.33; // 0.95 PF absorbing → Q ≈ 0.33 × P

// ───────────────────────────── types ─────────────────────────────

export type RunId = "P10" | "P50" | "P90";
export const RUNS: RunId[] = ["P10", "P50", "P90"];
export const RUN_LABEL: Record<RunId, string> = { P10: "Low solar", P50: "Expected", P90: "High solar" };

export interface Injection {
  load: Record<string, number>; // kW per bus
  pv: Record<string, number>; // available solar kW per bus
}

export interface Action {
  reactive?: boolean;
  batt?: number; // kW, + charge / − discharge
  tie?: boolean;
  curtail?: number; // fraction 0–1
  curtailMode?: "fair" | "end";
}

export interface Plant {
  transformerKva: number;
  battKWh: number;
  battKw: number;
  exportCap?: Partial<Record<BusId, number>>; // kW
  extraPv?: { bus: BusId; kw: number; reactive: boolean; battKWh: number };
}

export const BASE_PLANT: Plant = { transformerKva: FEEDER.transformerKva, battKWh: BATTERY.kWh, battKw: BATTERY.kW };

export type ViolationKind = "over" | "under" | "line" | "trafo";
export interface Violation {
  kind: ViolationKind;
  where: string;
  value: number;
  limit: number;
  severity: number; // 0–1
}

export interface Flow {
  v: Record<BusId, number>;
  lineKw: Record<LineId, number>; // + = away from the transformer
  lineLoad: Record<LineId, number>; // %
  trafoKw: number; // + = drawing from grid, − = reverse flow
  trafoLoad: number; // %
  vMax: number;
  vMaxBus: BusId;
  vMin: number;
  vMinBus: BusId;
  maxLine: number;
  maxLineId: LineId;
  tieClosed: boolean;
  pvUsed: number;
  pvAvail: number;
  curtailed: number; // kW
  curtailByBus: Record<string, number>;
  battKw: number;
  violations: Violation[];
  reverse: boolean;
}

// ───────────────────────────── inputs ─────────────────────────────

function loadShapeAt(hour: number): number {
  const h0 = Math.floor(hour) % 24;
  const h1 = (h0 + 1) % 24;
  const f = hour - Math.floor(hour);
  return LOAD_SHAPE[h0] * (1 - f) + LOAD_SHAPE[h1] * f;
}

export function cloudFactor(sc: Scenario, hour: number): number {
  if (!sc.cloudDip) return 1;
  const { startHour, endHour, drop } = sc.cloudDip;
  return hour >= startHour && hour < endHour ? 1 - drop : 1;
}

/** Actual injections for a scenario at a (fractional) hour. */
export function actualInjection(sc: Scenario, hour: number, plant: Plant = BASE_PLANT): Injection {
  const total = PEAK_LOAD_KW * loadShapeAt(hour) * sc.loadFactor;
  const load: Record<string, number> = {};
  for (const b of LOAD_BUSES) load[b] = total * LOAD_SHARE[b];
  const cf = pvCapacityFactor(hour) * sc.solarFactor * cloudFactor(sc, hour);
  const pv: Record<string, number> = {};
  for (const b of PV_BUSES) pv[b] = (PV[b] ?? 0) * cf;
  if (plant.extraPv) pv["NEW"] = plant.extraPv.kw * cf;
  return { load, pv };
}

/** Forecast for `hour` made one step earlier: clear-sky profile × the last seen cloud factor, with P10/P50/P90 bands. */
export function forecastInjection(
  sc: Scenario,
  hour: number,
  seenAtHour: number,
  run: RunId,
  plant: Plant = BASE_PLANT
): Injection {
  const total = PEAK_LOAD_KW * loadShapeAt(hour) * sc.loadFactor;
  const loadMul = run === "P10" ? 1 + BANDS.load : run === "P90" ? 1 - BANDS.load : 1;
  const solarMul = run === "P10" ? 1 - BANDS.solar : run === "P90" ? 1 + BANDS.solar : 1;
  const clear = pvCapacityFactor(hour) * sc.solarFactor;
  const expected = clear * cloudFactor(sc, seenAtHour);
  // High-solar run also assumes a passing cloud clears; no run can beat clear sky.
  const high = cloudFactor(sc, seenAtHour) < 1 ? clear : expected * solarMul;
  const cf = run === "P90" ? Math.min(high, clear) : Math.min(expected * solarMul, clear);
  const load: Record<string, number> = {};
  for (const b of LOAD_BUSES) load[b] = total * LOAD_SHARE[b] * loadMul;
  const pv: Record<string, number> = {};
  for (const b of PV_BUSES) pv[b] = (PV[b] ?? 0) * cf;
  if (plant.extraPv) pv["NEW"] = plant.extraPv.kw * cf;
  return { load, pv };
}

// ───────────────────────────── power flow ─────────────────────────────

const ORDER: BusId[] = ["B3", "B5", "B2", "B4", "B1"]; // leaves first

export function powerFlow(inj: Injection, act: Action, plant: Plant = BASE_PLANT): Flow {
  const tie = !!act.tie;
  const parent: Record<string, { bus: BusId; line: LineId }> = {
    B1: { bus: "B0", line: "A1" },
    B2: { bus: "B1", line: "A2" },
    B3: tie ? { bus: "B5", line: "TIE" } : { bus: "B2", line: "A3" },
    B4: { bus: "B0", line: "BL1" },
    B5: { bus: "B4", line: "BL2" },
  };

  // Solar after curtailment
  const pvAvail = Object.values(inj.pv).reduce((a, b) => a + b, 0);
  const pvOut: Record<string, number> = { ...inj.pv };
  const curtailByBus: Record<string, number> = {};
  const c = act.curtail ?? 0;
  if (c > 0) {
    if (act.curtailMode === "end") {
      const need = c * PV_BUSES.reduce((a, b) => a + inj.pv[b], 0);
      const cut = Math.min(need, inj.pv.B3);
      pvOut.B3 = inj.pv.B3 - cut;
      curtailByBus.B3 = cut;
    } else {
      for (const b of PV_BUSES) {
        curtailByBus[b] = inj.pv[b] * c;
        pvOut[b] = inj.pv[b] * (1 - c);
      }
      if (inj.pv.NEW) {
        curtailByBus.NEW = inj.pv.NEW * c;
        pvOut.NEW = inj.pv.NEW * (1 - c);
      }
    }
  }
  // Export caps (connect-time design fix)
  if (plant.exportCap) {
    for (const [b, cap] of Object.entries(plant.exportCap)) {
      const exportKw = pvOut[b] - (inj.load[b] ?? 0);
      if (cap !== undefined && exportKw > cap) {
        const cut = exportKw - cap;
        pvOut[b] -= cut;
        curtailByBus[b] = (curtailByBus[b] ?? 0) + cut;
      }
    }
  }

  const net: Record<string, number> = {}; // active, + = load
  const veff: Record<string, number> = {}; // voltage-effective power
  for (const b of LOAD_BUSES) {
    const pv = pvOut[b] ?? 0;
    net[b] = inj.load[b] - pv;
    const q = act.reactive ? Q_RATIO * pv : 0;
    veff[b] = net[b] + X_OVER_R * q;
  }
  // Battery at B3
  const batt = act.batt ?? 0;
  net.B3 += batt;
  veff.B3 += batt;
  // Proposed new rooftop system
  if (plant.extraPv) {
    const nb = plant.extraPv.bus;
    const out = pvOut["NEW"] ?? 0;
    net[nb] -= out;
    const q = plant.extraPv.reactive ? Q_RATIO * out : 0;
    veff[nb] -= out - X_OVER_R * q;
  }

  const down: Record<string, number> = {};
  const downV: Record<string, number> = {};
  for (const b of LOAD_BUSES) {
    down[b] = net[b];
    downV[b] = veff[b];
  }
  for (const b of ORDER) {
    const p = parent[b];
    if (p.bus !== "B0") {
      down[p.bus] += down[b];
      downV[p.bus] += downV[b];
    }
  }

  const lineKw = { A1: 0, A2: 0, A3: 0, BL1: 0, BL2: 0, TIE: 0 } as Record<LineId, number>;
  for (const b of LOAD_BUSES) lineKw[parent[b].line] = down[b];
  const trafoKw = down.B1 + down.B4;
  const trafoV = downV.B1 + downV.B4;

  const sens = 0.00022 * (FEEDER.transformerKva / plant.transformerKva);
  const v = { B0: 1.035 - sens * trafoV } as Record<BusId, number>;
  const topo: BusId[] = tie ? ["B1", "B2", "B4", "B5", "B3"] : ["B1", "B2", "B3", "B4", "B5"];
  for (const b of topo) {
    const p = parent[b];
    v[b] = v[p.bus] - LINES[p.line].r * downV[b];
  }

  const lineLoad = {} as Record<LineId, number>;
  for (const id of Object.keys(lineKw) as LineId[]) lineLoad[id] = (Math.abs(lineKw[id]) / LINES[id].ratingKw) * 100;
  const trafoLoad = (Math.abs(trafoKw) / FEEDER.powerFactor / plant.transformerKva) * 100;

  let vMax = -1,
    vMin = 9,
    vMaxBus: BusId = "B0",
    vMinBus: BusId = "B0";
  for (const b of ["B0", ...LOAD_BUSES] as BusId[]) {
    if (v[b] > vMax) {
      vMax = v[b];
      vMaxBus = b;
    }
    if (v[b] < vMin) {
      vMin = v[b];
      vMinBus = b;
    }
  }
  let maxLine = 0,
    maxLineId: LineId = "A1";
  for (const id of Object.keys(lineLoad) as LineId[]) {
    if (lineLoad[id] > maxLine) {
      maxLine = lineLoad[id];
      maxLineId = id;
    }
  }

  const violations: Violation[] = [];
  for (const b of LOAD_BUSES) {
    if (v[b] > FEEDER.vMax + 1e-9)
      violations.push({ kind: "over", where: b, value: v[b], limit: FEEDER.vMax, severity: Math.min(1, (v[b] - FEEDER.vMax) / 0.03) });
    if (v[b] < FEEDER.vMin - 1e-9)
      violations.push({ kind: "under", where: b, value: v[b], limit: FEEDER.vMin, severity: Math.min(1, (FEEDER.vMin - v[b]) / 0.03) });
  }
  for (const id of Object.keys(lineLoad) as LineId[]) {
    if (lineLoad[id] > 100 + 1e-9)
      violations.push({ kind: "line", where: id, value: lineLoad[id], limit: 100, severity: Math.min(1, (lineLoad[id] - 100) / 25) });
  }
  if (trafoLoad > 100 + 1e-9)
    violations.push({ kind: "trafo", where: "Transformer", value: trafoLoad, limit: 100, severity: Math.min(1, (trafoLoad - 100) / 25) });

  const curtailed = Object.values(curtailByBus).reduce((a, b) => a + b, 0);
  return {
    v,
    lineKw,
    lineLoad,
    trafoKw,
    trafoLoad,
    vMax,
    vMaxBus,
    vMin,
    vMinBus,
    maxLine,
    maxLineId,
    tieClosed: tie,
    pvAvail,
    pvUsed: pvAvail - curtailed,
    curtailed,
    curtailByBus,
    battKw: batt,
    violations,
    reverse: trafoKw < 0,
  };
}

/** 0–1 stress used for the risk score: rises gently near a limit, jumps once a limit breaks. */
export function stress(f: Flow): number {
  const band = (x: number, soft: number, hard: number, span: number) => {
    if (x <= soft) return 0;
    if (x <= hard) return (0.35 * (x - soft)) / (hard - soft);
    return 0.4 + 0.6 * Math.min(1, (x - hard) / span);
  };
  const lineOrTrafo = Math.max(f.maxLine, f.trafoLoad);
  return Math.max(
    band(f.vMax, 1.03, FEEDER.vMax, 0.03),
    band(-f.vMin, -0.97, -FEEDER.vMin, 0.03),
    band(lineOrTrafo, 85, 100, 25)
  );
}

export function describeViolation(v: Violation): string {
  switch (v.kind) {
    case "over":
      return `Voltage at ${v.where} hits ${v.value.toFixed(3)} p.u. (limit ${v.limit.toFixed(2)})`;
    case "under":
      return `Voltage at ${v.where} drops to ${v.value.toFixed(3)} p.u. (limit ${v.limit.toFixed(2)})`;
    case "line":
      return `${LINES[v.where as LineId].label} loaded ${v.value.toFixed(0)}% (limit 100%)`;
    case "trafo":
      return `Transformer loaded ${v.value.toFixed(0)}% (limit 100%)`;
  }
}

export function shortViolation(v: Violation): string {
  switch (v.kind) {
    case "over":
      return `High voltage at ${v.where}`;
    case "under":
      return `Low voltage at ${v.where}`;
    case "line":
      return `Line ${v.where} overloaded`;
    case "trafo":
      return `Transformer overloaded`;
  }
}

export const worstViolation = (vs: Violation[]) => vs.slice().sort((a, b) => b.severity - a.severity)[0];

// ───────────────────────────── candidate actions ─────────────────────────────

export type FamilyId =
  | "none"
  | "q"
  | "chg"
  | "dis"
  | "tie"
  | "cut"
  | "q_chg"
  | "q_cut"
  | "chg_cut"
  | "tie_dis"
  | "tie_chg"
  | "tie_q";

export const FAMILY_LABEL: Record<FamilyId, string> = {
  none: "Do nothing",
  q: "Inverter reactive power",
  chg: "Battery charge",
  dis: "Battery discharge",
  tie: "Tie-switch transfer",
  cut: "Solar cut (shared fairly)",
  q_chg: "Reactive power + battery charge",
  q_cut: "Reactive power + solar cut",
  chg_cut: "Battery charge + solar cut",
  tie_dis: "Tie switch + battery discharge",
  tie_chg: "Tie switch + battery charge",
  tie_q: "Tie switch + reactive power",
};

export const FAMILY_ICON: Record<FamilyId, string> = {
  none: "⏸",
  q: "🎛️",
  chg: "🔋",
  dis: "⚡",
  tie: "🔀",
  cut: "✂️",
  q_chg: "🎛️🔋",
  q_cut: "🎛️✂️",
  chg_cut: "🔋✂️",
  tie_dis: "🔀⚡",
  tie_chg: "🔀🔋",
  tie_q: "🔀🎛️",
};

export interface Evaluated {
  family: FamilyId;
  action: Action;
  runs: Record<RunId, Flow>;
  safe: boolean;
  curtailKWh: number; // expected run
  battKWh: number;
  switchOps: number;
  devices: number;
  worst: Flow; // run with the highest stress
  worstViolation?: Violation;
  vMax: number;
  vMin: number;
  maxLoad: number;
}

export function describeAction(a: Action): string {
  const parts: string[] = [];
  if (a.tie) parts.push("Close tie switch (move B3 to Feeder B)");
  if (a.batt && a.batt > 0) parts.push(`Charge battery ${a.batt} kW`);
  if (a.batt && a.batt < 0) parts.push(`Discharge battery ${-a.batt} kW`);
  if (a.reactive) parts.push("Inverters absorb reactive power (0.95 PF)");
  if (a.curtail) parts.push(`Cut solar ${Math.round(a.curtail * 100)}%${a.curtailMode === "end" ? " at B3 only" : " on every rooftop"}`);
  return parts.length ? parts.join(" + ") : "No action needed";
}

export function shortAction(a: Action): string {
  const parts: string[] = [];
  if (a.tie) parts.push("Tie switch");
  if (a.batt && a.batt > 0) parts.push(`Charge ${a.batt} kW`);
  if (a.batt && a.batt < 0) parts.push(`Discharge ${-a.batt} kW`);
  if (a.reactive) parts.push("Reactive 0.95 PF");
  if (a.curtail) parts.push(`Cut ${Math.round(a.curtail * 100)}%`);
  return parts.length ? parts.join(" + ") : "Do nothing";
}

function evaluate(
  family: FamilyId,
  action: Action,
  runs: Record<RunId, Injection>,
  plant: Plant
): Evaluated {
  const flows = {} as Record<RunId, Flow>;
  let safe = true;
  let worst: Flow | null = null;
  let worstS = -1;
  for (const r of RUNS) {
    const f = powerFlow(runs[r], action, plant);
    flows[r] = f;
    if (f.violations.length) safe = false;
    const s = stress(f) + f.violations.reduce((a, v) => a + v.severity, 0);
    if (s > worstS) {
      worstS = s;
      worst = f;
    }
  }
  const exp = flows.P50;
  let vMax = 0,
    vMin = 9,
    maxLoad = 0;
  for (const r of RUNS) {
    vMax = Math.max(vMax, flows[r].vMax);
    vMin = Math.min(vMin, flows[r].vMin);
    maxLoad = Math.max(maxLoad, flows[r].maxLine, flows[r].trafoLoad);
  }
  const devices = [action.reactive, action.batt, action.tie, action.curtail].filter(Boolean).length;
  return {
    family,
    action,
    runs: flows,
    safe,
    curtailKWh: exp.curtailed * 0.25,
    battKWh: Math.abs(action.batt ?? 0) * 0.25,
    switchOps: action.tie ? 1 : 0,
    devices,
    worst: worst!,
    worstViolation: worst!.violations.length ? worstViolation(worst!.violations) : undefined,
    vMax,
    vMin,
    maxLoad,
  };
}

/** PRD ranking: safe first → least solar cut → least battery cycling → fewest switch moves. */
export function rankCompare(a: Evaluated, b: Evaluated): number {
  if (a.safe !== b.safe) return a.safe ? -1 : 1;
  if (!a.safe) return badness(a) - badness(b);
  const eps = 1e-6;
  if (Math.abs(a.curtailKWh - b.curtailKWh) > eps) return a.curtailKWh - b.curtailKWh;
  if (Math.abs(a.battKWh - b.battKWh) > eps) return a.battKWh - b.battKWh;
  if (a.switchOps !== b.switchOps) return a.switchOps - b.switchOps;
  return a.devices - b.devices;
}

function badness(e: Evaluated): number {
  return RUNS.reduce((s, r) => s + e.runs[r].violations.reduce((a, v) => a + v.severity, 0), 0);
}

const SIZES_KW = [5, 10, 15, 20];

export interface Context {
  soc: number;
  scenario: Scenario;
  plant: Plant;
  allowCurtailOnly?: boolean; // for the curtail-only baseline
  noCurtail?: boolean;
}

function battRoom(ctx: Context) {
  const { plant, soc } = ctx;
  const charge = Math.max(0, ((BATTERY.socMax - soc) * plant.battKWh) / 0.25);
  const discharge = Math.max(0, ((soc - BATTERY.socMin) * plant.battKWh) / 0.25);
  return { charge: Math.min(plant.battKw, charge), discharge: Math.min(plant.battKw, discharge) };
}

function battSizes(max: number): number[] {
  const out: number[] = [];
  const step = max >= 40 ? 10 : 5;
  for (let p = step; p <= max + 1e-9; p += step) out.push(p);
  if (max > 0.5 && (out.length === 0 || out[out.length - 1] < max - 0.5)) out.push(Math.floor(max * 10) / 10);
  return out.length ? out : [];
}

function cutSizes(cap: number): number[] {
  const out: number[] = [];
  for (let c = 0.05; c <= cap + 1e-9; c += 0.05) out.push(Math.round(c * 100) / 100);
  return out;
}

export interface FamilyResult {
  family: FamilyId;
  best: Evaluated; // smallest safe option, or the strongest unsafe one
  available: boolean;
  note?: string;
}

/** Tests every action family (alone and in pairs) and returns the best option in each. */
export function testActions(runs: Record<RunId, Injection>, ctx: Context): FamilyResult[] {
  const { scenario, plant } = ctx;
  const room = battRoom(ctx);
  const hasPv = RUNS.some((r) => Object.values(runs[r].pv).some((p) => p > 0.1));
  const chg = battSizes(room.charge);
  const dis = battSizes(room.discharge);
  const cuts = ctx.noCurtail ? [] : cutSizes(ctx.allowCurtailOnly ? 1 : scenario.curtailCap);
  const tieOk = scenario.tieAvailable;

  const fams: { id: FamilyId; options: Action[]; available: boolean; note?: string }[] = [
    { id: "none", options: [{}], available: true },
    { id: "q", options: [{ reactive: true }], available: hasPv, note: hasPv ? undefined : "No solar to control right now" },
    { id: "chg", options: chg.map((p) => ({ batt: p })), available: chg.length > 0, note: chg.length ? undefined : "Battery is full" },
    { id: "dis", options: dis.map((p) => ({ batt: -p })), available: dis.length > 0, note: dis.length ? undefined : "Battery is empty" },
    { id: "tie", options: [{ tie: true }], available: tieOk, note: tieOk ? undefined : "Tie switch unavailable" },
    { id: "cut", options: cuts.map((c) => ({ curtail: c })), available: hasPv && cuts.length > 0, note: hasPv ? undefined : "No solar to cut" },
    {
      id: "q_chg",
      options: chg.map((p) => ({ reactive: true, batt: p })),
      available: hasPv && chg.length > 0,
      note: !hasPv ? "No solar to control" : chg.length ? undefined : "Battery is full",
    },
    { id: "q_cut", options: cuts.map((c) => ({ reactive: true, curtail: c })), available: hasPv && cuts.length > 0 },
    {
      id: "chg_cut",
      options: chg.flatMap((p) => cuts.map((c) => ({ batt: p, curtail: c }))),
      available: hasPv && chg.length > 0 && cuts.length > 0,
      note: chg.length ? undefined : "Battery is full",
    },
    {
      id: "tie_dis",
      options: dis.map((p) => ({ tie: true, batt: -p })),
      available: tieOk && dis.length > 0,
      note: !tieOk ? "Tie switch unavailable" : dis.length ? undefined : "Battery is empty",
    },
    {
      id: "tie_chg",
      options: chg.map((p) => ({ tie: true, batt: p })),
      available: tieOk && chg.length > 0,
      note: !tieOk ? "Tie switch unavailable" : chg.length ? undefined : "Battery is full",
    },
    { id: "tie_q", options: [{ tie: true, reactive: true }], available: tieOk && hasPv, note: !tieOk ? "Tie switch unavailable" : undefined },
  ];

  const allowed = ctx.allowCurtailOnly ? new Set<FamilyId>(["none", "cut"]) : null;

  const results: FamilyResult[] = [];
  for (const f of fams) {
    if (allowed && !allowed.has(f.id)) continue;
    if (!f.available || f.options.length === 0) {
      results.push({ family: f.id, best: evaluate(f.id, {}, runs, plant), available: false, note: f.note });
      continue;
    }
    const evals = f.options.map((o) => evaluate(f.id, o, runs, plant)).sort(rankCompare);
    results.push({ family: f.id, best: evals[0], available: true });
  }
  return results.sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    return rankCompare(a.best, b.best);
  });
}

// ───────────────────────────── explanations ─────────────────────────────

export function lossReason(r: FamilyResult, winner: Evaluated | null): string {
  if (!r.available) return r.note ?? "Not available";
  const e = r.best;
  if (!e.safe) {
    const v = e.worstViolation!;
    return `Unsafe — ${describeViolation(v)}`;
  }
  if (!winner || e === winner) return "Winner";
  if (e.curtailKWh > winner.curtailKWh + 1e-6)
    return `Safe, but wastes ${(e.curtailKWh - winner.curtailKWh).toFixed(1)} kWh more solar`;
  if (e.battKWh > winner.battKWh + 1e-6) return `Safe, but uses ${(e.battKWh - winner.battKWh).toFixed(1)} kWh more battery`;
  if (e.switchOps > winner.switchOps) return "Safe, but needs a switch move";
  return "Safe, but uses more devices";
}

export function whyReasons(results: FamilyResult[], winner: Evaluated | null, ctx: Context, none: Evaluated): string[] {
  const reasons: string[] = [];
  const nv = none.worstViolation;
  if (!winner) {
    if (nv) reasons.push(`Without action: ${describeViolation(nv)}.`);
    reasons.push("Every one of the tested fixes still breaks a limit in at least one forecast.");
    const best = results.filter((r) => r.available).map((r) => r.best).sort(rankCompare)[0];
    if (best?.worstViolation) reasons.push(`Closest try (${shortAction(best.action)}): ${describeViolation(best.worstViolation)}.`);
    reasons.push("So the twin stops recommending and prescribes the smallest upgrade instead.");
    return reasons;
  }
  if (winner.family === "none") {
    reasons.push(`All limits hold in all 3 forecasts — highest voltage ${none.vMax.toFixed(3)} p.u., lowest ${none.vMin.toFixed(3)} p.u.`);
    reasons.push(`Busiest equipment is at ${none.maxLoad.toFixed(0)}% of its rating.`);
    reasons.push("No action means zero solar wasted and zero battery wear.");
    return reasons;
  }
  if (nv) reasons.push(`Without action: ${describeViolation(nv)}.`);
  reasons.push(
    `With this fix, voltage stays between ${winner.vMin.toFixed(3)} and ${winner.vMax.toFixed(3)} p.u. and loading peaks at ${winner.maxLoad.toFixed(0)}% — in all 3 forecasts.`
  );
  if (winner.action.batt) {
    const soc = Math.round(ctx.soc * 100);
    const room =
      winner.action.batt > 0
        ? `${((BATTERY.socMax - ctx.soc) * ctx.plant.battKWh).toFixed(1)} kWh of space left`
        : `${((ctx.soc - BATTERY.socMin) * ctx.plant.battKWh).toFixed(1)} kWh left to give`;
    reasons.push(`Battery is ${soc}% full — ${room}.`);
  }
  const cutOnly = results.find((r) => r.family === "cut");
  if (cutOnly?.available && cutOnly.best.safe && winner.family !== "cut") {
    const saved = cutOnly.best.curtailKWh - winner.curtailKWh;
    if (saved > 0.05) reasons.push(`A cut-only fix would waste ${cutOnly.best.curtailKWh.toFixed(1)} kWh of solar — this saves ${saved.toFixed(1)} kWh.`);
  } else if (winner.curtailKWh > 0) {
    reasons.push(`Solar cut of ${winner.curtailKWh.toFixed(1)} kWh is shared across all rooftops by size — fairness 1.00.`);
  }
  const runnerUp = results.find((r) => r.available && r.best !== winner && r.family !== "none");
  if (runnerUp && reasons.length < 5) {
    reasons.push(`${FAMILY_LABEL[runnerUp.family]} lost: ${lossReason(runnerUp, winner).replace("Unsafe — ", "breaks a limit — ")}.`);
  }
  return reasons.slice(0, 5);
}

// ───────────────────────────── fairness ─────────────────────────────

export function jainIndex(xs: number[]): number {
  const n = xs.length;
  const s = xs.reduce((a, b) => a + b, 0);
  const s2 = xs.reduce((a, b) => a + b * b, 0);
  if (s2 === 0) return 1;
  return (s * s) / (n * s2);
}

/** Share of each rooftop's own solar that gets cut (the quantity Jain's index is computed on). */
export function cutShares(f: Flow, inj: Injection): number[] {
  return PV_BUSES.map((b) => (inj.pv[b] > 0 ? (f.curtailByBus[b] ?? 0) / inj.pv[b] : 0));
}

// ───────────────────────────── risk + forecast ─────────────────────────────

export interface StepForecast {
  risk: number;
  level: "safe" | "watch" | "critical";
  minutesToViolation: number | null;
  horizon: { step: number; time: string; runs: Record<RunId, Flow> }[];
}

const RUN_WEIGHT: Record<RunId, number> = { P10: 0.25, P50: 0.5, P90: 0.25 };

export function riskLevel(risk: number): StepForecast["level"] {
  return risk >= 60 ? "critical" : risk >= 30 ? "watch" : "safe";
}

/** Looks 4 steps (60 min) ahead with no new action and scores the risk. */
export function forecastAhead(sc: Scenario, step: number, soc: number, plant: Plant = BASE_PLANT): StepForecast {
  const seen = (step * 15) / 60;
  const horizon: StepForecast["horizon"] = [];
  let risk = 0;
  let mtv: number | null = null;
  const perRunMax: Record<RunId, number> = { P10: 0, P50: 0, P90: 0 };
  for (let k = 1; k <= 4; k++) {
    const s = step + k;
    if (s >= FEEDER.steps) break;
    const hour = (s * 15) / 60;
    const runs = {} as Record<RunId, Flow>;
    for (const r of RUNS) {
      const f = powerFlow(forecastInjection(sc, hour, seen, r, plant), {}, plant);
      runs[r] = f;
      perRunMax[r] = Math.max(perRunMax[r], stress(f));
      if (f.violations.length && mtv === null) mtv = k * 15;
    }
    horizon.push({ step: s, time: stepToTime(s), runs });
  }
  for (const r of RUNS) risk += RUN_WEIGHT[r] * perRunMax[r];
  const score = Math.round(Math.min(100, risk * 100));
  void soc;
  return { risk: score, level: riskLevel(score), minutesToViolation: mtv, horizon };
}

// ───────────────────────────── day simulation ─────────────────────────────

export interface StepRecord {
  step: number;
  time: string;
  hour: number;
  inj: Injection;
  base: Flow; // without GridGuard
  gg: Flow; // with GridGuard (actual outcome)
  action: Action;
  family: FamilyId;
  feasible: boolean;
  socBefore: number;
  socAfter: number;
  forecast: StepForecast; // looking ahead from this step (without action)
  cutOnly: Flow; // curtail-only baseline
}

export interface DayResult {
  scenario: Scenario;
  plant: Plant;
  steps: StepRecord[];
  metrics: DayMetrics;
}

export interface DayMetrics {
  baseViolationSteps: number;
  ggViolationSteps: number;
  solarAvailKWh: number;
  solarUsedKWh: number;
  utilisation: number;
  curtailKWh: number;
  cutOnlyCurtailKWh: number;
  curtailSaved: number; // fraction vs cut-only
  leadMinutes: number[]; // early-warning lead time per violation episode
  minLead: number | null;
  jain: number | null;
  infeasibleSteps: number;
  baseMaxV: number;
  ggMaxV: number;
  baseMinV: number;
  ggMinV: number;
  baseMaxLoad: number;
  ggMaxLoad: number;
  battCycledKWh: number;
  switchOps: number;
}

function decide(sc: Scenario, step: number, soc: number, plant: Plant, opts: Partial<Context> = {}) {
  const hour = (step * 15) / 60;
  const seen = Math.max(0, hour - 0.25);
  const runs = {} as Record<RunId, Injection>;
  for (const r of RUNS) runs[r] = forecastInjection(sc, hour, seen, r, plant);
  const ctx: Context = { soc, scenario: sc, plant, ...opts };
  const results = testActions(runs, ctx);
  const winner = results.find((r) => r.available && r.best.safe)?.best ?? null;
  const none = results.find((r) => r.family === "none")!.best;
  return { runs, ctx, results, winner, none };
}

/** Best-effort pick when nothing is safe: the option that breaks limits the least. */
function bestEffort(results: FamilyResult[]): Evaluated {
  return results.filter((r) => r.available).map((r) => r.best).sort(rankCompare)[0];
}

export function simulateDay(scId: ScenarioId, plant: Plant = BASE_PLANT, stepEvery = 1): DayResult {
  const sc = scenarioById(scId);
  let soc = sc.startSoc;
  const steps: StepRecord[] = [];
  let curtailKWh = 0,
    cutOnlyKWh = 0,
    availKWh = 0,
    battCycled = 0,
    switchOps = 0;
  const jains: number[] = [];
  const dt = 0.25 * stepEvery;
  for (let step = 0; step < FEEDER.steps; step += stepEvery) {
    const hour = (step * 15) / 60;
    const inj = actualInjection(sc, hour, plant);
    const base = powerFlow(inj, {}, plant);
    const d = decide(sc, step, soc, plant);
    let chosen = d.winner ?? bestEffort(d.results);
    // Battery idles on a quiet step — keep it simple and honest.
    const action = { ...chosen.action };
    const gg = powerFlow(inj, action, plant);
    const socBefore = soc;
    if (action.batt) {
      soc += (action.batt * dt) / plant.battKWh;
      soc = Math.min(BATTERY.socMax, Math.max(BATTERY.socMin, soc));
      battCycled += Math.abs(action.batt) * dt;
    }
    if (action.tie) switchOps += 1;
    const cutOnlyD = decide(sc, step, socBefore, plant, { allowCurtailOnly: true });
    const cutOnlyAction = (cutOnlyD.winner ?? bestEffort(cutOnlyD.results)).action;
    const cutOnly = powerFlow(inj, cutOnlyAction, plant);
    curtailKWh += gg.curtailed * dt;
    cutOnlyKWh += cutOnly.curtailed * dt;
    availKWh += gg.pvAvail * dt;
    if (gg.curtailed > 0.01) jains.push(jainIndex(cutShares(gg, inj)));
    steps.push({
      step,
      time: stepToTime(step),
      hour,
      inj,
      base,
      gg,
      action,
      family: chosen.family,
      feasible: !!d.winner,
      socBefore,
      socAfter: soc,
      forecast: forecastAhead(sc, step, socBefore, plant),
      cutOnly,
    });
    chosen = chosen; // eslint quiet
  }

  // Early warning lead time: for each violation episode (baseline), minutes between first warning and violation.
  const lead: number[] = [];
  for (let i = 0; i < steps.length; i++) {
    const starts = steps[i].base.violations.length > 0 && (i === 0 || steps[i - 1].base.violations.length === 0);
    if (!starts) continue;
    let first = i;
    for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
      const f = steps[j].forecast;
      if (f.minutesToViolation !== null && f.minutesToViolation <= (i - j) * 15 * stepEvery) first = j;
    }
    lead.push((i - first) * 15 * stepEvery);
  }

  const m: DayMetrics = {
    baseViolationSteps: steps.filter((s) => s.base.violations.length).length,
    ggViolationSteps: steps.filter((s) => s.gg.violations.length).length,
    solarAvailKWh: availKWh,
    solarUsedKWh: availKWh - curtailKWh,
    utilisation: availKWh > 0 ? (availKWh - curtailKWh) / availKWh : 1,
    curtailKWh,
    cutOnlyCurtailKWh: cutOnlyKWh,
    curtailSaved: cutOnlyKWh > 0 ? 1 - curtailKWh / cutOnlyKWh : 0,
    leadMinutes: lead,
    minLead: lead.length ? Math.min(...lead) : null,
    jain: jains.length ? Math.min(...jains) : null,
    infeasibleSteps: steps.filter((s) => !s.feasible).length,
    baseMaxV: Math.max(...steps.map((s) => s.base.vMax)),
    ggMaxV: Math.max(...steps.map((s) => s.gg.vMax)),
    baseMinV: Math.min(...steps.map((s) => s.base.vMin)),
    ggMinV: Math.min(...steps.map((s) => s.gg.vMin)),
    baseMaxLoad: Math.max(...steps.map((s) => Math.max(s.base.maxLine, s.base.trafoLoad))),
    ggMaxLoad: Math.max(...steps.map((s) => Math.max(s.gg.maxLine, s.gg.trafoLoad))),
    battCycledKWh: battCycled,
    switchOps,
  };
  return { scenario: sc, plant, steps, metrics: m };
}

/** Full detail for one moment — used by the Twin Console and the Action Arena. */
export function momentDetail(day: DayResult, step: number) {
  const rec = day.steps[step];
  const d = decide(day.scenario, step, rec.socBefore, day.plant);
  const fair = d.winner?.action.curtail
    ? (() => {
        const endOnly = testActions(d.runs, { ...d.ctx })
          .find((r) => r.family === "cut");
        void endOnly;
        const fairFlow = powerFlow(rec.inj, d.winner!.action, day.plant);
        // minimal end-of-line-only cut that is safe in all runs
        let endAction: Action | null = null;
        for (let c = 0.05; c <= 1.0001; c += 0.05) {
          const a: Action = { ...d.winner!.action, curtail: Math.round(c * 100) / 100, curtailMode: "end" };
          if (RUNS.every((r) => powerFlow(d.runs[r], a, day.plant).violations.length === 0)) {
            endAction = a;
            break;
          }
        }
        const endFlow = endAction ? powerFlow(rec.inj, endAction, day.plant) : null;
        return {
          fairShares: cutShares(fairFlow, rec.inj),
          fairJain: jainIndex(cutShares(fairFlow, rec.inj)),
          fairKw: fairFlow.curtailByBus,
          endShares: endFlow ? cutShares(endFlow, rec.inj) : null,
          endJain: endFlow ? jainIndex(cutShares(endFlow, rec.inj)) : null,
          endKw: endFlow?.curtailByBus ?? null,
          endPossible: !!endAction,
        };
      })()
    : null;
  return {
    rec,
    results: d.results,
    winner: d.winner,
    none: d.none,
    reasons: whyReasons(d.results, d.winner, d.ctx, d.none),
    fair,
    runs: d.runs,
  };
}

// ───────────────────────────── upgrade prescription ─────────────────────────────

export interface Prescription {
  bindingLimit: string;
  infeasibleWindow: string;
  options: { label: string; detail: string; works: boolean; violationsAfter: number; icon: string }[];
  recommended: string | null;
}

export function prescribe(day: DayResult): Prescription | null {
  const bad = day.steps.filter((s) => !s.feasible || s.gg.violations.length);
  if (!bad.length) return null;
  const worstStep = bad.slice().sort((a, b) => {
    const sa = a.gg.violations.reduce((x, v) => x + v.severity, 0);
    const sb = b.gg.violations.reduce((x, v) => x + v.severity, 0);
    return sb - sa;
  })[0];
  const binding = worstViolation(worstStep.gg.violations.length ? worstStep.gg.violations : worstStep.base.violations);
  const window = `${bad[0].time} – ${stepToTime(bad[bad.length - 1].step + 1)}`;
  const scId = day.scenario.id;
  const options: Prescription["options"] = [];

  // 1) Extra battery at B3 that only fills the gap the existing tools cannot
  let battFix: string | null = null;
  const gap = gapBattery(day);
  if (gap) {
    const after = gap.after;
    battFix = `+${gap.kWh} kWh / ${gap.kw} kW battery at B3`;
    options.push({
      icon: "🔋",
      label: `Add a ${gap.kWh} kWh, ${gap.kw} kW battery at B3`,
      detail: after === 0 ? "Re-simulated with the new battery: 0 problem steps." : `Re-simulated: still ${after} problem steps.`,
      works: after === 0,
      violationsAfter: after,
    });
  } else options.push({ icon: "🔋", label: "Add battery at B3", detail: "Even a 60 kW battery is not enough on its own.", works: false, violationsAfter: -1 });

  // 2) Export cap at the end-of-line rooftop
  let capFix: string | null = null;
  for (let cap = 20; cap >= 0; cap -= 2) {
    const plant: Plant = { ...day.plant, exportCap: { B3: cap } };
    if (simulateWith(scId, plant) === 0) {
      capFix = `Export cap ${cap} kW at B3`;
      options.push({ icon: "🧢", label: `Cap export at B3 to ${cap} kW`, detail: "Re-simulated: 0 problem steps. The home keeps self-use; only surplus export is limited.", works: true, violationsAfter: 0 });
      break;
    }
  }
  if (!capFix) options.push({ icon: "🧢", label: "Export cap at B3", detail: "No cap level fixes it alone.", works: false, violationsAfter: -1 });

  // 3) Bigger transformer
  let trafoFix: string | null = null;
  for (const kva of [160, 200, 250]) {
    const plant: Plant = { ...day.plant, transformerKva: kva };
    const v = simulateWith(scId, plant);
    if (v === 0) {
      trafoFix = `${kva} kVA transformer`;
      options.push({ icon: "🏗️", label: `Upgrade transformer to ${kva} kVA`, detail: "Re-simulated: 0 problem steps.", works: true, violationsAfter: 0 });
      break;
    }
    if (kva === 250)
      options.push({
        icon: "🏗️",
        label: "Bigger transformer (up to 250 kVA)",
        detail: `Still ${v} problem steps — the limit is voltage rise on the line, not transformer size.`,
        works: false,
        violationsAfter: v,
      });
  }

  const recommended = battFix ?? capFix ?? trafoFix;
  return {
    bindingLimit: describeViolation(binding),
    infeasibleWindow: window,
    options,
    recommended,
  };
}

/** Sizes an extra B3 battery that steps in only when no existing action is safe, then re-simulates with it. */
function gapBattery(day: DayResult): { kWh: number; kw: number; after: number } | null {
  const sc = day.scenario;
  const need: number[] = [];
  let soc = sc.startSoc;
  for (let step = 0; step < FEEDER.steps; step++) {
    const d = decide(sc, step, soc, day.plant);
    let pick = d.winner?.action;
    let extra = 0;
    if (!pick) {
      const be = bestEffort(d.results).action;
      pick = be;
      const dir = RUNS.some((r) => d.none.runs[r].violations.some((v) => v.kind === "over")) ? 1 : -1;
      let found = false;
      for (let p = 1; p <= 60; p++) {
        const a = { ...be, batt: (be.batt ?? 0) + dir * p };
        if (RUNS.every((r) => powerFlow(d.runs[r], a, day.plant).violations.length === 0)) {
          extra = p;
          found = true;
          break;
        }
      }
      if (!found) return null;
    }
    need.push(extra);
    if (pick.batt) soc = clampSoc(soc + (pick.batt * 0.25) / day.plant.battKWh);
  }
  const kw = Math.ceil(Math.max(...need) / 5) * 5;
  const energy = need.reduce((a, b) => a + b * 0.25, 0);
  const kWh = Math.ceil(energy / (BATTERY.socMax - BATTERY.socMin) / 5) * 5;
  if (kw === 0) return null;
  // Verify: replay with the gap battery enabled
  soc = sc.startSoc;
  let store = 0;
  const cap = kWh * (BATTERY.socMax - BATTERY.socMin);
  let bad = 0;
  for (let step = 0; step < FEEDER.steps; step++) {
    const hour = (step * 15) / 60;
    const inj = actualInjection(sc, hour, day.plant);
    const d = decide(sc, step, soc, day.plant);
    let a = d.winner?.action ?? bestEffort(d.results).action;
    if (!d.winner) {
      const dir = RUNS.some((r) => d.none.runs[r].violations.some((v) => v.kind === "over")) ? 1 : -1;
      for (let p = 1; p <= kw; p++) {
        const room = dir > 0 ? cap - store : store + cap; // charge room / energy (assume pre-charged for discharge)
        if (p * 0.25 > room + 1e-9) break;
        const t = { ...a, batt: (a.batt ?? 0) + dir * p };
        if (RUNS.every((r) => powerFlow(d.runs[r], t, day.plant).violations.length === 0)) {
          a = t;
          store += dir * p * 0.25;
          break;
        }
      }
    }
    const baseBatt = (d.winner?.action ?? bestEffort(d.results).action).batt ?? 0;
    if (powerFlow(inj, a, day.plant).violations.length) bad++;
    if (baseBatt) soc = clampSoc(soc + (baseBatt * 0.25) / day.plant.battKWh);
  }
  return { kWh, kw, after: bad };
}

function simulateWith(scId: ScenarioId, plant: Plant, scOverride?: Scenario): number {
  const sc = scOverride ?? scenarioById(scId);
  let soc = sc.startSoc;
  let bad = 0;
  for (let step = 0; step < FEEDER.steps; step++) {
    const hour = (step * 15) / 60;
    const inj = actualInjection(sc, hour, plant);
    const d = decide(sc, step, soc, plant);
    const pick = d.winner ?? bestEffort(d.results);
    const f = powerFlow(inj, pick.action, plant);
    if (f.violations.length) bad++;
    if (pick.action.batt) soc = Math.min(BATTERY.socMax, Math.max(BATTERY.socMin, soc + (pick.action.batt * 0.25) / plant.battKWh));
  }
  return bad;
}

// ───────────────────────────── connection simulator ─────────────────────────────

export type InverterMode = "unity" | "pf095";
export type Verdict = "safe" | "fix" | "upgrade";

export interface ConnectInput {
  bus: BusId;
  kw: number;
  mode: InverterMode;
  battKWh: 0 | 5 | 10;
}

export interface ConnectScenarioResult {
  scenario: ScenarioId;
  pass: boolean;
  gating: boolean; // S4 is a stress test: shown, but it does not block the verdict
  problemHours: number;
  extraCutKWh: number;
  worstV: number;
  worstLoad: number;
  hourlyV: { time: string; before: number; after: number }[];
  note: string;
}

export interface ConnectResult {
  input: ConnectInput;
  verdict: Verdict;
  fix?: ConnectInput;
  fixText?: string;
  reasons: string[];
  scenarios: ConnectScenarioResult[];
  fixScenarios?: ConnectScenarioResult[];
  newKWhPerDay: number;
}

const connectCache = new Map<string, ConnectScenarioResult[]>();
const baseHourCache = new Map<ScenarioId, BaseHour[]>();

/** Extra solar cut the new system may cause, as a share of its own daily energy. */
export const CONNECT_CUT_LIMIT = 0.2;

function newSystemEnergy(kw: number): number {
  let e = 0;
  for (let h = 0; h < 24; h += 0.25) e += kw * pvCapacityFactor(h) * 0.25;
  return e;
}

interface BaseHour {
  flow: Flow;
  action: Action;
  socAfter: number;
}

/** The feeder as GridGuard runs it today, sampled hourly (shared by every connection check). */
function baseHours(sc: ScenarioId): BaseHour[] {
  const hit = baseHourCache.get(sc);
  if (hit) return hit;
  const scen = scenarioById(sc);
  let soc = scen.startSoc;
  const out: BaseHour[] = [];
  for (let h = 0; h < 24; h++) {
    const step = h * 4 + 2;
    const d = decide(scen, step, soc, BASE_PLANT);
    const p = d.winner ?? bestEffort(d.results);
    if (p.action.batt) soc = clampSoc(soc + p.action.batt / BASE_PLANT.battKWh);
    out.push({ flow: powerFlow(actualInjection(scen, step / 4, BASE_PLANT), p.action, BASE_PLANT), action: p.action, socAfter: soc });
  }
  baseHourCache.set(sc, out);
  return out;
}

const safeFlow = (f: Flow) => f.violations.length === 0;

/** Smallest x in [0, max] for which make(x) is safe (bisection); null if even max is unsafe. */
function smallestSafe(max: number, make: (x: number) => Flow): number | null {
  if (max <= 0) return safeFlow(make(0)) ? 0 : null;
  if (safeFlow(make(0))) return 0;
  if (!safeFlow(make(max))) return null;
  let lo = 0,
    hi = max;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (safeFlow(make(mid))) hi = mid;
    else lo = mid;
  }
  return hi;
}

/**
 * Replays each scenario hour by hour with the proposed system added.
 * GridGuard keeps today's plan, then covers any new problem with spare battery first
 * and only then with the smallest extra solar cut, shared fairly (new system included).
 */
function runConnect(input: ConnectInput): ConnectScenarioResult[] {
  const key = JSON.stringify(input);
  const hit = connectCache.get(key);
  if (hit) return hit;
  const out: ConnectScenarioResult[] = [];
  const newE = newSystemEnergy(input.kw);
  for (const sc of ["S1", "S2", "S3", "S4"] as ScenarioId[]) {
    const scen = scenarioById(sc);
    const base = baseHours(sc);
    let extraStored = 0; // kWh of feeder battery used beyond today's plan
    let ownStore = 0; // kWh in the new system's own battery
    let problems = 0,
      extraCut = 0,
      worstV = 0,
      worstLoad = 0;
    const hourlyV: ConnectScenarioResult["hourlyV"] = [];
    for (let h = 0; h < 24; h++) {
      const hour = (h * 4 + 2) / 4;
      const avail = input.kw * pvCapacityFactor(hour) * scen.solarFactor * cloudFactor(scen, hour);
      // Hybrid inverter: its own battery soaks up the midday peak (power = kWh / 2).
      const absorb = hour >= 10 && hour <= 15 ? Math.max(0, Math.min(input.battKWh / 2, avail, input.battKWh * 0.9 - ownStore)) : 0;
      ownStore += absorb;
      const effKw = avail > 0 ? input.kw * (1 - absorb / avail) : input.kw;
      const plant: Plant = { ...BASE_PLANT, extraPv: { bus: input.bus, kw: effKw, reactive: input.mode === "pf095", battKWh: input.battKWh } };
      const inj = actualInjection(scen, hour, plant);
      const { flow: fB, action: aB, socAfter } = base[h];
      const baseBatt = aB.batt ?? 0;
      const baseCut = aB.curtail ?? 0;

      let act: Action = { ...aB };
      let fA = powerFlow(inj, act, plant);
      if (!safeFlow(fA)) {
        const over = fA.violations.some((v) => v.kind === "over");
        // 1) spare feeder battery
        const room = over
          ? Math.min(BASE_PLANT.battKw - Math.max(0, baseBatt), (BATTERY.socMax - socAfter) * BASE_PLANT.battKWh - extraStored)
          : Math.min(BASE_PLANT.battKw + Math.min(0, baseBatt), (socAfter - BATTERY.socMin) * BASE_PLANT.battKWh + extraStored);
        const dir = over ? 1 : -1;
        const x = smallestSafe(Math.max(0, room), (p) => powerFlow(inj, { ...aB, batt: baseBatt + dir * p }, plant));
        const useBatt = x ?? Math.max(0, room);
        act = { ...aB, batt: baseBatt + dir * useBatt };
        extraStored += dir * useBatt;
        // 2) smallest extra fair cut
        if (x === null && over) {
          const c = smallestSafe(1 - baseCut, (cc) => powerFlow(inj, { ...act, curtail: baseCut + cc }, plant));
          act = { ...act, curtail: baseCut + (c ?? 1 - baseCut) };
        }
        fA = powerFlow(inj, act, plant);
      }
      extraCut += Math.max(0, fA.curtailed - fB.curtailed);
      const worse =
        fA.violations.length > 0 &&
        (fB.violations.length === 0 || fA.vMax > fB.vMax + 0.002 || Math.max(fA.maxLine, fA.trafoLoad) > Math.max(fB.maxLine, fB.trafoLoad) + 2);
      if (worse) problems++;
      worstV = Math.max(worstV, fA.vMax);
      worstLoad = Math.max(worstLoad, fA.maxLine, fA.trafoLoad);
      hourlyV.push({ time: `${String(h).padStart(2, "0")}:30`, before: +fB.v[input.bus].toFixed(4), after: +fA.v[input.bus].toFixed(4) });
    }
    const stressDay = sc === "S4";
    const cutLimit = CONNECT_CUT_LIMIT * newE;
    const pass = stressDay ? problems === 0 : problems === 0 && extraCut <= cutLimit + 1e-6;
    let note: string;
    if (problems > 0) note = stressDay ? `Pushes the critical day higher (peak ${worstV.toFixed(3)} p.u.)` : `${problems} hour${problems > 1 ? "s" : ""} over the limit`;
    else if (!stressDay && extraCut > cutLimit) note = `Forces ${extraCut.toFixed(0)} kWh of solar cuts (${Math.round((extraCut / newE) * 100)}% of its output)`;
    else note = extraCut > 0.5 ? `Safe — ${extraCut.toFixed(1)} kWh shared solar cut` : "All limits hold";
    out.push({ scenario: sc, pass, gating: !stressDay, problemHours: problems, extraCutKWh: extraCut, worstV, worstLoad, hourlyV, note });
  }
  connectCache.set(key, out);
  return out;
}

const clampSoc = (s: number) => Math.min(BATTERY.socMax, Math.max(BATTERY.socMin, s));

export function checkConnection(input: ConnectInput): ConnectResult {
  const scenarios = runConnect(input);
  const newKWhPerDay = newSystemEnergy(input.kw);
  const passes = (rs: ConnectScenarioResult[]) => rs.every((r) => r.pass || !r.gating);
  const reasons: string[] = [];
  const worst = scenarios.reduce((a, b) => (b.worstV > a.worstV ? b : a));
  if (passes(scenarios)) {
    reasons.push(`Sunny, peak and cloudy days all stay inside the limits with ${input.kw} kW added at ${input.bus}.`);
    reasons.push(`Highest voltage anywhere: ${worst.worstV.toFixed(3)} p.u. (${worst.scenario}) — limit 1.05.`);
    const extra = scenarios.reduce((a, b) => a + b.extraCutKWh, 0);
    reasons.push(extra > 0.05 ? `Needs only ${extra.toFixed(1)} kWh of extra solar cuts across the 4 days.` : "Needs no extra solar cuts on the feeder.");
    reasons.push(`The new system makes about ${newKWhPerDay.toFixed(0)} kWh of clean energy on a sunny day.`);
    return { input, verdict: "safe", reasons, scenarios, newKWhPerDay };
  }
  const failing = scenarios.filter((s) => !s.pass && s.gating);
  for (const f of failing) reasons.push(`${scenarioById(f.scenario).name}: ${f.note}.`);

  // Search design fixes, cheapest first: inverter mode → small battery → both → bigger battery.
  const candidates: { input: ConnectInput; text: string }[] = [];
  if (input.mode === "unity") candidates.push({ input: { ...input, mode: "pf095" }, text: "Set the inverter to 0.95 PF (absorbing)" });
  for (const b of [5, 10] as const) {
    if (b > input.battKWh) {
      candidates.push({ input: { ...input, battKWh: b }, text: `Add a ${b} kWh battery (hybrid inverter)` });
      if (input.mode === "unity")
        candidates.push({ input: { ...input, mode: "pf095", battKWh: b }, text: `Set inverter to 0.95 PF and add a ${b} kWh battery` });
    }
  }
  for (const c of candidates) {
    const rs = runConnect(c.input);
    if (passes(rs)) {
      reasons.push(`Fix found: ${c.text.toLowerCase()} — then every test day passes.`);
      const w = rs.reduce((a, b) => (b.worstV > a.worstV ? b : a));
      reasons.push(`With the fix, worst-hour voltage is ${w.worstV.toFixed(3)} p.u.`);
      return { input, verdict: "fix", fix: c.input, fixText: c.text, reasons, scenarios, fixScenarios: rs, newKWhPerDay };
    }
  }
  // Smallest system size that would pass as proposed
  let maxOk = 0;
  for (let kw = 2; kw < input.kw; kw += 2) {
    if (passes(runConnect({ ...input, kw, mode: "pf095", battKWh: 10 }))) maxOk = kw;
    else break;
  }
  reasons.push("No inverter setting or small battery makes it safe.");
  reasons.push(
    maxOk > 0
      ? `This spot can take up to ${maxOk} kW (with 0.95 PF + 10 kWh battery) before the transformer or line needs an upgrade.`
      : "This spot needs a transformer upgrade or a feeder battery before any new rooftop system."
  );
  return { input, verdict: "upgrade", reasons, scenarios, newKWhPerDay };
}
