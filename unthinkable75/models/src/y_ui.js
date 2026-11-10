'use strict';
/* ===== viewer UI ===== */
const UI = { cat: 'All', q: '' };
function el(t, c, h) { const e = document.createElement(t); if (c) e.className = c; if (h !== undefined) e.innerHTML = h; return e; }
function buildUI() {
  const root = document.getElementById('ui');
  root.innerHTML = '<div id="top"><div id="plate"><h1 id="nm"></h1><div class="meta"><span id="sd" class="chip"></span><span id="ct"></span></div></div><div id="tools"><button class="ib" id="bEnv" aria-label="Environment">Dusk</button><button class="ib on" id="bToon">Toon</button><button class="ib" id="bAuto">Spin</button></div></div>' +
    '<div id="hint">Drag to orbit · pinch to zoom · double-tap resets</div>' +
    '<div id="drawer"><button id="grab" aria-label="Toggle drawer"></button><div id="acts"></div><div id="spec"></div><input id="q" type="search" placeholder="Search 160+ vehicles" autocomplete="off" aria-label="Search vehicles"><div id="tabs"></div><div id="list"></div></div>';
  const envs = Object.keys(ENVS); let ei = 0;
  const env = document.getElementById('bEnv'); env.onclick = () => { ei = (ei + 1) % envs.length; App.setEnv(envs[ei]); env.textContent = envs[ei]; };
  const toon = document.getElementById('bToon'); toon.onclick = () => { App.toon = !App.toon; App.outline = App.toon; toon.classList.toggle('on', App.toon); };
  const auto = document.getElementById('bAuto'); auto.classList.toggle('on', App.auto); auto.onclick = () => { App.auto = !App.auto; auto.classList.toggle('on', App.auto); };
  const dr = document.getElementById('drawer'); document.getElementById('grab').onclick = () => { dr.classList.toggle('min'); document.body.classList.toggle('dmin', dr.classList.contains('min')); };
  const cats = ['All', ...new Set(ORDER.map(i => REG[i].cat))]; const tabs = document.getElementById('tabs');
  cats.forEach(c => { const b = el('button', 'tab' + (c === UI.cat ? ' on' : ''), c); b.textContent = c + ' ' + (c === 'All' ? ORDER.length : ORDER.filter(i => REG[i].cat === c).length); b.onclick = () => { UI.cat = c; [...tabs.children].forEach(x => x.classList.toggle('on', x === b)); renderList(); }; tabs.appendChild(b); });
  document.getElementById('q').oninput = e => { UI.q = e.target.value.trim().toLowerCase(); renderList(); };
  renderList();
  App.updateUI = () => {
    const d = App.def; document.getElementById('nm').textContent = d.name; const s = document.getElementById('sd'); s.textContent = d.side; s.className = 'chip ' + d.side; document.getElementById('ct').textContent = d.cat + ' · ' + d.era;
    const sp = document.getElementById('spec'); sp.innerHTML = ''; for (const k in d.spec) { if (k === 'Note') continue; sp.appendChild(el('div', '', '<b>' + k + '</b><span>' + d.spec[k] + '</span>')); }
    const ac = document.getElementById('acts'); ac.innerHTML = ''; const m = App.model; const pf = PROFILES[d.fx]; const list = pf ? pf(m) : [];
    list.forEach((a, i) => { const b = el('button', 'act' + (i ? ' sec' : ''), a.label); b.onclick = () => { if (App.t - (App.lastAct || -9) < .3) return; App.lastAct = App.t; a.run(); }; ac.appendChild(b); });
    const b = el('button', 'act sec', 'Reset'); b.onclick = () => { const id = d.id; App.setModel(id); }; ac.appendChild(b);
    [...document.querySelectorAll('.row')].forEach(r => r.classList.toggle('on', r.dataset.id === d.id));
  };
}
function renderList() {
  const l = document.getElementById('list'); l.innerHTML = '';
  ORDER.filter(i => (UI.cat === 'All' || REG[i].cat === UI.cat) && (!UI.q || (REG[i].name + ' ' + REG[i].side + ' ' + REG[i].cat).toLowerCase().includes(UI.q))).forEach(i => {
    const d = REG[i], b = el('button', 'row', '<i class="' + d.side + '"></i><div>' + d.name + '<small>' + d.era + '</small></div>'); b.dataset.id = i; b.onclick = () => App.setModel(i); l.appendChild(b);
  });
  if (App.def) [...l.children].forEach(r => r.classList.toggle('on', r.dataset.id === App.def.id));
}
