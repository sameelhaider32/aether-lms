/* MAIN world: presentation on Sakai's existing Chart.js 2 instances only.
   No extension APIs, academic-data copying, messaging, or network access. */
(() => {
  'use strict';
  let host;
  try {
    if (location.origin !== 'https://lms.lums.edu.pk' || top.location.origin !== location.origin ||
        !/^\/+(?:portal(?:\/|$)|$)/.test(top.location.pathname)) return;
    host = top.document.documentElement;
  } catch { return; }
  const context = 'html.ae-academic-surface:has([class*="Mrphs-sakai-gradebook"],#gradeSummaryTable)';
  const surface = '.wicket-modal:has(canvas) .w_content_1:has(canvas),.gb-modal-dialog:has(> .gb-modal-content > canvas)';
  const originals = new WeakMap();
  let library = null, queued = false, disposed = false;
  const active = chart => host.classList.contains('aether-enabled') &&
    document.documentElement.matches(context) && chart.canvas?.isConnected && chart.canvas.closest(surface);
  const color = value => typeof value === 'string' ?
    ({'#15597e':'#329d79', '#5bc0de':'#9df8d6'}[value.toLowerCase()] || value) : value;

  function restore(chart) {
    const records = originals.get(chart);
    if (!records) return false;
    for (const [object, fields] of records) for (const [key, saved] of fields) {
      // A later Sakai write takes precedence over an older theme snapshot.
      if (object[key] !== saved.applied) continue;
      if (saved.own) object[key] = saved.value;
      else delete object[key];
    }
    originals.delete(chart);
    return true;
  }
  function theme(chart) {
    if (!active(chart)) return restore(chart);
    let records = originals.get(chart), changed = false;
    if (!records) { records = new Map(); originals.set(chart, records); }
    function set(object, key, value) {
      if (!object || object[key] === value) return;
      let fields = records.get(object);
      if (!fields) { fields = new Map(); records.set(object, fields); }
      let saved = fields.get(key);
      if (!saved || object[key] !== saved.applied) {
        saved = {own:Object.hasOwn(object, key), value:object[key]};
        fields.set(key, saved);
      }
      saved.applied = value; object[key] = value; changed = true;
    }
    for (const dataset of chart.data?.datasets || []) {
      for (const key of ['backgroundColor', 'hoverBackgroundColor']) {
        const value = dataset[key];
        if (Array.isArray(value)) {
          const mapped = value.map(color);
          if (mapped.some((v, i) => v !== value[i])) set(dataset, key, mapped);
        } else set(dataset, key, color(value));
      }
    }
    const options = chart.options;
    set(options?.title, 'fontColor', '#9df8d6');
    for (const axis of [...(options?.scales?.xAxes || []), ...(options?.scales?.yAxes || [])]) {
      set(axis.ticks, 'fontColor', '#a7cfbd');
      set(axis.scaleLabel, 'fontColor', '#9df8d6');
      set(axis.gridLines, 'color', 'rgba(88,143,116,0.14)');
      set(axis.gridLines, 'zeroLineColor', 'rgba(88,143,116,0.14)');
    }
    return changed;
  }
  // Chart.js 2.7 calls beforeUpdate for construction and renderChartData().
  // Never call update from this hook, replace Chart, or patch its prototypes.
  const plugin = {
    id:'aether-gradebook-colors',
    beforeUpdate(chart) { theme(chart); },
    destroy(chart) { originals.delete(chart); }
  };
  function refresh() {
    queued = false;
    if (disposed) return;
    const Chart = window.Chart;
    if (!Chart?.plugins?.register || !Chart.instances) return;
    if (library !== Chart) {
      library?.plugins.unregister(plugin);
      library = Chart; library.plugins.register(plugin);
    }
    for (const chart of Object.values(Chart.instances)) {
      if (theme(chart) && chart.canvas) chart.update(0);
    }
  }
  function schedule() {
    if (!queued && !disposed) { queued = true; queueMicrotask(refresh); }
  }
  const state = new MutationObserver(schedule);
  state.observe(host, {attributes:true, attributeFilter:['class']});
  if (document.documentElement !== host) state.observe(document.documentElement, {attributes:true, attributeFilter:['class']});
  const dom = new MutationObserver(records => {
    if (records.some(r => r.target.closest?.(surface) || [...r.addedNodes, ...r.removedNodes].some(n =>
      n.nodeType === 1 && (n.matches('canvas,script') || n.querySelector('canvas,script'))))) schedule();
  });
  dom.observe(document, {childList:true, subtree:true});
  function loaded(event) { if (event.target.tagName === 'SCRIPT') schedule(); }
  document.addEventListener('load', loaded, true);
  window.addEventListener('pageshow', schedule);
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    disposed = true; state.disconnect(); dom.disconnect();
    library?.plugins.unregister(plugin);
    document.removeEventListener('load', loaded, true);
    window.removeEventListener('pageshow', schedule);
  });
  schedule();
})();
