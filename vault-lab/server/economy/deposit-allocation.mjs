// A declared funding purpose is not proof of a sponsor's identity or fee origin.
// Contributions enter the existing reserve, never a player's spendable balance.
export function prizeAllocation(source) {
  if (!['seed', 'sponsor'].includes(source)) throw new Error('Choose a seed or sponsor contribution; creator-fee claims need a verified integration.');
  return { kind: 'prize-reserve', source, policy: 'prize-reserve-v1' };
}

export function depositAllocation(value) {
  if (value === undefined) return undefined; // Preserve historical top-up records.
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid deposit allocation.');
  const expected = prizeAllocation(value.source);
  if (Object.keys(value).length !== 3 || Object.keys(expected).some(key => value[key] !== expected[key])) throw new Error('Invalid deposit allocation.');
  return expected;
}
