'use strict';
window.addEventListener('DOMContentLoaded', () => {
  const cv = document.getElementById('cv');
  if (!App.init(cv)) { document.body.insertAdjacentHTML('beforeend', '<p style="color:#fff;padding:20px">WebGL is not available on this device.</p>'); return; }
  window.App = App; buildUI();
  // #<modelId> or #<game unit id> selects a model (used by the game to link to the 3D view)
  const fromHash = () => { let h = ''; try { h = decodeURIComponent(location.hash.slice(1)); } catch (e) {} if (!h) return null; if (REG[h]) return h; for (const id of ORDER) if ((REG[id].game || []).indexOf(h) >= 0) return id; return null; };
  App.setModel(window.__START || fromHash() || ORDER[0]);
  window.addEventListener('hashchange', () => { const id = fromHash(); if (id) App.setModel(id); });
});
