/**
 * Behavioural tests for the toolbar (jsdom — no browser needed).
 * The IIFE is re-evaluated per test via resetModules + cache-busting import.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

async function boot(config = {}, { reducedMotion = false } = {}) {
  vi.resetModules(); // re-evaluates the IIFE on the next import
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  document.documentElement.className = "";
  window.A11ybarManual = true;
  window.matchMedia = vi.fn().mockReturnValue({ matches: reducedMotion });
  await import("../src/a11ybar.js");
  window.a11ybar.init(config);
  return document.querySelector(".a11ybar");
}

beforeEach(() => {
  localStorage.clear();
});

describe("toolbar structure (ARIA)", () => {
  it("renders a labelled toolbar", async () => {
    const bar = await boot();
    expect(bar).not.toBeNull();
    expect(bar.getAttribute("role")).toBe("toolbar");
    expect(bar.getAttribute("aria-label")).toBe("Barra de acessibilidade");
  });

  it("every control has an accessible name", async () => {
    const bar = await boot({ vlibras: true });
    const buttons = [...bar.querySelectorAll("button")];
    expect(buttons.length).toBe(8); // A- A+ contrast spacing motion links vlibras reset
    for (const b of buttons) expect(b.getAttribute("aria-label")).toBeTruthy();
  });

  it("uses English strings when configured", async () => {
    const bar = await boot({ lang: "en" });
    expect(bar.getAttribute("aria-label")).toBe("Accessibility toolbar");
  });
});

describe("font scaling", () => {
  it("A+ sets the CSS custom property without any reload", async () => {
    const bar = await boot();
    const inc = bar.querySelector('[aria-label="Aumentar tamanho do texto"]');
    inc.click();
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--a11ybar-font-scale")).toBe("1.15");
    expect(root.classList.contains("a11ybar-font")).toBe(true);
    inc.click();
    expect(root.style.getPropertyValue("--a11ybar-font-scale")).toBe("1.3");
  });

  it("A- never goes below scale 1", async () => {
    const bar = await boot();
    bar.querySelector('[aria-label="Diminuir tamanho do texto"]').click();
    expect(document.documentElement.style.getPropertyValue("--a11ybar-font-scale")).toBe("1");
    expect(document.documentElement.classList.contains("a11ybar-font")).toBe(false);
  });
});

describe("toggles expose state via aria-pressed", () => {
  it("contrast toggles class and aria-pressed together", async () => {
    const bar = await boot();
    const btn = bar.querySelector('[aria-label="Alternar alto contraste"]');
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    btn.click();
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(document.documentElement.classList.contains("a11ybar-contrast")).toBe(true);
    btn.click();
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    expect(document.documentElement.classList.contains("a11ybar-contrast")).toBe(false);
  });
});

describe("persistence (localStorage)", () => {
  it("saves on interaction and restores on next boot", async () => {
    let bar = await boot();
    bar.querySelector('[aria-label="Alternar alto contraste"]').click();
    bar.querySelector('[aria-label="Aumentar tamanho do texto"]').click();

    bar = await boot(); // "reload"
    expect(document.documentElement.classList.contains("a11ybar-contrast")).toBe(true);
    expect(document.documentElement.style.getPropertyValue("--a11ybar-font-scale")).toBe("1.15");
    expect(
      bar.querySelector('[aria-label="Alternar alto contraste"]').getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("reset restores defaults and aria-pressed states", async () => {
    const bar = await boot();
    bar.querySelector('[aria-label="Alternar alto contraste"]').click();
    bar.querySelector('[aria-label="Restaurar configurações padrão"]').click();
    expect(document.documentElement.classList.contains("a11ybar-contrast")).toBe(false);
    expect(
      bar.querySelector('[aria-label="Alternar alto contraste"]').getAttribute("aria-pressed"),
    ).toBe("false");
  });
});

describe("reduced motion (WCAG 2.3.3)", () => {
  it("honours prefers-reduced-motion on first visit", async () => {
    await boot({}, { reducedMotion: true });
    expect(document.documentElement.classList.contains("a11ybar-motion")).toBe(true);
  });

  it("does not force motion-pause when the OS preference is off", async () => {
    await boot({}, { reducedMotion: false });
    expect(document.documentElement.classList.contains("a11ybar-motion")).toBe(false);
  });
});

describe("keyboard navigation (APG toolbar pattern)", () => {
  it("has exactly one tab stop (roving tabindex)", async () => {
    const bar = await boot();
    const stops = [...bar.querySelectorAll("button")].filter((b) => b.tabIndex === 0);
    expect(stops.length).toBe(1);
  });

  it("ArrowRight moves focus and the tab stop", async () => {
    const bar = await boot();
    const buttons = [...bar.querySelectorAll("button")];
    buttons[0].focus();
    bar.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    expect(document.activeElement).toBe(buttons[1]);
    expect(buttons[1].tabIndex).toBe(0);
    expect(buttons[0].tabIndex).toBe(-1);
  });
});
