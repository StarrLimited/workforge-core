type ErrorNode = Record<string, unknown>;
export type AICredential = 'api-key' | 'vercel-identity' | 'none';

// Only fixed categories and numeric HTTP statuses leave this function. Provider
// messages, response bodies, request headers and credentials must never be logged.
export function aiFailure(error: unknown, credential: AICredential = 'none') {
 const queue: unknown[] = [error];
 const seen = new Set<unknown>();
 const messages: string[] = [];
 const statuses: number[] = [];
 for (let count = 0; queue.length && count < 64; count++) {
  const value = queue.shift();
  if (!value || typeof value !== 'object' || seen.has(value)) continue;
  seen.add(value);
  const node = value as ErrorNode;
  for (const key of ['name', 'type', 'code', 'message']) {
   if (typeof node[key] === 'string') messages.push(node[key].slice(0, 8000));
  }
  if (Number.isInteger(node.statusCode) && Number(node.statusCode) >= 400 && Number(node.statusCode) <= 599) statuses.push(Number(node.statusCode));
  queue.push(node.cause, node.lastError, node.error, node.response);
  if (Array.isArray(node.errors)) queue.push(...node.errors.slice(0, 4));
  // AI SDK preserves the original Gateway response on the APICallError cause.
  // Its contextual authentication message alone can hide a billing rejection.
  if (typeof node.responseBody === 'string' && node.responseBody.length <= 16000) {
   try { queue.push(JSON.parse(node.responseBody)); } catch { /* Ignore non-JSON bodies. */ }
  }
 }
 const detail = messages.join(' ');
 const status = statuses[0] ?? null;
 let code: string;
 let message: string;
 if (/budget.{0,60}(exceed|exhaust|reached)|spend.{0,30}limit.{0,30}(exceed|reached)/i.test(detail)) {
  code = 'BUDGET';
  message = 'AI Gateway reported a spending limit. Check the team, project and API key budgets in Vercel.';
 } else if (/(?:free[_ -]tier|paid[_ -]tier)/i.test(detail) && /model|eligible|access|purchase|required|support/i.test(detail)) {
  code = 'MODEL-PLAN';
  message = 'AI Gateway reported a plan restriction for this model. Check model eligibility and credit access in Vercel.';
 } else if (statuses.includes(402) || /insufficient[_ -](?:credits?|funds?|balance)|(?:credits?|balance).{0,50}(?:exhausted|depleted)|(?:purchase|add|buy).{0,20}credits?/i.test(detail)) {
  code = 'CREDITS';
  message = 'AI Gateway reported a billing or credit restriction. Check the available AI Gateway credits for the connected team.';
 } else if (statuses.includes(401) || /authentication_error|GatewayAuthenticationError|unauthorized|unauthenticated|invalid.{0,12}(?:api[_ -]?key|oidc)|no authentication provided/i.test(detail)) {
  code = 'AUTH';
  message = credential === 'api-key'
   ? 'AI Gateway rejected authentication. An API key is configured in this deployment; verify that it is an active Gateway key for the correct team.'
   : credential === 'vercel-identity'
    ? 'AI Gateway rejected authentication. This deployment is using Vercel identity; the configured Gateway API key is not available to it. Check the Production environment and redeploy.'
    : 'No AI Gateway credential is available to this server. Configure the server connection and redeploy.';
 } else if (statuses.includes(403) || /GatewayForbiddenError/i.test(detail)) {
  code = 'ACCESS';
  message = 'AI Gateway denied access. Check the connected team, key scope, model access and Gateway rules.';
 } else if (statuses.includes(404) || /model_not_found|GatewayModelNotFoundError/i.test(detail)) {
  code = 'MODEL';
  message = 'The configured AI model or endpoint was not found. WorkForge support needs to check the model connection.';
 } else if (statuses.includes(429) || /rate_limit_exceeded|GatewayRateLimitError/i.test(detail)) {
  code = 'RATE';
  message = 'AI Gateway reported a rate limit. Wait briefly before generating another draft.';
 } else if (statuses.includes(408) || statuses.includes(504) || /timeout|abort/i.test(detail)) {
  code = 'TIMEOUT';
  message = 'The AI request timed out. Check saved drafts before trying again.';
 } else if (/too large for an AI draft/i.test(detail)) {
  code = 'INPUT';
  message = 'These saved notes or the pricebook are too large for an AI draft. Use the manual editor.';
 } else if (/NoObjectGenerated|NoOutputGenerated|incomplete draft|validation/i.test(detail)) {
  code = 'OUTPUT';
  message = 'The AI returned an incomplete draft. Review the source notes before trying again.';
 } else if (statuses.includes(400)) {
  code = 'REQUEST';
  message = 'AI Gateway rejected the request format. WorkForge support needs to check the model settings.';
 } else {
  code = 'PROVIDER';
  message = 'AI could not complete this draft. Try again later or use the manual editor.';
 }
 const reference = `WF-AI-${code}${status ? ` / HTTP ${status}` : ''} / ${credential}`;
 return { code, status, credential, message: `${message} No job changes were made. Reference: ${reference}.` };
}

export function aiErrorMessage(error: unknown) {
 return aiFailure(error).message;
}
