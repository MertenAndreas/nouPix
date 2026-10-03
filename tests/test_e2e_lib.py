import os
A, B = [0.8, 0.4, 0.2], [0.5, 0.5, 1.0]
def base_project(layers, scenes=None):
    return {"name": "T", "settings": {"compW": 400, "compH": 200, "transition": 0, "gamma": 1},
            "fixtures": [{"id": "f1", "type": "line", "name": "L", "enabled": True, "locked": False, "tag": "#fff", "order": "RGB",
                          "reverse": False, "dimmer": 1, "x1": 100, "y1": 100, "x2": 300, "y2": 100, "pixels": 5}],
            "controllers": [{"id": "c1", "name": "C", "ip": "127.0.0.1", "enabled": True, "outputs": 1, "upo": 1, "startUniverse": 3, "split": False, "chains": [["f1"]]}],
            "zones": [{"id": "z1", "name": "Zone 1", "tag": "#ffb341", "x": 0, "y": 0, "w": 400, "h": 200, "opacity": 1, "layers": layers, "scenes": scenes or [], "scene": None}]}
def solid(c, **kw): return dict({"id": kw.pop("id", None) or os.urandom(4).hex(), "src": "b-solid", "params": {"b-solid": {"color": c + [1]}}, "opacity": 1, "blend": "alpha", "on": True}, **kw)

