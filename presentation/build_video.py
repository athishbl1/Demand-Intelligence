"""
Builds the judges' video: neural voice-over (edge-tts), live screen recordings of the running app
(Playwright + Edge, CDP screencast at 1920x1080), title cards, burned-in captions, fades, one MP4.

Run with the app on http://localhost:3123 (npm --prefix frontend-starter run build && ... start -p 3123):
    python presentation/build_video.py            # everything
    python presentation/build_video.py explain    # re-record one scene, then reassemble
Output: presentation/out/demand-intelligence-pitch.mp4
"""
import asyncio
import base64
import json
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

import edge_tts
import imageio_ffmpeg
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "out"
WORK = OUT / "work"
APP = "http://localhost:3123"
VOICE = "en-US-AndrewMultilingualNeural"
RATE = "+2%"
W, H = 1440, 810          # CSS layout size
SCALE = 4 / 3             # device scale -> 1920 x 1080 frames
LEAD = 0.45               # silence before the narration of a scene
TAIL = 0.75               # after it
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

# --------------------------------------------------------------------------- the script

SCENES = [
    dict(id="intro", kind="card",
         text="Every season, Paznaun-Ischgl knows exactly how many guests stayed. What it never knew, was why."),
    dict(id="problem", kind="card",
         text="Take week sixteen of 2026. Last year, seventy-six thousand overnight stays. This year, thirty-four and a half thousand. "
              "Minus fifty-five percent. Was it the weather? Easter? A data glitch? "
              "By the time someone has worked it out, the next season is already being booked."),
    dict(id="solution", kind="card",
         text="So we built Demand Intelligence: an agent for the tourism board. It watches the coming season, explains every change, "
              "and turns it into a campaign, before the week is lost."),
    dict(id="landing", kind="app", path="/", chapter=("01", "Live on real data"),
         text="It runs live on the TVB's real data. Five hundred and seventeen days of overnight stays, twenty-two thousand beds, "
              "school holidays in eight source markets, weather and events, all refreshed every minute through n8n."),
    dict(id="cockpit", kind="app", path="/dashboard", chapter=("02", "Season cockpit"),
         text="The season cockpit gives the director one screen. Actual stays against the forecast and last year, key insights "
              "computed by fixed rules, the biggest movers, and every month with a why button that opens its explanation."),
    dict(id="calendar", kind="app", path="/dashboard#calendar", chapter=("03", "Source-market holidays"),
         text="It knows the calendar of our guests: when Dutch, German or British schools are off, week by week, and which holidays "
              "start next. So every campaign can aim at the markets that are actually free to travel."),
    dict(id="explain", kind="app", path="/explain?week=2026-W16", chapter=("04", "Explain any change"),
         text="Now the question nobody could answer. Why did week sixteen drop fifty-five percent? The answer comes first, in plain words. "
              "Easter came earlier, school holidays moved with it, and fewer source markets were on holiday. "
              "That alone cost about thirty-two thousand stays. The agent is honest about the rest: a quarter of the change has no "
              "measurable cause. Numbers come from SQL. The AI only writes the words, and every number it writes is checked."),
    dict(id="alerts", kind="app", path="/alerts", chapter=("05", "Alerts that look ahead"),
         text="Then it looks ahead. Alert rules check the coming season every hour. The week of the twenty-first of December is "
              "forecast ten percent below last year, while six source markets are on holiday. Act by the twentieth of November, "
              "because half of all guests book at least a month ahead."),
    dict(id="strategy", kind="app", path="/strategies/13", chapter=("06", "Campaign strategist"),
         text="And it tells you what to do. The campaign strategist turns the Easter drop into a plan for Easter 2027: "
              "forty-two thousand stays to win back, a launch date from the booking lead time, and three ranked strategies with "
              "markets, channels and a priority score. Choose one, correct it, or add your own idea, and the agent checks it against the data."),
    dict(id="arch", kind="card",
         text="Under the hood, it's a small, solid stack. TVB and Feratel data in Supabase, four n8n workflows, and a Next.js cockpit. "
              "Numbers from SQL. Words from AI. Every number checked."),
    dict(id="outro", kind="card",
         text="Demand Intelligence. From what happened, to what to do next, before the week is lost. Thank you."),
]

# --------------------------------------------------------------------------- helpers


def run(args):
    r = subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", *args], capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr[-2000:])


def media_seconds(path: Path) -> float:
    r = subprocess.run([FFMPEG, "-hide_banner", "-i", str(path)], capture_output=True, text=True)
    m = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", r.stderr)
    return int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])


def split_caption(text: str, start: float, end: float, limit: int = 78):
    """Long sentences become several caption lines, timed by their share of characters."""
    if len(text) <= limit:
        return [dict(start=start, end=end, text=text)]
    parts, cur = [], ""
    for word in text.split():
        if len(cur) + len(word) + 1 > limit and cur:
            parts.append(cur)
            cur = word
        else:
            cur = f"{cur} {word}".strip()
    parts.append(cur)
    total = sum(len(p) for p in parts)
    out, t = [], start
    for p in parts:
        d = (end - start) * len(p) / total
        out.append(dict(start=t, end=t + d, text=p))
        t += d
    return out


async def _tts_once(scene, mp3):
    comm = edge_tts.Communicate(scene["text"], VOICE, rate=RATE, boundary="SentenceBoundary", connect_timeout=15, receive_timeout=30)
    sentences = []
    with open(mp3, "wb") as f:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] in ("SentenceBoundary", "WordBoundary"):
                s = chunk["offset"] / 1e7
                sentences.append(dict(start=s, end=s + chunk["duration"] / 1e7, text=chunk["text"]))
    return sentences


async def narrate(scene):
    """Voice-over for one scene, plus sentence timings for the captions. Cached by text; retried on a stalled connection."""
    mp3 = WORK / f"{scene['id']}.mp3"
    cache = WORK / f"{scene['id']}.voice.json"
    key = f"{VOICE}|{RATE}|{scene['text']}"
    sentences = None
    if cache.exists() and mp3.exists() and mp3.stat().st_size > 0:
        c = json.loads(cache.read_text(encoding="utf-8"))
        if c.get("key") == key:
            sentences = c["sentences"]
    for attempt in range(4):
        if sentences:
            break
        try:
            sentences = await asyncio.wait_for(_tts_once(scene, mp3), timeout=90)
            if not sentences or mp3.stat().st_size == 0:
                raise RuntimeError("empty answer")
            cache.write_text(json.dumps({"key": key, "sentences": sentences}), encoding="utf-8")
        except Exception as e:
            sentences = None
            print(f"  voice {scene['id']:<9} attempt {attempt + 1} failed: {e!r}", flush=True)
            await asyncio.sleep(3 + attempt * 4)
    if not sentences:
        raise RuntimeError(f"no voice-over for {scene['id']}")
    dur = media_seconds(mp3)
    caps = []
    for i, s in enumerate(sentences):
        end = sentences[i + 1]["start"] - 0.05 if i + 1 < len(sentences) else dur
        caps += split_caption(s["text"], s["start"], max(s["end"], end))
    scene["audio"] = str(mp3)
    scene["dur"] = round(LEAD + dur + TAIL, 2)
    scene["captions"] = caps
    print(f"  voice {scene['id']:<9} {dur:5.1f}s  {len(caps)} caption lines")


# --------------------------------------------------------------------------- page actions


async def y_of(page, locator, offset=110):
    return await page.locator(locator).first.evaluate(f"e => e.getBoundingClientRect().top + window.scrollY - {offset}")


async def scroll(page, y, ms=1600):
    await page.evaluate(f"window.__scrollTo({y}, {ms})")


async def scroll_to(page, locator, ms=1600, offset=110):
    await scroll(page, await y_of(page, locator, offset), ms)


async def glide(page, x, y, ms=700):
    """Moves the (drawn) pointer smoothly to a point."""
    steps = max(2, int(ms / 16))
    await page.mouse.move(x, y, steps=steps)


async def sweep(page, locator, ms=3000, y_frac=0.5, x0=0.08, x1=0.92):
    box = await page.locator(locator).first.bounding_box()
    if not box:
        return
    y = box["y"] + box["height"] * y_frac
    await glide(page, box["x"] + box["width"] * x0, y, 500)
    n = int(ms / 33)
    for i in range(n + 1):
        x = box["x"] + box["width"] * (x0 + (x1 - x0) * i / n)
        await page.mouse.move(x, y)
        await asyncio.sleep(0.033)


async def hover(page, locator, ms=700):
    box = await page.locator(locator).first.bounding_box()
    if box:
        await glide(page, box["x"] + box["width"] * 0.5, box["y"] + box["height"] * 0.45, ms)


async def act_landing(page, d):
    await asyncio.sleep(1.2)
    await sweep(page, "svg[aria-label^='Weekly forecast for next winter']", 2600, 0.55)
    await scroll(page, 520, 1800)
    await asyncio.sleep(1.6)
    await scroll_to(page, "text=Forward radar", 1900, 90)
    await asyncio.sleep(0.6)
    for sel in ("text=2026-W51 >> nth=0", "text=2026-W52 >> nth=0", "text=2026-W53 >> nth=0"):
        await hover(page, sel, 600)
        await asyncio.sleep(0.9)


async def act_cockpit(page, d):
    await asyncio.sleep(1.0)
    for i in (0, 1, 2):
        await hover(page, f".kpi-tile >> nth={i}", 600)
        await asyncio.sleep(0.6)
    await scroll_to(page, "text=Key insights", 1600, 100)
    await asyncio.sleep(2.2)
    await scroll_to(page, "text=Biggest movers", 1600, 100)
    await asyncio.sleep(0.4)
    await hover(page, "text=2026-W16 >> nth=0", 600)
    await asyncio.sleep(1.4)
    await scroll_to(page, "text=Monthly breakdown", 1700, 100)
    await asyncio.sleep(0.5)
    await hover(page, "tr:has-text('April 2026') >> text=Why?", 700)


async def act_calendar(page, d):
    await asyncio.sleep(0.8)
    await scroll_to(page, "text=Holiday & event calendar", 1300, 90)
    await asyncio.sleep(0.4)
    cells = page.locator(".heat-cell")
    for i in (7, 8, 29, 30, 52):
        box = await cells.nth(i).bounding_box()
        if box:
            await glide(page, box["x"] + box["width"] / 2, box["y"] + box["height"] / 2, 450)
            await asyncio.sleep(0.7)
    await page.mouse.move(1300, 300, steps=10)
    await scroll_to(page, "text=Upcoming holiday starts", 1700, 100)
    await asyncio.sleep(0.6)
    await hover(page, "text=Germany · from 21 Dec 2026", 700)


async def act_explain(page, d):
    await asyncio.sleep(2.0)
    await scroll_to(page, "#answer", 1600, 90)
    await asyncio.sleep(4.0)
    await scroll_to(page, "text=How the change splits", 1400, 300)
    await asyncio.sleep(2.6)
    await scroll_to(page, "#why", 1700, 90)
    await asyncio.sleep(3.2)
    btn = page.get_by_role("button", name=re.compile("Show evidence")).first
    await hover(page, "button:has-text('Show evidence') >> nth=0", 600)
    await btn.click()
    await asyncio.sleep(3.5)
    await scroll(page, await page.evaluate("window.scrollY") + 380, 1600)


async def act_alerts(page, d):
    await asyncio.sleep(1.8)
    await scroll_to(page, "text=Needs your attention", 1800, 120)
    await asyncio.sleep(0.6)
    await hover(page, "text=What to do >> nth=0", 800)
    await asyncio.sleep(3.0)
    await hover(page, "text=What to do >> nth=1", 700)
    await asyncio.sleep(2.0)


async def act_strategy(page, d):
    await asyncio.sleep(2.2)
    await hover(page, "text=Room to fill", 700)
    await asyncio.sleep(2.2)
    await hover(page, "text=Launch by >> nth=0", 600)
    await asyncio.sleep(1.6)
    await scroll_to(page, "text=Three strategies", 1800, 90)
    await asyncio.sleep(0.6)
    for i in range(3):
        await hover(page, f"text=Choose this >> nth={i}", 600)
        await asyncio.sleep(1.4)
    await scroll(page, await page.evaluate("window.scrollY") + 420, 1800)
    await asyncio.sleep(0.6)
    await hover(page, "text=Priority score >> nth=0", 600)


ACTIONS = dict(landing=act_landing, cockpit=act_cockpit, calendar=act_calendar, explain=act_explain, alerts=act_alerts, strategy=act_strategy)

# innerText follows text-transform, so labels are compared in lower case.
TXT = "document.body.innerText.toLowerCase()"
READY = {
    "landing": f"() => !document.querySelector('.skeleton') && {TXT}.includes('live cockpit') && {TXT}.includes('2026-w51')",
    "cockpit": f"() => document.querySelectorAll('.kpi-tile').length >= 4 && !document.querySelector('.skeleton') && {TXT}.includes('monthly breakdown')",
    "calendar": f"() => document.querySelectorAll('.heat-cell').length > 20 && {TXT}.includes('upcoming holiday starts')",
    "explain": "() => !!document.querySelector('#why') && !document.querySelector('[aria-busy=true]')",
    "alerts": f"() => {TXT}.includes('needs your attention') && !document.querySelector('.skeleton')",
    "strategy": f"() => {TXT}.includes('three strategies')",
}

POINTER_JS = """
(() => {
  if (window.__ptr) return; window.__ptr = true;
  const add = () => {
    const p = document.createElement('div');
    p.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;' +
      'border:2.5px solid #bb1c3f;background:rgb(187 28 63 / .18);z-index:2147483647;pointer-events:none;' +
      'transition:transform .15s ease, opacity .3s;opacity:0;box-shadow:0 0 0 4px rgb(255 255 255 / .6)';
    document.body.appendChild(p);
    addEventListener('mousemove', e => { p.style.opacity = 1; p.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`; }, true);
    addEventListener('mousedown', () => p.style.boxShadow = '0 0 0 10px rgb(187 28 63 / .25)', true);
    addEventListener('mouseup', () => p.style.boxShadow = '0 0 0 4px rgb(255 255 255 / .6)', true);
  };
  if (document.body) add(); else addEventListener('DOMContentLoaded', add);
})();
"""

HIDE_SCROLLBARS = "html{scrollbar-width:none}::-webkit-scrollbar{display:none}"

# --------------------------------------------------------------------------- recording


async def record(browser, scene):
    frames_dir = WORK / f"frames-{scene['id']}"
    shutil.rmtree(frames_dir, ignore_errors=True)
    frames_dir.mkdir(parents=True)
    ctx = await browser.new_context(viewport={"width": W, "height": H}, device_scale_factor=SCALE, reduced_motion="no-preference")
    if scene["kind"] == "app":  # the drawn pointer only belongs to the live app scenes
        await ctx.add_init_script(POINTER_JS)
    page = await ctx.new_page()
    url = (ROOT / "cards.html").as_uri() + f"#{scene['id']}" if scene["kind"] == "card" else APP + scene["path"]
    await page.goto(url, wait_until="domcontentloaded")
    await page.add_style_tag(content=HIDE_SCROLLBARS)
    await page.add_script_tag(path=str(ROOT / "overlay.js"))
    await page.evaluate("document.fonts.ready")
    if scene["kind"] == "app":
        await page.wait_for_function(READY[scene["id"]], timeout=120_000, polling=250)
        await asyncio.sleep(1.2)  # let charts and count-ups settle before the first frame
    await page.mouse.move(W * 0.62, H * 0.3)

    cdp = await ctx.new_cdp_session(page)
    frames = []

    async def on_frame(p):
        path = frames_dir / f"{len(frames):06d}.jpg"
        path.write_bytes(base64.b64decode(p["data"]))
        frames.append((p["metadata"]["timestamp"], path.name))
        try:
            await cdp.send("Page.screencastFrameAck", {"sessionId": p["sessionId"]})
        except Exception:
            pass

    cdp.on("Page.screencastFrame", lambda p: asyncio.ensure_future(on_frame(p)))
    await cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 92, "maxWidth": 1920, "maxHeight": 1080, "everyNthFrame": 1})
    start = time.monotonic()
    chapter = {"n": scene["chapter"][0], "t": scene["chapter"][1]} if scene.get("chapter") else None
    await page.evaluate("(a) => window.__overlay(a)", {"chapter": chapter, "captions": scene["captions"], "lead": LEAD})
    if scene["kind"] == "card":
        await page.evaluate(f"window.__play({scene['dur']})")
    else:
        try:
            await asyncio.wait_for(ACTIONS[scene["id"]](page, scene["dur"]), timeout=scene["dur"])
        except asyncio.TimeoutError:
            pass
        except Exception as e:  # a missing element must not ruin the take
            print(f"    action note ({scene['id']}): {e}")
    rest = scene["dur"] - (time.monotonic() - start)
    if rest > 0:
        await asyncio.sleep(rest)
    await cdp.send("Page.stopScreencast")
    await asyncio.sleep(0.3)
    await ctx.close()
    if not frames:
        raise RuntimeError(f"no frames for {scene['id']}")

    # Frames arrive only when the screen changes: give each one its real on-screen duration.
    t0 = frames[0][0]
    lines = ["ffconcat version 1.0"]
    for i, (ts, name) in enumerate(frames):
        nxt = frames[i + 1][0] if i + 1 < len(frames) else t0 + scene["dur"]
        lines += [f"file '{name}'", f"duration {max(0.001, nxt - ts):.4f}"]
    lines.append(f"file '{frames[-1][1]}'")
    (frames_dir / "list.ffconcat").write_text("\n".join(lines), encoding="utf-8")
    print(f"  take  {scene['id']:<9} {scene['dur']:5.1f}s  {len(frames)} frames")
    return frames_dir


def encode(scene, frames_dir):
    seg = WORK / f"seg-{scene['id']}.mp4"
    d = scene["dur"]
    fade = 0.35
    run([
        "-f", "concat", "-safe", "0", "-i", str(frames_dir / "list.ffconcat"),
        "-i", scene["audio"],
        "-filter_complex",
        f"[0:v]fps=30,scale=1920:1080:flags=lanczos:in_range=full:out_range=tv,format=yuv420p,fade=t=in:st=0:d={fade},fade=t=out:st={d - fade:.2f}:d={fade}[v];"
        f"[1:a]aresample=48000,adelay={int(LEAD * 1000)}:all=1,apad,atrim=0:{d},afade=t=out:st={d - 0.3:.2f}:d=0.3[a]",
        "-map", "[v]", "-map", "[a]", "-t", f"{d}",
        "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-r", "30",
        "-c:a", "aac", "-b:a", "192k", "-ac", "2",
        str(seg),
    ])
    return seg


def assemble(scenes):
    lst = WORK / "segments.txt"
    lst.write_text("\n".join(f"file '{(WORK / f'seg-{s['id']}.mp4').as_posix()}'" for s in scenes), encoding="utf-8")
    joined = WORK / "joined.mp4"
    run(["-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(joined)])
    # Broadcast loudness (-16 LUFS) so the voice carries in a hall; video is copied untouched.
    final = OUT / "demand-intelligence-pitch.mp4"
    run(["-i", str(joined), "-c:v", "copy", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000",
         "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(final)])
    return final


async def warm_up(browser):
    """Open each live page once so the agent's answers are cached and the pages are compiled."""
    ctx = await browser.new_context(viewport={"width": W, "height": H})
    page = await ctx.new_page()
    for s in SCENES:
        if s["kind"] != "app":
            continue
        await page.goto("about:blank")  # a fresh load, so "#calendar" opens its tab
        await page.goto(APP + s["path"], wait_until="domcontentloaded")
        try:
            await page.wait_for_function(READY[s["id"]], timeout=60_000, polling=500)
            print(f"  warm  {s['id']:<9} ok")
        except Exception as e:
            print(f"  warm  {s['id']:<9} NOT READY: {e}")
    await ctx.close()


async def main(only):
    OUT.mkdir(exist_ok=True)
    WORK.mkdir(exist_ok=True)
    meta_file = WORK / "meta.json"
    print("Voice-over")
    for s in SCENES:
        await narrate(s)
    meta_file.write_text(json.dumps([{k: v for k, v in s.items()} for s in SCENES], indent=1), encoding="utf-8")
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(channel="msedge", headless=True, args=["--hide-scrollbars", "--force-color-profile=srgb"])
        print("Warm-up")
        await warm_up(browser)
        print("Recording")
        for s in SCENES:
            seg = WORK / f"seg-{s['id']}.mp4"
            if only and s["id"] not in only and seg.exists():
                continue
            frames = await record(browser, s)
            encode(s, frames)
        await browser.close()
    final = assemble(SCENES)
    total = sum(s["dur"] for s in SCENES)
    print(f"Done: {final}  ({total / 60:.1f} min)")


if __name__ == "__main__":
    asyncio.run(main(set(sys.argv[1:])))
