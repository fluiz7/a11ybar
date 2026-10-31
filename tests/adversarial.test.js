/**
 * Regression tests from an adversarial review (and a real-browser check of the
 * current VLibras plugin, v7). Each test pins a failure that existed before.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function boot(config = {}, { reducedMotion = false } = {}) {
  vi.resetModules();
  delete window.a11ybar; // each boot is a fresh page (a second copy defers to the first)
  document.head.innerHTML = "";
  document.body.innerHTML = "<p>page content</p>";
  document.documentElement.className = "";
  document.documentElement.removeAttribute("style");
  window.A11ybarManual = true;
  window.matchMedia = vi.fn().mockReturnValue({ matches: reducedMotion });
  await import("../src/a11ybar.js");
  window.a11ybar.init(config);
  return document.querySelector(".a11ybar");
}

const btn = (bar, label) => bar.querySelector(`[aria-label="${label}"]`);

beforeEach(() => {
  localStorage.clear();
  delete window.VLibras;
  delete window.VLibrasWidget;
  window.onload = null;
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("storage", () => {
  it("renders even when merely reading localStorage throws (Safari private, sandboxed iframe)", async () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    const bar = await boot();
    expect(bar).not.toBeNull();
    btn(bar, "Alternar alto contraste").click(); // and keeps working without persistence
    expect(document.documentElement.classList.contains("a11ybar-contrast")).toBe(true);
  });

  it("ignores corrupted or tampered preferences", async () => {
    localStorage.setItem("a11ybar:prefs", JSON.stringify({ fontStep: 99, contrast: "sim", links: true }));
    await boot();
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--a11ybar-font-scale")).toBe("1");
    expect(root.classList.contains("a11ybar-contrast")).toBe(false); // "sim" is not a boolean
    expect(root.classList.contains("a11ybar-links")).toBe(true);     // valid values still load
  });

  it("survives invalid JSON in storage", async () => {
    localStorage.setItem("a11ybar:prefs", "{not json");
    expect(await boot()).not.toBeNull();
  });
});

describe("initialisation", () => {
  it("init twice (script included twice) renders a single toolbar", async () => {
    await boot();
    window.a11ybar.init();
    expect(document.querySelectorAll(".a11ybar")).toHaveLength(1);
  });

  it("is the first node of <body>, so it is the first Tab stop (eMAG)", async () => {
    const bar = await boot();
    expect(document.body.firstElementChild).toBe(bar);
  });
});

describe("reset", () => {
  it("keeps the OS reduced-motion preference (WCAG 2.3.3)", async () => {
    const bar = await boot({}, { reducedMotion: true });
    btn(bar, "Restaurar configurações padrão").click();
    expect(document.documentElement.classList.contains("a11ybar-motion")).toBe(true);
    expect(btn(bar, "Pausar animações e movimentos").getAttribute("aria-pressed")).toBe("true");
  });

  it("forgets stored prefs instead of persisting defaults", async () => {
    const bar = await boot();
    btn(bar, "Alternar alto contraste").click();
    expect(localStorage.getItem("a11ybar:prefs")).not.toBeNull();
    btn(bar, "Restaurar configurações padrão").click();
    expect(localStorage.getItem("a11ybar:prefs")).toBeNull();
  });
});

describe("screen-reader announcements", () => {
  it("announces the text size, which has no visible state of its own", async () => {
    vi.useFakeTimers();
    const bar = await boot();
    btn(bar, "Aumentar tamanho do texto").click();
    vi.advanceTimersByTime(60);
    const status = bar.querySelector('[role="status"]');
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toBe("Tamanho do texto: 115%");
  });
});

describe("font scaling respects the site's own root size", () => {
  it("multiplies the site's root font size instead of replacing it (html{font-size:62.5%})", async () => {
    const real = window.getComputedStyle;
    vi.spyOn(window, "getComputedStyle").mockImplementation((el) =>
      el === document.documentElement ? { fontSize: "10px" } : real(el),
    );
    const bar = await boot();
    btn(bar, "Aumentar tamanho do texto").click();
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--a11ybar-font-base")).toBe("10px");
    const css = [...document.head.querySelectorAll("style")].map((s) => s.textContent).join("");
    expect(css).toContain("calc(var(--a11ybar-font-base,100%) * var(--a11ybar-font-scale,1))");
  });
});

describe("contrast palette", () => {
  it("does not use the `background` shorthand on controls (it erased icon background-images)", async () => {
    await boot();
    const css = [...document.head.querySelectorAll("style")].map((s) => s.textContent).join("");
    expect(css).not.toMatch(/textarea[^{]*\{background:#000/);
    expect(css).toContain("background-color:#000 !important;color:#ff0");
  });

  it("excludes the VLibras v7 hosts as well as the legacy [vw] markup", async () => {
    await boot();
    const css = [...document.head.querySelectorAll("style")].map((s) => s.textContent).join("");
    expect(css).toContain(":not(#vlibras-access-wrapper)");
    expect(css).toContain(":not(#vlibras-app-root)");
    expect(css).toContain(":not([vw])");
  });
});

describe("motion pause also pauses autoplaying media (WCAG 2.2.2)", () => {
  it("pauses <video autoplay>", async () => {
    const pause = vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    const bar = await boot();
    const v = document.createElement("video");
    v.setAttribute("autoplay", "");
    document.body.appendChild(v);
    btn(bar, "Pausar animações e movimentos").click();
    expect(pause).toHaveBeenCalledTimes(1);
  });
});

describe("VLibras (official plugin v7)", () => {
  const VL = "Ativar tradução em Libras (VLibras)";

  it("never calls the host page's window.onload, and opens Libras directly", async () => {
    const pageOnload = vi.fn();
    window.onload = pageOnload;                    // the page's own handler
    const open = vi.fn();
    window.VLibrasWidget = { open };               // plugin already on the page
    const bar = await boot({ vlibras: true });
    btn(bar, VL).click();
    expect(open).toHaveBeenCalledTimes(1);
    expect(pageOnload).not.toHaveBeenCalled();
  });

  it("loads the plugin, then opens it once its API appears — still without touching onload", async () => {
    vi.useFakeTimers();
    const pageOnload = vi.fn();
    window.onload = pageOnload;
    const bar = await boot({ vlibras: true });
    btn(bar, VL).click();

    const script = [...document.scripts].find((s) => /vlibras-plugin\.js$/.test(s.src));
    expect(script).toBeTruthy();
    expect(document.querySelector("[vw]")).toBeNull(); // no dead legacy markup

    const open = vi.fn();
    window.VLibras = { Widget: function () { window.VLibrasWidget = { open }; } }; // v7 shape
    script.onload();
    vi.advanceTimersByTime(150);
    expect(open).toHaveBeenCalledTimes(1);
    expect(pageOnload).not.toHaveBeenCalled();
  });

  it("announces a failure when the plugin cannot be loaded, and allows a retry", async () => {
    vi.useFakeTimers();
    const bar = await boot({ vlibras: true });
    btn(bar, VL).click();
    const first = [...document.scripts].filter((s) => /vlibras/.test(s.src));
    first[0].onerror();
    vi.advanceTimersByTime(60);
    expect(bar.querySelector('[role="status"]').textContent).toMatch(/Não foi possível carregar o VLibras/);
    btn(bar, VL).click(); // retry is allowed...
    const now = [...document.scripts].filter((s) => /vlibras/.test(s.src));
    expect(now).toHaveLength(1);         // ...and the failed tag was removed, not piled up
    expect(now[0]).not.toBe(first[0]);   // it is a fresh attempt
  });
});
