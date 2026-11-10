# Frontend Engineering Plan: Paznaun-Ischgl Demand Intelligence

> **Repository:** `team-07/frontend-starter`  
> **Challenge:** 04 – Overnight Data Without Explanation  
> **Tech Stack:** Next.js 16.4.5 (App Router), React 19, TypeScript, Tailwind CSS 4

---

## 1. Executive Summary & Objective

In **Challenge 04**, the partner (TVB Paznaun-Ischgl & Feratel) provides **244 days of daily overnight figures** (summer into winter 2026/27) and **88 days of bed capacity**. The core problem is that when actual overnight stays diverge from forecasts, destinations do not know **why** (was it weather, school holidays, regional events, or reporting delays?) and **what marketing action to take before it is too late**.

This frontend plan establishes an executive **Demand Intelligence & Explainability Cockpit** that directly answers the jury's 3 evaluation pillars:
1. **Explain the Deviations:** Pinpoint where actual demand trails forecasts or hits capacity crunches, and explain the exact drivers.
2. **Ranked Marketing Playbook:** Provide concrete, ranked interventions (what, when, where, which market) with projected room nights, revenue, lead time, and feasibility.
3. **Transparent Confidence & Reliability:** Explicitly communicate confidence levels, cross-referenced signals (weather, school holidays), and data lag warnings.

---

## 2. Component Hierarchy & File Structure

```
team-07/frontend-starter/
├── app/
│   ├── layout.tsx                     # Global HTML/Head, dynamic accent theme
│   ├── globals.css                    # Tailwind CSS 4 + custom UI classes
│   └── page.tsx                       # Main Demand Cockpit (Dashboard view)
├── components/
│   ├── Header.tsx                     # Top navigation, logo, live status badges
│   ├── Footer.tsx                     # Attribution & data licensing (Feratel, ODbL, CC BY 4.0)
│   ├── KpiSummary.tsx                 # 5 Top-line executive metric cards
│   ├── DemandTimeline.tsx             # Interactive SVG/Canvas/CSS chart with deviation markers
│   ├── DeviationExplainer.tsx         # "Why the Deviation?" root-cause analysis inspector
│   ├── ActionPlaybook.tsx             # Ranked marketing intervention cards with modal brief
│   ├── ActionModal.tsx                # Campaign detail modal with targeting & channel breakdown
│   └── ScenarioSimulator.tsx          # "What-If" scenario sliders (snow date, holiday shifts)
├── data/
│   └── overnightData.ts               # 244-day daily data, deviation clusters & ranked actions
├── lib/
│   ├── app.ts                         # Brand metadata & accent color (#0284c7)
│   └── n8n.ts                         # Webhook client adapter (ready for backend sync)
└── types/
    └── index.ts                       # Shared TypeScript models
```

---

## 3. UI/UX Wireframe & Layout

```
+-----------------------------------------------------------------------------------------+
| [Header] Paznaun-Ischgl Demand Intelligence | Live Status: Active Season | Team 07 Slot |
+-----------------------------------------------------------------------------------------+
| [KPI Cards]                                                                             |
| [ 244 Days Tracked ] [ 72.8% Occupancy ] [ -18,450 Bed Nights at Risk ] [ €2.45M Rev ]  |
+-----------------------------------------------------------------------------------------+
| [Timeline Filters] [Full Season (244d)] [Early Winter] [Mid-Jan Lull] [Carnival Crunch] |
|                                                                                         |
|  Demand & Capacity Timeline Chart:                                                      |
|   12k |----------------- Bed Capacity (11,800) -------------------                      |
|       |        /\                  /\  [Capacity Crunch]                                |
|    8k |       /  \    /\          /  \                                                  |
|       |      /    \  /  \  [Gap] /    \                                                 |
|    4k |_____/______\/____\______/______\________________________                        |
|        Jul   Aug   Sep   Oct   Nov   Dec   Jan   Feb   Mar   Apr                        |
|                                [🔴 Alert]    [🟢 Opportunity]                           |
+-----------------------------------------------------------------------------------------+
| [Left Column: Root-Cause Explainer]        | [Right Column: Ranked Marketing Playbook]  |
|                                            |                                            |
| Selected Period: Late Nov Snow Fall Slump  | #1 Live Webcam & Flex-Rebook Push (+840 n) |
| - Factor 1: Weather (55%) - rain in base   |    Target: Bavaria & Zurich | Lead: 7 days |
| - Factor 2: Market Trend (30%) - late book | #2 Mid-Week Gourmet Ski Package (+1,450 n) |
| - Factor 3: Data Anomaly (15%) - PMS lag   |    Target: Tech / Couples   | Lead: 14 d   |
|                                            | #3 Galtür & Kappl Dispersal (Load Balance) |
| Confidence Rating: 93% (High)              |    Target: Families         | Lead: 3 d    |
| Evidence: ZAMG weather, OpenHolidays API   | [Button: Deploy Campaign]                  |
+-----------------------------------------------------------------------------------------+
| [Interactive Simulator: What-If Snow is Delayed by 10 Days?] [Run Simulation]           |
+-----------------------------------------------------------------------------------------+
| [Footer] Team 07 · TTF Hackathon Salzburg · TVB Paznaun-Ischgl & Feratel Data           |
+-----------------------------------------------------------------------------------------+
```

---

## 4. Implementation Stages & Verification Tests

### Stage 1: Design Tokens, Theme & Layout Shell
- Brand name: *"Paznaun-Ischgl Demand Intelligence"*.
- Accent color: `#0284c7` (Alpine Sky Blue).
- Clean responsive layout supporting desktop, tablet, and mobile presentation.
- **Verification:** `npm run build` succeeds without warnings.

### Stage 2: Data Model & Executive KPI Cards
- 244-day daily data loaded from `data/overnightData.ts`.
- 5 executive KPI cards displaying:
  1. *Tracked Season Days* (244 days)
  2. *Average Occupancy* (72.8%)
  3. *At-Risk Unfilled Bed Nights* (18,450 nights)
  4. *Addressable Opportunity Revenue* (€2.45M)
  5. *Forecast Explainability Confidence* (94.2%)
- **Verification:** KPIs render with formatted values, comparison delta indicators, and tooltip definitions.

### Stage 3: Demand & Deviation Timeline Component
- Interactive multi-series visualization:
  - Line 1: `Actual Overnights` (solid alpine blue)
  - Line 2: `Forecasted Overnights` (dashed grey)
  - Line 3: `Previous Year Overnights` (dotted amber)
  - Line 4: `Max Bed Capacity` (solid slate line at 11,800)
- Visual alert markers positioned directly over the timeline for quick inspection.
- Filter pill buttons to instantly jump to key anomaly windows.
- **Verification:** Clicking any date or alert marker updates the active selected cluster in state.

### Stage 4: Root-Cause "Explainability" Card
- Displays the "Why?":
  - Percentage contribution breakdown of drivers (Weather vs. School Holidays vs. Regional Events vs. Data Gaps).
  - Explicit *Confidence Score* (e.g., 93% High Confidence) with cross-referenced data proofs.
  - Transparent data health note (e.g. accounting for PMS reporting delays in Mathon).
- **Verification:** Switching between "Early Snow Fall Slump" and "Mid-Jan Opportunity" dynamically updates the root-cause weights and evidence list.

### Stage 5: Ranked Marketing Action Playbook
- Cards ranked 1 to 4 following the jury specification:
  - **Effect:** Projected room nights (+840 to +1,450) and projected revenue (€80k to €203k).
  - **Lead Time:** Days required to execute (3 to 21 days).
  - **Feasibility:** High / Medium ratings with channel breakdowns.
  - **Confidence:** Verified against historical booking response rates.
- Modal dialog for each action containing:
  - Executive campaign brief
  - Audience targeting criteria (geographic radius, age segments)
  - Recommended marketing channels (Meta video, newsletters, Feratel widgets)
  - One-click "Approve / Export Brief" action with toast notification.
- **Verification:** Clicking "Review Campaign Brief" opens the modal and exporting triggers a confirmation banner.

### Stage 6: "What-If" Scenario Simulator & Pitch Preparation
- Interactive sliders:
  - *Snow Delay Adjustment* (-14 days to +14 days)
  - *German School Holiday Shift* (-7 days to +7 days)
- Dynamically recalculates projected gap and automatically updates the rank and urgency of countermeasures.
- 2-minute demo flow rehearsed:
  1. *0:00–0:30:* The Problem: "Paznaun has 244 days of data, but deviations were unexplained."
  2. *0:30–1:00:* The Explanation: "Our cockpit cross-references weather, holiday calendars, and PMS logs to explain the -15k gap."
  3. *1:00–1:40:* The Solution: "Ranked marketing actions tell the TVB exactly what to launch, for whom, with €2.45M addressable upside."
  4. *1:40–2:00:* Interactive Simulation: "Drag the snow slider: watch how the AI adjusts the plan live."
- **Verification:** End-to-end user journey works without errors or network dependency.

---

## 5. Technical Highlights for Technical Jury Evaluation
- **Zero-Dependency Robustness:** Runs completely client-side in React 19 / Next.js without risk of network timeouts during live pitch.
- **n8n / Webhook Ready:** Architecture isolates data fetching through `lib/n8n.ts`, ready to bind to live `team-07-*` n8n endpoints with one toggle.
- **Accessibility & Design:** Semantic HTML, ARIA landmarks, keyboard accessible, responsive typography, and Tailwind CSS 4 design tokens.

