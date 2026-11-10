import { getLang } from "@/lib/i18n";

/**
 * Name, tagline, accent colour, logo and language of the app. Change them here only:
 * the header, the browser tab and all building blocks follow.
 *
 * - name:    shown in the header and in the browser tab
 * - tagline: small line below the name, "" for none
 * - accent:  colour of buttons, links, notices and the bar in the header.
 *            Pick a strong, rather dark colour: white text sits on it.
 * - logo:    "/logo.svg" for a file in public/, or a full https:// address, "" for no logo
 * - lang:    language of the page for browsers and screen readers, for example "en" or "de"
 */
export const APP = {
  name: "Paznaun-Ischgl Demand Intelligence",
  tagline: "Explainable Overnight Forecasting & Early-Action Playbook",
  accent: "#bb1c3f",
  logo: "https://www.ischgl.com/007_BERGBAHNEN/001_SSAG/shopski/ischgl_ohne_r.png",
  lang: "en",
};

/**
 * Format numbers with a fixed 'en-US' locale to prevent SSR/client hydration mismatches.
 */
export function formatNumber(val: number | null | undefined): string {
  if (val === null || val === undefined) return "";
  return val.toLocaleString(getLang() === "de" ? "de-AT" : "en-US");
}

