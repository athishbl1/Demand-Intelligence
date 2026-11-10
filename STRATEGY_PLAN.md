# Phase 3: Campaign Strategist agent

**Part of:** [PLAN.md](PLAN.md). It builds on the Change Explainer in [AGENT_PLAN.md](AGENT_PLAN.md).
**Decided:**
- Rises use **Capitalise** mode.
- Phase 3 ends at **suggest + choose**; campaign texts and the runner come in Phase 4.
- The agent runs in its **own workflow**.

**Status (2026-11-08):** built and tested against the live webhook. **Not pushed yet**, pending local testing.

## What it does

The explainer says *why* stays changed. The strategist says *what to do*:
- It suggests **at most 3 strategies**.
- A **4th option** lets the user write their own idea; the agent structures it and checks it against the data.
- Users can vote on and correct strategies, reanalyse (up to 5 versions), choose one or dismiss the plan.

The key design decision: **campaigns always target the future.**
- **A past period** gets the same period next season. It is Easter-aligned when Easter explains the change: 2026-W16 becomes 2027-W14.
- **A forecast period** is used as it is (for example 2027-W13).
- **Launch by** is the target start minus the booking lead time. The lead time is the bucket by which half of the bookings were made, from `team_07_lead_time`. If that date has passed, the plan says "late".

| Change type | Mode | Strategies aim at |
|---|---|---|
| real / expected / forecast drop, forecast too high | **Recover** | Winning back demand: holiday markets, last-minute push, value packages, event hooks |
| real / expected / forecast rise, forecast too low | **Capitalise** | Protecting prices and minimum stays, moving demand into weaker neighbour weeks, rebooking and repeating what works |
| no change | Monitor | No AI call, no campaign |
| data issue | None | Fix the data first |

## How it works

- **n8n:** `team-07 · Campaign Strategist` (id `C89YnLaxf4cKBiaJ`, 20 nodes), POST `team-07-strategy`. Saved to `workflows/strategy.json`; node sources are in `workflows/strategy-sql/` and `workflows/strategy-code/`.
  - **Actions:** `strategize`, `regenerate`, `custom`, `feedback`, `decide` (0–2 = a strategy, 3 = your idea, `dismiss`, `reopen`), `get`, `list`.
  - **Flow:** Validate → Load set (explanation, versions, feedback) → Plan target (mode, window, no AI) → Load forward (weeks ±2, school holidays per market, events, lead-time mix, beds per village) → Build candidates (facts `s.*` / `r*`, room to fill, rule-based playbook) → Strategist Agent (`gpt-4.1-mini`, one.intelligence) → Finalize → Save.
- **Guardrails in Finalize:**
  - At most 3 strategies; each must cite a fact, and in Recover mode it must answer a reason.
  - Markets, channels and KPIs come from fixed lists.
  - Dates are overwritten with the computed ones. The AI may only choose a neighbour week, which is how the spill-over strategy works.
  - Any sentence with a number or % not in the facts is removed, so no invented discounts or uplift figures.
  - Confidence is at most medium for market-specific ideas, because there is no market split in the data.
  - The "Easter week" wording is corrected when the target window lies after Easter.
  - **Your idea:** the agent's verdict is checked by rules, for example "no school holidays in NL that week".
- **Data:** `supabase/03_strategy.sql` creates `team_07_strategy_sets` (versioned) and `team_07_strategy_feedback`. RLS is on, with no anon policy.
- **App:**
  - `/strategies`: list, filters, next launch date.
  - `/strategies/[id]`:
    - the plan header with mode, target window, launch date and room to fill, a timeline and links back to the reasons;
    - 3 cut-corner strategy cards with who/how/message/timeline/confidence/effort/KPI/evidence, votes, "Correct" and "Choose this";
    - an "Option 4 · Your idea" card;
    - the decision banner, versions and Reanalyse.
  - A "Next step" band under the reasons on `/explain` and `/alerts/[id]`.
  - "Strategies" is in the main nav.
  - Files: `lib/strategy.ts`, `lib/useStrategySet.ts`, `components/strategy/*`.

## Tested (live webhook)

- **2026-W16 (explanation 8):** Recover mode.
  - Target 2027-W14 (aligned to Easter on 28 Mar 2027), launch by 2027-03-06, room to fill 42,248 stays.
  - Strategies: BE/CH/UK holiday families, a last-minute push and event hooks (sun.downer, Pistengaudi Closing).
- **2027-W12 (explanation 19), forecast +63.9 %:** Capitalise mode. Strategies: protect prices, **spill demand into 2027-W13** (−23.7 %, with its own launch date 2027-01-28), rebooking.
- **2027-W13 (explanation 20):** Recover mode, room to fill 26,942.
  - Reanalysis with "no packages after Easter; try British families" gave v2 with a UK focus and a change note.
  - Your idea "ski & spa week for Dutch families" came back as "Possible, with risks", with the warning that the Netherlands has no school holidays that week.
- **2025-W46 (explanation 10, data issue):** mode None, no AI call.
- **Other actions:**
  - Asking again is a cache hit.
  - Votes are saved.
  - `decide` 3 is accepted, and an invalid choice is refused.
  - `get` and `list` work, and a bad request returns a clear message.
- **App:** `npm --prefix frontend-starter run build` is green, and all pages return 200. Not yet clicked through in a browser.

## Later

1. **Phase 4, campaign builder and runner:** the chosen strategy becomes texts per market language, an audience spec and dated demo sends.
2. **Measure the outcome:** after the target window, compare actual stays vs forecast and build a playbook library ranked by results.
3. **More signals as agent tools:** search demand per market (DataForSEO), competitor prices (Apify), weather and snow forecast, lift opening dates.
4. **Budget and channel split, and a what-if:** "fill 10 % of the free beds", computed rather than written by the AI.
5. **Approval flow:** marketing proposes, the director approves, the board gets a weekly digest.
6. **Peer-aware ideas:** when peer regions also dropped, suggest joint regional campaigns.

## Which gap the campaigns aim at (`target.basis`)

- **`fc`:** |actual vs forecast| > 5 %. Mode comes from the sign of the forecast gap, room = forecast gap, and the reasons are the explanation's forecast reasons.
- **`py`:** actual within ±5 % of the forecast. Mode comes from the sign of actual vs last year (monitor if that is within ±5 % too), room = gap to last year, and the reason is `vs_py.main_point`.
- **`py_forecast`:** no actuals yet; forecast vs last year.
- **Fact `s.basis`:** the prompt states the aim.
- **Live tests (8 Nov):**
  - **W16:** fc, recover, room 5,836.
  - **W14:** py, capitalise, room 56,781.
