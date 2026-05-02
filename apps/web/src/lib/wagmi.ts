import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { defineChain } from 'viem';

const chainId = Number(process.env.NEXT_PUBLIC_OG_CHAIN_ID ?? 16601);
const rpcUrl = process.env.NEXT_PUBLIC_OG_RPC_URL ?? 'https://evmrpc-testnet.0g.ai';

export const ogTestnet = defineChain({
  id: chainId,
  name: '0G Chain Testnet',
  nativeCurrency: { name: '0G', symbol: 'OG', decimals: 18 },
  rpcUrls: {
    default: { http: [rpcUrl] },
  },
  testnet: true,
});

export type WagmiConfig = ReturnType<typeof getDefaultConfig>;

export function createWagmiConfig(): WagmiConfig {
  return getDefaultConfig({
    appName: 'Tribune',
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'tribune-dev',
    chains: [ogTestnet],
    ssr: true,
  });
}
