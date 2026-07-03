# a11ybar

> A **zero-dependency accessibility toolbar** you can drop into any website with one `<script>` tag: text scaling, high contrast, reading comfort, motion pause, link underlining and optional **VLibras** (Brazilian Sign Language) — every feature mapped to **WCAG 2.2, eMAG 3.1 and ABNT NBR 17225:2025**.

![JavaScript](https://img.shields.io/badge/JavaScript-vanilla%2C%20zero%20deps-F7DF1E?style=flat&logo=javascript&logoColor=black)
![WCAG 2.2](https://img.shields.io/badge/WCAG-2.2-005A9C?style=flat)
![eMAG 3.1](https://img.shields.io/badge/eMAG-3.1-1351B4?style=flat)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

Born from real accessibility-audit work at **UFRJ** (EMAR — student monitors for digital accessibility, DIRAC): auditing a public-sector website, we kept finding the same anti-patterns in "accessibility menu" plugins — font resizing that loops over every DOM node and then **reloads the page**, contrast buttons **without accessible names**, keyboard shortcuts that scroll the view but **never move focus**. a11ybar is the native, standards-first alternative we wished existed.

## Quickstart

```html
<script>
  window.A11ybarConfig = { lang: "pt-BR", position: "bottom-right", vlibras: true };
</script>
<script src="a11ybar.js"></script>
```

That's it — no build step, no framework, no CSS file. **[Try the live demo →](https://fluiz7.github.io/a11ybar/demo/)**

## Features → standards map

| Button | What it does | Grounded in |
|---|---|---|
| `A−` / `A+` | Text scaling via **one CSS custom property** on `:root` (no per-element loop, no reload) | WCAG **1.4.4** Resize Text · eMAG rec. 28 |
| ◐ | High contrast (full-page inversion; images/video re-inverted back) | WCAG **1.4.3/1.4.6** Contrast · eMAG 4.1 |
| ≡ | Reading comfort: applies the WCAG text-spacing minimums (line 1.5+, letter .12em, word .16em) | WCAG **1.4.12** Text Spacing · dyslexia guidance |
| ⏸ | Pauses all CSS animations/transitions/smooth-scroll | WCAG **2.2.2** Pause, Stop, Hide · **2.3.3** Animation from Interactions · GAIA (autism) |
| ⎁ | Underlines every link — colour is never the only cue | WCAG **1.4.1** Use of Color |
| 🤟 | Loads the official [VLibras](https://vlibras.gov.br) widget on demand (opt-in) | Lei 13.146/2015 (LBI) · eMAG |
| ↺ | Restores defaults | — |

**The toolbar itself is accessible** — that's the point:

- `role="toolbar"` with a proper `aria-label`, following the [ARIA APG toolbar pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/) (roving tabindex: ←/→/Home/End navigate, one Tab stop).
- Every toggle exposes **`aria-pressed`** state; every button has an accessible name.
- Targets are **≥ 44×44 px** (WCAG 2.5.5/2.5.8) with a strong `:focus-visible` indicator (WCAG 2.4.7).
- State changes are **O(1) class flips** on `<html>` — no page reload, scroll position preserved.
- Preferences persist in `localStorage`; on first visit, **`prefers-reduced-motion` is honoured** automatically (WCAG 2.3.3).

## Configuration

```js
window.A11ybarConfig = {
  lang: "pt-BR",          // "pt-BR" | "en"
  position: "bottom-right", // top-right | top-left | bottom-right | bottom-left
  vlibras: false           // show the VLibras (Libras translation) button
};
// manual mode: set window.A11ybarManual = true and call a11ybar.init(config) yourself
```

Elements that should **not** be re-inverted in contrast mode (e.g. an already-dark logo) can opt out with `data-a11ybar-noinvert`.

## Limitations (honest ones)

- Text scaling follows sites that size text in `rem`/`%` (best practice); fixed `px` typography won't scale — that's a bug in the page, and a11ybar won't paper over it with DOM-walking hacks.
- High contrast uses inversion for universality; a curated palette per-site is always superior when you control the CSS.
- VLibras loads an external government script — hence opt-in.

## Roadmap

- Unit tests (jsdom) + CI
- npm package + CDN build
- Sister project: an **eMAG/ABNT-aware audit CLI** that generates instructional reports in the format Brazilian public institutions actually need.

## License

[MIT](LICENSE) — © Luiz Felipe Cantanhede Cristino.
