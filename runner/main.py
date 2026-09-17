"""Stdin manifest -> stdout NDJSON. No network, signing or environment credentials."""
import hashlib
import json
import os
from pathlib import Path
import platform
import sys
import time

ROOT = Path(__file__).resolve().parents[1]

def environment(real=False):
    result = {'python': platform.python_version(), 'platform': sys.platform}
    if real:
        from importlib.metadata import version
        packages = (ROOT / 'requirements.lock.txt').read_text(encoding='utf-8-sig').splitlines()
        for requirement in packages:
            if not requirement.strip() or requirement.startswith('#'):
                continue
            name, expected = requirement.split('==')
            if version(name) != expected:
                raise ValueError('DEPENDENCY_VERSION_MISMATCH')
            result[name] = version(name)
    return result

def digest(path):
    with open(path, 'rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def emit(value):
    print(json.dumps(value, separators=(',', ':')), flush=True)

def main():
    if '--environment' in sys.argv:
        emit(environment('--real' in sys.argv))
        return
    request = json.load(sys.stdin)
    m = request['manifest']
    # Controller computes the canonical manifest digest; runner checks exact received bytes.
    if hashlib.sha256(request['canonical'].encode()).hexdigest() != request['manifest_hash']:
        raise ValueError('MANIFEST_HASH_MISMATCH')
    if json.loads(request['canonical']) != m or m['live_execution_enabled'] is not False:
        raise ValueError('MANIFEST_MISMATCH')
    for name, expected in m['files'].items():
        path = (ROOT / name).resolve()
        if not path.is_relative_to(ROOT) or digest(path) != expected:
            raise ValueError('FILE_HASH_MISMATCH')
    real = m['runner'] == 'SHIU_REFERENCE'
    env = environment(real)
    if env != m['environment']:
        raise ValueError('ENVIRONMENT_MISMATCH')
    from reference import simulate as reference
    from mock import simulate as mock
    start = time.perf_counter()
    peak = 0
    neurons, connections = 1, 0
    ablated_connections = 0
    if real:
        import psutil
        process = psutil.Process(os.getpid())
    for event in (reference if real else mock)(m):
        if real:
            info = process.memory_info()
            peak = max(peak, getattr(info, 'peak_wset', info.rss))
        if event.get('loaded'):
            neurons, connections = event['neurons'], event['connections']
            ablated_connections = event['ablated_connections']
        else:
            emit(event)
    emit({'type':'complete','provenance':m['runner'],'manifest_hash':request['manifest_hash'],
          'seed':m['seed']['value'],'duration_ms':m['duration_ms'], 'neurons_loaded':neurons,
          'connections_loaded':connections,'ablated_connections':ablated_connections,'elapsed_ms':round((time.perf_counter()-start)*1000,3),
          'peak_rss_bytes':peak,'vram_bytes':0,'environment':env})

if __name__ == '__main__':
    try:
        main()
    except Exception:
        # Do not leak environment, paths, third-party error content or credentials into evidence.
        emit({'type':'error','code':'RUNNER_FAILED'})
        sys.exit(1)
