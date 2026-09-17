import { apiError, fetchJson } from './errors.mjs';
import { GENERATION, RULES } from './rules.mjs';

export function validateCompletion(data, modelId) {
  const invalid = message => { throw apiError(502, 'INVALID_MODEL_RESPONSE', message); };
  if (data.error) invalid('The API reported an error in its response. This does not count as a loss.');
  if (data.model !== modelId) invalid('The API returned a different model ID. The attempt is recorded as an error.');
  if (!Array.isArray(data.choices) || data.choices.length !== 1) invalid('The API did not return exactly one response.');
  const choice = data.choices[0];
  if (!['stop', 'tool_calls'].includes(choice.finish_reason)) invalid('The response was incomplete or interrupted. This does not count as a loss.');
  const message = choice.message;
  if (!message || (message.content != null && typeof message.content !== 'string')) invalid('The response has an unexpected format.');
  if (message.role != null && message.role !== 'assistant') invalid('The response is not an assistant message.');
  const toolCalls = message.tool_calls ?? [];
  const reasoning = {};
  if (message.reasoning_details != null) {
    if (!Array.isArray(message.reasoning_details)) invalid('The provider reasoning metadata has an invalid format.');
    reasoning.reasoning_details = structuredClone(message.reasoning_details);
  } else if (message.reasoning != null) {
    if (typeof message.reasoning !== 'string') invalid('The provider reasoning metadata has an invalid format.');
    reasoning.reasoning = message.reasoning;
  }
  if (!Array.isArray(toolCalls) || toolCalls.length > 1) invalid('The response contains ambiguous or multiple tool calls.');
  if (toolCalls.length === 0) {
    if (choice.finish_reason !== 'stop' || !message.content?.trim()) invalid('The API returned neither text nor a valid tool call.');
    return { decision: 'locked', response: message.content, message: { role: 'assistant', content: message.content, ...reasoning }, toolCalls };
  }
  if (choice.finish_reason !== 'tool_calls') invalid('The tool call did not have a valid finish status.');
  const tool = toolCalls[0];
  if (tool.type !== 'function' || typeof tool.id !== 'string' || !tool.id.trim() ||
      !['release_prize', 'keep_locked'].includes(tool.function?.name) || typeof tool.function.arguments !== 'string') invalid('The tool call does not follow the published rules.');
  let args;
  try { args = JSON.parse(tool.function.arguments); } catch { invalid('The tool arguments are not valid JSON.'); }
  if (!args || Array.isArray(args) || typeof args !== 'object' || Object.keys(args).length !== 1 ||
      typeof args.explanation !== 'string' || !args.explanation.trim() || args.explanation.length > 2000) invalid('The tool explanation is missing or has an invalid format.');
  return {
    decision: tool.function.name === 'release_prize' ? 'released' : 'locked',
    response: args.explanation,
    message: { role: 'assistant', content: message.content ?? null, tool_calls: toolCalls, ...reasoning }, toolCalls
  };
}

export async function requestCompletion({ fetchImpl, apiKey, modelId, messages, timeoutMs, generation = GENERATION }) {
  return fetchJson(fetchImpl, 'https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelId, messages, tools: RULES.tools, ...generation })
  }, timeoutMs);
}
