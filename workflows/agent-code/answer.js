// n8n Code node "Answer": the final JSON for the app (after Save, or straight from Finalize).
const f = $('Finalize').item.json;
if (!f.save) return { json: f.respond };
const s = $json.result || {};
const versions = [...(f.versions || []), { id: s.explanation_id, version: s.version, change_note: s.change_note, created_at: s.created_at }];
return { json: { ...f.respond, explanation_id: s.explanation_id, root_id: s.root_id, alert_id: s.alert_id || null, versions,
  feedback_summary: { up: 0, down: 0, notes: 0 } } };
