#!/usr/bin/env python3
"""api2ui.py — convert ComfyUI API-format workflow JSONs into UI-format
graphs so they render on the canvas when opened from the Workflows tab.

Usage: python3 scripts/api2ui.py file1.json [file2.json ...]
Converts in place (API originals stay untouched under gateway/workflows/).
"""
import json
import sys
import urllib.request


def fetch_object_info(url="http://localhost:8188/object_info"):
    return json.load(urllib.request.urlopen(url))


def convert(api: dict, obj: dict) -> dict:
    nodes = []
    links = []
    link_id = 0

    # Pre-scan: every connection input becomes a link
    pending_inputs = []  # (node_id, input_name, src_api, src_slot, type)
    for aid, node in api.items():
        spec = obj.get(node["class_type"], {}).get("input", {})
        decl = list(spec.get("required", {}).items()) + list(spec.get("optional", {}).items())
        for name, v in decl:
            val = node["inputs"].get(name)
            if isinstance(val, list) and len(val) == 2:
                link_id += 1
                pending_inputs.append((aid, name, int(val[0]), int(val[1]), str(v[0]), link_id))

    last_link_id = len(pending_inputs)

    for aid, node in api.items():
        aid_int = int(aid)
        ctype = node["class_type"]
        info = obj.get(ctype, {})
        spec = info.get("input", {})
        decl = list(spec.get("required", {}).items()) + list(spec.get("optional", {}).items())

        widgets = []
        ui_inputs = []
        for name, v in decl:
            val = node["inputs"].get(name)
            if isinstance(val, list) and len(val) == 2:
                lid = next(lid for (n_, nm, _, _, _, lid) in pending_inputs
                           if n_ == aid and nm == name)
                ui_inputs.append({"name": name, "type": str(v[0]), "link": lid})
            elif val is not None:
                widgets.append(val)

        out_types = info.get("output", [])
        out_names = info.get("output_name", out_types)
        outputs = [
            {"name": out_names[i] if i < len(out_names) else str(out_types[i]),
             "type": t, "links": [
                 lid for (sa, nm, _, ss, ty, lid) in pending_inputs
                 if sa == aid_int and ss == i
             ]}
            for i, t in enumerate(out_types)
        ]

        nodes.append({
            "id": aid_int,
            "type": ctype,
            "pos": [260 * ((aid_int - 1) % 5), 240 * ((aid_int - 1) // 5)],
            "size": [300, 140],
            "flags": {},
            "order": aid_int,
            "mode": 0,
            "inputs": ui_inputs,
            "outputs": outputs,
            "properties": {"Node name for S&R": ctype},
            "widgets_values": widgets,
        })

    for (target_id, target_name, src_api, src_slot, ltype, lid) in pending_inputs:
        links.append([lid, src_api, src_slot, target_id, 0, ltype])

    return {
        "id": "converted-api",
        "revision": 0,
        "last_node_id": max(int(k) for k in api) if api else 0,
        "last_link_id": last_link_id,
        "nodes": nodes,
        "links": links,
        "groups": [],
        "config": {},
        "extra": {"ds": {"scale": 0.6, "offset": [100, 100]}},
        "version": 0.4,
    }


def main():
    obj = fetch_object_info()
    for path in sys.argv[1:]:
        api = json.load(open(path))
        ui = convert(api, obj)
        json.dump(ui, open(path, "w"), indent=1, ensure_ascii=False)
        print(f"{path}: {len(ui['nodes'])} 节点, {len(ui['links'])} 连线 → UI 格式")


if __name__ == "__main__":
    main()
