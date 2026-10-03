# The bridge moves Weft's window profile (~/.weft) to ~/.openledmapper once, unless the old window is open
import importlib.util, os, sys, tempfile
def load(home):
    os.environ["HOME"] = home; os.environ["USERPROFILE"] = home   # never the real home (Windows reads USERPROFILE)
    spec = importlib.util.spec_from_file_location("olm_mod", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "openledmapper.py"))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
ok = True
def check(name, cond, detail=""):
    global ok; ok &= bool(cond); print(("PASS " if cond else "FAIL ") + name, detail)
# 1. old profile only: it is moved, with its contents
h = tempfile.mkdtemp(); os.makedirs(os.path.join(h, ".weft", "browser-profile", "Default")); open(os.path.join(h, ".weft", "browser-profile", "Default", "Local Storage"), "w").write("x")
m = load(h); p = m.profile_dir()
check("old profile is moved to the new place", p == os.path.join(h, ".openledmapper", "browser-profile") and os.path.exists(os.path.join(p, "Default", "Local Storage")) and not os.path.exists(os.path.join(h, ".weft")), p)
# 2. the old window is still open (SingletonLock): the old profile is used where it is
h = tempfile.mkdtemp(); os.makedirs(os.path.join(h, ".weft", "browser-profile")); os.symlink("host-1234", os.path.join(h, ".weft", "browser-profile", "SingletonLock"))
m = load(h); p = m.profile_dir()
check("open old window: its profile is used, not moved", p == os.path.join(h, ".weft", "browser-profile") and os.path.isdir(os.path.join(h, ".weft")), p)
# 3. both exist: the new one wins and the old one is left alone
h = tempfile.mkdtemp(); os.makedirs(os.path.join(h, ".weft", "browser-profile")); os.makedirs(os.path.join(h, ".openledmapper", "browser-profile"))
m = load(h); p = m.profile_dir()
check("both exist: the new profile is used", p == os.path.join(h, ".openledmapper", "browser-profile") and os.path.isdir(os.path.join(h, ".weft")), p)
# 4. neither exists: the new one
h = tempfile.mkdtemp(); m = load(h); p = m.profile_dir()
check("fresh install: the new profile", p == os.path.join(h, ".openledmapper", "browser-profile"), p)
print("ALL PASS" if ok else "SOME FAILED")
