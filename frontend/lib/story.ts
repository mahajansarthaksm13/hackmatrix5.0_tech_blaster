import { StepRecord, shortAction } from "./engine";

export type Tone = "safe" | "watch" | "risk" | "flow";

/** One plain-words sentence about what the grid is doing right now. */
export function storyFor(rec: StepRecord, withGG: boolean): { icon: string; headline: string; detail: string; tone: Tone } {
  const b = rec.base;
  const over = b.violations.some((v) => v.kind === "over");
  const heavy = b.violations.some((v) => v.kind === "line" || v.kind === "trafo" || v.kind === "under");
  const fixed = rec.gg.violations.length === 0;

  if (over || heavy) {
    const problem = over
      ? { icon: "☀️", headline: "Too much sun, too little demand.", why: `Extra solar is pushing voltage up to ${b.vMax.toFixed(3)} p.u. at ${b.vMaxBus}.` }
      : { icon: "🌆", headline: "Evening rush — the line is working too hard.", why: `Loading hits ${Math.max(b.maxLine, b.trafoLoad).toFixed(0)}% and voltage sags to ${b.vMin.toFixed(3)} p.u.` };
    if (!withGG) return { icon: problem.icon, headline: problem.headline, detail: `${problem.why} Nobody acts — the limit breaks.`, tone: "risk" };
    if (fixed) return { icon: "🛡️", headline: "GridGuard is holding the line.", detail: `${problem.why.replace(/\.$/, "")} without help — GridGuard fixes it with: ${shortAction(rec.action)}.`, tone: "safe" };
    return { icon: "⛔", headline: "No safe fix exists right now.", detail: `${problem.why} Every tested fix still breaks a limit — see the upgrade plan in the Scenario Lab.`, tone: "risk" };
  }
  if (rec.forecast.level !== "safe" && rec.forecast.minutesToViolation !== null)
    return { icon: "⏱️", headline: `Trouble ahead in ${rec.forecast.minutesToViolation} minutes.`, detail: "The forecast sees a limit breaking soon. GridGuard is getting ready.", tone: "watch" };
  if (b.reverse && b.pvAvail > 5)
    return { icon: "🔄", headline: "Solar is flowing back to the grid.", detail: "Rooftops make more than homes use — power runs backwards, but all limits hold.", tone: "flow" };
  if (b.pvAvail > 5) return { icon: "🌤️", headline: "Sun is up, all calm.", detail: "Homes are using the rooftop solar. Every limit is fine.", tone: "safe" };
  return { icon: "🌙", headline: "Quiet grid.", detail: "No sun, normal demand. Every limit is fine.", tone: "safe" };
}
