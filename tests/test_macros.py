# Macros (macros.js, ui-macros.js): what each effect control follows; Speed through the effects' clocks (also the
# ones a rate or bpm drives), Intensity, Saturation, Color 1 and 2, the shared controls; the layers' own values never
# change, scenes keep working, thumbnails keep their own look; saved in the project, repaired on opening, kept through
# an undo; the Macros section of the Content tab (folding, the colour parts in HSV or RGB, typed values, the notes
# under an effect's controls); MIDI learnt onto a macro and onto a part of a colour; a device's change by its role.
import os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import CHROME_ARGS, start_bridge, app_error
from playwright.sync_api import sync_playwright
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8184
fails = []
def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + ("  " + " ".join(str(detail).split())[:300] if detail != "" else ""), flush=True); ok or fails.append(name)

bridge = start_bridge(PORT)
try:
  with sync_playwright() as pw:
    br = pw.chromium.launch(args=CHROME_ARGS); pg = br.new_page(viewport={"width": 1440, "height": 1100})
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if app_error(m) else None)
    pg.goto(f"http://127.0.0.1:{PORT}/"); pg.wait_for_function("window.olm && olm.bridge.connected"); time.sleep(0.5)
    ev = pg.evaluate
    def settle(t=0.3): time.sleep(t)
    def load(src, params=None):
        ev(f"""(() => {{ const p = blankProject('Macros'); p.fixtures.push(newFixture('line', {{ x1: 100, y1: 320, x2: 900, y2: 320, pixels: 8 }}));
          const L = newLayer('{src}'); {f"L.params['{src}'] = {params};" if params else ''} p.zones[0].layers = [L];
          olm.loadProject(JSON.parse(JSON.stringify(p, replacer))); ui.rightTab = 'content'; ui.zone = olm.project.zones[0].id; renderRight(); }})()"""); settle(0.5)
    col = lambda i=0: ev(f"Array.from(olm.project.fixtures[0]._col.slice({i * 3}, {i * 3 + 3}))")
    roles = lambda src: ev(f"(() => {{ const rt = runtimeOf(srcById('{src}')); return rt.roles; }})()")
    reset = lambda: ev("project.macros = defaultMacros(); updateMacrosUI()")

    # ---------- defaults and files
    load("b-solid", "{ color: [0, 0, 1, 1] }")
    check("a new project has every macro, none changing anything", ev("MACROS.every(d => !macroActive(d.id))") and ev("Object.keys(project.macros).length") == 13)
    check("so the effects look as they did", col() == [0, 0, 255], col())
    ev("loadProject(Object.assign(JSON.parse(serialize()), { macros: { speed: { v: 9 }, color1: { on: 1, h: 400, s: 'x', mode: 'cmyk' }, angle: 'no' } }))"); settle()
    m = ev("project.macros")
    check("a file's macros are repaired: in range, with defaults for the rest", m["speed"]["v"] == 2 and m["color1"]["on"] is True and m["color1"]["h"] == 40 and m["color1"]["s"] == 1
          and m["color1"]["mode"] == "hsv" and m["angle"] == {"on": False, "v": 0.5}, m)
    ev("loadProject(Object.assign(JSON.parse(serialize()), { macros: undefined }))"); settle()
    check("a file without macros opens with them neutral", ev("MACROS.every(d => !macroActive(d.id))"))

    # ---------- what follows what
    r = roles("b-bars")
    check("bars: its colour follows Color 1, its background Color 2, its speed Speed, and its shared controls theirs",
          r == {"color": "color1", "background": "color2", "count": "count", "width": "width", "softness": "softness", "speed": "speed", "angle": "angle"}, r)
    check("the rate or bpm a clock runs at follows Speed", roles("b-strobe").get("rate") == "speed" and roles("b-discodots").get("bpm") == "speed"
          and roles("b-checker").get("rate") == "speed" and roles("b-checker").get("scroll") == "speed", (roles("b-strobe"), roles("b-checker")))
    check("saturation and fade (decay) follow theirs", roles("b-rainbow").get("saturation") == "saturation" and roles("b-twinkle").get("decay") == "decay")
    ev("""(() => { const code = '/*{"INPUTS":[{"NAME":"tint","TYPE":"color","DEFAULT":[1,0,0,1]},{"NAME":"speed","TYPE":"float","MIN":0,"MAX":1,"DEFAULT":0.5}]}*/\\nvoid main(){gl_FragColor=vec4(1.0);}';
      project.sources.push({ id: 'mine', kind: 'isf', name: 'Mine', code }); })()""")
    check("an effect of your own follows by the same names; a speed it doesn't run by TIME doesn't follow Speed", roles("mine") == {"tint": "color1"}, roles("mine"))

    # ---------- colours, intensity, saturation
    load("b-solid", "{ color: [0, 0, 1, 1] }")
    ev("setMacro('color1', { h: 0, s: 1, v: 1 })"); settle()
    check("Color 1 moved: it turns on, and every effect's colour is it", ev("project.macros.color1.on") and col() == [255, 0, 0], col())
    ev("setMacro('intensity', { v: 0.5 })"); settle()
    check("Intensity at 50 % halves every layer", col() == [128, 0, 0], col())
    ev("setMacro('intensity', { v: 0 })"); settle()
    check("at 0 it is dark", col() == [0, 0, 0])
    ev("setMacro('color1', { on: false }); setMacro('intensity', { v: 1 })"); settle()
    check("off again, each effect has its own colour back, which never changed", col() == [0, 0, 255] and ev("project.zones[0].layers[0].params['b-solid'].color") == [0, 0, 1, 1])
    load("b-bars", "{ color: [1, 1, 1, 1], background: [0, 0, 0, 1], count: 1, width: 0.05, softness: 0 }")
    ev("setMacro('color2', { h: 120, s: 1, v: 1 })"); settle()
    check("Color 2 is the background", sum(col(i) == [0, 255, 0] for i in range(8)) >= 5, [col(i) for i in range(8)])
    load("b-rainbow", "{ saturation: 1 }")
    ev("setMacro('saturation', { v: 0 })"); settle()
    c = col(2)
    check("Saturation at 0 makes a rainbow grey", max(c) - min(c) <= 2, c)
    reset(); settle()
    c = col(2)
    check("and back at 100 % it is coloured again", max(c) - min(c) > 100, c)

    # ---------- speed
    def rate(key):
        a = ev(f"[speedClocks.get({key}).tau, clockT]"); settle(0.6); b = ev(f"[speedClocks.get({key}).tau, clockT]")
        return (b[0] - a[0]) / (b[1] - a[1])
    key = "project.zones[0].layers[0].id + '|b-rainbow'"
    r1 = rate(key); ev("setMacro('speed', { v: 2 })"); r2 = rate(key)
    check("Speed at 2× runs an effect twice as fast", abs(r2 / r1 - 2) < 0.1, (r1, r2))
    ev("setMacro('speed', { v: 0 })"); a = col(3); settle(0.6); b = col(3)
    check("at 0 it stops, where it was", a == b and rate(key) == 0, (a, b))
    load("b-strobe")
    skey = "project.zones[0].layers[0].id + '|b-strobe|flash'"
    reset(); r1 = rate(skey); ev("setMacro('speed', { v: 0.5 })"); r2 = rate(skey)
    check("an effect with a rate clock (Strobe) follows it too", abs(r2 / r1 - 0.5) < 0.05, (r1, r2))
    reset()

    # ---------- shared controls
    inp = "isfInputs(srcById('b-bars')).find(i => i.NAME === 'angle')"
    check("a shared control on sets every effect's control to the same point of its range", ev(f"(() => {{ project.macros.angle = {{ on: true, v: 0.25 }}; return macroOver('angle', {inp}, 300); }})()") == 90)
    check("off, each keeps its own", ev(f"(() => {{ project.macros.angle.on = false; return macroOver('angle', {inp}, 300); }})()") == 300)
    reset()

    # ---------- scenes, thumbnails, undo, files
    load("b-solid", "{ color: [0, 0, 1, 1] }")
    ev("(() => { const z = project.zones[0]; storeScene(z); z.layers = [newLayer('b-solid')]; z.layers[0].params['b-solid'] = { color: [0, 1, 0, 1] }; storeScene(z); })()"); settle()
    ev("setMacro('color1', { h: 0, s: 1, v: 1 })"); ev("goScene(project.zones[0], project.zones[0].scenes[0], true)"); settle()
    check("a scene played keeps following the macro", col() == [255, 0, 0])
    ev("setMacro('color1', { on: false })"); settle()
    check("and has its own colour when it is off", col() == [0, 0, 255])
    ev("setMacro('color1', { on: true })"); ev("(() => { const s = srcById('b-solid'); drawThumb(s, true); })()")
    t = ev("Array.from(thumbs.get('b-solid').getContext('2d').getImageData(48, 48, 1, 1).data.slice(0, 3))")
    check("a source's thumbnail keeps its own look", t != [255, 0, 0], t)
    ev("setMacro('speed', { v: 1.5 })"); ev("project.name = 'Changed'; commit()"); ev("undo()"); settle()
    check("an undo leaves the macros where they are", ev("project.macros.speed.v") == 1.5 and ev("project.macros.color1.on"))
    saved = ev("JSON.parse(serialize()).macros")
    check("the macros are saved in the project file", saved["speed"]["v"] == 1.5 and saved["color1"]["on"] is True)
    ev("s => loadProject(JSON.parse(s))", ev("serialize()")); settle()
    check("and come back when it opens", ev("project.macros.speed.v") == 1.5 and ev("project.macros.color1.on"))
    reset(); settle()

    # ---------- the Macros section
    load("b-bars")
    sec = pg.locator("#rightBody .sec.macros")
    check("the Content tab starts with the macros, folded to one line", pg.locator("#rightBody .sec").first.evaluate("e => e.classList.contains('macros')")
          and sec.locator(".row").count() == 0 and "none in use" in sec.inner_text(), sec.inner_text())
    sec.locator("h3 .mfold").click(); settle()
    check("open, Speed, Intensity and Saturation come first", [x.strip() for x in sec.locator(".row .lbl").all_inner_texts()][:3] == ["Speed", "Intensity", "Saturation"] and ev("ui.macrosOpen"),
          sec.locator(".row .lbl").all_inner_texts())
    sl = sec.locator(".row", has=pg.locator(".lbl", has_text="Speed")).locator("input[type=range]")
    sl.fill("1.5"); sl.dispatch_event("input"); settle()
    check("the Speed slider moves Speed", ev("project.macros.speed.v") == 1.5 and "1.50×" in sec.inner_text())
    v = sec.locator(".row", has=pg.locator(".lbl", has_text="Intensity")).locator(".sval"); v.dblclick(); pg.keyboard.type("40"); pg.keyboard.press("Enter"); settle()
    check("a value can be typed (40 means 40 %)", abs(ev("project.macros.intensity.v") - 0.4) < 1e-9, ev("project.macros.intensity.v"))
    check("a control that follows a macro says so", "Follows Speed (1.50×)" in pg.inner_text("#rightBody"), pg.locator("#rightBody .note.via:not([hidden])").all_inner_texts())
    reset(); settle()
    check("and doesn't once it is back to neutral", pg.locator("#rightBody .note.via:not([hidden])").count() == 0)
    sec.locator(".mshared .mfold").click(); settle()
    shared = sec.locator(".msub .row")
    check("the shared controls open, each off", shared.count() == 8 and all("off" in (shared.nth(i).get_attribute("class") or "") for i in range(8)))
    a = sec.locator(".row", has=pg.locator(".mlbl", has_text="Angle"))
    s2 = a.locator("input[type=range]"); s2.fill("0.75"); s2.dispatch_event("input"); settle()
    check("moving one turns it on, and the effect's angle says it follows", ev("project.macros.angle.on") and "off" not in (a.get_attribute("class") or "") and "Follows Angle" in pg.inner_text("#rightBody"))
    a.locator("input[type=checkbox]").uncheck(); settle()
    check("its tick turns it off", not ev("project.macros.angle.on") and "Follows Angle" not in pg.inner_text("#rightBody"))
    c1 = sec.locator(".row.mcolor").first
    c1.locator(".mfold").click(); settle()
    parts = sec.locator(".msub").first.locator(".row .lbl").all_inner_texts()
    check("Color 1 opens to its hue, saturation and value", parts[1:] == ["Hue", "Saturation", "Value"], parts)
    sec.locator(".msub").first.locator(".seg button", has_text="RGB").click(); settle()
    parts = sec.locator(".msub").first.locator(".row .lbl").all_inner_texts()
    check("or red, green and blue, without switching it on", parts[1:] == ["Red", "Green", "Blue"] and ev("project.macros.color1.mode") == "rgb" and not ev("project.macros.color1.on"), parts)
    g = sec.locator(".msub").first.locator(".row", has=pg.locator(".lbl", has_text="Green")).locator("input[type=range]")
    ev("setMacro('color1', { h: 0, s: 1, v: 1, on: false })"); settle(); g.fill("1"); g.dispatch_event("input"); settle()
    check("moving green makes it yellow, and on", [round(x * 255) for x in ev("macroRgb(project.macros.color1)")] == [255, 255, 0] and ev("project.macros.color1.on"))
    sw = c1.locator(".cswatch")
    check("its swatch shows it", "#FFFF00" in sw.inner_text(), sw.inner_text())
    sec.locator(".sec.macros h3 .mfold, h3 .mfold").first.click(); settle()
    check("folded, the section keeps one line, which says what is in use", pg.locator("#rightBody .sec.macros .row").count() == 0 and "Color 1" in pg.inner_text("#rightBody .sec.macros h3"), pg.inner_text("#rightBody .sec.macros h3"))
    pg.reload(); pg.wait_for_function("window.olm && olm.bridge.connected"); ev("ui.rightTab = 'content'; renderRight()"); settle()
    check("and stays folded the next time", pg.locator("#rightBody .sec.macros .row").count() == 0 and not ev("ui.macrosOpen"))
    ev("ui.macrosOpen = true; ui.macroOpen = []; savePrefs(); renderRight()"); reset(); settle()

    # ---------- MIDI
    ev("ui.midiOn = true; ui.midiVc = false")
    def cc(n, v): ev(f"midiIn({{ port: 'K', ch: 1, type: 'cc', num: {n}, val: {v} }})"); time.sleep(0.03)
    ev("midiSetLearn(true)"); cc(21, 10); settle(0.1)
    pg.locator('#rightBody .mslot[data-midi="m:speed"]').click(); settle()
    check("learning, a MIDI control goes onto the Speed slider (which stays where it was)", ev("project.midi.maps.some(w => w.key === 'midi:K:1:cc:21' && w.to === 'm:speed')") and ev("project.macros.speed.v") == 1)
    c1 = pg.locator("#rightBody .row.mcolor").first; c1.locator(".mfold").click(); settle()
    cc(22, 10); settle(0.1); pg.locator('#rightBody .mslot[data-midi="m:color1.0"]').click(); settle()
    ev("midiSetLearn(false)"); settle()
    check("and another onto Color 1's hue", ev("project.midi.maps.some(w => w.key === 'midi:K:1:cc:22' && w.to === 'm:color1.0')"))
    for v in (60, 64, 100): cc(21, v)
    settle()
    check("with pickup, Speed follows the fader once it reaches 1×", abs(ev("project.macros.speed.v") - 200 / 127) < 1e-6, ev("project.macros.speed.v"))
    cc(22, 0); cc(22, 127); cc(22, 64); settle()
    check("the hue fader moves the hue and turns Color 1 on", abs(ev("project.macros.color1.h") - 64 / 127 * 360) < 1e-6 and ev("project.macros.color1.on"), ev("project.macros.color1"))
    check("the slider shows where the fader is", pg.locator('#rightBody .mslot[data-midi="m:speed"] .fline').is_visible())
    check("a mapping onto a macro is named after it", ev("midiTargetLabel('m:speed')") == "Speed" and ev("midiTargetLabel('m:color1.0')") in ("Color 1 · Hue", "Color 1 · Red"))
    with pg.expect_popup() as pi: pg.click("#btnMidi")
    W = pi.value; settle(0.6)
    opts = W.locator(".mmap select.mtarget").first.locator("optgroup[label=Macros] option").all_inner_texts()
    check("the MIDI window's list has the macros", opts[:3] == ["Speed", "Intensity", "Saturation"] and "Fade" in opts and any(o.startswith("Color 1 · ") for o in opts), opts)
    W.close()

    # ---------- devices
    ev("remoteFromDevice('a', 'operator', { op: 'macro', id: 'saturation', patch: { v: 0.25 } })")
    ev("remoteFromDevice('b', 'remote', { op: 'macro', id: 'saturation', patch: { v: 0.9 } })")
    ev("remoteFromDevice('c', 'programmer', { op: 'macro', id: 'nope', patch: { v: 0.9 } })")
    check("an operator's device can move a macro, a phone can't", ev("project.macros.saturation.v") == 0.25)
    check("the devices hear the macros with the master", ev("remoteLive().macros.saturation.v") == 0.25)
    check("no errors on the page", not errs, errs[:3])
    br.close()
finally:
  bridge.terminate()
print("FAILED: " + (", ".join(fails) if fails else "none"))
