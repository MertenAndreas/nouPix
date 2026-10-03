import os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import start_bridge, CHROME_ARGS
from test_e2e_lib import base_project, solid
from playwright.sync_api import sync_playwright
bridge = start_bridge(8092)
JS = """async () => {
  const col = () => Array.from(olm.project.fixtures[0]._col.slice(6, 9));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const Z = olm.project.zones[0], S = Z.scenes;
  olm.goScene(Z, S[0], true); await wait(300);
  const t0 = performance.now(); olm.goScene(Z, S[1]);
  const samples = [];
  while (Z._fade) { samples.push([Math.round(performance.now() - t0), col()]); await wait(60); }
  const took = performance.now() - t0;
  await wait(200);
  // interrupted fade: go to S[1] (2 s), after ~1 s go back to S[0]
  olm.goScene(Z, S[0], true); await wait(300);
  const t1 = performance.now(); olm.goScene(Z, S[1]);
  while (performance.now() - t1 < 1000) await wait(30);
  const before = col(); olm.goScene(Z, S[0]);
  const after = [];
  const f = Z._fade, seenT = [];
  for (let i = 0; i < 6; i++) { const c0 = olm.clockT; await new Promise(r => { const k = () => olm.clockT !== c0 ? r() : setTimeout(k, 5); k(); }); after.push([ (olm.clockT - f.start) / f.dur, col() ]); }
  while (Z._fade) await wait(50);
  return { took, samples, before, after, end: col(), dur: S[1].fade };
}"""
with sync_playwright() as p:
    br = p.chromium.launch(args=CHROME_ARGS); pg = br.new_page()
    pg.goto("http://127.0.0.1:8092/"); pg.wait_for_function("window.olm && olm.bridge.connected")
    red, blue = solid([1, 0, 0], id="L1"), solid([0, 0, 1], id="L1")
    pg.evaluate("p => olm.loadProject(p)", base_project([solid([0, 1, 0])], [
        {"id": "s1", "name": "Red", "fade": 1.0, "layers": [red]}, {"id": "s2", "name": "Blue", "fade": 2.0, "layers": [blue]}]))
    r = pg.evaluate(JS)
    br.close()
bridge.terminate(); bridge.communicate()
s = r["samples"]
mono = all(s[i][1][2] <= s[i + 1][1][2] + 1 and s[i][1][0] >= s[i + 1][1][0] - 1 for i in range(len(s) - 1))
lin = max(abs(c[2] - 255 * min(1, t / 2000)) for t, c in s)
print("fade 2 s took %.0f ms over %d samples; monotonic=%s; max deviation from linear=%d/255" % (r["took"], len(s), mono, lin))
print("samples:", s[::max(1, len(s) // 8)])
print("interrupt: before", r["before"], "after (t, colour)", [[round(t, 3), c] for t, c in r["after"][:4]], "... end", r["end"])
exp = lambda t: [round(b + (e - b) * min(t, 1)) for b, e in zip(r["before"], [255, 0, 0])]
jump = max(max(abs(a - b) for a, b in zip(c, exp(t))) for t, c in r["after"])
print("PASS" if 1800 < r["took"] < 2400 and mono and lin < 40 and jump < 30 and r["end"] == [255, 0, 0] else "FAIL", "jump at interrupt =", jump)
