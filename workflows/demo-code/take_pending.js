// The app polls this. The pending dummy count is handed over ONCE and then forgotten,
// so a page refresh in the app loses it.
const sd = $getWorkflowStaticData('global');
const r = sd.pending;
delete sd.pending;
delete sd.demo;
return [{ json: { record: r ? { ...r, pending: true } : { ok: true, pending: false } } }];
