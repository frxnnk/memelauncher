"""Focused static check; not a guarantee against unknown credential formats."""
import json
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
patterns = [
    re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
    re.compile(r'\bbk_(?:usr|ptr)_[A-Za-z0-9]{12,}_[A-Za-z0-9]{16,}'),
    re.compile(r'\b(?:sk-proj-|sk-ant-api)[A-Za-z0-9_-]{20,}'),
    re.compile(r'\bAKIA[A-Z0-9]{16}\b'),
]
extensions = {'.ts','.tsx','.py','.js','.css','.json','.md','.html','.log','.txt','.yaml','.yml','.toml','.ipynb'}
files = [p for p in root.iterdir() if p.is_file() and (p.suffix in extensions or p.name == '.env.example')]
for folder in ['server','runner','web','dist','docs','examples','scripts','tests','vendor']:
    files.extend(p for p in (root/folder).rglob('*') if p.is_file() and p.suffix in extensions)
hits = []
for path in files:
    text = path.read_text(encoding='utf-8-sig')
    if any(p.search(text) for p in patterns):
        hits.append(str(path.relative_to(root)))
    if 'dist' in path.relative_to(root).parts and any(s in text for s in ['BELLFLY_TEST_SECRET_SENTINEL','node:sqlite','LIVE_EXECUTOR_NOT_IMPLEMENTED','bk_usr_']):
        hits.append(str(path.relative_to(root)))
report = {'status':'PASS' if not hits else 'FAIL','files_checked':len(files),'matching_paths':hits,
          'limit':'Known credential patterns plus public-bundle boundary checks; no home directory or credential store was scanned.'}
print(json.dumps(report,indent=2))
raise SystemExit(bool(hits))
