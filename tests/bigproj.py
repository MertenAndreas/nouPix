# A large installation: ~30k pixels over 1920x1080, 3 zones, 6 layers, 2 controllers
def big_project(ctrl_ip="127.0.0.1", k=1.0):
    S = lambda v: round(v * k, 2)
    fx, chains = [], [[] for _ in range(16)]
    kk = 0
    for i in range(12):   # 12 matrices 64x32
        cx, cy = 180 + (i % 4) * 480, 170 + (i // 4) * 360
        f = {"id": "m%d" % i, "type": "matrix", "name": "M%d" % i, "enabled": True, "locked": False, "tag": "#3cc8ff", "order": "GRB", "reverse": False, "dimmer": 1,
             "cx": S(cx), "cy": S(cy), "w": S(400), "h": S(200), "rot": 0, "cols": 64, "rows": 32, "start": "TL", "dir": "H", "snake": True}
        fx.append(f); chains[i].append(f["id"])
    for i in range(40):   # 40 strips of 150
        y = 20 + i * 26
        f = {"id": "s%d" % i, "type": "line", "name": "S%d" % i, "enabled": True, "locked": False, "tag": "#ffb341", "order": "RGB", "reverse": i % 2 == 1, "dimmer": 1,
             "x1": S(60), "y1": S(y), "x2": S(1860), "y2": S(y), "pixels": 150}
        fx.append(f); chains[12 + i % 4].append(f["id"])
    L = lambda src, params=None, **kw: dict({"id": "l" + src + str(len(params or {})), "src": "b-" + src, "params": {"b-" + src: params or {}}, "opacity": 1, "blend": "alpha", "on": True}, **kw)
    zones = [
        {"id": "za", "name": "All", "tag": "#ffb341", "x": 0, "y": 0, "w": S(1920), "h": S(1080), "opacity": 0.6, "layers": [L("plasma"), L("twinkle", blend="add", opacity=0.7)], "scenes": [], "scene": None},
        {"id": "zb", "name": "Left", "tag": "#b58cff", "x": 0, "y": 0, "w": S(960), "h": S(1080), "opacity": 1, "layers": [L("fire"), L("noise", blend="multiply")], "scenes": [], "scene": None},
        {"id": "zc", "name": "Right", "tag": "#46e08c", "x": S(960), "y": 0, "w": S(960), "h": S(1080), "opacity": 1, "layers": [L("rainbow", {"mode": 2}), L("bars", blend="screen", opacity=0.5)], "scenes": [], "scene": None},
    ]
    zones = [zones[1], zones[2], zones[0]]
    return {"name": "Big", "settings": {"compW": S(1920), "compH": S(1080), "gamma": 2.2, "fps": 40, "transition": 0},
            "fixtures": fx, "controllers": [{"id": "cb", "name": "Big", "ip": ctrl_ip, "enabled": True, "outputs": 16, "upo": 16, "startUniverse": 0, "split": False, "chains": chains}],
            "zones": zones}
