import { createHash, createPublicKey } from 'node:crypto';
import { verifyAccessToken, verifyIdentityToken } from '@privy-io/node';
import { apiError } from './errors.mjs';

const publicId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const unauthorized = () => apiError(401, 'AUTH_REQUIRED', 'Sign in again to verify your account.');

export function createAuthentication({ appId = '', clientId = '', verificationKey = '', now = Date.now } = {}) {
  let validKey = false;
  try { const key = createPublicKey(verificationKey); validKey = key.asymmetricKeyType === 'ec' && key.asymmetricKeyDetails?.namedCurve === 'prime256v1'; } catch {}
  const configured = publicId(appId) && publicId(clientId) && validKey;
  const publicConfig = () => ({ provider: 'privy', configured, appId: configured ? appId : null,
    clientId: configured ? clientId : null, realFunds: false,
    methods: ['email'], ownershipEvidence: 'Privy-signed identity token; no wallet transaction authority granted',
    missing: configured ? [] : ['Configure PRIVY_APP_ID, PRIVY_CLIENT_ID and the public PRIVY_VERIFICATION_KEY.'] });

  async function authenticate(headers) {
    if (!configured) throw apiError(503, 'AUTH_NOT_CONFIGURED', 'Privy is not configured for this application yet.');
    const authorization = headers.authorization;
    if (typeof authorization !== 'string' || authorization.length > 12000 || !/^Bearer [a-zA-Z0-9_.-]+$/.test(authorization)) throw unauthorized();
    try {
      const access = await verifyAccessToken({ access_token: authorization.slice(7), app_id: appId, verification_key: verificationKey });
      if (!access.user_id.startsWith('did:privy:') || access.user_id.length > 200 || !access.session_id ||
          !Number.isFinite(access.expiration) || access.expiration * 1000 <= now() ||
          !Number.isFinite(access.issued_at) || access.issued_at * 1000 > now() + 60000) throw unauthorized();
      const identityToken = headers['x-privy-identity-token'];
      let wallets = [];
      if (identityToken !== undefined) {
        if (typeof identityToken !== 'string' || identityToken.length > 12000) throw unauthorized();
        const user = await verifyIdentityToken({ identity_token: identityToken, app_id: appId, verification_key: verificationKey });
        if (user.id !== access.user_id) throw unauthorized();
        wallets = user.linked_accounts.filter(a => a.type === 'wallet' && a.chain_type === 'ethereum' &&
          typeof a.address === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a.address))
          .map(a => ({ address: a.address.toLowerCase(), chainType: 'ethereum', kind: a.wallet_client_type === 'privy' ? 'embedded' : 'external' }));
        wallets = wallets.filter((wallet, index) => wallets.findIndex(other => other.address === wallet.address) === index);
      }
      return { authenticated: true, accountId: 'player_' + createHash('sha256').update(appId + '\0' + access.user_id).digest('hex').slice(0, 48),
        expiresAt: new Date(access.expiration * 1000).toISOString(), wallets,
        walletOwnershipVerified: Boolean(wallets.length), realFunds: false };
    } catch { throw unauthorized(); }
  }
  return { publicConfig, authenticate, configured };
}
