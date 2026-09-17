"""Runs upstream Shiu create_model/poi; numpy backend, no model equation edits."""
from pathlib import Path
import sys

def disconnect_incoming(syn, neuron_index):
    import numpy as np
    from brian2 import mV
    # Brian2 treats a boolean index array as integer indices, NOT as a NumPy mask.
    mask = np.asarray(syn.j[:]) == neuron_index
    affected = int(np.count_nonzero(mask))
    syn.w[f'j == {neuron_index}'] = 0 * mV
    if not affected or np.count_nonzero(np.asarray(syn.w[:])[mask]):
        raise ValueError('ABLATION_NOT_APPLIED')
    return affected

def simulate(manifest):
    import brian2 as b
    import pandas as pd
    import numpy as np
    root = Path(__file__).resolve().parents[1] / 'vendor' / 'shiu'
    sys.path.insert(0, str(root))
    import model
    b.start_scope()
    b.prefs.codegen.target = 'numpy'
    b.defaultclock.dt = manifest['dt_us'] * b.us
    b.seed(manifest['seed']['value'])
    params = dict(model.default_params)
    params['r_poi'] = manifest['stimulus']['hz'] * b.Hz
    params['t_run'] = manifest['duration_ms'] * b.ms
    params['n_run'] = 1
    comp = root / '2023_03_23_completeness_630_final.csv'
    con = root / '2023_03_23_connectivity_630_final.parquet'
    ids = [str(n) for n in pd.read_csv(comp, index_col=0).index]
    lookup = {n:i for i,n in enumerate(ids)}
    neu, syn, monitor = model.create_model(comp, con, params)
    inputs, neu = model.poi(neu, [lookup[n] for n in manifest['stimulus']['neuron_ids']], [], params)
    ablated = 0
    if manifest['stimulus']['silence_output']:
        # Intervention: sever incoming drive to declared output, not just its outgoing synapses.
        for output in manifest['rule']['output_ids']:
            ablated += disconnect_incoming(syn, lookup[output])
    network = b.Network(neu, syn, monitor, *inputs)
    yield {'loaded': True, 'neurons': len(neu), 'connections': len(syn), 'ablated_connections': ablated}
    seen = 0
    for i in range(manifest['duration_ms'] // manifest['bin_ms']):
        network.run(manifest['bin_ms'] * b.ms)
        now = len(monitor.i)
        spikes = [{'neuron_id': ids[int(n)], 't_us': int(round(float(t / b.us)))}
                  for n,t in zip(monitor.i[seen:now],monitor.t[seen:now])]
        seen = now
        yield {'type':'frame','provenance':'SHIU_REFERENCE','seq':i,'t_ms':i*10,'spikes':spikes}
