(() => {
  const host = window.location.hostname;
  const isLocalhost =
    host === "localhost" || host === "127.0.0.1" || host === "::1";
  const defaultMode = isLocalhost ? "node" : "browser";
  window.__PLAYGROUND_MODE = window.__PLAYGROUND_MODE || defaultMode;
  window.__PAGYRA_FONT_BASE =
    window.__PAGYRA_FONT_BASE || new URL("./assets/fonts/", window.location.href).toString();
})();
