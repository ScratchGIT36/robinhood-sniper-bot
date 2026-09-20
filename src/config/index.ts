import 'dotenv/config';
import { z } from 'zod';
import type { Address, DexType, Mode } from '../types/index.js';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const PRIVKEY_RE = /^0x[a-fA-F0-9]{64}$/;

const emptyToUndef = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

const addressSchema = z
  .preprocess(emptyToUndef, z.string().regex(ADDRESS_RE, 'must be a 0x-prefixed 20-byte hex address').optional())
  .transform((v) => (v ? (v as Address) : undefined));

const numFromEnv = (def: number, constraints?: { min?: number; max?: number }) =>
  z.preprocess(emptyToUndef, z.coerce.number().min(constraints?.min ?? 0).max(constraints?.max ?? Number.MAX_SAFE_INTEGER).default(def));

const configSchema = z.object({
  // Preferred Cronos env names; ROBINHOOD_* kept as legacy aliases.
  CRONOS_RPC_URL: z.preprocess(emptyToUndef, z.string().url().optional()),
  CRONOS_WS_URL: z.preprocess(emptyToUndef, z.string().url().optional()),
  ROBINHOOD_RPC_URL: z.preprocess(emptyToUndef, z.string().url().optional()),
  ROBINHOOD_WS_URL: z.preprocess(emptyToUndef, z.string().url().optional()),
  CHAIN_ID: z.preprocess(emptyToUndef, z.coerce.number().int().positive().optional()),
  PRIVATE_KEY: z.preprocess(emptyToUndef, z.string().regex(PRIVKEY_RE, 'must be a 0x-prefixed 32-byte hex private key').optional()),
  WALLET_ADDRESS: addressSchema,
  MODE: z.preprocess(emptyToUndef, z.enum(['paper', 'testnet', 'live']).default('paper')),
  DEX_TYPE: z.preprocess(emptyToUndef, z.enum(['uniswap_v2', 'uniswap_v3', 'mock']).default('mock')),
  DEX_FACTORY_ADDRESS: addressSchema,
  DEX_ROUTER_ADDRESS: addressSchema,
  DEX_QUOTER_ADDRESS: addressSchema,
  BASE_TOKEN_ADDRESS: addressSchema,
  BASE_TOKEN_IS_NATIVE_WRAPPER: z.preprocess(emptyToUndef, z.enum(['true', 'false']).default('true')),
  MAX_BUY_ETH: numFromEnv(0.01, { min: 0 }),
  MAX_SLIPPAGE_BPS: numFromEnv(300, { min: 0, max: 10_000 }),
  // Cronos mainnet gas is typically thousands of gwei — keep a high default ceiling.
  MAX_GAS_GWEI: numFromEnv(10_000, { min: 0 }),
  MIN_LIQUIDITY_ETH: numFromEnv(1, { min: 0 }),
  MAX_TOKEN_TAX_BPS: numFromEnv(1000, { min: 0, max: 10_000 }),
  TAKE_PROFIT_PERCENT: numFromEnv(50, { min: 0 }),
  STOP_LOSS_PERCENT: numFromEnv(20, { min: 0, max: 100 }),
  TRAILING_STOP_PERCENT: z.preprocess(emptyToUndef, z.coerce.number().min(0.1).max(100).optional()),
  MAX_OPEN_POSITIONS: numFromEnv(3, { min: 1, max: 1000 }),
  COOLDOWN_SECONDS: numFromEnv(60, { min: 0 }),
  ENABLE_LIVE_TRADING: z.preprocess(emptyToUndef, z.enum(['true', 'false']).default('false')),
  DB_PATH: z.preprocess(emptyToUndef, z.string().default('./data/bot.db')),
  LOG_LEVEL: z.preprocess(emptyToUndef, z.string().default('info')),
  PAPER_BALANCE_ETH: numFromEnv(10, { min: 0 }),
  POSITION_POLL_MS: numFromEnv(5000, { min: 250 }),
});

/** Cronos EVM mainnet (Crypto.com). */
export const CRONOS_MAINNET_ID = 25;
/** Cronos EVM testnet. */
export const CRONOS_TESTNET_ID = 338;
export const CRONOS_MAINNET_RPC = 'https://evm.cronos.com/';
export const CRONOS_TESTNET_RPC = 'https://evm-t3.cronos.com/';

/** @deprecated Use CRONOS_* — kept so old imports do not break. */
export const ROBINHOOD_MAINNET_ID = CRONOS_MAINNET_ID;
/** @deprecated Use CRONOS_* */
export const ROBINHOOD_TESTNET_ID = CRONOS_TESTNET_ID;
/** @deprecated Use CRONOS_* */
export const ROBINHOOD_MAINNET_RPC = CRONOS_MAINNET_RPC;
/** @deprecated Use CRONOS_* */
export const ROBINHOOD_TESTNET_RPC = CRONOS_TESTNET_RPC;

/** VVS Finance (Uniswap V2–compatible) on Cronos mainnet — verify on explorer before live use. */
export const VVS_FACTORY = '0x3b44b2a187a7b3824131f8db5a74194d0a42fc15' as Address;
export const VVS_ROUTER = '0x145863Eb42Cf62847A6Ca784e6416C1682b1b2Ae' as Address;
export const WCRO = '0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23' as Address;

export interface BotConfig {
  rpcUrl: string;
  wsUrl?: string;
  chainId: number;
  privateKey?: `0x${string}`;
  walletAddress?: Address;
  mode: Mode;
  dexType: DexType;
  dexFactoryAddress?: Address;
  dexRouterAddress?: Address;
  dexQuoterAddress?: Address;
  baseTokenAddress?: Address;
  baseTokenIsNativeWrapper: boolean;
  maxBuyEth: number;
  maxSlippageBps: number;
  maxGasGwei: number;
  minLiquidityEth: number;
  maxTokenTaxBps: number;
  takeProfitPercent: number;
  stopLossPercent: number;
  trailingStopPercent?: number;
  maxOpenPositions: number;
  cooldownSeconds: number;
  enableLiveTrading: boolean;
  dbPath: string;
  logLevel: string;
  paperBalanceEth: number;
  positionPollMs: number;
}

export class ConfigError extends Error {}

/** Parse and validate configuration from an env map (default: process.env). */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): BotConfig {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const msgs = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new ConfigError(`Invalid configuration:\n  - ${msgs.join('\n  - ')}`);
  }
  const e = parsed.data;

  const mode = e.MODE as Mode;
  const defaultChainId = mode === 'testnet' ? CRONOS_TESTNET_ID : CRONOS_MAINNET_ID;
  const chainId = e.CHAIN_ID ?? defaultChainId;
  const rpcUrl =
    e.CRONOS_RPC_URL ??
    e.ROBINHOOD_RPC_URL ??
    (chainId === CRONOS_TESTNET_ID ? CRONOS_TESTNET_RPC : CRONOS_MAINNET_RPC);
  const wsUrl = e.CRONOS_WS_URL ?? e.ROBINHOOD_WS_URL;

  if (mode === 'testnet' && chainId === CRONOS_MAINNET_ID) {
    throw new ConfigError('MODE=testnet but CHAIN_ID is Cronos mainnet (25). Set CHAIN_ID=338.');
  }
  if (mode === 'live' && chainId === CRONOS_TESTNET_ID) {
    throw new ConfigError('MODE=live but CHAIN_ID is Cronos testnet (338). Set CHAIN_ID=25.');
  }
  if (e.STOP_LOSS_PERCENT >= 100) {
    throw new ConfigError('STOP_LOSS_PERCENT must be below 100.');
  }

  return {
    rpcUrl,
    wsUrl,
    chainId,
    privateKey: e.PRIVATE_KEY as `0x${string}` | undefined,
    walletAddress: e.WALLET_ADDRESS,
    mode,
    dexType: e.DEX_TYPE as DexType,
    dexFactoryAddress: e.DEX_FACTORY_ADDRESS,
    dexRouterAddress: e.DEX_ROUTER_ADDRESS,
    dexQuoterAddress: e.DEX_QUOTER_ADDRESS,
    baseTokenAddress: e.BASE_TOKEN_ADDRESS,
    baseTokenIsNativeWrapper: e.BASE_TOKEN_IS_NATIVE_WRAPPER === 'true',
    maxBuyEth: e.MAX_BUY_ETH,
    maxSlippageBps: e.MAX_SLIPPAGE_BPS,
    maxGasGwei: e.MAX_GAS_GWEI,
    minLiquidityEth: e.MIN_LIQUIDITY_ETH,
    maxTokenTaxBps: e.MAX_TOKEN_TAX_BPS,
    takeProfitPercent: e.TAKE_PROFIT_PERCENT,
    stopLossPercent: e.STOP_LOSS_PERCENT,
    trailingStopPercent: e.TRAILING_STOP_PERCENT,
    maxOpenPositions: e.MAX_OPEN_POSITIONS,
    cooldownSeconds: e.COOLDOWN_SECONDS,
    enableLiveTrading: e.ENABLE_LIVE_TRADING === 'true',
    dbPath: e.DB_PATH,
    logLevel: e.LOG_LEVEL,
    paperBalanceEth: e.PAPER_BALANCE_ETH,
    positionPollMs: e.POSITION_POLL_MS,
  };
}

/**
 * Every condition that must hold before a LIVE trade is allowed.
 * Returns a list of human-readable blockers; empty list means ready.
 */
export function liveTradingBlockers(
  cfg: BotConfig,
  state: { liveConfirmed: boolean; emergencyStop: boolean },
): string[] {
  const blockers: string[] = [];
  if (cfg.mode !== 'live') blockers.push(`MODE is "${cfg.mode}", not "live"`);
  if (!cfg.enableLiveTrading) blockers.push('ENABLE_LIVE_TRADING is not "true"');
  if (!cfg.privateKey) blockers.push('PRIVATE_KEY is not set');
  if (cfg.dexType === 'mock') blockers.push('DEX_TYPE is "mock" — configure a real DEX adapter');
  if (!cfg.dexRouterAddress) blockers.push('DEX_ROUTER_ADDRESS is not set');
  if (!cfg.dexFactoryAddress) blockers.push('DEX_FACTORY_ADDRESS is not set');
  if (!cfg.baseTokenAddress) blockers.push('BASE_TOKEN_ADDRESS is not set');
  if (cfg.dexType === 'uniswap_v3' && !cfg.dexQuoterAddress) blockers.push('DEX_QUOTER_ADDRESS is required for uniswap_v3');
  if (!(cfg.maxBuyEth > 0)) blockers.push('MAX_BUY_ETH must be > 0');
  if (!(cfg.maxSlippageBps > 0 && cfg.maxSlippageBps <= 10_000)) blockers.push('MAX_SLIPPAGE_BPS must be in (0, 10000]');
  if (!(cfg.maxGasGwei > 0)) blockers.push('MAX_GAS_GWEI must be > 0');
  if (!(cfg.stopLossPercent > 0 && cfg.stopLossPercent < 100)) blockers.push('STOP_LOSS_PERCENT must be in (0, 100)');
  if (!(cfg.maxOpenPositions >= 1)) blockers.push('MAX_OPEN_POSITIONS must be >= 1');
  if (!state.liveConfirmed) blockers.push('live trading has not been confirmed via `bot confirm-live`');
  if (state.emergencyStop) blockers.push('EMERGENCY STOP is active (run `bot resume` to clear)');
  return blockers;
}
