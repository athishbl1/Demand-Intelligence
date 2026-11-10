// n8n Code node "Validate" (Run once for each item) — workflow "team-07 · Campaign Strategist".
// Normalises POST team-07-strategy into one shape and adds `payload` (base64 JSON for the SQL nodes).

const MODEL = 'gpt-4.1-mini';
const body = ($json.body && typeof $json.body === 'object') ? $json.body : $json;
const action = String(body.action || '').toLowerCase();
const ACTIONS = ['strategize', 'regenerate', 'custom', 'feedback', 'decide', 'get', 'list'];
const TAGS = ['not realistic', 'wrong market', 'wrong timing', 'too vague', 'too expensive', 'missing idea'];

const b64 = (o) => {
  const s = JSON.stringify(o);
  if (typeof Buffer !== 'undefined') return Buffer.from(s, 'utf8').toString('base64');
  return btoa(unescape(encodeURIComponent(s)));
};
const fail = (msg) => ({ json: { action: 'invalid', ok: false, error: 'bad_request', message: msg } });
const int = (x) => (x === undefined || x === null || x === '' ? null : Number.isInteger(Number(x)) ? Number(x) : NaN);

if (!ACTIONS.includes(action)) return fail(`action must be one of ${ACTIONS.join(', ')}`);
const out = { action, ok: true, model: MODEL, force: body.force === true, today: new Date().toISOString().slice(0, 10) };

const needSet = ['regenerate', 'custom', 'feedback', 'decide'];
if (action === 'strategize') {
  const id = int(body.explanation_id);
  if (!id || Number.isNaN(id)) return fail('explanation_id is required');
  out.explanation_id = id;
}
if (needSet.includes(action) || (action === 'get' && body.set_id !== undefined)) {
  const id = int(body.set_id);
  if (!id || Number.isNaN(id)) return fail('set_id is required');
  out.set_id = id;
}
if (action === 'get' && !out.set_id) {
  const id = int(body.explanation_id);
  if (!id || Number.isNaN(id)) return fail('set_id or explanation_id is required');
  out.explanation_id = id;
}
if (action === 'regenerate' || action === 'feedback') {
  const fb = Array.isArray(body.feedback) ? body.feedback.slice(0, 10) : [];
  out.feedback = fb.map((f) => ({
    strategy_idx: Number.isInteger(f.strategy_idx) && f.strategy_idx >= 0 && f.strategy_idx <= 3 ? f.strategy_idx : null,
    vote: [1, -1, 0].includes(f.vote) ? f.vote : null,
    tags: (Array.isArray(f.tags) ? f.tags : []).filter((t) => TAGS.includes(t)),
    text: String(f.text || '').slice(0, 500),
    ignore: f.ignore === true,
  }));
  out.note = String(body.note || '').slice(0, 500);
  if (out.note && action === 'regenerate') out.feedback.push({ strategy_idx: null, vote: null, tags: [], text: out.note, ignore: false });
  if (action === 'feedback' && !out.feedback.length) return fail('feedback must be a non-empty list');
}
if (action === 'custom') {
  out.text = String(body.text || '').trim().slice(0, 800);
  if (out.text.length < 10) return fail('describe your strategy in at least a few words');
}
if (action === 'decide') {
  if (body.choice === 'dismiss' || body.choice === 'reopen') out.choice = body.choice;
  else {
    const c = int(body.choice);
    if (c === null || Number.isNaN(c) || c < 0 || c > 3) return fail('choice must be 0-3, "dismiss" or "reopen"');
    out.choice = c;
  }
}

out.payload = b64(out);
return { json: out };
