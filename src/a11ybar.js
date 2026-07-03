/*!
 * a11ybar — zero-dependency accessibility toolbar for the web.
 * Features are mapped to WCAG 2.2, eMAG 3.1 and ABNT NBR 17225:2025.
 * https://github.com/fluiz7/a11ybar — MIT License
 */
(function () {
  "use strict";

  var STORAGE_KEY = "a11ybar:prefs";
  var FONT_STEPS = [1, 1.15, 1.3, 1.5];

  var I18N = {
    "pt-BR": {
      toolbar: "Barra de acessibilidade",
      fontDec: "Diminuir tamanho do texto",
      fontInc: "Aumentar tamanho do texto",
      contrast: "Alternar alto contraste",
      spacing: "Alternar conforto de leitura (espaçamento)",
      motion: "Pausar animações e movimentos",
      links: "Sublinhar todos os links",
      vlibras: "Ativar tradução em Libras (VLibras)",
      reset: "Restaurar configurações padrão"
    },
    en: {
      toolbar: "Accessibility toolbar",
      fontDec: "Decrease text size",
      fontInc: "Increase text size",
      contrast: "Toggle high contrast",
      spacing: "Toggle reading comfort (text spacing)",
      motion: "Pause animations and motion",
      links: "Underline all links",
      vlibras: "Enable Libras translation (VLibras)",
      reset: "Restore default settings"
    }
  };

  /* ------------------------------------------------------------------ */
  /* Styles: injected once. The page-level effects live on <html> classes
     and one CSS custom property, so there is no per-element JS loop and
     no page reload — state flips are O(1). */
  /* ------------------------------------------------------------------ */
  /* selectors excluded from the forced high-contrast palette */
  var NX = ":not(.a11ybar):not(.a11ybar *):not([vw]):not([vw] *)";

  var CSS = [
    /* --- toolbar shell (WCAG 2.5.8/2.5.5: targets >= 44px) --- */
    ".a11ybar{position:fixed;z-index:2147483646;display:flex;gap:4px;padding:6px;",
    "background:#1a1a2e;border-radius:12px;box-shadow:0 4px 14px rgba(0,0,0,.35);}",
    ".a11ybar--top-right{top:12px;right:12px}.a11ybar--bottom-right{bottom:12px;right:12px}",
    ".a11ybar--top-left{top:12px;left:12px}.a11ybar--bottom-left{bottom:12px;left:12px}",
    ".a11ybar button{min-width:44px;min-height:44px;border:2px solid transparent;border-radius:8px;",
    "background:#16213e;color:#fff;font:700 15px/1 system-ui,sans-serif;cursor:pointer;}",
    ".a11ybar button:hover{background:#0f3460}",
    /* WCAG 2.4.7 / 2.4.13: strong, always-visible focus indicator */
    ".a11ybar button:focus-visible{outline:3px solid #ffd166;outline-offset:2px}",
    ".a11ybar button[aria-pressed=\"true\"]{background:#e94560;border-color:#fff}",
    /* --- page effects --- */
    /* font scale: one custom property, rem-based sites follow automatically */
    "html.a11ybar-font{font-size:calc(100% * var(--a11ybar-font-scale,1)) !important}",
    /* high contrast: curated eMAG-style palette (no CSS filter — filters on the
       root break position:fixed widgets like VLibras and wash colours out).
       Black bg + white text (21:1), cyan links (16.7:1), yellow controls/focus
       (19.6:1) — all above WCAG 1.4.6 AAA. Media keeps its real colours. */
    "html.a11ybar-contrast,html.a11ybar-contrast body{background:#000 !important;color:#fff !important}",
    /* NX below: the toolbar itself and the VLibras widget ([vw] subtree) keep
       their own styling — forcing black onto them made VLibras invisible. */
    "html.a11ybar-contrast body *" + NX,
    "{background-color:#000 !important;color:#fff !important;border-color:#fff !important;",
    "box-shadow:none !important;text-shadow:none !important}",
    /* `body a` (not bare `a`) so this outranks the generic rule above */
    "html.a11ybar-contrast body a" + NX + ",html.a11ybar-contrast body a" + NX + " *",
    "{color:#0ff !important;text-decoration:underline !important}",
    "html.a11ybar-contrast body button" + NX + ",html.a11ybar-contrast body input" + NX + ",",
    "html.a11ybar-contrast body select" + NX + ",html.a11ybar-contrast body textarea" + NX,
    "{background:#000 !important;color:#ff0 !important;border:2px solid #ff0 !important}",
    "html.a11ybar-contrast img,html.a11ybar-contrast video{filter:none !important}",
    /* visible focus everywhere while in contrast mode (eMAG focus pattern) */
    "html.a11ybar-contrast :focus-visible{outline:3px solid #ff0 !important;outline-offset:2px}",
    /* reading comfort: WCAG 1.4.12 text-spacing minimums */
    "html.a11ybar-spacing body *{line-height:1.6 !important;letter-spacing:.12em !important;",
    "word-spacing:.16em !important}",
    "html.a11ybar-spacing body p{margin-bottom:2em !important}",
    /* motion pause: freezes CSS animation/transition/smooth-scroll (WCAG 2.2.2 / 2.3.3) */
    "html.a11ybar-motion *,html.a11ybar-motion *::before,html.a11ybar-motion *::after",
    "{animation-play-state:paused !important;transition:none !important;scroll-behavior:auto !important}",
    /* link underline: WCAG 1.4.1 — never rely on colour alone */
    "html.a11ybar-links a{text-decoration:underline !important;text-underline-offset:2px}"
  ].join("");

  /* ------------------------------------------------------------------ */
  /* State                                                                */
  /* ------------------------------------------------------------------ */
  var state = { fontStep: 0, contrast: false, spacing: false, motion: false, links: false };

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        for (var k in state) if (k in saved) state[k] = saved[k];
      }
    } catch (e) { /* private mode etc. — run without persistence */ }
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function applyState() {
    var root = document.documentElement;
    root.style.setProperty("--a11ybar-font-scale", String(FONT_STEPS[state.fontStep]));
    root.classList.toggle("a11ybar-font", state.fontStep > 0);
    root.classList.toggle("a11ybar-contrast", state.contrast);
    root.classList.toggle("a11ybar-spacing", state.spacing);
    root.classList.toggle("a11ybar-motion", state.motion);
    root.classList.toggle("a11ybar-links", state.links);
  }

  /* ------------------------------------------------------------------ */
  /* VLibras (opt-in): loads the official government widget on demand     */
  /* ------------------------------------------------------------------ */
  var vlibrasLoaded = false;
  function loadVLibras() {
    if (vlibrasLoaded) return;
    vlibrasLoaded = true;
    var host = document.createElement("div");
    host.setAttribute("vw", "");
    host.className = "enabled";
    host.innerHTML =
      '<div vw-access-button class="active"></div>' +
      '<div vw-plugin-wrapper><div class="vw-plugin-top-wrapper"></div></div>';
    document.body.appendChild(host);

    /* The official gov.br script is a LOADER that chains the real plugin from a
       CDN, and the real plugin initialises itself by assigning window.onload —
       which has already fired by the time the user clicks. So: poll until the
       real plugin arrives, instantiate the widget, then invoke the plugin's
       onload hook ourselves (it chains any previous handler internally). */
    var s = document.createElement("script");
    s.src = "https://vlibras.gov.br/app/vlibras-plugin.js";
    document.body.appendChild(s);

    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      if (window.VLibras && typeof window.VLibras.Widget === "function") {
        clearInterval(timer);
        new window.VLibras.Widget("https://vlibras.gov.br/app");
        if (typeof window.onload === "function") window.onload();
      } else if (tries > 100) { /* ~20s: CDN unreachable — allow a retry */
        clearInterval(timer);
        vlibrasLoaded = false;
      }
    }, 200);
  }

  /* ------------------------------------------------------------------ */
  /* Toolbar UI (ARIA APG "toolbar" pattern with roving tabindex)         */
  /* ------------------------------------------------------------------ */
  function buildButton(t, opts) {
    var b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-label", t[opts.label]);
    b.title = t[opts.label];
    if (opts.toggle) b.setAttribute("aria-pressed", String(!!opts.pressed()));
    b.textContent = opts.glyph;
    b.addEventListener("click", function () {
      opts.onClick();
      if (opts.toggle) b.setAttribute("aria-pressed", String(!!opts.pressed()));
      applyState();
      saveState();
    });
    return b;
  }

  function build(config) {
    var t = I18N[config.lang] || I18N["pt-BR"];

    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var bar = document.createElement("div");
    bar.className = "a11ybar a11ybar--" + config.position;
    bar.setAttribute("role", "toolbar");
    bar.setAttribute("aria-label", t.toolbar);

    var buttons = [
      { glyph: "A−", label: "fontDec", onClick: function () { state.fontStep = Math.max(0, state.fontStep - 1); } },
      { glyph: "A+", label: "fontInc", onClick: function () { state.fontStep = Math.min(FONT_STEPS.length - 1, state.fontStep + 1); } },
      { glyph: "◐", label: "contrast", toggle: true, pressed: function () { return state.contrast; }, onClick: function () { state.contrast = !state.contrast; } },
      { glyph: "≡", label: "spacing", toggle: true, pressed: function () { return state.spacing; }, onClick: function () { state.spacing = !state.spacing; } },
      { glyph: "⏸", label: "motion", toggle: true, pressed: function () { return state.motion; }, onClick: function () { state.motion = !state.motion; } },
      { glyph: "⎁", label: "links", toggle: true, pressed: function () { return state.links; }, onClick: function () { state.links = !state.links; } }
    ];
    if (config.vlibras) {
      buttons.push({ glyph: "🤟", label: "vlibras", onClick: loadVLibras });
    }
    buttons.push({
      glyph: "↺", label: "reset",
      onClick: function () {
        state = { fontStep: 0, contrast: false, spacing: false, motion: false, links: false };
        Array.prototype.forEach.call(bar.querySelectorAll("[aria-pressed]"), function (el) {
          el.setAttribute("aria-pressed", "false");
        });
      }
    });

    buttons.forEach(function (opts) { bar.appendChild(buildButton(t, opts)); });

    /* roving tabindex: one tab stop; arrows navigate inside the toolbar */
    var items = Array.prototype.slice.call(bar.querySelectorAll("button"));
    items.forEach(function (el, i) { el.tabIndex = i === 0 ? 0 : -1; });
    bar.addEventListener("keydown", function (ev) {
      var idx = items.indexOf(document.activeElement);
      if (idx < 0) return;
      var next = null;
      if (ev.key === "ArrowRight" || ev.key === "ArrowDown") next = (idx + 1) % items.length;
      else if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") next = (idx - 1 + items.length) % items.length;
      else if (ev.key === "Home") next = 0;
      else if (ev.key === "End") next = items.length - 1;
      if (next !== null) {
        ev.preventDefault();
        items[idx].tabIndex = -1;
        items[next].tabIndex = 0;
        items[next].focus();
      }
    });

    document.body.appendChild(bar);
  }

  /* ------------------------------------------------------------------ */
  /* Init                                                                 */
  /* ------------------------------------------------------------------ */
  function init(userConfig) {
    var config = { lang: "pt-BR", position: "bottom-right", vlibras: false };
    var g = userConfig || window.A11ybarConfig || {};
    for (var k in config) if (k in g) config[k] = g[k];

    loadState();
    /* OS-level preference wins on first visit (WCAG 2.3.3) */
    if (!localStorage.getItem(STORAGE_KEY) &&
        window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      state.motion = true;
    }
    applyState();
    build(config);
  }

  window.a11ybar = { init: init, _state: function () { return state; } };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      if (!window.A11ybarManual) init();
    });
  } else if (!window.A11ybarManual) {
    init();
  }
})();
