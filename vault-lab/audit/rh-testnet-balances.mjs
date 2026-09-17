import { createPublicClient, defineChain, formatEther, formatUnits, http, parseAbi } from 'viem';
import { FUNDING_NETWORK } from '../public/funding-network.js';

const ADDRESS = '0xFcF79a0D3D32791dF521A041b02Ac97Ca12842F4';
const AMZN = '0x5884ad2f920c162cfbbacc88c9c51aa75ec09e02';
const chain = defineChain({
  id: FUNDING_NETWORK.id,
  name: FUNDING_NETWORK.name,
  nativeCurrency: { ...FUNDING_NETWORK.nativeCurrency },
  rpcUrls: { default: { http: [FUNDING_NETWORK.rpcUrl] } }
});
const client = createPublicClient({ chain, transport: http(FUNDING_NETWORK.rpcUrl) });
const [native, amzn, chainId] = await Promise.all([
  client.getBalance({ address: ADDRESS }),
  client.readContract({
    address: AMZN,
    abi: parseAbi(['function balanceOf(address owner) view returns (uint256)']),
    functionName: 'balanceOf',
    args: [ADDRESS]
  }),
  client.getChainId()
]);
console.log(JSON.stringify({
  address: ADDRESS,
  chainId,
  nativeWei: native.toString(),
  nativeEth: formatEther(native),
  amznBaseUnits: amzn.toString(),
  amzn: formatUnits(amzn, 18),
  needsFaucet: native === 0n || amzn < 5_000_000_000_000_000_000n
}, null, 2));
