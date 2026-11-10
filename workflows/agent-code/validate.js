// n8n Code node "Validate" (Run once for each item).
// Normalises the request of POST team-07-agent (and of the schedule) into one shape.
// Output: { action, ok, error?, from, to, kind, label, scope_key, compare, ..., payload (base64 JSON for SQL) }

const MODEL = 'gpt-4.1-mini';
const body = ($json.body && typeof $json.body === 'object') ? $json.body : $json;
const action = String(body.action || '').toLowerCase();
const ACTIONS = ['explain', 'report', 'regenerate', 'feedback', 'get', 'alerts', 'alert_status'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MIN = '2025-11-04', MAX = '2027-04-04';

const b64 = (o) => {
  const s = JSON.stringify(o);
  if (typeof Buffer !== 'undefined') return Buffer.from(s, 'utf8').toString('base64');
  return btoa(unescape(encodeURIComponent(s)));
};
const fail = (msg) => ({ json: { action: 'invalid', ok: false, error: 'bad_request', message: msg } });
const int = (x) => (x === undefined || x === null || x === '' ? null : Number.isInteger(Number(x)) ? Number(x) : NaN);
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
function isoWeekMonday(w) {
  const [y, n] = w.split('-W').map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const mon = new Date(jan4); mon.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (n - 1) * 7);
  return mon.toISOString().slice(0, 10);
}
const fmtDay = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

if (!ACTIONS.includes(action)) return fail(`action must be one of ${ACTIONS.join(', ')}`);
const out = { action, ok: true, model: MODEL, compare: body.compare === 'fc' ? 'fc' : 'py', force: body.force === true };

if (action === 'explain' || action === 'report') {
  let kind = action === 'report' ? 'day' : String(body.scope || body.kind || 'day');
  let from, to, label;
  if (kind === 'day') {
    const d = body.date || (action === 'report' ? null : null);
    if (d && !ISO.test(d)) return fail('date must be YYYY-MM-DD');
    from = to = d || null; // report without date: the as-of date from team_07_settings (SQL)
    label = d ? fmtDay(d) : null;
  } else if (kind === 'week') {
    if (!/^\d{4}-W\d{2}$/.test(String(body.week || ''))) return fail('week must be like 2026-W16');
    from = isoWeekMonday(body.week); to = addDays(from, 6); label = body.week;
  } else if (kind === 'range') {
    if (!ISO.test(body.from || '') || !ISO.test(body.to || '')) return fail('from and to must be YYYY-MM-DD');
    from = body.from; to = body.to;
    if (to < from) return fail('to must be on or after from');
    if ((new Date(to) - new Date(from)) / 86400000 > 91) return fail('a range can be at most 92 days');
    label = `${fmtDay(from)} – ${fmtDay(to)}`;
  } else return fail('scope must be day, week or range');
  if (from && (to < MIN || from > MAX)) return fail(`dates must be between ${MIN} and ${MAX}`);
  if (from && from < MIN) from = MIN;
  if (to && to > MAX) to = MAX;

  const report = action === 'report' ? {
    actual: int(body.actual), forecast: int(body.forecast), source: body.source === 'schedule' ? 'schedule' : 'webhook',
  } : null;
  if (report && (Number.isNaN(report.actual) || Number.isNaN(report.forecast) || report.actual < 0)) return fail('actual and forecast must be whole numbers ≥ 0');
  Object.assign(out, { kind, from, to, label, report });
  out.demo = !!report && body.demo === true; // demo: the reported actual is never written to the database
  out.scope_key = from ? `${kind}:${from}:${to}${report && report.actual !== null ? ':a' + report.actual : ''}${out.demo ? ':demo' : ''}` : null;
}

if (action === 'regenerate' || action === 'get' || action === 'feedback') {
  const id = int(body.explanation_id);
  if (!id || Number.isNaN(id)) return fail('explanation_id is required');
  out.explanation_id = id;
  out.note = String(body.note || '').slice(0, 500);
  const fb = Array.isArray(body.feedback) ? body.feedback.slice(0, 10) : [];
  out.feedback = fb.map((f) => ({
    reason_idx: Number.isInteger(f.reason_idx) && f.reason_idx >= 0 && f.reason_idx < 3 ? f.reason_idx : null,
    vote: [1, -1, 0].includes(f.vote) ? f.vote : null,
    tags: (Array.isArray(f.tags) ? f.tags : []).filter((t) => ['wrong cause', 'wrong number', 'too vague', 'missing context'].includes(t)),
    text: String(f.text || '').slice(0, 500),
    ignore: f.ignore === true,
  }));
  if (out.note && action === 'regenerate') out.feedback.push({ reason_idx: null, vote: null, tags: [], text: out.note, ignore: false });
  if (action === 'feedback' && !out.feedback.length) return fail('feedback must be a non-empty list');
}

if (action === 'alerts') out.status = ['unread', 'read', 'dismissed', 'open'].includes(body.status) ? body.status : 'open';
if (action === 'alert_status') {
  const id = int(body.id);
  if (!id || Number.isNaN(id)) return fail('id is required');
  if (!['read', 'dismissed', 'unread'].includes(body.status)) return fail('status must be read, dismissed or unread');
  out.id = id; out.status = body.status;
}

out.payload = b64(out);
return { json: out };
