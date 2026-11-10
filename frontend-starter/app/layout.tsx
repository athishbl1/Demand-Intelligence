import type { CSSProperties, ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { DM_Sans, Saira } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { SkipLink } from "@/components/SkipLink";
import { Footer } from "@/components/Footer";
import { APP } from "@/lib/app";
import { LangBoundary, LangProvider } from "@/lib/i18n";

// Sets the saved (or system) theme before the first paint, so there is no flash.
// A link can carry ?theme=dark|light and ?lang=de|en; that choice is saved like a click on the toggle.
const THEME_SCRIPT = `try{var q=new URLSearchParams(location.search);var qt=q.get("theme");if(qt==="dark"||qt==="light")localStorage.setItem("ttf-theme",qt);var ql=q.get("lang");if(ql==="de"||ql==="en")localStorage.setItem("ttf-lang",ql);var t=localStorage.getItem("ttf-theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

// Body text: DM Sans (as on ischgl.com). Headlines and buttons: Saira, standing in for Eurostile Heavy.
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const saira = Saira({ subsets: ["latin"], weight: ["700", "800", "900"], variable: "--font-saira", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${APP.name} — Demand Intelligence & Action Planner`, template: `%s · ${APP.name}` },
  description: APP.tagline || undefined,
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
};

type StyleWithVariables = CSSProperties & Record<`--${string}`, string>;

const accentStyle: StyleWithVariables | undefined = APP.accent ? { "--accent": APP.accent } : undefined;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang={APP.lang || "en"}
      style={accentStyle}
      className={`${dmSans.variable} ${saira.variable} font-sans`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col bg-[var(--background)] text-[var(--text)] antialiased" suppressHydrationWarning>
        <LangProvider>
        <SkipLink />
        <Header />
        {/* Full width: each page sets its own .container-page, so heroes and banners can run edge to edge */}
        <main id="content" className="w-full flex-1">
          <LangBoundary>{children}</LangBoundary>
        </main>
        <Footer />
        </LangProvider>
      </body>
    </html>
  );
}
