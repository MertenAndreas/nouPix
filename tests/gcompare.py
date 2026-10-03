import json, sys
a, b = json.load(open(sys.argv[1])), json.load(open(sys.argv[2]))
bad = 0
for k in a:
    if k not in b: print("missing", k); bad += 1; continue
    x, y = a[k], b[k]
    dmx_same = x["dmx"] == y["dmx"]
    cols_same = x["cols"] == y["cols"]
    stage_same = x["stage"] == y["stage"]
    nu = sum(len(v) for v in x["dmx"].values())
    if not dmx_same:
        diffs = [(ip, u) for ip in set(x["dmx"]) | set(y["dmx"]) for u in set(x["dmx"].get(ip, {})) | set(y["dmx"].get(ip, {})) if x["dmx"].get(ip, {}).get(u) != y["dmx"].get(ip, {}).get(u)]
        print(f"  {k}: DMX differs in {len(diffs)} universes, e.g. {diffs[:4]}")
    if not cols_same:
        nd = sum(1 for f1, f2 in zip(x["cols"], y["cols"]) for c1, c2 in zip(f1, f2) if c1 != c2)
        mx = max((abs(c1 - c2) for f1, f2 in zip(x["cols"], y["cols"]) for c1, c2 in zip(f1, f2)), default=0)
        print(f"  {k}: pixel colours differ in {nd} channels (max diff {mx})")
    print(f"{'SAME' if dmx_same and cols_same and stage_same else 'DIFF'}  {k:20s} universes {nu:3d}  dmx {'=' if dmx_same else '≠'}  pixels {'=' if cols_same else '≠'}  stage {'=' if stage_same else '≠'}")
    bad += not (dmx_same and cols_same and stage_same)
print("ALL IDENTICAL" if not bad else f"{bad} scenario(s) differ")
