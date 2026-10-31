/**
 * Regression tests for the fourth adversarial review of PR #1 (review of commit 4badb33).
 * Findings 2 and 3 reproduced against that commit before being fixed. Finding 1 was
 * refuted in Chromium: pause() on a still-loading autoplay element cancels the pending
 * autoplay (HTML "internal pause steps" clear the can-autoplay flag), so stamping it is right.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function load() {
  vi.resetModules();
  await import("../src/a11ybar.js");
}
async function boot({ reducedMotion = false, body = "<p>page</p>" } = {}) {
  delete window.a11ybar;
  document.head.innerHTML = "";
  document.body.innerHTML = body;
  document.documentElement.className = "";
  document.documentElement.removeAttribute("style");
  window.A11ybarManual = true;
  window.matchMedia = vi.fn().mockReturnValue({ matches: reducedMotion });
  await load();
  window.a11ybar.init();
  return document.querySelector(".a11ybar");
}
const btn = (bar, label) => bar.querySelector(`[aria-label="${label}"]`);

let pause;
beforeEach(() => {
  localStorage.clear();
  pause = vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("2. the script included twice", () => {
  it("keeps window.a11ybar bound to the instance that owns the toolbar", async () => {
    const bar = await boot();
    const api = window.a11ybar;
    btn(bar, "Alternar alto contraste").click();
    await load();                                   // the CMS includes it a second time
    expect(window.a11ybar).toBe(api);
    expect(window.a11ybar._state().contrast).toBe(true);
  });

  it("a second copy does not build a second toolbar or double the play listener", async () => {
    await boot({ reducedMotion: true });
    await load();
    window.a11ybar.init();
    expect(document.querySelectorAll(".a11ybar")).toHaveLength(1);
    const v = document.createElement("video");
    v.setAttribute("autoplay", "");
    document.body.appendChild(v);
    pause.mockClear();
    v.dispatchEvent(new Event("play"));
    expect(pause).toHaveBeenCalledTimes(1);
  });
});

describe("3. reset starts a new pause generation", () => {
  const VIDEO = '<video id="v" autoplay controls src="a.mp4"></video>';

  it("with OS reduced motion, reset re-pauses a video the user had resumed", async () => {
    const bar = await boot({ reducedMotion: true, body: VIDEO });
    document.getElementById("v").dispatchEvent(new Event("play"));   // user resumed it
    pause.mockClear();
    btn(bar, "Restaurar configurações padrão").click();
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it("after reset the user can play it again (once per generation)", async () => {
    const bar = await boot({ reducedMotion: true, body: VIDEO });
    btn(bar, "Restaurar configurações padrão").click();
    pause.mockClear();
    document.getElementById("v").dispatchEvent(new Event("play"));
    expect(pause).not.toHaveBeenCalled();
  });

  it("without OS reduced motion, reset leaves media alone", async () => {
    const bar = await boot({ body: VIDEO });
    pause.mockClear();
    btn(bar, "Restaurar configurações padrão").click();
    expect(pause).not.toHaveBeenCalled();
  });

  it("re-init does NOT start a new generation (a permanent player survives navigation)", async () => {
    await boot({ reducedMotion: true, body: VIDEO });
    const v = document.getElementById("v");
    v.dispatchEvent(new Event("play"));                               // user is watching
    document.body.querySelector(".a11ybar").remove();                 // router swaps the page...
    pause.mockClear();
    window.a11ybar.init();                                            // ...the player stays
    expect(pause).not.toHaveBeenCalled();
  });
});
