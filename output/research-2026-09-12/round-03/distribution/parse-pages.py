import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def walk(value):
    yield value
    if isinstance(value, dict):
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def parse_html(path):
    html = path.read_text(encoding="utf-8-sig")
    segments = []
    for match in re.finditer(r"self\.__next_f\.push\((\[.*?\])\)</script>", html):
        push = json.loads(match[1])
        if len(push) > 1 and isinstance(push[1], str):
            segments.append(push[1])
    payload = "".join(segments)
    objects = []
    for line in payload.splitlines():
        if ":" in line:
            candidate = line.split(":", 1)[1]
            try:
                objects.append(json.loads(candidate))
            except json.JSONDecodeError:
                pass
    return objects


for path in sorted(ROOT.glob("coin-*.html")):
    objects = parse_html(path)
    relevant = [v for obj in objects for v in walk(obj) if isinstance(v, dict) and ("paid" in v or "initial" in v)]
    target = path.with_suffix(".json")
    target.write_text(json.dumps(relevant, ensure_ascii=False, indent=2), encoding="utf-8")
    print(path.stem, [(list(v.keys()), {k:v[k] for k in ["paid", "dropped"] if k in v}) for v in relevant])
for name in ["rounds", "analytics"]:
    path = ROOT / f"{name}.html"
    objects = parse_html(path)
    (ROOT / f"{name}-rsc.json").write_text(json.dumps(objects, ensure_ascii=False, indent=2), encoding="utf-8")
