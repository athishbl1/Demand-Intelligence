// n8n Code node "Plan target" (Run once for each item).
// Picks the mode from the change type and the FUTURE window the campaign aims at (no AI):
// a past period -> the same period next season (Easter-aligned when Easter explains it); a forecast-only
// period -> itself. The lead-time reference is the asked period (if it has bookings data) or the target - 364.

const v = $('Validate').item.json;
const c = $json.result;
const ex = c.explanation;
const S = c.settings || {};
const today = v.today;
const maxVersions = Number(S.max_versions ?? 5);

const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diffDays = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), cc = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(cc / 4), k = cc % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31);
  const da = ((h + l - 7 * m + 114) % 31) + 1;
  return `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
}
function isoWeek(iso) {
  const d = new Date(iso + 'T00:00:00Z'); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day + 3);
  const y = d.getUTCFullYear(); const j4 = new Date(Date.UTC(y, 0, 4));
  const w = 1 + Math.round(((d - j4) / 86400000 - 3 + ((j4.getUTCDay() + 6) % 7)) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}
const fmtDay = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

let error = null;
if (!ex) error = v.action === 'strategize' ? 'explanation_not_found' : 'set_not_found';
if (['regenerate', 'custom'].includes(v.action) && !c.src) error = 'set_not_found';
if (v.action === 'regenerate' && c.src && (c.versions || []).length >= maxVersions) error = 'limit_reached';

const MODE = {
  real_drop: 'recover', expected_drop: 'recover', forecast_drop: 'recover', forecast_too_high: 'recover',
  real_rise: 'capitalise', expected_rise: 'capitalise', forecast_rise: 'capitalise', forecast_too_low: 'capitalise',
  no_change: 'monitor', data_issue: 'none',
};

let mode = 'none', target = null, leadRef = null, alignment = null;
if (!error) {
  if (c.src) {
    mode = c.src.mode; target = c.src.target; leadRef = (c.src_context || {}).lead_ref || null; alignment = target.alignment;
  } else {
    mode = MODE[ex.change_type] || 'none';
    const sc = ex.scope, hasAct = ex.totals.days_with_actual > 0;
    let from = sc.from, to = sc.to;
    if (hasAct) {
      const y = Number(sc.from.slice(0, 4));
      const easterFact = (ex.facts || []).find((f) => f.id === 'f5.easter');
      // the Easter of the asked period's year; align to the next Easter if Easter explains the change
      let shift = 364; alignment = 'same weekdays next year';
      if (easterFact) {
        const eNow = easterFact.now, eNext = easter(Number(String(eNow).slice(0, 4)) + 1);
        shift = diffDays(eNow, eNext); alignment = `aligned to Easter ${eNext}`;
      }
      from = addDays(from, shift); to = addDays(to, shift);
      while (to < today) { from = addDays(from, 364); to = addDays(to, 364); }
      leadRef = { from: sc.from, to: sc.to, why: 'how guests booked the asked period' };
    } else {
      alignment = 'the asked period itself (forecast only)';
      leadRef = { from: addDays(from, -364), to: addDays(to, -364), why: 'how guests booked the same weeks last year' };
    }
    const label = sc.kind === 'week' ? isoWeek(from) : sc.kind === 'day' ? fmtDay(from) : `${fmtDay(from)} – ${fmtDay(to)}`;
    target = { from, to, label, alignment, kind: sc.kind };
  }
}

const isCustom = v.action === 'custom';
const cached = c.cached && !v.force && v.action === 'strategize' ? c.cached : null;
const out = {
  action: v.action, error, mode, target, lead_ref: leadRef, today,
  use_cache: !!cached && !error, cached,
  explanation: ex, src: c.src || null, src_answer: c.src_answer || null,
  versions: c.versions || [], feedback: [...(c.feedback || []), ...(c.feedback_new || []).map((f) => ({ ...f, set_id: c.src && c.src.id }))],
  max_versions: maxVersions, custom_text: isCustom ? v.text : null,
};
out.payload = (() => {
  const s = JSON.stringify({ target: target || { from: today, to: today }, lead_ref: leadRef || { from: today, to: today } });
  if (typeof Buffer !== 'undefined') return Buffer.from(s, 'utf8').toString('base64');
  return btoa(unescape(encodeURIComponent(s)));
})();
return { json: out };
