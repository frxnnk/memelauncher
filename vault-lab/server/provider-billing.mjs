export const ZERO_COMPLETION_POLICY = 'https://openrouter.ai/docs/guides/features/zero-completion-insurance';

// Preserve raw usage. A documented no-charge result is not a reported token count.
export function receiptBilling(receipt) {
  const cost = receipt?.usage?.cost;
  if (cost != null) return typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 && cost <= 1000000
    ? { cost, source: 'existing-local-receipt-not-independent-proof' } : null;
  const message = receipt?.outputMessage;
  if (receipt?.status !== 'error' || receipt.error?.code !== 'INVALID_MODEL_RESPONSE' ||
      // This validation point is reached only after exactly one choice and the
      // requested model identity were verified, including in older receipts.
      receipt.error?.message !== 'The response was incomplete or interrupted. This does not count as a loss.' ||
      receipt.finishReason !== 'error' || !/^gen-[a-zA-Z0-9_-]+$/.test(receipt.upstreamId ?? '') ||
      typeof receipt.modelRequested !== 'string' || receipt.modelRequested !== receipt.modelReturned ||
      !message || message.role !== 'assistant' || message.content != null || message.reasoning != null ||
      message.reasoning_details != null || message.refusal != null ||
      (message.tool_calls != null && (!Array.isArray(message.tool_calls) || message.tool_calls.length)) ||
      !Array.isArray(receipt.toolCalls) || receipt.toolCalls.length ||
      (receipt.usage?.completion_tokens != null && receipt.usage.completion_tokens !== 0)) return null;
  return { cost: 0, source: 'openrouter-zero-completion-policy', policyUrl: ZERO_COMPLETION_POLICY };
}
