# openLedMapper — notes for Claude Code

LED pixel-mapping software by Albert. Draw or import fixtures, split the
canvas into zones, layer ISF shaders / images / video / screen capture per zone, store scenes, patch fixtures to
Art-Net controller outputs, send. Albert works efficiently: short updates, test before handing over, say plainly
what was and wasn't verified.

## Layout

- `index.html` — the whole interface in one file (≈4,500 lines, no build step, no dependencies to install). The
  bundled ISF renderer (interactive-shader-format-js, ISC) and the built-in shaders (`BUILTINS`, a JSON array on
  one long line near the top) are inside it. Sections are marked `/* ===== name */`: utilities, model, geometry,
  patch/addressing, content sources, mixer, zones/fades, thumbnails, output, clock, bridge, stage view, form
  helpers, fixture list, source list, right panel, bottom dock, history + persistence, files, menus, demo,
  top bar + status, wiring the UI, boot.
- `openledmapper.py` — the bridge, Python 3.8+ standard library only: serves the page, a WebSocket for frames,
  sends ArtDmx/ArtSync over UDP, ArtPoll discovery, holds the last frame if the page stalls, one sending window at a
  time. Opens the page in its own Chrome/Edge/Chromium window with switches that stop background throttling.
  `VERSION` is here; the README title carries the same version.
- `start-openledmapper.bat` (CRLF) / `.command` (executable) — double-click launchers.
- `examples/` — a user ISF shader (Fruit of Life), used by the golden test.
- `tests/` — see Testing.

## Page ↔ bridge boundary (keep it small and fixed)

Everything network-related goes through one WebSocket. Page → bridge: binary frames
(`[u8 type=1][u8 flags(1=ArtSync)][u16 count]` then per universe `[4 ip][u16 universe][u16 512][512 ch]`), and JSON
`{t:'output', on}`, `{t:'poll', …}`. Bridge → page: `hello`, `stats`, `node`, `error`, `takeover`.
**Plan:** when version 1 is final, move to Electron (Windows + macOS builds via GitHub Actions) and rewrite only the
bridge in Node; the page should carry over almost untouched. So: no new Python-only features, nothing in the page
that assumes Python.

## Model (project JSON, `format: 'openledmapper-project', version: 3`)

- `fixtures[]`: `line | circle | matrix | path`; `order` (RGB…/RGBW/W), `trim: [r,g,b,w]` per fixture, `dimmer`,
  `reverse`, `enabled`, `locked`, optional `group`, optional `addr: {u, ch}` (advanced patch: start address set by
  hand, only used inside its output's universes). Paths may have `ctl` (pen curves: in/out handle offsets per
  point, 4 numbers per point); `pathPoly(f)` is the line a path runs along — use it, not `f.pts`, for anything
  geometric.
- `groups[]`: one level only, a fixture in at most one group, members always contiguous in `fixtures`
  (`normalizeGroups()` enforces it and drops empty groups). List order = draw order (last on top) and Auto-patch order.
- `controllers[].chains[output] = [fixture ids]` — the patch order; independent of the list order.
- `zones[]` (later in the array = on top): rectangle, `opacity` (its master), `layers[]`, `scenes[]`, current `scene`.
- `hydrate()` tolerates old, partial and hand-edited files: missing or bad values get defaults. Old global
  `settings.trim` migrates to every fixture's `trim`. Any new field needs a matching rule there, plus a test.
- Undo: `commit()` snapshots the serialized project; `commitSoft()` debounced. Fold state of groups survives undo.

## Behaviour worth knowing

- Speed: a float input named `speed` (built-ins, or custom shaders using `TIME * speed`) is shown as 0–100 % of its
  range plus Reverse. Each layer has its own clock (`speedClocks`, key `layerId|sourceId`); the shader gets that clock
  as TIME and ±full speed as speed, so moving the slider is smooth. Constant speeds give byte-identical output to before.
- Output: GPU mixer per zone → sampled at pixel positions (adaptive GPU/CPU pick) → gamma, master, trims, white
  extraction → universes. Frame rate 1–100 (default 40), worker timer.
- Stage clicks select whole groups; double-click selects one fixture inside. Arrange treats whole groups as blocks
  (one group selected: its fixtures line up with each other).
- Duplicate patches a copy after the others on the original's output only if all its pixels fit.

## UI text style

Plain, specific British English (colour, centre). Say what something does and what happens, not marketing. Tooltips
and notes are short sentences. No emoji. Keep the dark theme's CSS variables (`--accent` #3cc8ff, etc.).

## Testing

```
pip install playwright && playwright install chromium
python tests/run_tests.py --quick     # ~5 min: every functional suite
python tests/run_tests.py             # ~12 min: plus golden output, soak and fuzz
python tests/run_tests.py groups v05  # just some suites
```

- Tests run the real bridge and headless Chromium (Playwright) with a fake Art-Net node on UDP 6454, so quit
  MadMapper or other Art-Net software first.
- `golden`: byte-exact DMX output, pixel colours and stage checksum of fixed scenes, compared with
  `tests/golden/`. Any change to output must keep it ALL IDENTICAL unless the change is meant to alter output (then
  say so and re-record deliberately with `golden.py`). On macOS it needs `sudo ifconfig lo0 alias 127.0.0.2 up` and
  `…127.0.0.3 up` once per boot (the runner skips it otherwise).
- The page exposes `window.olm` for tests (project, ui, tick, computePatch, universes…); top-level functions are
  globals and can be called from `page.evaluate`.
- Add a test file per feature batch (`test_<name>.py`, `check(...)` lines, ends with `FAILED: none`) and register it
  in `SUITES` in `tests/run_tests.py`.
- Before handing over: run the suites, look at screenshots of UI changes, bump `VERSION` + README title, update
  README for user-visible changes.

## Ideas discussed for later

- Right-click context menus (group, ungroup, duplicate, delete, identify, lock, patch) — right-drag must still pan.
- A user manual in `docs/` (Markdown, screenshots generated by the test scripts), published with GitHub Pages and
  opened from the app. Language still to be decided.
- Speed-like fix for other rate sliders (Breathe, Strobe, Checkerboard).
- Performance readout (time per frame: render / output / preview, GPU name).
- Raspberry Pi as a standalone player: start on boot, kiosk mode, open last project.
- 3D (version 2): pixel positions with z; importer for Cinema 4D (a small C4D Python script exporting splines /
  Cloner points to JSON, plus glTF/OBJ as reference model); 3D preview with 2D edit views; mapping per zone: planar,
  cylindrical/spherical projection (reuses all shaders), volumetric shaders evaluated per LED (xyz), UV mapping last;
  zones as volumes or groups. Patch/Art-Net unchanged.
- Electron after version 1 (see above).
