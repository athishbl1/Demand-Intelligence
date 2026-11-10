---
name: ischgl-ui
description: Ischgl / Paznaun design system taken from ischgl.com/de/winter — crimson #bb1c3f, DM Sans + Eurostile-style heavy uppercase headlines, square corners, cut-corner buttons, white premium layout and the interaction patterns used in this app. Use whenever building, restyling or reviewing any page, component, chart, email or slide that should look like Ischgl / TVB Paznaun-Ischgl, or when the user says "Ischgl theme", "same style as the website", "brand colours", "make it premium" in this project.
---

# Ischgl UI style

This is the visual language of **ischgl.com/de/winter**, as extracted from its production CSS (`style-*.css`).
It also covers how that language is implemented in this Next.js app, which uses Tailwind v4.
Follow it so every new page looks like it belongs to the same brand.

Ready-made implementation: [assets/ischgl-globals.css](assets/ischgl-globals.css). It is a copy of `app/globals.css` and can be dropped into any Tailwind v4 project.

---

## 1. Brand personality

- **Bold, alpine and high-energy.** "Relax. If you can." The look is party and premium at the same time, not cute.
- **There is one loud colour**, crimson. Everything else is black, white and cool grey.
- **Big uppercase headlines** are set in a heavy squared face, and short punchy copy sits next to generous white space.
- **Corners are sharp everywhere.** The signature detail is the **cut-off top-right corner** on buttons, cards and banners.
- **Use full-bleed imagery and mountain silhouettes.** Crimson banners carry white text.

---

## 2. Colours

### Brand (from ischgl.com)

| Token | Hex | Use |
|---|---|---|
| `--color-primary` / `--color-ischgl` | **`#bb1c3f`** | The ONE accent: main buttons, links, active states, countdown badge, highlights |
| primary hover (ours) | `color-mix(#bb1c3f 82%, #000)` ≈ `#991733` | Button hover |
| primary tint (ours) | `color-mix(#bb1c3f 7%, #fff)` ≈ `#fbf1f3` | Notice boxes, soft highlights |
| `--color-secondary` / `--color-text-default` | `#313131` | Body text on the original site |
| `--color-very-dark` | `#1a1a1a` | Headlines, dark bands, footer strip (this app's `--text`) |
| `--color-default-dark` | `#161616` | Shadow base colour (`#16161633`, `#1616164d`) |
| `--color-default` | `#2d343e` | Dark UI elements |
| `--color-dark` | `#343a40` | Dark grey |
| `--color-text-muted` | `#929292` | Muted text on the site (this app uses `#6f747a` for better contrast) |
| `--color-dark-grey` | `#bec2c6` | Dividers on dark grey, disabled |
| `--color-bg` | `#edf0f3` | Section background (cool light grey) |
| `--color-light-grey` | `#f8f9fa` | Lightest surface |
| `--color-white` | `#fff` | Page background, text on crimson |

### Status colours (site)

| Meaning | Hex | Dark | Light |
|---|---|---|---|
| success | `#08ce08` | `#12862b` | `#1ee048` |
| booking / CTA green | `#239c43` | | |
| warning / info | `#ffc107` | `#967102` | `#fbbd03` |
| info blue | `#17a2b8` | | |
| danger | `#ff3e3e` | `#cc2333` | `#e15260` |

Secondary accents seen in summer and season content: `#99364d` (wine), `#335980` (alpine blue), `#4d8033` (meadow green), `#b39336` (gold). Use them only for chart series or category tags, never for UI chrome.

### Neutral scale used in this app (Tailwind `slate-*` is remapped to it)

```
50 #f8f9fa  100 #f1f2f4  200 #e4e6e9  300 #cfd2d6  400 #a3a7ad
500 #6f747a 600 #55595e  700 #3f4246  800 #313131  900 #1a1a1a  950 #111111
```

### Semantic tokens (this app, `:root`)

```css
--accent:#bb1c3f; --on-accent:#fff;
--accent-light:color-mix(in srgb,var(--accent) 7%,#fff);
--accent-border:color-mix(in srgb,var(--accent) 28%,#fff);
--accent-dark:color-mix(in srgb,var(--accent) 82%,#000);
--background:#fff; --surface:#fff; --surface-muted:#f4f5f7;
--line:#e4e6e9; --line-field:#cfd2d6; --text:#1a1a1a; --text-muted:#6f747a;
```

**Rules**
- Crimson covers at most ~10% of any screen. It goes on one primary CTA per view, active states and key numbers.
- Text on crimson is always white. Never put crimson text on dark grey.
- Use only the light theme (white). Dark is limited to bands: the top live strip and an occasional `#1a1a1a` section.
- Use the Tailwind classes `sky-*`, `text-accent`, `bg-accent` and `bg-accent-light`. All of them resolve to the crimson. **Change the colour only in `lib/app.ts` → `APP.accent`.**

### Chart colours

- Actual or main series: `#bb1c3f`.
- Forecast: `#6f747a` (dashed).
- Last year: `#f59e0b`.
- Capacity: `#a3a7ad`.
- Grid: `#eef0f2`.
- Extra series: `#e11d48`, `#059669`, `#9333ea`, then the summer accents above.

---

## 3. Typography

| Role | ischgl.com | This app (free substitute) |
|---|---|---|
| Body / UI | `"dm-sans-regular"`, bold `"dm-sans-bold"` | **DM Sans** (`next/font/google`, `--font-dm-sans`) |
| Headlines, buttons, labels | `"eurostile-heavy"` (licensed) | **Saira 700/800/900** (`--font-saira`). Tailwind class `font-display` |

```ts
// app/layout.tsx
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const saira  = Saira({ subsets: ["latin"], weight: ["700","800","900"], variable: "--font-saira", display: "swap" });
```

**Scale (taken from the site)**
- `h1`: `clamp(4.5rem, 6vw, 6.25rem)` on desktop, 2.5rem on mobile. Line-height 1, uppercase.
- `h2`: about 3rem on desktop, 2rem on mobile. Uppercase, line-height 1.
- `h3`: 1.875rem on desktop, 1.25rem on mobile.
- `h5`/`h6`: 1.25rem on desktop, .875rem on mobile.
- Body: 1rem (16px), 14px on xs, line-height 1.6.
- In-app page title (`.page-title`): `clamp(1.75rem, 1.4rem + 1.4vw, 2.5rem)` / 800, with a 3rem × 4px crimson bar below it.

**Letter-spacing on the site**
- Eyebrows and kickers: `.3125rem` (5px, very wide).
- Small caps labels: `.078–.11rem`.
- Buttons: `.1875rem`.
- In-app equivalents: eyebrow `0.14em`, button `0.04em`, nav `tracking-wider`.

**Rules**
- h1/h2, buttons, nav links, eyebrows and table headers are UPPERCASE and use the display face.
- Body copy is DM Sans in sentence case. Never set body paragraphs in the display face.
- Use `text-wrap: balance` on headings.
- For a big decorative word, use outlined display text (`.text-outline`) in `text-slate-200/300` at about `18vw`. Examples: the footer "PAZNAUN" watermark, marquee words.

---

## 4. Shape, spacing, elevation

- **Radius:** `0` everywhere. Small inputs, chips and code get at most 2px. `rounded-full` is only for dots, avatars and status badges.
- **Cut corner** (the signature detail):

  ```css
  --cut: .75rem;                 /* buttons  */
  .cut-corner-lg { --cut: 2.25rem } /* cards, banners */
  clip-path: polygon(0 0, calc(100% - var(--cut)) 0, 100% var(--cut), 100% 100%, 0 100%);
  ```

  - Site primary button: `linear-gradient(315deg, transparent 2.1875rem, var(--color-primary) 0)`, height 3.125rem (50px), padding-left 1.5625rem, padding-right 4.6875rem.
  - Site image tiles cut the **bottom-right** corner by 3.125rem (50px) or 30px. Use this for image cards.
- **Containers on the site**:
  - large 1795px, default 1487px, medium 1183px, narrow 878px, extra-narrow 780px.
  - Padding is 30px.
  - The navbar is 149px tall on desktop and 50px on mobile.
- **Container in this app:** `.container-page` with max-width 80rem and padding 1rem, or 1.5rem from 640px.
- **Section rhythm:** `py-16 sm:py-24`. Alternate white and `bg-slate-50` / `#edf0f3` sections.
- **Shadows (site):** `0 1.25rem 2.25rem #16161633`, `0 2rem 3.125rem #1616164d`, and a glow `0 0 5rem 0 var(--color-primary)` for CTAs.
- **Shadows (app):** `--shadow-premium: 0 1px 2px rgb(17 17 17/.04), 0 18px 40px -18px rgb(17 17 17/.18)`. Show it on hover together with `-translate-y-1`.

---

## 5. Components (class names in `globals.css`)

| Class | Look |
|---|---|
| `.btn` | Crimson, white uppercase display text, cut top-right corner, min-h 3rem; on hover it changes to `--accent-dark`. **One per view/form.** |
| `.btn-secondary` | Transparent with a 1.5px black border; on hover it fills black with white text |
| `.btn-ghost` | Uppercase text link; a crimson 2px underline grows from the left on hover |
| `.eyebrow` | 12px uppercase crimson label with a 1.75rem dash before it |
| `.page-title` | Uppercase display h1 with a crimson bar below |
| `.card` | White, 1px `--line` border, square corners, padding 1.25rem to 1.5rem |
| `.field` / `.label` | Square input, 48px tall, 16px text, crimson focus ring at 16% |
| `.notice` / `.notice-error` | Tinted box with a 3px left border |
| `.badge-green/yellow/red/gray` | Pill with a dot (these are the only round elements) |
| `.table-wrap` | Bordered box that scrolls on its own; header row is `--surface-muted` |
| `.spinner`, `.skeleton` | Loading states |
| `.reveal` + `.is-visible` | Fade up 28px over 0.8s with `cubic-bezier(.22,1,.36,1)` |
| `.spotlight` | Crimson radial glow that follows the pointer (`--mx`, `--my`) |
| `.cut-corner`, `.cut-corner-lg`, `.text-outline`, `.bg-dots`, `.marquee`, `.scrollbar-none` | Decorative helpers |

**Header pattern**
- Dark `#1a1a1a` "Live info" strip, 36px tall: pulsing crimson label, key facts, countdown on the right.
- Below it, a sticky white header, 64px tall: logo, a vertical divider, the name in uppercase display type.
- Nav links are uppercase display type at 12px. The active link has a 3px crimson underline that scales in from the left.
- A 2px crimson scroll-progress bar sits at the bottom edge.
- After 12px of scroll the header turns blurred (`bg-white/90 backdrop-blur-lg`) and gets a soft shadow.

**Footer pattern**
- `bg-slate-50` with four columns, uppercase display headings (12px, tracking 0.14em).
- A huge outlined "PAZNAUN" watermark.
- A white bottom strip with © text and facts.

**Hero pattern**
- White background with layered SVG mountain ridges: `#eceff2`, `#d6dce2`, `#bec6cf` with snow caps.
- Pointer parallax and canvas snowfall.
- Uppercase h1 where one word is crimson, then one `.btn` and one `.btn-secondary`.
- A crimson countdown badge (site: `--color-countdown-badge-bg`).

**Crimson banner**
- Full-width `bg-accent` with `.cut-corner-lg`, white h2 and translucent white mountain ridges.
- The button inside is white with crimson text.

---

## 6. Motion and interaction

The timings come from the site:
- `filter .2s ease-in-out` on buttons (most common).
- `transform .33s ease-in-out` on image zoom.
- `all .35s` on cards.

| Pattern | Spec | Component |
|---|---|---|
| Scroll reveal | IntersectionObserver, stagger 80–120ms | `components/ui/Reveal.tsx`, `hooks.ts → useInView` |
| Count-up numbers | rAF ~1.2s ease-out, parses "€3.45M", "22,078", "+12%" | `components/ui/CountUp.tsx` |
| Countdown to season start | 26 Nov 2026 08:30 CET, "boxes" and "inline" variants | `components/ui/Countdown.tsx` |
| Snowfall | Canvas, `density` prop, paused off-screen | `components/ui/Snowfall.tsx` |
| Mountain parallax | SVG ridges moved by the pointer, `light` / `brand` variants | `components/ui/MountainScene.tsx` |
| Spotlight + tilt cards | Glow follows the pointer, max 4° tilt | `components/ui/SpotlightCard.tsx` |
| Marquee | 38s linear loop, a reverse row at 44s, pauses on hover | `.marquee` / `animate-marquee` |
| Image hover | `scale(1.05)` over .33s inside `overflow-hidden` | |
| Card hover | `-translate-y-1` plus `--shadow-premium` | |
| Underline nav | `scale-x-0 → scale-x-100`, `origin-left`, .3s | |
| Sliding tab indicator | Absolute crimson bar animated to the active tab rect | dashboard tabs |
| Command palette | Ctrl/⌘+K, arrows, Enter, Esc | `components/ModuleSearch.tsx` |
| Success | SVG check stroke-dashoffset (`draw-check`) | login/signup |

**Rules**
- Every animation respects `prefers-reduced-motion`. The global rule in `globals.css` already handles CSS animations; JS animations must check `prefersReducedMotion()` from `components/ui/hooks.ts`.
- Animations must never be needed to read content. The final state has to be the correct one.
- Everything interactive works with the keyboard. Focus ring: `outline: 2px solid var(--accent); outline-offset: 2px`.
- Format numbers with the `en-US` locale (`formatNumber` in `lib/app.ts`) to avoid hydration mismatches.

---

## 7. Imagery and icons

- Use full-bleed winter photography: snow, slopes, night events, concerts. Overlay text on photos with `linear-gradient(#16161600 → #161616cc)`.
- When no photo is available, use the mountain silhouette SVG, `bg-dots` or a crimson panel. Never use stock gradients or blobs.
- Icons are **lucide-react**, 16–20px, stroke 2 (the site uses its own icon font with the same line style). Icons inside crimson squares are white.
- Logo: `https://www.ischgl.com/007_BERGBAHNEN/001_SSAG/shopski/ischgl_ohne_r.png`, with `/logo.png` as the local fallback via `onError`.

---

## 8. Do / Don't

**Do**
- Use white space, sharp edges, uppercase display headlines, one crimson CTA, a cut corner and real data.
- Give each section an eyebrow, then an h2, then a one-line lead in `text-slate-500`.

**Don't**
- Use rounded cards, pastel gradients, purple or blue accents, or drop shadows on everything.
- Add more than one filled crimson button per view.
- Use dark mode, centred body paragraphs wider than 65ch, or emoji as icons.
- Change the page structure when restyling. Restyle through tokens and classes only.

---

## 9. Applying to a new project (checklist)

1. Copy `assets/ischgl-globals.css` to `app/globals.css` (Tailwind v4).
2. Load DM Sans and Saira in the layout and put both `.variable` classes on `<html>`.
3. Set `style={{ "--accent": "#bb1c3f" }}` on `<html>`, plus `themeColor: "#ffffff"` and `colorScheme: "light"`.
4. Copy `components/ui/*` (hooks, Reveal, CountUp, Countdown, Snowfall, MountainScene, SpotlightCard) if motion is wanted.
5. Build pages with `.container-page`, `.eyebrow`, `.page-title`, `.card`, `.btn` and `.btn-secondary`.
6. Check:
   - Each view has exactly one crimson CTA.
   - All headlines are uppercase.
   - There are no rounded corners.
   - Motion works with reduced motion and with the keyboard.
   - The layout fits at 375px width without horizontal scroll.
