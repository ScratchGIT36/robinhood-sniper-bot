import { defineChain, type Chain } from 'viem';
import {
  CRONOS_MAINNET_ID,
  CRONOS_MAINNET_RPC,
  CRONOS_TESTNET_ID,
  CRONOS_TESTNET_RPC,
} from '../config/index.js';

export const cronosMainnet: Chain = defineChain({
  id: CRONOS_MAINNET_ID,
  name: 'Cronos',
  nativeCurrency: { name: 'Cronos', symbol: 'CRO', decimals: 18 },
  rpcUrls: { default: { http: [CRONOS_MAINNET_RPC] } },
  blockExplorers: {
    default: { name: 'Cronos Explorer', url: 'https://explorer.cronos.com' },
  },
});

export const cronosTestnet: Chain = defineChain({
  id: CRONOS_TESTNET_ID,
  name: 'Cronos Testnet',
  nativeCurrency: { name: 'Cronos Test', symbol: 'TCRO', decimals: 18 },
  rpcUrls: { default: { http: [CRONOS_TESTNET_RPC] } },
  blockExplorers: {
    default: { name: 'Cronos Testnet Explorer', url: 'https://explorer.cronos.com/testnet' },
  },
  testnet: true,
});

/** @deprecated Use cronosMainnet */
export const robinhoodMainnet = cronosMainnet;
/** @deprecated Use cronosTestnet */
export const robinhoodTestnet = cronosTestnet;

/** Build a Chain object for the configured chain id + RPC. */
export function chainFor(chainId: number, rpcUrl: string): Chain {
  if (chainId === CRONOS_MAINNET_ID) return { ...cronosMainnet, rpcUrls: { default: { http: [rpcUrl] } } };
  if (chainId === CRONOS_TESTNET_ID) return { ...cronosTestnet, rpcUrls: { default: { http: [rpcUrl] } } };
  return defineChain({
    id: chainId,
    name: `Custom EVM chain ${chainId}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
}
