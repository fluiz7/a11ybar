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
      reset: "Restaurar configurações padrão",
      sizeNow: "Tamanho do texto: ",
      resetDone: "Configurações restauradas",
      vlibrasFail: "Não foi possível carregar o VLibras. Verifique a conexão e tente de novo."
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
      reset: "Restore default settings",
      sizeNow: "Text size: ",
      resetDone: "Settings restored",
      vlibrasFail: "Could not load VLibras. Check your connection and try again."
    }
  };

  /* ------------------------------------------------------------------ */
  /* Styles: injected once. The page-level effects live on <html> classes
     and one CSS custom property, so there is no per-element JS loop and
     no page reload — state flips are O(1). */
  /* ------------------------------------------------------------------ */
  /* Selectors excluded from the forced high-contrast palette: the toolbar
     itself, the VLibras widget (v7 hosts #vlibras-access-wrapper / #vlibras-app-root,
     and the legacy [vw] markup), and anything the page marks with
     data-a11ybar-keep (elements whose colours carry meaning — charts,
     colour swatches, brand marks). */
  /* UI that must keep its own typography and colours: the toolbar and the VLibras widget. */
  var OWN_UI = ":not(.a11ybar):not(.a11ybar *):not([vw]):not([vw] *)" +
               ":not(#vlibras-access-wrapper):not(#vlibras-access-wrapper *)" +
               ":not(#vlibras-app-root):not(#vlibras-app-root *)";
  var NX = OWN_UI + ":not([data-a11ybar-keep]):not([data-a11ybar-keep] *)";

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
    "html.a11ybar-font{font-size:calc(var(--a11ybar-font-base,100%) * var(--a11ybar-font-scale,1)) !important}",
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
    /* NX goes on BOTH the link and its descendants: attached only to `a`, a
       data-a11ybar-keep badge inside a link still matched `a:not(…) *` and turned cyan */
    "html.a11ybar-contrast body a" + NX + ",html.a11ybar-contrast body a " + "*" + NX,
    "{color:#0ff !important;text-decoration:underline !important}",
    "html.a11ybar-contrast body button" + NX + ",html.a11ybar-contrast body input" + NX + ",",
    "html.a11ybar-contrast body select" + NX + ",html.a11ybar-contrast body textarea" + NX,
    "{background-color:#000 !important;color:#ff0 !important;border:2px solid #ff0 !important}",
    "html.a11ybar-contrast img,html.a11ybar-contrast video{filter:none !important}",
    /* visible focus everywhere while in contrast mode (eMAG focus pattern) */
    "html.a11ybar-contrast :focus-visible{outline:3px solid #ff0 !important;outline-offset:2px}",
    /* reading comfort: WCAG 1.4.12 text-spacing minimums */
    /* (OWN_UI: the toolbar's own buttons and the VLibras widget keep their spacing) */
    "html.a11ybar-spacing body *" + OWN_UI + "{line-height:1.6 !important;letter-spacing:.12em !important;",
    "word-spacing:.16em !important}",
    "html.a11ybar-spacing body p" + OWN_UI + "{margin-bottom:2em !important}",
    /* motion pause: freezes CSS animation/transition/smooth-scroll (WCAG 2.2.2 / 2.3.3) */
    "html.a11ybar-motion *,html.a11ybar-motion *::before,html.a11ybar-motion *::after",
    "{animation-play-state:paused !important;transition:none !important;scroll-behavior:auto !important}",
    ".a11ybar-status{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}",
    /* link underline: WCAG 1.4.1 — never rely on colour alone */
    "html.a11ybar-links a{text-decoration:underline !important;text-underline-offset:2px}"
  ].join("");

  /* ------------------------------------------------------------------ */
  /* State                                                                */
  /* ------------------------------------------------------------------ */
  function defaults() {
    return { fontStep: 0, contrast: false, spacing: false, motion: false, links: false };
  }
  var state = defaults();

  /* Every storage access goes through these two. In Safari private mode, sandboxed
     iframes or with site data blocked, merely READING `localStorage` throws — an
     unguarded access anywhere stops the whole toolbar from rendering. */
  function storageGet() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function storageSet(value) {
    try {
      if (value === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, value);
    } catch (e) { /* no persistence available — the toolbar still works */ }
  }

  /* Saved prefs are untrusted input (old versions, manual edits, other scripts):
     accept only valid values, keep the default otherwise. */
  function loadState() {
    var raw = storageGet();
    if (!raw) return false;
    try {
      var saved = JSON.parse(raw) || {};
      var step = saved.fontStep;
      if (typeof step === "number" && step % 1 === 0 && step >= 0 && step < FONT_STEPS.length) state.fontStep = step;
      ["contrast", "spacing", "motion", "links"].forEach(function (k) {
        if (typeof saved[k] === "boolean") state[k] = saved[k];
      });
      return true;
    } catch (e) { return false; }
  }

  function saveState() { storageSet(JSON.stringify(state)); }

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  /* Root font size the SITE intended, measured with our override switched off. Scaling
     multiplies this instead of replacing it: sites using the `html{font-size:62.5%}`
     rem idiom would otherwise jump from 62.5% to 115% (~1.84x) on the first A+. */
  function siteRootFontSize() {
    var root = document.documentElement;
    var had = root.classList.contains("a11ybar-font");
    root.classList.remove("a11ybar-font");
    var size = window.getComputedStyle ? window.getComputedStyle(root).fontSize : "";
    if (had) root.classList.add("a11ybar-font");
    return /^\d+(\.\d+)?px$/.test(size) ? size : "100%";
  }

  function applyState() {
    var root = document.documentElement;
    if (state.fontStep > 0) root.style.setProperty("--a11ybar-font-base", siteRootFontSize());
    root.style.setProperty("--a11ybar-font-scale", String(FONT_STEPS[state.fontStep]));
    root.classList.toggle("a11ybar-font", state.fontStep > 0);
    root.classList.toggle("a11ybar-contrast", state.contrast);
    root.classList.toggle("a11ybar-spacing", state.spacing);
    root.classList.toggle("a11ybar-motion", state.motion);
    root.classList.toggle("a11ybar-links", state.links);
    /* every path that turns motion pause on goes through here: the button, the OS
       preference at boot, saved prefs after a reload, and reset */
    pauseAutoplayMedia();
  }

  /* ------------------------------------------------------------------ */
  /* VLibras (opt-in): loads the official government widget on demand     */
  /* ------------------------------------------------------------------ */
  var VLIBRAS_SRC = "https://vlibras.gov.br/app/vlibras-plugin.js";
  var vlibrasLoading = false;

  /* Current official plugin (v7, served via redirect to jsDelivr) builds its own widget:
     it initialises on DOMContentLoaded / a 50 ms timer, renders into its own
     #vlibras-access-wrapper (shadow DOM) and exposes window.VLibrasWidget.open().
     So: no legacy <div vw> markup, and NO call to window.onload — in v7 that handler
     belongs to the host page, and calling it re-ran the page's own load logic.
     One click on our button opens the Libras app directly. */
  function openVLibras(onFail) {
    if (window.VLibrasWidget && typeof window.VLibrasWidget.open === "function") {
      window.VLibrasWidget.open();
      return;
    }
    if (vlibrasLoading) return;
    vlibrasLoading = true;

    var s = document.createElement("script");
    s.src = VLIBRAS_SRC;
    /* every failure path releases the lock AND removes the failed tag, so a retry
       starts clean instead of piling <script> elements into the page */
    function fail() {
      vlibrasLoading = false;
      if (s.parentNode) s.parentNode.removeChild(s);
      onFail();
    }
    s.onerror = fail;
    s.onload = function () {
      try {
        if (window.VLibras && typeof window.VLibras.Widget === "function") {
          new window.VLibras.Widget("https://vlibras.gov.br/app"); /* idempotent in v7 */
        }
      } catch (e) {
        fail(); /* a throwing plugin must not leave the button locked forever */
        return;
      }
      var tries = 0;
      var timer = setInterval(function () {
        tries += 1;
        if (window.VLibrasWidget && typeof window.VLibrasWidget.open === "function") {
          clearInterval(timer);
          vlibrasLoading = false;
          window.VLibrasWidget.open();
        } else if (tries > 50) { /* ~5 s: unexpected plugin API — allow a retry */
          clearInterval(timer);
          fail();
        }
      }, 100);
    };
    document.body.appendChild(s);
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
      if (opts.label === "reset") storageSet(null); /* forget prefs: next visit = first visit */
      else if (opts.label !== "vlibras") saveState();
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

    /* Polite live region: changes with no visible state of their own (text size, reset,
       a failed VLibras load) are announced to screen-reader users. Toggles already
       expose aria-pressed, so they are not repeated here. */
    var status = document.createElement("div");
    status.className = "a11ybar-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    function announce(msg) {
      status.textContent = "";
      setTimeout(function () { status.textContent = msg; }, 50); /* re-announce identical text */
    }
    function announceSize() {
      announce(t.sizeNow + Math.round(FONT_STEPS[state.fontStep] * 100) + "%");
    }

    var buttons = [
      { glyph: "A−", label: "fontDec", onClick: function () { state.fontStep = Math.max(0, state.fontStep - 1); announceSize(); } },
      { glyph: "A+", label: "fontInc", onClick: function () { state.fontStep = Math.min(FONT_STEPS.length - 1, state.fontStep + 1); announceSize(); } },
      { glyph: "◐", label: "contrast", toggle: true, pressed: function () { return state.contrast; }, onClick: function () { state.contrast = !state.contrast; } },
      { glyph: "≡", label: "spacing", toggle: true, pressed: function () { return state.spacing; }, onClick: function () { state.spacing = !state.spacing; } },
      { glyph: "⏸", label: "motion", toggle: true, pressed: function () { return state.motion; }, onClick: function () { state.motion = !state.motion; } },
      { glyph: "⎁", label: "links", toggle: true, pressed: function () { return state.links; }, onClick: function () { state.links = !state.links; } }
    ];
    if (config.vlibras) {
      buttons.push({ glyph: "🤟", label: "vlibras", onClick: function () {
        openVLibras(function () { announce(t.vlibrasFail); });
      } });
    }
    buttons.push({
      glyph: "↺", label: "reset",
      onClick: function () {
        state = defaults();
        /* "default" includes the OS preference: a user who asked the system for reduced
           motion must not get animations back by pressing reset (WCAG 2.3.3) */
        state.motion = prefersReducedMotion();
        syncPressed();
        announce(t.resetDone);
      }
    });

    var built = buttons.map(function (opts) { var b = buildButton(t, opts); bar.appendChild(b); return { el: b, opts: opts }; });
    function syncPressed() {
      built.forEach(function (x) { if (x.opts.toggle) x.el.setAttribute("aria-pressed", String(!!x.opts.pressed())); });
    }

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

    bar.appendChild(status);
    /* First node of <body>: it stays visually fixed in its corner, but in the Tab order it
       comes first — as the eMAG accessibility bar does — instead of after the whole page. */
    document.body.insertBefore(bar, document.body.firstChild);
  }

  /* CSS can freeze animations but not media: pause playing autoplay video/audio too (WCAG 2.2.2). */
  function pauseAutoplayMedia() {
    if (!state.motion) return;
    Array.prototype.forEach.call(document.querySelectorAll("video[autoplay], audio[autoplay]"), function (m) {
      try { m.pause(); } catch (e) { /* not supported */ }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Init                                                                 */
  /* ------------------------------------------------------------------ */
  var POSITIONS = ["top-right", "top-left", "bottom-right", "bottom-left"];

  function init(userConfig) {
    var config = { lang: "pt-BR", position: "bottom-right", vlibras: false };
    var g = userConfig || window.A11ybarConfig || {};
    for (var k in config) if (k in g) config[k] = g[k];
    /* config is input too: an unknown position (e.g. "top") has no CSS rule, and a
       position:fixed bar with no coordinates lands over the top of the page */
    if (POSITIONS.indexOf(config.position) < 0) config.position = "bottom-right";
    if (!I18N[config.lang]) config.lang = "pt-BR";
    config.vlibras = config.vlibras === true;

    /* Idempotent: a CMS that includes the script twice, or a manual init() on top of
       the automatic one, must not produce two toolbars. */
    if (document.querySelector(".a11ybar")) return;

    /* OS-level preference wins on first visit (WCAG 2.3.3) */
    if (!loadState() && prefersReducedMotion()) state.motion = true;
    applyState();
    build(config);
    var bar = document.querySelector(".a11ybar");

    /* media that starts AFTER boot (autoplay racing init, players injected by an SPA):
       `play` doesn't bubble, so listen in the capture phase. The listener acts only
       while ITS toolbar is on the page, so a removed instance never interferes. */
    document.addEventListener("play", function (ev) {
      var m = ev.target;
      if (bar && bar.isConnected && state.motion && m && m.hasAttribute && m.hasAttribute("autoplay")) {
        try { m.pause(); } catch (e) { /* not supported */ }
      }
    }, true);
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
