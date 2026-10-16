// openLedMapper · js/ui-macros.js
// The Macros section at the top of the Content tab: Speed, Intensity and Saturation; Color 1 and Color 2 (the
// colour picker, on or off, and opened, a slider for each part, HSV or RGB, for MIDI); and the shared controls
// (Angle, Softness…), folded. Every slider can be learnt by a MIDI control. Under an effect's control, a note says
// which macro it follows while that macro changes it.

// The part of the macros the user has opened: 'color1', 'color2', 'shared'
const macroOpen = () => new Set(Array.isArray(ui.macroOpen) ? ui.macroOpen : []);
function toggleMacroOpen(key) {
  const s = macroOpen();
  if (s.has(key)) s.delete(key); else s.add(key);
  ui.macroOpen = [...s]; savePrefs(); renderRight();
}
// A binder runs at once too, so what it shows is right from the start, then on each syncInspector
const bind = f => { binders.push(f); f(); };
const foldBtn = (open, label, onclick, title) => h('button', { class: 'mfold' + (open ? ' open' : ''), type: 'button', 'aria-expanded': String(open), title, onclick }, icon('chev'), label);
// A label with a tick that switches a colour or a shared control on and off
function macroSwitch(id, label) {
  const d = macroDef(id), box = h('input', { type: 'checkbox', 'aria-label': d.label + ' on', title: 'On: the effects follow it. Off: each keeps its own.', onchange: e => setMacro(id, { on: e.target.checked }) });
  bind(() => { box.checked = !!project.macros[id].on; });
  return h('span', { class: 'lbl mlbl' }, box, label);
}
// A macro's slider: moving it (or its MIDI control) turns a shared control on
function macroSlider(id) {
  const d = macroDef(id), holder = { get v() { return project.macros[id].v; }, set v(x) { setMacro(id, { v: x }); } };
  const r = sliderRow(d.label, holder, 'v', { min: 0, max: macroMax(d), step: 0.01, fmt: d.kind === 'mult' ? v => v.toFixed(2) + '×' : pct, midi: 'm:' + id,
    label: d.kind === 'abs' ? macroSwitch(id, d.label) : null });
  if (d.kind === 'abs') bind(() => r.classList.toggle('off', !project.macros[id].on));
  r.title = d.kind === 'mult' ? 'Every effect\'s speed: 1× leaves them as they are.' : id === 'intensity' ? 'The level of every layer: 100 % leaves them as they are.'
    : id === 'saturation' ? 'Every effect\'s saturation: 100 % leaves them as they are.' : `Sets the ${d.label.toLowerCase()} of every effect that has one, each in its own range.`;
  return r;
}
// A colour macro: the picker and its switch; opened, a slider for each part, which a MIDI fader can drive
function macroColor(id) {
  const d = macroDef(id), open = macroOpen().has(id), m = project.macros[id];
  const get = () => macroRgb(project.macros[id]).concat(1);
  const set = c => { const [hh, s, v] = macroRgbHsv(c[0], c[1], c[2]); setMacro(id, { h: s > 0 && v > 0 ? hh : project.macros[id].h, s, v }); };
  const r = colorRow(d.label, get, set, () => {}, 'macro-' + id);
  const sw = r.querySelector('.cswatch');
  r.firstChild.replaceWith(macroSwitch(id, foldBtn(open, d.label, () => toggleMacroOpen(id), open ? 'Fold its parts' : 'Its hue, saturation and value, for MIDI faders')));
  r.classList.add('mcolor');
  bind(() => { sw._show(get()); r.classList.toggle('off', !project.macros[id].on); });
  if (!open) return [r];
  const mode = seg([['hsv', 'HSV'], ['rgb', 'RGB']], m.mode, v => { setMacro(id, { mode: v, on: project.macros[id].on }); renderRight(); });
  const parts = MACRO_PARTS[m.mode].map(([k, name], i) => {
    const hue = k === 'h', holder = { get v() { return macroPart(project.macros[id], i) * (hue ? 360 : 1); }, set v(x) { setMacroPart(id, i, hue ? x / 360 : x); } };
    return sliderRow(name, holder, 'v', { min: 0, max: hue ? 360 : 1, step: hue ? 1 : 0.01, fmt: hue ? v => Math.round(v) + '°' : pct, midi: `m:${id}.${i}` });
  });
  return [r, h('div', { class: 'msub' }, row('Sliders', mode), ...parts)];
}
function macrosSection() {
  const open = !!ui.macrosOpen, shared = macroOpen().has('shared');
  const sum = h('span', { class: 'msum' });
  bind(() => { const on = MACROS.filter(d => macroActive(d.id)); sum.textContent = on.length ? on.map(d => d.kind === 'color' || d.kind === 'abs' ? d.label : `${d.label} ${macroText(d.id)}`).join(' · ') : 'none in use'; });
  const head = h('h3', null, foldBtn(open, 'Macros', () => { ui.macrosOpen = !open; savePrefs(); renderRight(); }, open ? 'Fold the macros' : 'Speed, Intensity, colours… for every effect at once'), h('span', { class: 'fill' }), open ? null : sum);
  if (!open) return h('div', { class: 'sec macros' }, head);
  const abs = MACROS.filter(d => d.kind === 'abs');
  const nOn = h('span', { class: 'msum' });
  bind(() => { const n = abs.filter(d => project.macros[d.id].on).length; nOn.textContent = n ? `${n} on` : ''; });
  return h('div', { class: 'sec macros' }, head,
    h('p', { class: 'note' }, 'For every effect at once, over each one\'s own values: scenes keep theirs.'),
    macroSlider('speed'), macroSlider('intensity'), macroSlider('saturation'),
    ...macroColor('color1'), ...macroColor('color2'),
    h('div', { class: 'row mshared' }, foldBtn(shared, 'Shared controls', () => toggleMacroOpen('shared'), shared ? 'Fold them' : 'Angle, Softness, Scale, Count, Size, Width, Density, Fade'), nOn),
    shared ? h('div', { class: 'msub' }, abs.map(d => macroSlider(d.id))) : null);
}
// Under an effect's control: the macro it follows, while that macro changes it
function macroFollows(id) {
  const d = macroDef(id), el = h('p', { class: 'note via' });
  bind(() => { const on = macroActive(id); el.hidden = !on; if (on) el.textContent = `Follows ${d.label}` + (d.kind === 'color' || d.kind === 'abs' ? '' : ` (${macroText(id)})`); });
  return el;
}
// After a macro moves: its sliders, the notes and the swatches, at most once a frame; and the MIDI marks
let macrosQueued = false;
function updateMacrosUI() {
  updateMidiUI();
  if (macrosQueued) return;
  macrosQueued = true;
  requestAnimationFrame(() => { macrosQueued = false; if (ui.rightTab === 'content' && !ui.rightHidden) syncInspector(); });
}
