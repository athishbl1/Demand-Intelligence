/**
 * Turns a technical error (webhook path, HTTP status, CORS hint) into a sentence for business users.
 * The raw message goes to the browser console so the team can still debug it.
 */
export function friendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : err == null ? "" : String(err);
  if (raw) console.warn("[cockpit]", raw);
  if (/timed? ?out|took too long/i.test(raw)) return "The service took too long to answer. Please try again in a minute.";
  if (/network|failed to fetch|connection|offline/i.test(raw)) return "The service cannot be reached right now. Please check your connection and try again.";
  return "Something went wrong on our side. Please try again in a minute.";
}
