"""
Screenshots of every screen of the running app (light theme, English), at 2x for slides.
Run with the app on http://localhost:3123:  python presentation/screenshots.py
Output: presentation/out/screenshots/*.png  (a "screen" shot of the first view and a "full" shot of the whole page)
"""
import asyncio
import re
import sys
from pathlib import Path

from playwright.async_api import async_playwright

APP = "http://localhost:3123"
OUT = Path(__file__).resolve().parent / "out" / "screenshots"
W, H = 1440, 900
TXT = "document.body.innerText.toLowerCase()"

# name, path, ready check, optional action before the shot
SHOTS = [
    ("01-landing", "/", f"() => !document.querySelector('.skeleton') && {TXT}.includes('live cockpit')", None),
    ("02-dashboard-overview", "/dashboard", f"() => document.querySelectorAll('.kpi-tile').length >= 4 && {TXT}.includes('monthly breakdown')", None),
    ("03-dashboard-weeks", "/dashboard#weeks", f"() => document.querySelectorAll('table tbody tr').length > 10", None),
    ("04-dashboard-holidays", "/dashboard#calendar", f"() => document.querySelectorAll('.heat-cell').length > 20", None),
    ("05-week-detail", "/dashboard?week=2026-W16", "() => !!document.querySelector('[aria-labelledby=week-panel-title]')", None),
    ("06-explain-W16", "/explain?week=2026-W16", "() => !!document.querySelector('#why') && !document.querySelector('[aria-busy=true]')", None),
    ("07-explain-reasons", "/explain?week=2026-W16", "() => !!document.querySelector('#why') && !document.querySelector('[aria-busy=true]')", "why"),
    ("08-alerts", "/alerts", f"() => {TXT}.includes('needs your attention') && !document.querySelector('.skeleton')", None),
    ("09-strategies", "/strategies", f"() => {TXT}.includes('strategies') && !document.querySelector('.skeleton')", None),
    ("10-strategy-plan", "/strategies/13", f"() => {TXT}.includes('target window') && !document.querySelector('.skeleton')", None),
    ("11-strategy-options", "/strategies/13", f"() => {TXT}.includes('target window') && !document.querySelector('.skeleton')", "options"),
]
ONLY = set(sys.argv[1:])  # e.g. "11-strategy-options" to re-shoot one screen

INIT = "try{localStorage.setItem('ttf-theme','light');localStorage.setItem('ttf-lang','en')}catch(e){}"
CLEAN = "html{scrollbar-width:none}::-webkit-scrollbar{display:none}"


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(channel="msedge", headless=True)
        ctx = await browser.new_context(viewport={"width": W, "height": H}, device_scale_factor=2, color_scheme="light")
        await ctx.add_init_script(INIT)
        for name, path, ready, action in SHOTS:
            if ONLY and name not in ONLY:
                continue
            page = await ctx.new_page()
            await page.goto(APP + path, wait_until="domcontentloaded")
            await page.add_style_tag(content=CLEAN)
            try:
                await page.wait_for_function(ready, timeout=90_000, polling=300)
            except Exception as e:
                print(f"  {name}: not ready ({e.__class__.__name__}), shooting anyway")
            await asyncio.sleep(2.0)  # count-ups, charts and fades settle
            if action == "why":
                await page.evaluate("document.querySelector('#why').scrollIntoView({block:'start'}); window.scrollBy(0,-90)")
                btn = page.get_by_role("button", name=re.compile("Show evidence")).first
                if await btn.count():
                    await btn.click()
                await asyncio.sleep(0.8)
            if action == "options":
                # The heading wording changes between versions; take the first strategy heading below the plan.
                await page.evaluate(
                    "() => { const h = [...document.querySelectorAll('h2')].find(e => /strateg|option|what to do/i.test(e.innerText) && e.getBoundingClientRect().top > 300);"
                    " window.scrollTo(0, h ? h.getBoundingClientRect().top + scrollY - 110 : 900); }"
                )
                await asyncio.sleep(0.8)
            await page.screenshot(path=str(OUT / f"{name}-screen.png"))
            if action is None and not name.startswith("05"):
                await page.screenshot(path=str(OUT / f"{name}-full.png"), full_page=True)
            print(f"  {name}")
            await page.close()
        await browser.close()
    print(f"Saved to {OUT}")


asyncio.run(main())
