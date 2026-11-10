// Injected into every recorded page: a chapter tag and burned-in captions, timed to the narration.
// The browser lays out at 1440 x 810 CSS px and renders at device scale 4/3, so frames are 1920 x 1080.
// window.__overlay({ chapter, captions: [{ start, end, text }], lead }) — times in seconds from the call.
window.__overlay = ({ chapter, captions, lead }) => {
  const root = document.createElement("div");
  root.id = "__ov";
  root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;font-family:"DM Sans",system-ui,sans-serif';
  const style = document.createElement("style");
  style.textContent = `
    #__ov .chap{position:absolute;left:48px;bottom:132px;display:flex;align-items:stretch;opacity:0;transform:translateX(-18px);transition:all .7s cubic-bezier(.22,1,.36,1)}
    #__ov .chap.in{opacity:1;transform:none}
    #__ov .chap .n{background:#bb1c3f;color:#fff;font:900 19px/1 Saira,"DM Sans",sans-serif;padding:11px 12px;letter-spacing:.04em}
    #__ov .chap .t{background:#1a1a1a;color:#fff;font:800 16px/1 Saira,"DM Sans",sans-serif;padding:12px 16px;text-transform:uppercase;letter-spacing:.1em}
    #__ov .cap{position:absolute;left:50%;bottom:40px;transform:translateX(-50%);max-width:1120px;width:max-content;
      background:rgb(17 17 17 / .86);color:#fff;font:500 25px/1.35 "DM Sans",system-ui,sans-serif;padding:12px 24px;text-align:center;
      border-left:5px solid #bb1c3f;opacity:0;transition:opacity .25s ease;box-shadow:0 18px 40px -18px rgb(0 0 0 / .5)}
    #__ov .cap.in{opacity:1}
  `;
  root.appendChild(style);
  if (chapter) {
    const c = document.createElement("div");
    c.className = "chap";
    c.innerHTML = `<span class="n">${chapter.n}</span><span class="t">${chapter.t}</span>`;
    root.appendChild(c);
    setTimeout(() => c.classList.add("in"), 300);
  }
  const cap = document.createElement("div");
  cap.className = "cap";
  root.appendChild(cap);
  document.body.appendChild(root);
  for (const s of captions || []) {
    setTimeout(() => {
      cap.textContent = s.text;
      cap.classList.add("in");
    }, (lead + s.start) * 1000);
    setTimeout(() => {
      if (cap.textContent === s.text) cap.classList.remove("in");
    }, (lead + s.end) * 1000);
  }
};

// Smooth, eased scroll that the recorder can await.
window.__scrollTo = (y, ms) =>
  new Promise((resolve) => {
    const from = window.scrollY;
    const to = Math.max(0, Math.min(y, document.documentElement.scrollHeight - window.innerHeight));
    const t0 = performance.now();
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      window.scrollTo(0, from + (to - from) * ease(p));
      if (p < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });

// Document y of an element's top, minus an offset for the sticky header.
window.__yOf = (sel, offset = 110) => {
  const el = document.querySelector(sel);
  if (!el) return window.scrollY;
  return el.getBoundingClientRect().top + window.scrollY - offset;
};
