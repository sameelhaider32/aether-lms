/* Document-local theme coordination. No portal markup, handlers or forms change. */
(() => {
  'use strict';
  if (globalThis.AetherTheme) return;
  const key = 'aether:v16:theme', root = document.documentElement;
  const normalize = value => value === 'monochrome' ? value : 'aether';
  const preview = location.protocol === 'chrome-extension:' && /\/preview\/(pdf|office)\.html$/.test(location.pathname);
  if (preview) root.classList.add('ae-preview-theme');
  let host;
  if (!preview) {
    try {
      if (top.location.origin !== 'https://lms.lums.edu.pk' || !/^\/+(?:portal(?:\/|$)|$)/.test(top.location.pathname)) return;
      host = top.document.documentElement;
    } catch { return; } // Cross-origin tools keep their native appearance.
  }
  let selected = 'aether', revision = 0, observer;
  function apply(value) {
    selected = normalize(value);
    if (root.dataset.aetherTheme !== selected) root.dataset.aetherTheme = selected;
    window.dispatchEvent(new Event('aether-theme-change'));
  }
  function cache(value) { try { localStorage.setItem(key, value); } catch {} }
  function syncFrame() { apply(host.dataset.aetherTheme); }
  function set(value) {
    if (preview || host !== root) return;
    revision++; apply(value); cache(selected);
    try { chrome.storage.local.set({[key]:selected}, () => { void chrome.runtime.lastError; }); } catch {}
  }
  globalThis.AetherTheme = {set, get:() => selected};
  if (host && host !== root) {
    syncFrame();
    observer = new MutationObserver(syncFrame);
    observer.observe(host, {attributes:true, attributeFilter:['data-aether-theme']});
  } else {
    try { selected = normalize(localStorage.getItem(key)); } catch {}
    apply(selected);
    const initialRevision = revision;
    try {
      chrome.storage.local.get([key], values => {
        if (chrome.runtime.lastError || revision !== initialRevision) return;
        if (Object.hasOwn(values, key)) { apply(values[key]); if (!preview) cache(selected); }
      });
    } catch {}
    const changed = (changes, area) => {
      if (area !== 'local' || !Object.hasOwn(changes, key)) return;
      revision++; apply(changes[key].newValue); if (!preview) cache(selected);
    };
    try { chrome.storage.onChanged.addListener(changed); } catch {}
    window.addEventListener('pagehide', event => {
      if (!event.persisted) try { chrome.storage.onChanged.removeListener(changed); } catch {}
    });
  }
  window.addEventListener('pageshow', () => { if (host && host !== root) syncFrame(); });
  window.addEventListener('pagehide', event => { if (!event.persisted) observer?.disconnect(); });
})();
