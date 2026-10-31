/**
 * Regression tests for the second adversarial review of PR #1 (the author's own review).
 * Every case reproduced against the PR branch before being fixed.
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
const css = () => [...document.head.querySelectorAll("style")].map((s) => s.textContent).join("");
const rule = (needle) => css().split("}").find((r) => r.includes(needle));

let pause;
beforeEach(() => {
  localStorage.clear();
  delete window.VLibras;
  delete window.VLibrasWidget;
  pause = vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const VIDEO = '<video autoplay src="a.mp4"></video>';

describe("1. autoplay media is paused on every path that enables motion pause", () => {
  it("at boot, when the OS asks for reduced motion", async () => {
    await boot({}, { reducedMotion: true, body: VIDEO });
    expect(pause).toHaveBeenCalled();
  });

  it("after a reload with motion pause saved", async () => {
    localStorage.setItem("a11ybar:prefs", JSON.stringify({ motion: true }));
    await boot({}, { body: VIDEO });
    expect(pause).toHaveBeenCalled();
  });

  it("after reset, when the OS asks for reduced motion and the user had turned pause off", async () => {
    // (round 3: pausing is once per element; reset re-pauses when it turns pause back ON)
    const bar = await boot({}, { reducedMotion: true, body: VIDEO });
    btn(bar, "Pausar animações e movimentos").click();   // user turns motion pause off
    pause.mockClear();
    btn(bar, "Restaurar configurações padrão").click();  // reset -> OS preference -> on again
    expect(pause).toHaveBeenCalled();
  });

  it("for media that starts playing after boot (SPA, autoplay racing init)", async () => {
    await boot({}, { reducedMotion: true });
    pause.mockClear();
    const v = document.createElement("video");
    v.setAttribute("autoplay", "");
    document.body.appendChild(v);
    v.dispatchEvent(new Event("play"));
    expect(pause).toHaveBeenCalledTimes(1);   // only the live instance reacts
  });

  it("late media is left alone when motion pause is off", async () => {
    await boot();
    pause.mockClear();
    const v = document.createElement("video");
    v.setAttribute("autoplay", "");
    document.body.appendChild(v);
    v.dispatchEvent(new Event("play"));
    expect(pause).not.toHaveBeenCalled();
  });

  it("does not pause anything when motion pause is off", async () => {
    await boot({}, { body: VIDEO });
    expect(pause).not.toHaveBeenCalled();
  });
});

describe("2-3. contrast exclusions", () => {
  it("excludes data-a11ybar-keep on link DESCENDANTS, not only on the link", () => {
    return boot().then(() => {
      const r = rule("color:#0ff");
      // the descendant selector must carry the exclusion on `*`, not on `a`
      expect(r).toMatch(/body a \*:not\(\.a11ybar\)/);
      expect(r).not.toMatch(/body a:not\([^{]*\) \*/);
    });
  });

  it("excludes the children of #vlibras-access-wrapper, not only the wrapper", async () => {
    await boot();
    expect(rule("background-color:#000 !important;color:#fff")).toContain(":not(#vlibras-access-wrapper *)");
  });
});

describe("4. reading comfort leaves the toolbar and VLibras alone", () => {
  it("text-spacing rules exclude the toolbar and the widget", async () => {
    await boot();
    const r = rule("letter-spacing:.12em");
    expect(r).toContain(":not(.a11ybar *)");
    expect(r).toContain(":not(#vlibras-app-root *)");
    expect(rule("margin-bottom:2em")).toContain(":not(.a11ybar *)");
  });
});

describe("5. VLibras failure paths", () => {
  const VL = "Ativar tradução em Libras (VLibras)";
  const vscripts = () => [...document.scripts].filter((s) => /vlibras/.test(s.src));

  it("a throwing plugin does not lock the button forever", async () => {
    vi.useFakeTimers();
    const bar = await boot({ vlibras: true });
    btn(bar, VL).click();
    const first = vscripts()[0];
    window.VLibras = { Widget() { throw new Error("broken plugin"); } };
    first.onload();
    vi.advanceTimersByTime(60);
    expect(bar.querySelector('[role="status"]').textContent).toMatch(/Não foi possível carregar o VLibras/);
    btn(bar, VL).click();                    // the lock was released: a new attempt starts
    expect(vscripts()).toHaveLength(1);
    expect(vscripts()[0]).not.toBe(first);
  });

  it("repeated network failures leave no orphan <script> tags", async () => {
    const bar = await boot({ vlibras: true });
    for (let i = 0; i < 3; i++) {
      btn(bar, VL).click();
      vscripts()[0].onerror();
    }
    expect(vscripts()).toHaveLength(0);
  });

  it("an unexpected plugin API times out, unlocks and cleans up", async () => {
    vi.useFakeTimers();
    const bar = await boot({ vlibras: true });
    btn(bar, VL).click();
    window.VLibras = { Widget() {} };        // loads, but never exposes VLibrasWidget.open
    vscripts()[0].onload();
    vi.advanceTimersByTime(6000);
    expect(vscripts()).toHaveLength(0);
  });
});

describe("6. config is validated like saved prefs", () => {
  it.each([["top"], ["center"], [""], [42]])("unknown position %j falls back to bottom-right", async (position) => {
    const bar = await boot({ position });
    expect(bar.className).toBe("a11ybar a11ybar--bottom-right");
  });

  it("valid positions are kept", async () => {
    expect((await boot({ position: "top-left" })).className).toBe("a11ybar a11ybar--top-left");
  });

  it("unknown lang falls back to pt-BR", async () => {
    expect((await boot({ lang: "fr" })).getAttribute("aria-label")).toBe("Barra de acessibilidade");
  });

  it('vlibras must be literally true ("false" as a string is not truthy here)', async () => {
    const bar = await boot({ vlibras: "false" });
    expect(btn(bar, "Ativar tradução em Libras (VLibras)")).toBeNull();
  });
});
