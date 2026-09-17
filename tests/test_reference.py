"""Regression for Brian2 indexing: assert real synapse values, not a mocked mask."""
import sys
import unittest
sys.path.insert(0, 'runner')
import brian2 as b
import numpy as np
from reference import disconnect_incoming

class AblationTest(unittest.TestCase):
    def test_only_incoming_edges_are_zeroed(self):
        b.start_scope()
        b.prefs.codegen.target = 'numpy'
        neurons = b.NeuronGroup(4, 'v : volt')
        syn = b.Synapses(neurons, neurons, 'w : volt')
        syn.connect(i=[0,1,2,3], j=[1,2,2,1])
        syn.w = [10,20,30,40] * b.mV
        self.assertEqual(disconnect_incoming(syn, 2), 2)
        np.testing.assert_array_equal(syn.w[:] / b.mV, [10,0,0,40])

if __name__ == '__main__':
    unittest.main()
