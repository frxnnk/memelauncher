import { z } from 'zod';
const checksum = z.string().regex(/^[a-f0-9]{64}$/);
const strict = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict();
export const termsSchema = strict({
  chain: z.literal('robinhood'), chain_id: z.literal(4663), platform: z.literal('bankr-proposed'),
  issuer: z.literal('UNSET'), quote_asset: z.literal('NVDA_UNVERIFIED'), beneficiary: z.literal('UNSET'),
  supply: z.null(), creator_allocation: z.literal(0), initial_buy: z.literal(0),
  disable_vesting: z.literal(true), fee_bps: z.null(), max_budget_wei: z.literal('0'), status: z.literal('PROPOSED')
});
export const manifestSchema = strict({
  schema: z.literal('bellfly-manifest-v1'), kind: z.literal('ENGINEERING_REHEARSAL'),
  live_execution_enabled: z.literal(false), created_at: z.string().datetime(),
  runner: z.enum(['MOCK','SHIU_REFERENCE']), model_commit: z.string(),
  files: z.record(z.string(), checksum), code_hash: checksum,
  environment: z.record(z.string(), z.string()),
  seed: strict({ mechanism: z.literal('FIXED_LOCAL'), value: z.number().int().min(0).max(4294967295) }),
  duration_ms: z.number().int().min(10).max(1000), dt_us: z.literal(100), bin_ms: z.literal(10),
  stimulus: strict({ type: z.literal('sugarR'), hz: z.number().int().min(0).max(150), neuron_ids: z.array(z.string()).min(1), silence_output: z.boolean() }),
  rule: strict({ output_ids: z.array(z.string()).min(1), min_spikes: z.number().int().positive(),
    consecutive_bins: z.number().int().positive(), rationale: z.string() }),
  terms: termsSchema,
  commitment: strict({ scope: z.literal('LOCAL_ONLY'), independent_timestamp: z.literal(false) })
});
export type Manifest = z.infer<typeof manifestSchema>;
export const frameSchema = strict({ type: z.literal('frame'), provenance: z.enum(['MOCK','SHIU_REFERENCE']),
  seq: z.number().int().min(0), t_ms: z.number().int().min(0),
  spikes: z.array(strict({ neuron_id: z.string(), t_us: z.number().int().min(0) })) });
export type Frame = z.infer<typeof frameSchema>;
export const resultSchema = strict({ type: z.literal('complete'), provenance: z.enum(['MOCK','SHIU_REFERENCE']),
  manifest_hash: checksum, seed: z.number().int(), duration_ms: z.number().int(),
  neurons_loaded: z.number().int().positive(), connections_loaded: z.number().int().min(0),
  ablated_connections: z.number().int().min(0),
  elapsed_ms: z.number().finite().min(0), peak_rss_bytes: z.number().int().min(0),
  vram_bytes: z.literal(0), environment: z.record(z.string(), z.string()) });
export type RunnerResult = z.infer<typeof resultSchema>;
export type Decision = 'LAUNCH_SIGNAL' | 'NO_LAUNCH' | 'INVALID';
export type State = 'DRAFT' | 'PREFLIGHT_PASSED' | 'COMMITTED' | 'RUNNING' | Decision;
