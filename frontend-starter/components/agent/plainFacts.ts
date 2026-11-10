/**
 * Evidence in simple words. The facts come from n8n with technical labels ("effect on stays (driver model)",
 * "90 % range 572 to 826", "driver model drivers-v2"). This turns them into short everyday phrases for
 * business readers. Only the wording changes; the numbers are shown exactly as computed.
 */
import type { Fact } from "@/lib/agent";
import { tr } from "@/lib/i18n";

const LABEL_RULES: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^(.*): effect on stays \(driver model\)$/, (m) => tr("{x}: how many stays it added or removed", { x: m[1] })],
  [/^Change against the same weekdays last year \(driver model\)$/, () => tr("Change against the same weekdays last year")],
  [/^Change type \(computed.*\)$/, () => tr("Type of change")],
  [/^Part of the gap to last year the forecast already expected$/, () => tr("Part the forecast already expected")],
  [/^Part of the gap to last year that is a forecast miss$/, () => tr("Part that was a surprise")],
  [/^Days where actual is outside the forecast by more than the tolerance$/, () => tr("Days clearly off the forecast")],
  [/^Change of the normalised stays index vs last year$/, () => tr("Change compared with nearby regions")],
  [/^Days with data warnings$/, () => tr("Days with unreliable data")],
  [/^Reason (\d+) from the explanation$/, (m) => tr("Reason {n} from the explanation", { n: m[1] })],
];

/** "90 % range 572 to 826" -> "likely between 572 and 826" */
const simplifyRef = (ref: string): string => {
  const m = ref.match(/^90 % range (.+) to (.+)$/);
  if (m) return tr("likely between {a} and {b}", { a: m[1], b: m[2] });
  if (/^hypothesis$/.test(ref)) return tr("a possible cause, not proven");
  const c = ref.match(/^(high|medium|low) confidence$/);
  if (c) return tr("{x} confidence", { x: tr(c[1]) });
  return ref;
};

const simplifySource = (src: string): string => {
  if (/^driver model/.test(src)) return tr("Our statistics model");
  if (/^computed$/.test(src) || /^calendar \(computed\)$/.test(src)) return tr("Calculated from the data");
  if (/^Phase 2 agent$/.test(src)) return tr("AI analysis");
  return src;
};

export function simplifyFact(f: Fact): { label: string; now: string | number | null; ref: string | number | null; source: string; isRange: boolean } {
  let label = f.label;
  for (const [re, fn] of LABEL_RULES) {
    const m = label.match(re);
    if (m) {
      label = fn(m);
      break;
    }
  }
  if (label === f.label) label = tr(f.label);
  const ref = typeof f.ref === "string" ? simplifyRef(f.ref) : f.ref;
  const isRange = typeof f.ref === "string" && /^90 % range /.test(f.ref);
  return { label, now: f.now, ref, source: simplifySource(f.source), isRange };
}
