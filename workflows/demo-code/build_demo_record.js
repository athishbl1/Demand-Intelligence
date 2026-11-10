// DUMMY actual guest nights for today's demo, correlated to the forecast of the demo day.
// Change SCENARIO ('drop' | 'rise' | 'normal') or PCT before pressing Execute workflow.
// Nothing is written to the database: the next node posts the record to the webhook the app listens to.
const SCENARIO = 'drop';
const PCT = null; // null = default: drop 35, rise 25, normal 2

const row = $input.first().json || {};
if (!row.date || row.forecast === undefined || row.forecast === null) {
  throw new Error('No day with a usable forecast found.');
}
const pct = PCT || (SCENARIO === 'rise' ? 25 : SCENARIO === 'normal' ? 2 : 35);
const forecast = Number(row.forecast);
const actual = Math.max(0, Math.round(forecast * (SCENARIO === 'rise' ? 1 + pct / 100 : 1 - pct / 100)));
const record = {
  ok: true, demo: true, source: 'n8n demo trigger',
  date: row.date, real_today: row.real_today, shifted: row.date !== row.real_today,
  forecast, previous_year: row.previous_year === null ? null : Number(row.previous_year),
  actual, deviation_pct: forecast ? Math.round(((actual - forecast) / forecast) * 1000) / 10 : null,
  scenario: SCENARIO, pct, pushed_at: new Date().toISOString(),
};
return [{ json: { record } }];
