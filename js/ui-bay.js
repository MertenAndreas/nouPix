// openLedMapper · js/ui-bay.js
// The patch bay: the MIDI window's second view (the list is the first; both show the same mappings). Three columns
// joined by wires: the MIDI controls; what they can drive (the output, the zones with their scenes and playlists,
// the macros); and the controls of the project's effects. A wire is a mapping: click it for Pickup or Jump (Toggle,
// Hold or Follow) and to remove it (or Delete). Each row moves what it drives with the mouse too, and Learn works
// here as everywhere: move a control, click a row. Drawn into the MIDI window by ui-midi.js; the engine stays midi.js.

// sel: the mapping picked (its wire and settings); hover: a control's key or a target, whose wires stand out
const bay = { sel: null, hover: null };
// The groups opened: 'z:<zone>', 'fx:<source>', 'color1', 'color2' (zones and effects start folded)
const bayOpen = () => new Set(Array.isArray(ui.bayOpen) ? ui.bayOpen : []);
function bayToggle(key) {
  const s = bayOpen();
  if (s.has(key)) s.delete(key); else s.add(key);
  ui.bayOpen = [...s]; savePrefs(); updateMidiUI();
}
// The controls in the bay, as in the list: the mapped ones, and while learning the one just moved; in the user's
// order (midiKeyOrder)
function bayKeys() {
  const keys = project.midi.maps.map(w => w.key);
  if (midi.learn.on && midi.learn.pending) keys.push(midi.learn.pending);
  return midiKeyOrder(keys);
}
const baySig = () => [ui.bayOpen, bayKeys()];

/* ---------- rows ---------- */
const bayDot = (dir, id) => h('span', { class: 'bdot ' + dir, ['data-' + dir]: id });
// What a target row moves it with: a slider for a fader, a button for the rest (the row is what learning picks)
function bayWidget(t, T) {
  if (T.kind === 'fader') {
    const r = h('input', { type: 'range', min: 0, max: 1, step: 0.001, value: T.get(), 'aria-label': T.label, 'data-bv': t });
    r.addEventListener('input', () => { const X = midiTarget(t); if (X) X.set(parseFloat(r.value)); updateMidiUI(); });
    r.addEventListener('change', () => commit());
    return r;
  }
  const btn = h('button', { class: 'btn sm', type: 'button', 'data-bb': t, onclick: () => { const X = midiTarget(t); if (X) X.set(X.kind === 'trigger' ? 1 : X.get() > 0.5 ? 0 : 1); updateMidiUI(); } },
    T.kind === 'trigger' ? 'Play' : T.get() > 0.5 ? 'On' : 'Off');
  return btn;
}
// A row for something a control can drive: its dot, its name, how it moves; while learning, a click picks it
function bayRow(t, label, cls = '') {
  const T = midiTarget(t);
  if (!T) return null;
  const el = h('div', { class: 'brow ' + cls, 'data-midi': t, 'data-t': t, onmouseenter: () => bayHover(t), onmouseleave: () => bayHover(null) },
    bayDot('in', t), h('span', { class: 'nm', title: T.label }, label || T.label), bayWidget(t, T));
  return el;
}
// A group that folds (a zone, a colour, an effect): its head, which is also where the wires of its folded rows end
function bayGroup(key, head, rows, n) {
  const open = bayOpen().has(key);
  const fold = h('button', { class: 'mfold' + (open ? ' open' : ''), type: 'button', 'aria-expanded': String(open), 'aria-label': (open ? 'Fold ' : 'Open ') + key, onclick: e => { e.stopPropagation(); bayToggle(key); } }, icon('chev'));
  head.classList.add('bhead');
  head.dataset.group = key;
  head.insertBefore(fold, head.querySelector('.nm'));
  if (!head.querySelector('.bdot.in')) head.prepend(h('span', { class: 'bdot in alias' }));
  return h('div', { class: 'bgroup' + (open ? ' open' : ''), 'data-g': key }, head, open ? h('div', { class: 'bsub' }, rows) : n ? h('div', { class: 'bmore' }, n) : null);
}

/* ---------- the three columns ---------- */
function bayControls() {
  const keys = bayKeys(), ports = new Set(keys.map(k => midiKeyParts(k).port)), L = midi.learn;
  return h('div', { class: 'bcol bctls', onscroll: bayWires },
    h('h3', null, 'Controls'),
    keys.length ? keys.map(key => {
      const k = midiKeyParts(key), ws = project.midi.maps.filter(w => w.key === key), lost = ws.filter(w => !midiTarget(w.to)).length;
      const row = h('div', { class: 'bctl' + (L.on && L.pending === key ? ' new' : '') + (ws.length ? '' : ' loose'), 'data-key': key, onmouseenter: () => bayHover(key), onmouseleave: () => bayHover(null), title: k.port + '. Drag it to put it in another place.' },
        h('span', { class: 'pgrip', 'aria-hidden': 'true' }), h('span', { class: 'mk' }, midiKeyLabel(key)), h('small', null, `ch${k.ch}` + (ports.size > 1 ? ' · ' + k.port : '') + (lost ? ` · ${lost} missing` : '')),
        h('button', { class: 'x', type: 'button', title: ws.length ? 'Forget this control and its mappings' : 'Forget this control', 'aria-label': 'Forget ' + midiKeyFull(key), onclick: e => { e.stopPropagation(); midiForget(key); } }, icon('x')),
        h('span', { class: 'cval' }, h('i', { class: 'cbar', 'data-cbar': key })), bayDot('out', key));
      bayDrag(row, key);
      return row;
    }) : h('p', { class: 'note' }, 'Press Learn and move a fader, knob or pad on your controller: it shows here. Then click what it should move.'));
}
// Dragging a control up or down puts it in another place (in the list view too): it follows the pointer, the others
// slide out of its way, and let go, it glides into its place. Its wires follow it.
let bayDragging = false;
function bayDrag(row, key) {
  row.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('button') || midi.learn.on) return;
    const doc = row.ownerDocument, rows = $$('.bctl', row.closest('.bcol')), from = rows.indexOf(row), y0 = e.clientY;
    const tops = rows.map(r => r.getBoundingClientRect().top), step = rows.length > 1 ? tops[1] - tops[0] : 0;
    let moved = false, to = from;
    const move = ev => {
      if (!moved && Math.abs(ev.clientY - y0) < 4) return;
      if (!moved) { moved = bayDragging = true; row.classList.add('dragging'); }
      const dy = clamp(ev.clientY - y0, tops[0] - tops[from], tops[rows.length - 1] - tops[from]);
      row.style.transform = `translateY(${dy}px)`;
      to = step ? clamp(from + Math.round(dy / step), 0, rows.length - 1) : from;
      rows.forEach((r, i) => { if (r !== row) r.style.transform = from < to && i > from && i <= to ? `translateY(${-step}px)` : to < from && i >= to && i < from ? `translateY(${step}px)` : ''; });
      bayWires();
    };
    const up = () => {
      doc.removeEventListener('pointermove', move); doc.removeEventListener('pointerup', up);
      if (!moved) return;
      // into its place, then the new order
      row.classList.add('settling'); row.style.transform = `translateY(${(to - from) * step}px)`;
      setTimeout(() => {
        bayDragging = false;
        if (to === from) { rows.forEach(r => { r.style.transform = ''; r.classList.remove('dragging', 'settling'); }); bayWires(); return; }
        const keys = rows.map(r => r.dataset.key).filter(k => k !== key);
        keys.splice(to, 0, key);
        midiSetOrder(keys.concat(bayKeys().filter(k => !keys.includes(k))));
      }, 140);
    };
    doc.addEventListener('pointermove', move); doc.addEventListener('pointerup', up);
  });
}
function bayTargets() {
  const open = bayOpen(), rows = [h('h3', null, 'Output')];
  rows.push(bayRow('master', 'Master'), bayRow('blackout', 'Blackout'));
  rows.push(h('h3', null, 'Zones'));
  for (const z of project.zones.slice().reverse()) {
    const head = bayRow('z:' + z.id, z.name + ' level');
    const subs = z.scenes.map(sc => bayRow(`sc:${z.id}:${sc.id}`, sc.name, 'sub'))
      .concat(z.scenes.length ? [bayRow('nx:' + z.id, 'Next scene', 'sub')] : [])
      .concat(z.playlists.map(pl => bayRow(`pl:${z.id}:${pl.id}`, pl.name + ' (playlist)', 'sub')));
    rows.push(bayGroup('z:' + z.id, head, subs, open.has('z:' + z.id) ? 0 : subs.length ? `${z.scenes.length} scene${z.scenes.length === 1 ? '' : 's'}, ${z.playlists.length} playlist${z.playlists.length === 1 ? '' : 's'}` : 0));
  }
  rows.push(h('h3', null, 'Macros'));
  for (const d of MACROS) {
    if (d.kind !== 'color') { rows.push(bayRow('m:' + d.id, d.label)); continue; }
    const m = project.macros[d.id], sw = h('i', { class: 'bsw' });
    sw.style.background = toHex(macroRgb(m));
    const head = h('div', { class: 'brow', 'data-t': 'm:' + d.id }, h('span', { class: 'nm' }, d.label), sw, h('span', { class: 'k' }, m.mode.toUpperCase()));
    const parts = MACRO_PARTS[m.mode].map((p, i) => bayRow(`m:${d.id}.${i}`, p[1], 'sub'));
    rows.push(bayGroup(d.id, head, parts));
  }
  return h('div', { class: 'bcol btgts', onscroll: bayWires }, rows);
}
function bayEffects() {
  const fx = midiEffects().map(srcById).filter(Boolean), mapped = new Set(project.midi.maps.map(w => w.to));
  return h('div', { class: 'bcol bfx', onscroll: bayWires },
    h('h3', null, 'Effects'),
    fx.length ? fx.map(src => {
      const ts = controlsOf(src).map(i => `p:${src.id}:${i.NAME}`).filter(t => midiTarget(t)), key = 'fx:' + src.id;
      const head = h('div', { class: 'brow' }, h('span', { class: 'nm' }, src.name), h('span', { class: 'k' }, ts.filter(t => mapped.has(t)).length ? ts.filter(t => mapped.has(t)).length + ' mapped' : ''));
      // folded, its mapped controls stay out, so their wires have somewhere to go
      const open = bayOpen().has(key), shown = open ? ts : ts.filter(t => mapped.has(t));
      const g = bayGroup(key, head, ts.map(t => bayRow(t, midiTargetLabel(t).split(' · ').slice(1).join(' · '), 'sub')), open ? 0 : ts.length - shown.length ? `${ts.length - shown.length} more` : 0);
      if (!open && shown.length) g.insertBefore(h('div', { class: 'bsub' }, shown.map(t => bayRow(t, midiTargetLabel(t).split(' · ').slice(1).join(' · '), 'sub'))), g.querySelector('.bmore'));
      return g;
    }) : h('p', { class: 'note' }, 'The effects in your zones and scenes show here, with their controls.'));
}
function bayView() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'bwires'); svg.id = 'bayWires'; svg.setAttribute('aria-hidden', 'true');
  const el = h('div', { class: 'bay' }, bayControls(), bayTargets(), bayEffects(), svg, h('div', { class: 'bpop', id: 'bayPop', hidden: true }));
  el.addEventListener('click', e => {
    const w = e.target.closest && e.target.closest('[data-wire]');
    if (w) { bay.sel = bay.sel === w.dataset.wire ? null : w.dataset.wire; bayWires(); return; }
    if (!e.target.closest('.bpop')) { bay.sel = null; bayWires(); }
  });
  return el;
}

/* ---------- wires ---------- */
function bayHover(id) { if (bay.hover === id) return; bay.hover = id; bayWires(); }
// Where a dot is, in the bay; one scrolled out of its column stops at the column's edge
function bayXY(el, box) {
  const r = el.getBoundingClientRect(), col = el.closest('.bcol').getBoundingClientRect();
  const y = r.top + r.height / 2, cy = clamp(y, col.top + 28, col.bottom - 6);
  return { x: r.left + r.width / 2 - box.left, y: cy - box.top, edge: Math.abs(cy - y) > 0.5 };
}
// The dot a wire ends at: the target's, or in a folded group the group's head (the wire is dashed then)
function bayIn(D, t) {
  const el = $(`.bay [data-in="${CSS.escape(t)}"]`, D);
  if (el) return { el };
  const groups = t.startsWith('m:color') ? [t.split('.')[0].slice(2)] : /^(sc|nx|pl):/.test(t) ? ['z:' + t.split(':')[1]] : t.startsWith('p:') ? ['fx:' + t.slice(2, t.indexOf(':', 2))] : [];
  for (const g of groups) { const head = $(`.bay [data-group="${CSS.escape(g)}"] .bdot.in`, D); if (head) return { el: head, folded: true }; }
  return null;
}
const bayCurve = (a, b) => { const dx = Math.max(40, (b.x - a.x) * 0.45); return `M${a.x} ${a.y} C${a.x + dx} ${a.y} ${b.x - dx} ${b.y} ${b.x} ${b.y}`; };
function bayWires() {
  const D = midiDoc(), bayEl = D && $('.bay', D), svg = D && $('#bayWires', D);
  if (!bayEl || !svg) return;
  const box = bayEl.getBoundingClientRect(), paths = [];
  let mid = null;
  if (bay.sel && !project.midi.maps.some(w => w.id === bay.sel)) bay.sel = null;
  for (const w of project.midi.maps) {
    const ao = $(`.bay [data-out="${CSS.escape(w.key)}"]`, D), end = bayIn(D, w.to);
    if (!ao || !end) continue;
    const a = bayXY(ao, box), b = bayXY(end.el, box);
    if (a.edge && b.edge) continue;
    const sel = bay.sel === w.id, lit = sel || bay.hover === w.key || bay.hover === w.to, heat = midiHeat(w);
    const d = bayCurve(a, b), cls = ['wire', sel && 'sel', lit && 'lit', end.folded && 'folded', (a.edge || b.edge) && 'edge', w.to.startsWith('p:') && 'fx'].filter(Boolean).join(' ');
    // while its control moves it glows, and fades out once it stops (no blinking when several move at once)
    paths.push(`<path class="hit" data-wire="${w.id}" d="${d}"/>${heat ? `<path class="glow" d="${d}" style="opacity:${heat.toFixed(2)}"/>` : ''}<path class="${cls}" d="${d}"/>`);
    if (sel) mid = { x: a.x, y: a.y };   // its settings open under the control, clear of what it drives
  }
  svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
  svg.innerHTML = paths.join('');
  for (const el of $$('.bay [data-key], .bay [data-t]', D)) {
    const id = el.dataset.key || el.dataset.t;
    el.classList.toggle('lit', bay.hover === id || (!!bay.sel && project.midi.maps.some(w => w.id === bay.sel && (w.key === id || w.to === id))));
  }
  bayPop(D, mid, box);
}
// The picked wire's settings, under its control
function bayPop(D, mid, box) {
  const pop = $('#bayPop', D), w = bay.sel && project.midi.maps.find(x => x.id === bay.sel);
  if (!w || !mid) { pop.hidden = true; pop.dataset.for = ''; return; }
  if (pop.dataset.for !== w.id + w.takeover + w.mode) {
    pop.dataset.for = w.id + w.takeover + w.mode;
    const T = midiTarget(w.to), k = midiKeyParts(w.key);
    const seg = (key, opts) => h('span', { class: 'seg mini' }, opts.map(([v, label, tip]) => h('button', { type: 'button', class: w[key] === v ? 'on' : '', title: tip, onclick: () => midiSetMap(w.id, { [key]: v }) }, label)));
    const how = !T ? h('span', { class: 'muted' }, 'Missing') : T.kind === 'fader' ? seg('takeover', [['pickup', 'Pickup', 'It follows once the fader reaches it'], ['jump', 'Jump', 'It goes where the fader is at once']])
      : T.kind === 'toggle' ? seg('mode', [['toggle', 'Toggle', 'Each press turns it on or off'], k.type === 'cc' ? ['hold', 'Follow', 'On while the control is up'] : ['hold', 'Hold', 'On while held']])
        : h('span', { class: 'muted' }, 'On a press');
    pop.replaceChildren(h('div', { class: 'bph' }, h('b', { class: 'mono' }, midiKeyFull(w.key)), ' → ', T ? T.label : 'Missing'),
      h('div', { class: 'bpr' }, how, h('span', { class: 'fill' }),
        h('button', { class: 'btn sm danger-t', type: 'button', title: 'Remove this mapping (Delete)', onclick: () => { bay.sel = null; midiDisconnect(w.id); } }, icon('trash'), 'Remove')));
  }
  pop.hidden = false;
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  pop.style.left = clamp(mid.x - pw + 24, 6, box.width - pw - 6) + 'px';
  pop.style.top = clamp(mid.y + 20, 6, box.height - ph - 6) + 'px';
}
// With each message: where each control is, each slider and button, and the wires (a hot one shows the control moving)
function bayUpdate(D) {
  if (bayDragging) return;
  for (const b of $$('.bay [data-cbar]', D)) { const c = midi.controls.get(b.dataset.cbar); b.style.width = c ? c.last * 100 + '%' : '0'; }
  for (const r of $$('.bay [data-bv]', D)) { const T = midiTarget(r.dataset.bv); if (T && D.activeElement !== r) r.value = T.get(); }
  for (const b of $$('.bay [data-bb]', D)) { const T = midiTarget(b.dataset.bb); if (T && T.kind === 'toggle') { b.textContent = T.get() > 0.5 ? 'On' : 'Off'; b.classList.toggle('on', T.get() > 0.5); } }
  bayWires();
}
