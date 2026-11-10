// n8n Code node "Answer": the final JSON for the app (after Save, or straight from Finalize).
const f = $('Finalize').item.json;
if (!f.save) return { json: f.respond };
const s = $json.result || {};
let versions = f.versions || [];
if (f.action !== 'custom') versions = [...versions, { id: s.set_id, version: s.version, change_note: s.change_note, created_at: s.created_at }];
return { json: { ...f.respond, set_id: s.set_id, root_id: s.root_id, status: s.status || 'open', accepted_idx: s.accepted_idx ?? null,
  versions: versions.length ? versions : [{ id: s.set_id, version: s.version, change_note: s.change_note, created_at: s.created_at }],
  feedback_summary: { up: 0, down: 0, votes: {} } } };
