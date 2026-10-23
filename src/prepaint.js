/* Synchronous critical styling, before first paint. No network access. */
(() => {
  "use strict";
  if (window.top !== window || location.hostname !== "lms.lums.edu.pk") return;
  // Sakai serves the gateway and Home at / as well as /portal and //portal.
  if (!/^\/+(?:portal(?:\/|$)|$)/.test(location.pathname)) return;
  try {
    const enabled = localStorage.getItem("aether:v02:enabled") !== "false";
    document.documentElement.classList.toggle("aether-enabled", enabled);
  } catch {
    document.documentElement.classList.add("aether-enabled");
  }
  document.documentElement.classList.add("aether-paint-ready");
})();
