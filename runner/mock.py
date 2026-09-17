"""Synthetic integration fixture. No connectome, no scientific claims."""
import random

def simulate(manifest):
    rng = random.Random(manifest['seed']['value'])
    neuron = manifest['rule']['output_ids'][0]
    for i in range(manifest['duration_ms'] // manifest['bin_ms']):
        spikes = []
        for tick in range(manifest['bin_ms'] * 10):
            if rng.random() < manifest['stimulus']['hz'] / 10000 and not manifest['stimulus']['silence_output']:
                spikes.append({'neuron_id': neuron, 't_us': i * 10000 + tick * 100})
        yield {'type': 'frame', 'provenance': 'MOCK', 'seq': i, 't_ms': i * 10, 'spikes': spikes}
