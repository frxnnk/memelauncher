import { meteredAttempt } from './metered-attempt.mjs';

export function createPublicPractice({ vault, authentication, limits, beta }) {
  return {
    async attempt(headers, input) {
      const principal = await authentication.authenticate(headers);
      beta?.assertAccess(principal.accountId, { write:true, modelId:input?.modelId });
      return meteredAttempt({ vault, limits, input, scope: { ownerId: principal.accountId } });
    },
    async usage(headers) {
      const { accountId } = await authentication.authenticate(headers);
      beta?.assertAccess(accountId);
      return limits.status(accountId);
    }
  };
}
