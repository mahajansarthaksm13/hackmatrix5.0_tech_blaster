import { checkConnection } from "../lib/engine";
const t0=Date.now();
for (const bus of ["B2","B3","B5"] as const) {
  const row:string[]=[];
  for (let kw=2; kw<=30; kw+=4) { const r = checkConnection({bus, kw, mode:"unity", battKWh:0}); row.push(`${kw}:${r.verdict}${r.fixText?"("+r.fixText.slice(0,18)+")":""}`); }
  console.log(bus, row.join("  "));
}
console.log(Date.now()-t0,"ms");
const r = checkConnection({bus:"B3",kw:10,mode:"unity",battKWh:0}); console.log(r.reasons, r.scenarios.map(s=>[s.scenario,s.pass,s.note,s.worstV.toFixed(3)]));
