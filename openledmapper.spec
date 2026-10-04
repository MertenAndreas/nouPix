# PyInstaller recipe for the openLedMapper apps:  pip install pyinstaller && pyinstaller openledmapper.spec
# Windows: dist/openLedMapper.exe (one file). macOS: dist/openLedMapper.app, for the processor of the Mac that
# builds it. Neither opens a terminal window: the packed server runs in background mode (see openledmapper.py).
# .github/workflows/release.yml builds them on GitHub for every version tag.
import re
import sys

VERSION = re.search(r'^VERSION = "(.+)"', open("openledmapper.py", encoding="utf-8").read(), re.M).group(1)

a = Analysis(["openledmapper.py"], datas=[("index.html", ".")])
pyz = PYZ(a.pure)

if sys.platform == "darwin":
    exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name="openLedMapper", console=False)
    coll = COLLECT(exe, a.binaries, a.datas, name="openLedMapper")
    app = BUNDLE(
        coll,
        name="openLedMapper.app",
        bundle_identifier="studio.nouled.openledmapper",
        version=VERSION,
        info_plist={
            "CFBundleShortVersionString": VERSION,
            "CFBundleVersion": VERSION,
            "LSUIElement": True,  # no Dock icon of its own: the openLedMapper window is the app
            "NSHumanReadableCopyright": "GPL-3.0",
        },
    )
else:
    exe = EXE(pyz, a.scripts, a.binaries, a.datas, [], name="openLedMapper", console=False)
