import { simulateDay, prescribe, checkConnection, forecastAhead } from "../lib/engine";
import { SCENARIOS } from "../lib/config";
for (const s of SCENARIOS) {
  const t0 = Date.now();
  const d = simulateDay(s.id);
  const m = d.metrics;
  console.log(s.id, `${Date.now()-t0}ms`, JSON.stringify({ base: m.baseViolationSteps, gg: m.ggViolationSteps, util: m.utilisation.toFixed(3), cut: m.curtailKWh.toFixed(1), cutOnly: m.cutOnlyCurtailKWh.toFixed(1), saved: m.curtailSaved.toFixed(2), lead: m.leadMinutes, jain: m.jain, inf: m.infeasibleSteps, bV: m.baseMaxV.toFixed(3), gV: m.ggMaxV.toFixed(3), bmin: m.baseMinV.toFixed(3), gmin: m.ggMinV.toFixed(3), bL: m.baseMaxLoad.toFixed(0), gL: m.ggMaxLoad.toFixed(0), batt: m.battCycledKWh, sw: m.switchOps }));
  const line = d.steps.filter((x,i)=>i%2===0 && (x.base.violations.length || x.action && Object.keys(x.action).length)).map(x => `${x.time} ${x.family} ${JSON.stringify(x.action)} soc=${x.socBefore.toFixed(2)} bV=${x.base.vMax.toFixed(3)}/${x.base.vMin.toFixed(3)} gV=${x.gg.vMax.toFixed(3)}/${x.gg.vMin.toFixed(3)} L=${Math.max(x.base.maxLine,x.base.trafoLoad).toFixed(0)}->${Math.max(x.gg.maxLine,x.gg.trafoLoad).toFixed(0)} risk=${x.forecast.risk} f=${x.feasible?'':'INFEAS'}`);
  console.log(line.join("\n"));
  const p = prescribe(d); if (p) console.log(JSON.stringify(p, null, 1));
}
