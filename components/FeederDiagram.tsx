"use client";

import { BusId, FEEDER, LineId, PV } from "@/lib/config";
import { Flow, Injection } from "@/lib/engine";

export const vColor = (v: number) =>
  v > FEEDER.vMax || v < FEEDER.vMin ? "#f43f5e" : v > FEEDER.vMax - 0.01 || v < FEEDER.vMin + 0.01 ? "#fbbf24" : "#34d399";
export const loadColor = (l: number) => (l > 100 ? "#f43f5e" : l > 85 ? "#fbbf24" : "#22d3ee");

const POS: Record<BusId, [number, number]> = {
  B0: [150, 200],
  B1: [320, 100],
  B2: [500, 100],
  B3: [700, 100],
  B4: [380, 300],
  B5: [700, 300],
};

const PATHS: Record<LineId, string> = {
  A1: "M150,200 V100 H320",
  A2: "M320,100 H500",
  A3: "M500,100 H700",
  BL1: "M150,200 V300 H380",
  BL2: "M380,300 H700",
  TIE: "M700,300 V100",
};

type Anchor = "start" | "middle" | "end";
const L: Record<string, { vx: number; vy: number; hx: number; hy: number; anchor: Anchor }> = {
  B1: { vx: 320, vy: 136, hx: 320, hy: 152, anchor: "middle" },
  B2: { vx: 500, vy: 136, hx: 500, hy: 152, anchor: "middle" },
  B3: { vx: 724, vy: 128, hx: 724, hy: 144, anchor: "start" },
  B4: { vx: 380, vy: 274, hx: 380, hy: 340, anchor: "middle" },
  B5: { vx: 724, vy: 292, hx: 724, hy: 308, anchor: "start" },
};

const LABEL_AT: Record<LineId, [number, number]> = {
  A1: [235, 90],
  A2: [410, 90],
  A3: [600, 90],
  BL1: [265, 322],
  BL2: [540, 322],
  TIE: [722, 205],
};

interface Props {
  flow: Flow;
  inj: Injection;
  soc: number;
  compact?: boolean;
  className?: string;
}

export default function FeederDiagram({ flow, inj, soc, compact, className }: Props) {
  const lines = Object.keys(PATHS) as LineId[];
  const buses: BusId[] = ["B1", "B2", "B3", "B4", "B5"];
  const badBus = new Set(flow.violations.filter((v) => v.kind === "over" || v.kind === "under").map((v) => v.where));

  return (
    <svg viewBox="0 0 860 400" className={className} role="img" aria-label="Single-line diagram of the demo power line">
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="sunG">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="1" stopColor="#f59e0b" />
        </radialGradient>
      </defs>

      {/* Grid feed */}
      <g>
        <line x1="30" y1="200" x2="118" y2="200" stroke="#1c2738" strokeWidth="6" strokeLinecap="round" />
        <line
          x1="30"
          y1="200"
          x2="118"
          y2="200"
          stroke={flow.reverse ? "#fbbf24" : "#22d3ee"}
          strokeWidth="3"
          className={`flow-dash ${flow.reverse ? "reverse" : ""}`}
          style={{ animationDuration: `${Math.max(0.35, 2.2 - Math.abs(flow.trafoKw) / 40)}s` }}
        />
        <text x="30" y="226" className="num" fontSize="12" fill="#8a99b0">
          11 kV grid
        </text>
        {!compact && (
          <text x="30" y="243" className="num" fontSize="11" fill={flow.reverse ? "#fbbf24" : "#56647a"}>
            {flow.reverse ? `← ${Math.abs(flow.trafoKw).toFixed(0)} kW back` : `→ ${flow.trafoKw.toFixed(0)} kW in`}
          </text>
        )}
      </g>

      {/* Lines */}
      {lines.map((id) => {
        const isTie = id === "TIE";
        const closed = !isTie || flow.tieClosed;
        const openA3 = id === "A3" && flow.tieClosed;
        const kw = flow.lineKw[id];
        const load = flow.lineLoad[id];
        const active = closed && !openA3 && Math.abs(kw) > 0.3;
        const w = 3 + Math.min(1.3, load / 100) * 8;
        const col = loadColor(load);
        return (
          <g key={id}>
            <path d={PATHS[id]} fill="none" stroke="#1c2738" strokeWidth={isTie ? 4 : 12} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={isTie && !closed ? "5 7" : undefined} />
            {active && (
              <>
                <path d={PATHS[id]} fill="none" stroke={col} strokeOpacity="0.35" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" />
                <path
                  d={PATHS[id]}
                  fill="none"
                  stroke={col}
                  strokeWidth={Math.max(2, w * 0.45)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`flow-dash ${kw < 0 ? "reverse" : ""}`}
                  style={{ animationDuration: `${Math.max(0.3, 1.8 - Math.abs(kw) / 35)}s` }}
                />
              </>
            )}
            {!compact && (closed && !openA3 ? (
              <text x={LABEL_AT[id][0]} y={LABEL_AT[id][1]} textAnchor="middle" className="num" fontSize="12" fontWeight="600" fill={load > 85 ? col : "#8a99b0"}>
                {load.toFixed(0)}%
              </text>
            ) : openA3 ? (
              <text x={LABEL_AT[id][0]} y={LABEL_AT[id][1]} textAnchor="middle" className="num" fontSize="11" fill="#56647a">
                open
              </text>
            ) : null)}
          </g>
        );
      })}

      {/* Tie switch symbol */}
      <g transform="translate(700,200)">
        <rect x="-16" y="-12" width="32" height="24" rx="6" fill="#0b111b" stroke={flow.tieClosed ? "#22d3ee" : "#56647a"} strokeWidth="1.5" />
        {flow.tieClosed ? (
          <line x1="-8" y1="0" x2="8" y2="0" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" transform="rotate(90)" />
        ) : (
          <line x1="-8" y1="4" x2="7" y2="-6" stroke="#8a99b0" strokeWidth="3" strokeLinecap="round" />
        )}
        {!compact && (
          <text x="-24" y="4" textAnchor="end" fontSize="11" fill={flow.tieClosed ? "#22d3ee" : "#56647a"}>
            Tie {flow.tieClosed ? "closed" : "open"}
          </text>
        )}
      </g>

      {/* Transformer */}
      <g transform={`translate(${POS.B0[0]},${POS.B0[1]})`}>
        <circle cx="-8" cy="0" r="17" fill="#0b111b" stroke={loadColor(flow.trafoLoad)} strokeWidth="2.5" />
        <circle cx="8" cy="0" r="17" fill="none" stroke={loadColor(flow.trafoLoad)} strokeWidth="2.5" />
        {!compact && (
          <>
            <text x="30" y="30" textAnchor="start" fontSize="11" fill="#8a99b0">
              100 kVA transformer
            </text>
            <text x="30" y="-22" textAnchor="start" className="num" fontSize="12" fontWeight="700" fill={flow.trafoLoad > 85 ? loadColor(flow.trafoLoad) : "#8a99b0"}>
              {flow.trafoLoad.toFixed(0)}%
            </text>
          </>
        )}
      </g>

      {/* Buses */}
      {buses.map((b) => {
        const [x, y] = POS[b];
        const v = flow.v[b];
        const col = vColor(v);
        const top = y < 200;
        const pv = inj.pv[b];
        const cut = flow.curtailByBus[b] ?? 0;
        return (
          <g key={b}>
            {badBus.has(b) && <circle cx={x} cy={y} r="14" fill="none" stroke={col} strokeWidth="2" className="pulse-ring" />}
            <circle cx={x} cy={y} r="15" fill="#0b111b" stroke={col} strokeWidth="3" filter="url(#glow)" />
            <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#e7eef8">
              {b}
            </text>
            <text x={L[b].vx} y={L[b].vy} textAnchor={L[b].anchor} className="num" fontSize="13" fontWeight="700" fill={col}>
              {v.toFixed(3)}
            </text>
            {!compact && (
              <text x={L[b].hx} y={L[b].hy} textAnchor={L[b].anchor} fontSize="11" fill="#56647a">
                🏠 {inj.load[b].toFixed(0)} kW
              </text>
            )}
            {PV[b] !== undefined && (
              <g transform={`translate(${x + (top ? 0 : 0)},${top ? y - 50 : y + 62})`}>
                <circle r={6 + (pv / (PV[b] ?? 1)) * 8} fill="url(#sunG)" opacity={pv > 0.2 ? 0.95 : 0.15} />
                {!compact && (
                  <text x={b === "B3" ? -22 : 22} y="4" textAnchor={b === "B3" ? "end" : "start"} fontSize="11" className="num" fill={pv > 0.2 ? "#fde68a" : "#56647a"}>
                    {(pv - cut).toFixed(0)}/{PV[b]} kW{cut > 0.05 ? ` ✂${cut.toFixed(1)}` : ""}
                  </text>
                )}
              </g>
            )}
          </g>
        );
      })}

      {/* Battery at B3 */}
      <g transform="translate(770,40)">
        <rect x="0" y="0" width="54" height="26" rx="5" fill="#0b111b" stroke="#8a99b0" strokeWidth="1.5" />
        <rect x="54" y="8" width="4" height="10" rx="1" fill="#8a99b0" />
        <rect x="3" y="3" width={Math.max(0, 48 * soc)} height="20" rx="3" fill={flow.battKw > 0.1 ? "#34d399" : flow.battKw < -0.1 ? "#22d3ee" : "#56647a"} opacity="0.85" />
        <text x="27" y="17.5" textAnchor="middle" className="num" fontSize="11" fontWeight="700" fill="#05070c">
          {Math.round(soc * 100)}%
        </text>
        {!compact && (
          <text x="27" y="44" textAnchor="middle" className="num" fontSize="11" fill={Math.abs(flow.battKw) > 0.1 ? "#e7eef8" : "#56647a"}>
            {flow.battKw > 0.1 ? `charging ${flow.battKw.toFixed(0)} kW` : flow.battKw < -0.1 ? `giving ${(-flow.battKw).toFixed(0)} kW` : "battery idle"}
          </text>
        )}
        <line x1="0" y1="13" x2="-56" y2="50" stroke="#56647a" strokeWidth="1.5" strokeDasharray="3 3" />
      </g>
    </svg>
  );
}
