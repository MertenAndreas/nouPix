# Weft LED Mapper 0.1

A basic pixel-mapping tool: draw or import LED fixtures (lines, matrices, circles, free paths), play generators, ISF shaders, images, video or a screen capture across them, patch them to Art-Net controller outputs, and send it out.

The interface runs in your browser. `weft.py` is a small local server that sends the Art-Net packets, because browsers cannot send UDP.

## Start

You need Python 3.8 or newer. Nothing else to install.

- **Windows:** double-click `start-weft.bat`
- **macOS:** double-click `start-weft.command` (the first time, right-click → Open)
- **Any system:** `python3 weft.py`

Your browser opens at `http://127.0.0.1:8080/`. Chrome or Edge work best. Keep the terminal window open: closing it stops the Art-Net output. Give Weft its own browser window rather than a background tab, because browsers can slow down hidden tabs.

On Windows, allow Python through the firewall on private networks when asked, otherwise node discovery won't receive replies.

## Workflow

1. **Settings → Composition.** Set the size of the canvas the content is rendered at. Fixture coordinates use these units.
2. **Fixtures.** Pick a tool on the stage: `L` line, `M` matrix, `C` circle/ring, `P` path. Drag to draw, or click for a default size. You can also bring fixtures in with **SVG…** (see below). Edit exact values in the Inspector, including pixel count, color order, wiring start and direction.
3. **Patch.** In the Patch panel, add a controller: IP address, number of outputs, universes per output and first universe. Then drag fixtures from the list onto an output. Fixtures chained on one output are addressed in order, automatically.
4. **Source.** Click a generator in Sources. Tweak it in the Content tab. You can also add your own ISF shader, an image, a video, or a window capture (for example Resolume's output).
5. **Art-Net ON.**

`Identify` (or `I`) lights only the selected fixtures: first pixel red, last pixel blue, and a green dot running in wiring order. Use it to check direction and patching on the real install.

## How addressing works

- Controller output *n* (counting from 0) starts at `first universe + n × universes per output`.
- **Whole pixels** mode never splits a pixel across universes: 170 RGB or 128 RGBW pixels per universe, as most pixel controllers expect. **Split** mode packs all 512 channels.
- Pixels that don't fit in an output's universes are not sent. They show in red in the Patch panel and Inspector.
- Universe numbers are Art-Net 15-bit port addresses, starting at 0. The DMX Monitor also shows them as net / subnet / universe.
- Every packet is a full 512-channel ArtDmx packet with a sequence number, sent unicast to the controller's IP. ArtSync is optional (Settings).
- **Gamma**, **master**, **RGB trim** and **RGBW white extraction** are applied to the output. The stage preview shows the colours before gamma.

## SVG import

Circles, arcs, lines and paths become fixtures, fitted into the composition. Circles keep the start point and drawing direction from the SVG. Shapes drawn exactly on top of each other are imported once. The SVG can also be kept as a guide image for tracing. Set the real pixel count per fixture afterwards; select several fixtures to set them all at once.

## Network notes

- To send from a specific network card (for example a 2.x.x.x Art-Net network), use `python3 weft.py --bind-ip 2.0.0.10`.
- Discovery listens on UDP 6454. If another Art-Net program is running, Weft still sends, but discovery is off. The Nodes tab says so.
- To reach the interface from a tablet on the same network: `python3 weft.py --host 0.0.0.0`.
- Other options: `--port 9000` (web port), `--no-browser`, `--bind-port 0`.

## Files

- The current project is kept in the browser automatically.
- **Project → Save project file** writes a `.weft.json` you can open again later or on another computer.
- **Project → Export patch list** writes a CSV with every fixture's controller, output and start/end universe and channel, for the install crew.
- Image and video files are not stored in projects. Browsers don't keep file access between sessions, so re-link them from the Content tab.

## Limits of this version

Art-Net only (no sACN/E1.31 yet). One content layer at a time, with crossfades. No Syphon, Spout or NDI: use window capture instead. It's been tested in Chromium; Firefox and Safari should work but are less tested.

## Credits

The ISF renderer is [interactive-shader-format](https://github.com/Vidvox/interactive-shader-format-js) by VIDVOX (ISC licence), bundled inside `index.html`.
