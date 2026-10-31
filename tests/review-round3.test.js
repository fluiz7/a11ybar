/**
 * Regression tests for the third adversarial review of PR #1 (review of commit 63e7622).
 * Every case reproduced against that commit before being fixed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function boot(config = {}, { reducedMotion = false, body = "<p>page</p>" } = {}) {
  vi.resetModules();
  delete window.a11ybar; // each boot is a fresh page (a second copy defers to the first)
  document.head.innerHTML = "";
  document.body.innerHTML = body;
  document.documentElement.className = "";
  document.documentElement.removeAttribute("style");
  window.A11ybarManual = true;
  window.matchMedia = vi.fn().mockReturnValue({ matches: reducedMotion });
  await import("../src/a11ybar.js");
  window.a11ybar.init(config);
  return document.querySelector(".a11ybar");
}
const btn = (bar, label) => bar.querySelector(`[aria-label="${label}"]`);
const MOTION = "Pausar animações e movimentos";
const VIDEO = '<video id="v" autoplay controls src="a.mp4"></video>';

let pause;
beforeEach(() => {
  localStorage.clear();
  pause = vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("1. motion pause stops autoplay ONCE — the user's own Play is honoured", () => {
  it("the user can play an autoplay video after the toolbar paused it", async () => {
    await boot({}, { reducedMotion: true, body: VIDEO });
    expect(pause).toHaveBeenCalledTimes(1);         // paused at boot
    document.getElementById("v").dispatchEvent(new Event("play")); // user presses ▶
    expect(pause).toHaveBeenCalledTimes(1);         // ...and it keeps playing
  });

  it("other clicks on the toolbar don't re-pause a video the user resumed", async () => {
    const bar = await boot({}, { reducedMotion: true, body: VIDEO });
    document.getElementById("v").dispatchEvent(new Event("play"));
    pause.mockClear();
    btn(bar, "Alternar alto contraste").click();    // applyState() runs again
    expect(pause).not.toHaveBeenCalled();
  });

  it("turning motion pause off and on again is an explicit choice: it re-pauses", async () => {
    const bar = await boot({}, { reducedMotion: true, body: VIDEO });
    document.getElementById("v").dispatchEvent(new Event("play"));
    btn(bar, MOTION).click();                       // off
    pause.mockClear();
    btn(bar, MOTION).click();                       // on again
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it("a late autoplay video is paused once, then the user may play it", async () => {
    await boot({}, { reducedMotion: true });
    const v = document.createElement("video");
    v.setAttribute("autoplay", "");
    document.body.appendChild(v);
    pause.mockClear();
    v.dispatchEvent(new Event("play"));            // it starts by itself -> paused
    v.dispatchEvent(new Event("play"));            // the user plays it -> allowed
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it("a play with real user activation is honoured even the first time", async () => {
    await boot({}, { reducedMotion: true });
    const v = document.createElement("video");
    v.setAttribute("autoplay", "");
    document.body.appendChild(v);
    pause.mockClear();
    Object.defineProperty(navigator, "userActivation", { value: { isActive: true }, configurable: true });
    try {
      v.dispatchEvent(new Event("play"));
      expect(pause).not.toHaveBeenCalled();
    } finally {
      delete navigator.userActivation;
    }
  });
});

describe("2. re-init after the <body> is swapped (SPA, Turbo, HTMX)", () => {
  it("does not inject the stylesheet twice", async () => {
    await boot();
    document.body.innerHTML = "<p>next page</p>";   // router swaps the body, keeps <head>
    window.a11ybar.init();
    expect(document.querySelectorAll("style[data-a11ybar-style]")).toHaveLength(1);
    expect(document.querySelector(".a11ybar")).not.toBeNull();
  });

  it("starts from a clean state when storage is blocked", async () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    const bar = await boot();
    btn(bar, "Alternar alto contraste").click();
    document.body.innerHTML = "<p>next page</p>";
    window.a11ybar.init();
    expect(window.a11ybar._state().contrast).toBe(false);
  });

  it("restores saved prefs on re-init when storage works", async () => {
    const bar = await boot();
    btn(bar, "Alternar alto contraste").click();
    document.body.innerHTML = "<p>next page</p>";
    window.a11ybar.init();
    expect(window.a11ybar._state().contrast).toBe(true);
  });

  it("keeps a single play listener across re-inits", async () => {
    await boot({}, { reducedMotion: true });
    for (let i = 0; i < 3; i++) {
      document.body.innerHTML = "<p>next page</p>";
      window.a11ybar.init();
    }
    const v = document.createElement("video");
    v.setAttribute("autoplay", "");
    document.body.appendChild(v);
    pause.mockClear();
    v.dispatchEvent(new Event("play"));
    expect(pause).toHaveBeenCalledTimes(1);
  });
});
