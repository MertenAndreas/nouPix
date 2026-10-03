# Soak: many scene recalls, project loads, undo/redo, zone and layer edits; JS heap and GPU objects must stay bounded
import os, sys, time, random, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import CHROME_ARGS, start_bridge
from test_e2e_lib import base_project, solid
from playwright.sync_api import sync_playwright
PORT, ROUNDS = int(sys.argv[1]), int(sys.argv[2])
rnd = random.Random(11)
bridge = start_bridge(PORT)
COUNT = """(() => { const P = WebGLRenderingContext.prototype; window.__gl = { programs: 0, textures: 0, buffers: 0, fbs: 0 };
  const wrap = (make, del, key) => { const m = P[make], d = P[del];
    P[make] = function () { const o = m.apply(this, arguments); if (o) window.__gl[key]++; return o; };
    P[del] = function (o) { if (o) window.__gl[key]--; return d.apply(this, arguments); }; };
  wrap('createProgram', 'deleteProgram', 'programs'); wrap('createTexture', 'deleteTexture', 'textures'); wrap('createBuffer', 'deleteBuffer', 'buffers'); wrap('createFramebuffer', 'deleteFramebuffer', 'fbs'); })();"""
fails = []
def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + ("  " + str(detail)[:400] if detail != "" else ""), flush=True); ok or fails.append(name)
with sync_playwright() as p:
    br = p.chromium.launch(args=CHROME_ARGS + ["--js-flags=--expose-gc", "--enable-precise-memory-info"])
    ctx = br.new_context(viewport={"width": 1440, "height": 900}); ctx.add_init_script(COUNT); pg = ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    pg.goto(f"http://127.0.0.1:{PORT}/"); pg.wait_for_function("window.olm && olm.bridge.connected")
    pg.evaluate("localStorage.clear(); olm.loadProject(olm.project); olm.setOutput(true)")
    demo = pg.evaluate("JSON.parse(JSON.stringify(olm.project, (k, v) => k.startsWith('_') ? undefined : v))")
    other = base_project([solid([1, 0, 0]), dict(solid([0, 0, 1]), src="b-plasma", params={}, blend="add")])
    def stats():
        return pg.evaluate("() => { gc(); gc(); return { heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1), gl: Object.assign({}, window.__gl), hist: undefined }; }")
    time.sleep(3)
    samples = []
    for r in range(ROUNDS):
        for _ in range(4):   # recall scenes in random zones, sometimes cutting
            pg.evaluate("c => { const zs = olm.project.zones.filter(z => z.scenes.length); if (!zs.length) return; const z = zs[Math.floor(Math.random() * zs.length)]; olm.goScene(z, z.scenes[Math.floor(Math.random() * z.scenes.length)], c); }", rnd.random() < 0.3)
            time.sleep(0.15)
        act = r % 5
        if act == 0: pg.evaluate("p => olm.loadProject(p)", other if (r // 5) % 2 == 0 else demo); time.sleep(0.6)
        elif act == 1: pg.evaluate("() => { newZoneFromUI(); addLayer(selZone()); olm.loadSource('b-noise'); }"); time.sleep(0.3)
        elif act == 2: pg.evaluate("() => { const z = selZone(); if (z && olm.project.zones.length > 1) deleteZone(z); }"); time.sleep(0.3)
        elif act == 3: pg.evaluate("() => { for (let i = 0; i < 3; i++) undo(); for (let i = 0; i < 2; i++) redo(); }"); time.sleep(0.3)
        else: pg.evaluate("() => { document.querySelector('#rightTabs button[data-tab=content]').click(); }"); time.sleep(0.3)
        if r % 5 == 4:
            if (r // 5) % 2 == 1:   # compare like with like: after loading the demo layout
                samples.append(stats())
    time.sleep(1)
    alive = pg.evaluate("() => new Promise(r => { const f0 = olm.frameIndex; setTimeout(() => r(olm.frameIndex > f0), 800); })")
    br.close()
bridge.terminate(); bridge.communicate()
print(json.dumps(samples))
first, last = samples[1], samples[-1]
check("JS heap stays bounded", last["heapMB"] < first["heapMB"] + 15, (first["heapMB"], last["heapMB"]))
check("GPU programs, textures, buffers and framebuffers stay bounded", all(last["gl"][k] <= first["gl"][k] + 4 for k in first["gl"]), (first["gl"], last["gl"]))
check("still running, no page errors", alive and not errs, errs[:3])
print("FAILED:", fails or "none")
