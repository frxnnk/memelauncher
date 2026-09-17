"""Download only the pinned public reference files; no credentials or execution."""
import hashlib
import json
from pathlib import Path
import urllib.request

root = Path(__file__).resolve().parents[1]
pin = json.loads((root / 'vendor/shiu.pin.json').read_text(encoding='utf-8-sig'))
destination = root / 'vendor/shiu'
destination.mkdir(parents=True, exist_ok=True)
for name, info in pin['files'].items():
    if Path(name).name != name:
        raise ValueError('Invalid pinned filename')
    path = destination / name
    if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest() == info['sha256']:
        print('Verified existing', name)
        continue
    url = f"https://raw.githubusercontent.com/philshiu/Drosophila_brain_model/{pin['commit']}/{name}"
    with urllib.request.urlopen(url, timeout=60) as response:
        data = response.read(info['bytes'] + 1)
    if len(data) != info['bytes'] or hashlib.sha256(data).hexdigest() != info['sha256']:
        raise ValueError('Download checksum mismatch')
    if path.exists():
        raise ValueError(f'Refusing to overwrite different existing file: {name}')
    path.write_bytes(data)
    print('Downloaded and verified', name)
