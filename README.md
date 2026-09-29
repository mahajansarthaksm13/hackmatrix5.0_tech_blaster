# GridGuard Twin — frontend prototype

> **Predict early. Act fairly. Waste less solar.**
> Other tools tell you the grid broke. GridGuard Twin tells you it's about to — what to do, and why.

HACKMATRIX 5.0 · Problem statement ENR-02 · Team Tech Blasters

## Run it

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
npm run build      # static export in ./out (deploy anywhere, e.g. Vercel)
```

## Pages

| Page | Route | What it shows |
|---|---|---|
| Landing | `/` | Live animated feeder (flow arrows flip at noon), headline results, problem, 3-step story, two modes |
| Twin Console | `/twin` | Single-line diagram, 24-hour scrubber with play, risk gauge + minutes to problem, recommended fix with "Why?" |
| Action Arena | `/twin/actions` | Every fix family tested in 3 forecasts, ranked safe → least solar cut → least battery → fewest switches; fair solar cuts (Jain's index) |
| Scenario Lab | `/scenarios` | 4 test days, before/after charts and metrics, upgrade plan for the critical day |
| Connect Check | `/connect` | Bus / size / inverter / battery → Safe, Safe with a fix, or Needs upgrade; hosting map |
| How it works | `/method` | Real vs simulated data, pipeline, rules, parameters, word guide, references, team |

## Engine

`lib/engine.ts` is a light TypeScript mirror of the Python/pandapower engine from the PRD
(linearised radial power flow on the 6-bus demo feeder in `lib/config.ts`). It runs in the
browser, so every screen works offline. When `precompute.py` is ready, its JSON can replace
these calls without changing the pages.

`npx tsx scripts/check.ts` prints the day metrics for all four scenarios;
`npx tsx scripts/connect.ts` prints the connection verdict map.
