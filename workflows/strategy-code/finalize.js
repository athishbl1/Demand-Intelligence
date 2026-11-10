// n8n Code node "Finalize" (Run once for each item).
// Parses the AI answer, keeps max. 3 valid strategies (or the structured custom one), forces the computed dates,
// checks lists and numbers, and builds the answer + the save payload. Template answers for monitor/none modes.

const b = $('Build candidates').item.json;
const fromAi = b.need_ai;
const raw = fromAi ? ($json.output ?? $json.text ?? '') : '';
const model = $('Validate').item.json.model || null;
const today = b.today;

const b64 = (o) => {
  const s = JSON.stringify(o);
  if (typeof Buffer !== 'undefined') return Buffer.from(s, 'utf8').toString('base64');
  return btoa(unescape(encodeURIComponent(s)));
};
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// ---------- errors and cache ----------
if (b.error) {
  const msg = { limit_reached: `This strategy set already has ${b.max_versions} versions.`, set_not_found: 'Strategy set not found.', explanation_not_found: 'Explanation not found.' };
  return { json: { respond: { error: b.error, message: msg[b.error] || b.error }, save: false } };
}
if (b.use_cache) {
  const fb = (b.feedback || []).filter((f) => f.set_id === b.cached.id);
  return { json: { respond: { ...b.cached.answer, cached: true, set_id: b.cached.id, root_id: b.cached.root_id, versions: b.versions, status: b.cached.status, accepted_idx: b.cached.accepted_idx,
    feedback_summary: { up: fb.filter((f) => f.vote === 1).length, down: fb.filter((f) => f.vote === -1).length } }, save: false, lookup_status: true } };
}

// ---------- number check (stricter than the explainer) ----------
// Dates count as dates only (their parts are not "known numbers"); a number with % must match a percentage in the facts.
const DATE = /\b\d{4}-\d{2}-\d{2}\b|\b\d{4}-W\d{2}\b/g;
const NUM = /[-+−]?\d[\d,]*(?:\.\d+)?\s*%?/g;
const norm = (s) => { const n = Number(String(s).replace(/%/g, '').trim().replace(/[−]/g, '-').replace(/,/g, '').replace(/^\+/, '')); return isFinite(n) ? Math.abs(n) : null; };
const allowed = new Set(), allowedPct = new Set();
const addNums = (s) => {
  for (const m of String(s).replace(DATE, ' ').match(NUM) || []) {
    const n = norm(m); if (n === null) continue;
    const set = m.includes('%') ? allowedPct : allowed;
    for (const x of [n, Math.round(n), Math.round(n * 10) / 10]) { set.add(x); if (set === allowedPct) allowed.add(x); }
  }
};
addNums(JSON.stringify(b.facts));
for (let k = 0; k <= 3; k++) allowed.add(k);
const easterFact = (b.facts || []).find((f) => f.id === 's.easter');
const afterEaster = !!(easterFact && /after Easter/.test(easterFact.note || ''));
function check(text) {
  const parts = String(text || '').replace(/\s*\((?:[rs]\d*\.?[\w-]*(?:,\s*)?)+\)/g, '').replace(/\b(?:s\.[\w-]+|r[1-3])\b/g, '').split(/(?<=[.!?])\s+/);
  let edited = false;
  const kept = parts.filter((s) => {
    const nums = s.replace(DATE, ' ').replace(/\bW\d{2}\b/g, '').match(NUM) || [];
    const ok = nums.every((m) => {
      const n = norm(m); if (n === null) return true;
      const set = m.includes('%') ? allowedPct : allowed;
      return set.has(n) || set.has(Math.round(n * 10) / 10);
    });
    if (!ok) edited = true;
    return ok;
  });
  let out = kept.join(' ').replace(/\s{2,}/g, ' ').trim();
  // exact Easter wording: the target window is after Easter, so "Easter week" would be wrong
  if (afterEaster) out = out.replace(/\b(?:the\s+)?Easter\s+week\b/gi, 'the week after Easter').replace(/\byour Easter break\b/gi, 'your post-Easter break');
  return { text: out, edited };
}

// ---------- parse ----------
let ai = null, error = null;
if (fromAi) {
  try {
    const t = String(raw).replace(/```(json)?/g, '').trim();
    ai = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
  } catch (e) { error = 'ai_unavailable'; }
}

const factIds = new Set(b.facts.map((f) => f.id));
const weekById = Object.fromEntries((b.weeks || []).map((w) => [w.week, w]));
const reasonCount = ((b.explanation || {}).reasons || []).length;
const TYPES = ['holiday_market', 'last_minute', 'value_package', 'event_hook', 'snow_message', 'yield_protect', 'spill_over', 'retain_rebook', 'replicate', 'custom'];
const GOALS = ['recover', 'protect', 'shift', 'retain'];
const LEVEL = ['low', 'medium', 'high'];
const GOAL_BY_TYPE = { yield_protect: 'protect', spill_over: 'shift', retain_rebook: 'retain', replicate: 'protect', holiday_market: 'recover', last_minute: 'recover', value_package: 'recover', event_hook: 'recover', snow_message: 'recover' };

// ---------- deterministic priority (impact, lead time, feasibility, confidence) ----------
// The AI only labels effort and confidence. Ranking is computed here, so it is reproducible.
const IMPACT_BASE = { holiday_market: 0.8, yield_protect: 0.8, last_minute: 0.6, value_package: 0.6, spill_over: 0.6, event_hook: 0.5, retain_rebook: 0.5, replicate: 0.5, snow_message: 0.35, custom: 0.4, other: 0.4 };
const FEAS = { low: 1, medium: 0.7, high: 0.4 }; // effort low = easy to do
const CONF = { low: 0.4, medium: 0.7, high: 1 };
function priorityOf(c) {
  const roomOk = b.room && b.room.value > 0;
  const impact = Math.min(1, (IMPACT_BASE[c.type] || 0.4) * (roomOk ? 1 : 0.6) + Math.min(0.15, 0.05 * (c.addresses || []).length));
  const feas = FEAS[c.effort] || 0.7;
  const conf = CONF[c.confidence] || 0.7;
  const slack = Math.round((new Date(c.timing.ideal_launch) - new Date(today)) / 86400000);
  const time = c.timing.late ? 0.4 : Math.min(1, 0.6 + Math.max(0, slack) / 90 * 0.4);
  const score = Math.round(100 * (0.35 * impact + 0.25 * conf + 0.2 * feas + 0.2 * time));
  return { priority: score, scores: { impact: +impact.toFixed(2), lead_time: +time.toFixed(2), feasibility: +feas.toFixed(2), confidence: +conf.toFixed(2), slack_days: slack,
    basis: 'impact = playbook type weight x whether a gap to fill exists; lead_time = days of slack before the ideal launch date; feasibility = effort; confidence = AI label capped by rules. Weights 35/20/20/25.' } };
}

function clean(s, isCustom) {
  if (!s || typeof s !== 'object') return null;
  const refs = (Array.isArray(s.evidence_refs) ? s.evidence_refs : []).filter((x) => factIds.has(x));
  if (!refs.length && !isCustom) return null;
  const addresses = (Array.isArray(s.addresses) ? s.addresses : []).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= reasonCount);
  if (b.mode === 'recover' && !addresses.length && !isCustom) return null;
  const markets = (Array.isArray(s.markets) ? s.markets : []).map((m) => String(m).toUpperCase()).filter((m) => b.markets.includes(m)).slice(0, 3);
  const channels = (Array.isArray(s.channels) ? s.channels : []).filter((c) => b.channels.includes(c)).slice(0, 4);
  // timing: forced from the computed facts; the AI may only pick a neighbour week
  const wk = s.target_week && s.target_week !== 'target' ? weekById[s.target_week] : null;
  const win = wk ? { from: wk.week_start, to: wk.week_end, label: wk.week, neighbour: !wk.in_target } : { from: b.target.from, to: b.target.to, label: b.target.label, neighbour: false };
  const ideal = addDays(win.from, -b.lead_days);
  const timing = { ...win, launch_by: ideal < today ? today : ideal, late: ideal < today, ideal_launch: ideal, lead_days: b.lead_days };
  let edited = false;
  const txt = (v) => { const r = check(v); edited = edited || r.edited; return r.text; };
  let confidence = LEVEL.includes(s.confidence) ? s.confidence : 'medium';
  if (markets.length && confidence === 'high') confidence = 'medium';
  const out = {
    type: TYPES.includes(s.type) ? s.type : isCustom ? 'custom' : 'other',
    title: txt(s.title) || 'Strategy', goal: GOAL_BY_TYPE[s.type] || (GOALS.includes(s.goal) ? s.goal : b.mode === 'capitalise' ? 'protect' : 'recover'),
    addresses, markets, audience: txt(s.audience), timing, channels,
    hook: txt(s.hook), message_idea: txt(s.message_idea), kpi: b.kpis.includes(s.kpi) ? s.kpi : b.kpis[0],
    effort: LEVEL.includes(s.effort) ? s.effort : 'medium', confidence, evidence_refs: refs, why: txt(s.why),
  };
  out.edited_by_check = edited;
  Object.assign(out, priorityOf(out));
  return out;
}

let strategies = [], custom = null, headline = '', caveat = '', change_note = null;
if (b.action === 'custom') {
  const src = b.src_answer || {};
  strategies = src.strategies || (b.src && b.src.strategies) || [];
  headline = src.headline || ''; caveat = src.caveat || '';
  if (ai && ai.custom) {
    const c = clean(ai.custom, true);
    if (c) {
      custom = { ...c, from_user: true, original: b.custom_text,
        verdict: ['fits', 'risky', 'conflicts'].includes(ai.verdict) ? ai.verdict : 'risky',
        warnings: (Array.isArray(ai.warnings) ? ai.warnings : []).map((w) => check(w).text).filter(Boolean).slice(0, 3) };
      // rule-based checks, independent of the AI
      const MN = { AT: 'Austria', BE: 'Belgium', CH: 'Switzerland', DE: 'Germany', NL: 'the Netherlands', SE: 'Sweden', UK: 'the United Kingdom' };
      for (const m of custom.markets) {
        const h = b.facts.find((f) => f.id === `s.hol_${m}`);
        if (h && String(h.now).startsWith('0 of')) custom.warnings.unshift(`No school holidays in ${MN[m] || m} during ${custom.timing.label}: families there are unlikely to travel that week.`);
      }
      if (custom.verdict === 'fits' && custom.warnings.length) custom.verdict = 'risky';
      if (custom.timing.late) custom.warnings.unshift(`The ideal launch date (${custom.timing.ideal_launch}) has passed: only a last-minute push is possible.`);
      custom.warnings = custom.warnings.slice(0, 3);
    }
  }
  if (!custom) custom = { type: 'custom', title: 'Your strategy', original: b.custom_text, from_user: true, verdict: 'risky',
    warnings: [error ? 'The agent could not check your strategy right now. Try again in a minute.' : 'The agent could not structure this strategy.'],
    timing: { from: b.target.from, to: b.target.to, label: b.target.label, launch_by: b.main_launch.launch_by, late: b.main_launch.late, ideal_launch: b.main_launch.ideal, lead_days: b.lead_days },
    markets: [], channels: [], evidence_refs: [], addresses: [] };
} else if (ai && Array.isArray(ai.strategies)) {
  const seen = new Set();
  for (const s of ai.strategies) {
    if (strategies.length >= 3) break;
    const c = clean(s, false);
    if (!c) continue;
    const key = c.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    strategies.push(c);
  }
  strategies.sort((x, y) => y.priority - x.priority);
  strategies.forEach((x, i) => { x.rank = i + 1; });
  headline = check(ai.headline).text; caveat = check(ai.caveat).text;
  change_note = b.action === 'regenerate' && ai.change_note ? check(ai.change_note).text : null;
}

const MODE_TEXT = {
  recover: 'Recover: win back the missing demand in the target window',
  capitalise: 'Capitalise: demand is strong — protect value, spread it to weaker weeks, keep the guests',
  monitor: 'Monitor: no real change, so no campaign is needed',
  none: 'Fix the data first: the numbers for this period are incomplete',
};
if (b.mode === 'monitor') headline = 'No campaign needed: stays are in line with the forecast and last year.';
if (b.mode === 'none') headline = 'No campaign yet: the numbers for this period are incomplete, so check the data first.';
if (!headline) headline = MODE_TEXT[b.mode];
if (fromAi && error && b.action !== 'custom') caveat = 'The AI could not write strategies right now. The target window and dates above are correct; try again in a minute.';

const prevVersion = b.versions && b.versions.length ? Math.max(...b.versions.map((x) => x.version)) : 0;
const version = b.action === 'regenerate' ? prevVersion + 1 : b.action === 'custom' ? (b.src ? b.src.version : 1) : 1;
const answer = {
  explanation_id: b.explanation.id,
  explanation: { id: b.explanation.id, scope: b.explanation.scope, change_type: b.explanation.change_type, headline: b.explanation.headline,
    reasons: (b.explanation.reasons || []).map((r) => ({ rank: r.rank, title: r.title, kind: r.kind, confidence: r.confidence })) },
  mode: b.mode, mode_text: MODE_TEXT[b.mode],
  target: { ...b.target, launch_by: b.main_launch.launch_by, late: b.main_launch.late, ideal_launch: b.main_launch.ideal, lead_days: b.lead_days, has_forecast: b.has_forecast },
  room: b.room, headline, caveat, strategies, custom, facts: b.facts, change_note, version,
  model: fromAi ? model : null, ai: fromAi && !error, error: b.action === 'custom' ? null : error, created_at: new Date().toISOString(),
};
const save = {
  action: b.action, set_id: b.src ? b.src.id : null,
  explanation_id: b.explanation.id, version, parent_id: b.action === 'regenerate' && b.src ? b.src.id : null,
  root_id: b.action === 'regenerate' && b.src ? (b.src.root_id || b.src.id) : null,
  mode: b.mode, target: answer.target, context: b.context, strategies, custom, change_note,
  model: answer.model, ai: answer.ai, error: answer.error, answer,
};
return { json: { respond: answer, save: true, payload: b64(save), versions: b.action === 'strategize' ? [] : b.versions, action: b.action } };
