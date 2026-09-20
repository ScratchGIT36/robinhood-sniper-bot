import { encodeFunctionData, type PublicClient, type Abi } from 'viem';
import type { Address, PoolInfo, TxRequest } from '../types/index.js';
import type { DexAdapter } from './adapter.js';
import { childLogger } from '../utils/logger.js';

const log = childLogger('dex:cronos_launch');

/** Cronos Launch entry (proxy) — create + curve buy/sell. From ULTCAT birth tx. */
export const CRONOS_LAUNCH_ENTRY = '0xa18f14a35853bc619132ba9e126bf2ec63183c8e' as Address;
/** Cronos Launch AMM factory (proxy). */
export const CRONOS_LAUNCH_FACTORY = '0x227205a020bd5522e45436176d85603d2dcc43c5' as Address;
/** Optional launch router (quotes / swaps). */
export const CRONOS_LAUNCH_ROUTER = '0xe39873ffe547cecdba62e032b08c332c597ea695' as Address;
/** WCRO on Cronos mainnet. */
export const WCRO = '0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23' as Address;

/** event Launched(address indexed token, address indexed pool, uint256 param) */
export const LAUNCHED_TOPIC =
  '0x714aa39317ad9a7a7a99db52b44490da5d068a0b2710fffb1a1282ad3cadae1f' as const;

const cronosLaunchAbi = [
  {
    type: 'event',
    name: 'Launched',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'pair', type: 'address', indexed: true },
      { name: 'n', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'function',
    name: 'buy',
    stateMutability: 'payable',
    inputs: [
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'tokenAddress', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'sell',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'tokenAddress', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'curvePair',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'isGraduated',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
] as const satisfies Abi;

const pairAbi = [
  {
    type: 'function',
    name: 'getReserves',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'reserve0', type: 'uint112' },
      { name: 'reserve1', type: 'uint112' },
      { name: 'blockTimestampLast', type: 'uint32' },
    ],
  },
] as const satisfies Abi;

const routerQuoteAbi = [
  {
    type: 'function',
    name: 'getAmountsOut',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const satisfies Abi;

export interface CronosLaunchAdapterOptions {
  publicClient: PublicClient;
  subscriptionClient: PublicClient;
  entry: Address;
  router?: Address;
  baseToken: Address;
  baseIsNativeWrapper: boolean;
  pollingIntervalMs?: number;
}

/**
 * Cronos Launch birth-snipe adapter.
 * Watches `Launched` on the launch entry (token birth on the bonding curve),
 * then buys via payable `buy(minOut, token, deadline)` with CRO as msg.value.
 *
 * After graduation, curve buy reverts NOT_TRADING — switch to VVS (uniswap_v2).
 */
export class CronosLaunchAdapter implements DexAdapter {
  readonly name = 'cronos_launch';
  private readonly o: CronosLaunchAdapterOptions;

  constructor(opts: CronosLaunchAdapterOptions) {
    this.o = opts;
  }

  private toPool(token: Address, pool: Address, blockNumber: bigint): PoolInfo {
    return {
      address: pool,
      dex: this.name,
      token,
      baseToken: this.o.baseToken,
      token0: this.o.baseToken,
      token1: token,
      blockNumber,
    };
  }

  async scanNewPools(fromBlock: bigint, toBlock: bigint): Promise<PoolInfo[]> {
    const logs = await this.o.publicClient.getContractEvents({
      address: this.o.entry,
      abi: cronosLaunchAbi,
      eventName: 'Launched',
      fromBlock,
      toBlock,
    });
    return logs.map((l) => {
      const { token, pair } = l.args as { token: Address; pair: Address };
      return this.toPool(token, pair, l.blockNumber ?? 0n);
    });
  }

  watchNewPools(onPool: (pool: PoolInfo) => void, onError: (err: Error) => void): () => void {
    log.info({ entry: this.o.entry }, 'watching Cronos Launch Launched events');
    return this.o.subscriptionClient.watchContractEvent({
      address: this.o.entry,
      abi: cronosLaunchAbi,
      eventName: 'Launched',
      pollingInterval: this.o.pollingIntervalMs ?? 2000,
      onLogs: (logs) => {
        for (const l of logs) {
          try {
            const { token, pair } = l.args as { token: Address; pair: Address };
            log.info({ token, pair, block: l.blockNumber?.toString() }, 'Cronos Launch birth');
            onPool(this.toPool(token, pair, l.blockNumber ?? 0n));
          } catch (err) {
            onError(err instanceof Error ? err : new Error(String(err)));
          }
        }
      },
      onError: (err) => onError(err instanceof Error ? err : new Error(String(err))),
    });
  }

  async getPoolLiquidityBase(pool: PoolInfo): Promise<bigint> {
    try {
      const [r0, r1] = (await this.o.publicClient.readContract({
        address: pool.address,
        abi: pairAbi,
        functionName: 'getReserves',
      })) as readonly [bigint, bigint, number];
      return r0 > r1 ? r0 : r1;
    } catch {
      return 0n;
    }
  }

  async quoteBuy(token: Address, amountInBase: bigint): Promise<bigint> {
    if (this.o.router) {
      try {
        return (await this.o.publicClient.readContract({
          address: this.o.router,
          abi: routerQuoteAbi,
          functionName: 'getAmountsOut',
          args: [this.o.baseToken, token, amountInBase],
        })) as bigint;
      } catch (err) {
        log.debug({ err: String(err) }, 'quoteBuy via router failed; minOut=1');
      }
    }
    return 1n;
  }

  async quoteSell(token: Address, amountTokens: bigint): Promise<bigint> {
    if (this.o.router) {
      try {
        return (await this.o.publicClient.readContract({
          address: this.o.router,
          abi: routerQuoteAbi,
          functionName: 'getAmountsOut',
          args: [token, this.o.baseToken, amountTokens],
        })) as bigint;
      } catch (err) {
        log.debug({ err: String(err) }, 'quoteSell via router failed');
      }
    }
    return 1n;
  }

  async buildBuyTx(p: {
    token: Address;
    amountInBase: bigint;
    minAmountOut: bigint;
    recipient: Address;
    deadlineSec: number;
  }): Promise<TxRequest> {
    const graduated = (await this.o.publicClient.readContract({
      address: this.o.entry,
      abi: cronosLaunchAbi,
      functionName: 'isGraduated',
      args: [p.token],
    })) as boolean;
    if (graduated) {
      throw new Error(
        'token already graduated from Cronos Launch curve — use DEX_TYPE=uniswap_v2 (VVS) instead',
      );
    }
    const deadline = BigInt(Math.floor(Date.now() / 1000) + p.deadlineSec);
    const data = encodeFunctionData({
      abi: cronosLaunchAbi,
      functionName: 'buy',
      args: [p.minAmountOut, p.token, deadline],
    });
    if (!this.o.baseIsNativeWrapper) {
      throw new Error('Cronos Launch birth buys expect BASE_TOKEN_IS_NATIVE_WRAPPER=true (pay CRO)');
    }
    return { to: this.o.entry, data, value: p.amountInBase };
  }

  async buildSellTx(p: {
    token: Address;
    amountTokens: bigint;
    minAmountOutBase: bigint;
    recipient: Address;
    deadlineSec: number;
  }): Promise<TxRequest> {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + p.deadlineSec);
    const data = encodeFunctionData({
      abi: cronosLaunchAbi,
      functionName: 'sell',
      args: [p.amountTokens, p.minAmountOutBase, p.token, deadline],
    });
    return { to: this.o.entry, data, value: 0n };
  }

  spender(): Address {
    return this.o.entry;
  }

  async estimateTaxesBps(_token: Address): Promise<{ buyBps: number; sellBps: number } | null> {
    return null;
  }
}
