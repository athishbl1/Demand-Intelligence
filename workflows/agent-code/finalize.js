// n8n Code node "Finalize" (Run once for each item).
// Comes either straight from "Need AI?" (false) or after "AI Agent". Turns the ranked findings into the reasons
// (order and evidence from n8n, wording from the AI), fact-checks the numbers, computes the unexplained share and builds the answer + the save payload.

const b = $('Build facts').item.json;
const fromAi = b.need_ai;
const raw = fromAi ? ($json.output ?? $json.text ?? '') : '';
const model = $('Validate').item.json.model || null;

const b64 = (o) => {
  const s = JSON.stringify(o);
  if (typeof Buffer !== 'undefined') return Buffer.from(s, 'utf8').toString('base64');
  return btoa(unescape(encodeURIComponent(s)));
};

// ---------- cached / error answers ----------
if (b.error) {
  return { json: { respond: { error: b.error, message: b.error === 'limit_reached'
    ? `This explanation already has ${b.max_versions} versions. Ask a new question instead.`
    : 'Explanation not found.' }, save: false } };
}
if (b.use_cache) {
  const fb = (b.feedback_all || []).filter((f) => f.explanation_id === b.cached_id);
  const a = { ...b.cached_answer, cached: true, explanation_id: b.cached_id, root_id: b.cached_root, versions: b.versions,
    feedback_summary: { up: fb.filter((f) => f.vote === 1).length, down: fb.filter((f) => f.vote === -1).length, notes: fb.filter((f) => f.text).length } };
  return { json: { respond: a, save: false } };
}

// ---------- allowed numbers: every number that appears in the facts, scope and totals ----------
const NUM = /[-+−]?\d[\d,]*(?:\.\d+)?/g;
const norm = (s) => {
  const n = Number(String(s).replace(/[−]/g, '-').replace(/,/g, '').replace(/^\+/, ''));
  return isFinite(n) ? Math.abs(n) : null;
};
const allowed = new Set();
const addNums = (s) => { for (const m of String(s).match(NUM) || []) { const n = norm(m); if (n !== null) { allowed.add(n); allowed.add(Math.round(n)); allowed.add(Math.round(n * 10) / 10); } } };
addNums(JSON.stringify(b.facts)); addNums(JSON.stringify(b.scope)); addNums(JSON.stringify(b.totals)); addNums(JSON.stringify(b.findings_selected || []));
for (const d of b.scope.from.split('-').concat(b.scope.to.split('-'))) addNums(d);
for (let k = 0; k <= 3; k++) allowed.add(k); // "one/two/three reasons" style counts

function checkText(text) {
  // Drop every sentence that contains a number not found in the facts (fact ids are removed first).
  const sentences = String(text || '').replace(/\s*\((?:f\d+\.[\w]+(?:,\s*)?)+\)/g, '').replace(/\bf\d+\.[\w]+\b/g, '').split(/(?<=[.!?])\s+/);
  let edited = false;
  const kept = sentences.filter((s) => {
    const nums = (s.replace(/\b\d{4}-\d{2}-\d{2}\b/g, (m) => m.replace(/-/g, ' ')).replace(/\bW\d{2}\b/g, '').match(NUM)) || [];
    const ok = nums.every((m) => { const n = norm(m); return n === null || allowed.has(n) || allowed.has(Math.round(n * 10) / 10); });
    if (!ok) edited = true;
    return ok;
  });
  return { text: kept.join(' ').trim(), edited };
}

// ---------- parse the AI answer ----------
let ai = null, error = null;
if (fromAi) {
  try {
    const t = String(raw).replace(/```(json)?/g, '').trim();
    const start = t.indexOf('{'), end = t.lastIndexOf('}');
    ai = JSON.parse(t.slice(start, end + 1));
  } catch (e) {
    error = 'ai_unavailable';
  }
}

// ---------- reasons = the ranked findings of "Build facts", worded by the AI ----------
// Order, evidence, "explains" and confidence come from the findings (computed in n8n); the AI only words them.
// A finding the AI skipped, or worded with numbers that are not in the facts, keeps its computed text.
const factIds = new Set(b.facts.map((f) => f.id));
let reasons = [];
if (fromAi) {
  const sel = Array.isArray(b.findings_selected) ? b.findings_selected : [];
  const aiR = ai && Array.isArray(ai.reasons) ? ai.reasons.filter((r) => r && typeof r === 'object') : [];
  const used = new Set();
  const take = (ok) => { const i = aiR.findIndex((r, k) => !used.has(k) && ok(r)); if (i < 0) return null; used.add(i); return aiR[i]; };
  for (const f of sel) {
    const r = take((x) => x.finding_id === f.finding_id)
      || take((x) => x.kind !== 'hypothesis' && !sel.some((s) => s.finding_id === x.finding_id)
        && Array.isArray(x.evidence_refs) && x.evidence_refs.includes(f.evidence_refs[0]));
    const t1 = r ? checkText(r.title) : { text: '', edited: false };
    const t2 = r ? checkText(r.text) : { text: '', edited: false };
    reasons.push({
      rank: reasons.length + 1, kind: 'data', title: t1.text || f.title, text: t2.text || f.statement,
      evidence_refs: f.evidence_refs.filter((x) => factIds.has(x)), explains: f.explains, confidence: f.confidence,
      from_feedback: !!f.suggested, edited_by_check: t1.edited || t2.edited,
      finding_id: f.finding_id, finding_rank: f.rank, score: f.score, covers: f.covers !== false, worded_by: t2.text ? 'ai' : 'n8n',
    });
  }
  const h = reasons.length < 3 ? take((x) => x.kind === 'hypothesis') : null;
  if (h) {
    const t1 = checkText(h.title), t2 = checkText(h.text);
    if (t1.text || t2.text) {
      reasons.push({
        rank: reasons.length + 1, kind: 'hypothesis', title: t1.text || 'Possible cause to check', text: t2.text,
        evidence_refs: ['f1.change_type'], explains: ['expected', 'miss', 'both'].includes(h.explains) ? h.explains : 'both', confidence: 'low',
        from_feedback: !!h.from_feedback, edited_by_check: t1.edited || t2.edited,
        finding_id: null, finding_rank: null, score: null, covers: false, worded_by: 'ai',
      });
    }
  }
}

// ---------- template answers (no AI) ----------
let headline = ai && ai.headline ? checkText(ai.headline).text : '';
let caveat = ai && ai.caveat ? checkText(ai.caveat).text : '';
const T = b.totals;
if (b.change_type === 'no_change') {
  headline = `No real change: stays are within the tolerance of forecast and last year.`;
} else if (b.change_type === 'data_issue') {
  headline = 'The numbers for this period look incomplete, so the change is not explained.';
  reasons = [{ rank: 1, kind: 'data', title: 'Data gap in this period', confidence: 'high',
    text: T.red_days ? `${T.red_days} of ${T.days} days have a forecast of 0 or missing figures.` : 'The forecast or last-year figures are missing for this period.',
    evidence_refs: b.facts.some((f) => f.id === 'f3.quality') ? ['f3.quality'] : ['f1.change_type'], explains: 'both', from_feedback: false, edited_by_check: false }];
} else if (!headline) {
  headline = reasons.length && reasons[0].kind === 'data' ? `${b.change_text}. Main reason: ${reasons[0].title}.` : b.change_text + '.';
}
if (fromAi && error) caveat = reasons.length ? 'The AI could not word the reasons right now, so they are shown as computed from the data.' : 'The AI could not write reasons right now. The numbers above are correct.';

// ---------- unexplained share (computed, not by the AI) ----------
let unexplained_pct = null;
if (b.parts && b.parts.expected) {
  const dataR = reasons.filter((r) => r.kind === 'data' && r.covers !== false && r.evidence_refs.some((x) => !x.startsWith('f1.')));
  const covE = dataR.some((r) => r.explains === 'expected' || r.explains === 'both');
  const covM = dataR.some((r) => r.explains === 'miss' || r.explains === 'both');
  unexplained_pct = (covE ? 0 : b.parts.expected.share_pct) + (b.parts.miss ? (covM ? 0 : b.parts.miss.share_pct) : 0);
  for (const r of reasons) {
    r.share_pct = r.explains === 'expected' ? b.parts.expected.share_pct : r.explains === 'miss' && b.parts.miss ? b.parts.miss.share_pct : 100;
  }
}

const alert = b.action === 'report' && !$('Validate').item.json.demo && !!b.severity && ['high', 'medium', 'info', 'warning'].includes(b.severity) && b.change_type !== 'no_change';
const answer = {
  scope: b.scope, totals: b.totals, parts: b.parts, change_type: b.change_type, change_text: b.change_text, severity: b.severity,
  headline, caveat, reasons, unexplained_pct, findings: b.findings || [], logic: b.logic || null, facts: b.facts, series: b.series,
  change_note: b.version > 1 && ai && ai.change_note ? checkText(ai.change_note).text : null,
  version: b.version, model: fromAi ? model : null, ai: fromAi && !error, error,
  report: b.report || null, created_at: new Date().toISOString(),
};
const save = {
  scope_key: b.scope_key, scope: b.scope, version: b.version, parent_id: b.parent_id, root_id: b.root_id,
  change_type: b.change_type, severity: b.severity, totals: b.totals, facts: b.facts, reasons,
  unexplained_pct, headline, caveat, change_note: answer.change_note, model: answer.model, ai: answer.ai, error,
  data_updated_at: b.data_updated_at, answer, alert,
  alert_date: b.scope.from, alert_label: b.scope.label,
  alert_delta: b.totals.gap_py_pct ?? b.totals.fc_vs_py_pct ?? null,
};
return { json: { respond: answer, save: true, payload: b64(save), versions: b.versions } };
