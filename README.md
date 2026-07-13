# Robinhood Sniper Bot

A token monitor and trading bot for Robinhood Chain (EVM). It watches DEX factories for newly created liquidity pools, runs safety checks against each new token, and can simulate or execute buys and sells within configured risk limits.

## Risk warning

Automated trading of newly launched tokens is speculative and can lose the entire amount you allocate. Most new tokens go to zero, and the safety checks here lower that risk but do not remove it. The bot defaults to testnet; live trading stays off until you flip several separate switches. Read [docs/LIVE_TRADING_WARNING.md](docs/LIVE_TRADING_WARNING.md) before enabling it.

The bot only reads public RPC/WebSocket data and sends ordinary swap transactions. There is no front-running, sandwiching, or mempool manipulation, and none should be added.

## Components

- Scanner. Follows new blocks and `PairCreated`/`PoolCreated` factory events, writes pools to SQLite, dedupes them, and reconnects with backoff after RPC or WebSocket failures.
- Safety pipeline. ERC20 metadata, contract-code existence, a liquidity floor, a sell-quote honeypot probe, a best-effort tax estimate, owner/renounce detection, and max-tx / max-wallet probes. A token that fails any critical check is flagged and never bought.
- Trading engine. One code path for paper, testnet, and live. It quotes the trade, derives a slippage-protected `minOut`, checks the gas cap, simulates via `eth_call`, then sends. Approvals are for the exact amount, never unlimited.
- Position manager. Take-profit, stop-loss, and an optional trailing stop, re-priced on an interval.
- DEX adapters. Generic Uniswap v2-style and v3-style adapters plus a mock adapter. Router and factory addresses come from `.env` and are never hardcoded.
- CLI. `status`, `scan`, `watch`, `paper`, `buy`, `sell`, `positions`, `trades`, `safety-check`, `config-check`, `confirm-live`, `emergency-stop`, `resume`, `backtest`, `dashboard`.
- SQLite storage for tokens, pools, safety checks, trades, positions, settings, events, and errors.

## Install

Requires Node.js 20 or newer.

```bash
git clone https://github.com/LaChance-Lab/robinhood-sniper-bot.git
cd robinhood-sniper-bot
npm install
cp .env.example .env
npm test
```

The test suite should pass on a clean checkout.

## 1. Paper mode

`.env.example` ships with `MODE=paper` and `DEX_TYPE=mock`, so paper mode runs with no chain access and no keys:

```bash
npm run paper
```

It discovers synthetic pools, runs the safety checks (some pools are deliberately bad — honeypots, high tax, thin liquidity), paper-buys the ones that pass, and exits on take-profit or stop-loss as prices move. Inspect the results:

```bash
npm run bot -- status
npm run bot -- positions --all
npm run bot -- trades
npm run bot -- backtest        # replay stored price events against different TP/SL settings
```

## 2. Point at Robinhood Chain

| Network | Chain ID | RPC |
| --- | --- | --- |
| Mainnet | `4663` | `https://rpc.mainnet.chain.robinhood.com/` |
| Testnet | `46630` | `https://rpc.testnet.chain.robinhood.com` |

In `.env`:

```ini
ROBINHOOD_RPC_URL=https://rpc.testnet.chain.robinhood.com
CHAIN_ID=46630
MODE=testnet
```

Run `npm run bot -- config-check` to validate the env, confirm the RPC is reachable, and check that the RPC's reported chain id matches `CHAIN_ID`.

## 3. Add DEX addresses

Robinhood Chain's DEX landscape is new and still changing, so no addresses are baked in.

If you don't know them, discover them from on-chain data:

```bash
npm run discover -- --rpc https://rpc.mainnet.chain.robinhood.com/ --blocks 6000
```

This scans recent blocks for Uniswap-style pool-creation events and prints the factory (the contract emitting them), the base token (the one appearing in most pairs), and a likely router (the most common `Swap` caller). See [docs/ROBINHOOD_CHAIN.md](docs/ROBINHOOD_CHAIN.md#finding-the-dex-addresses-automatically); as of 2026-07-08 the active mainnet venue was a Uniswap-v3-style DEX with a WETH base token. Verify the router and quoter on the block explorer before trading.

Once you've picked a DEX, put its contracts in `.env`:

```ini
DEX_TYPE=uniswap_v2            # or uniswap_v3
DEX_FACTORY_ADDRESS=0x...
DEX_ROUTER_ADDRESS=0x...
DEX_QUOTER_ADDRESS=0x...       # v3 only: QuoterV2
BASE_TOKEN_ADDRESS=0x...       # WETH, USDG, etc.
BASE_TOKEN_IS_NATIVE_WRAPPER=true
```

Until these are set the bot runs in monitor/simulation mode with the mock adapter and reports as much at startup; live trading is not possible. See [docs/DEX_ADAPTERS.md](docs/DEX_ADAPTERS.md) for how the adapters work and how to add another DEX style.

## 4. Testnet

```bash
MODE=testnet CHAIN_ID=46630 PRIVATE_KEY=0x...   # use a throwaway testnet key
npm run testnet
```

Testnet sends real transactions on the test network, exercising approvals, gas estimation, simulation, and swap execution end to end with worthless funds.

## 5. Live trading

Live trading requires all of the following, each set independently:

1. `MODE=live` and `CHAIN_ID=4663`
2. `ENABLE_LIVE_TRADING=true`
3. `PRIVATE_KEY` set — a dedicated wallet funded only with what you can afford to lose
4. A real DEX adapter configured (factory, router, base token; quoter for v3)
5. Valid risk limits (`MAX_BUY_ETH`, `MAX_SLIPPAGE_BPS`, `MAX_GAS_GWEI`, `STOP_LOSS_PERCENT`, and the rest)
6. The confirmation step: `npm run bot -- confirm-live`, where you type `I UNDERSTAND THE RISKS`

Then `npm run live`. `npm run bot -- emergency-stop` halts all trading immediately and revokes the live confirmation. See [docs/LIVE_TRADING_WARNING.md](docs/LIVE_TRADING_WARNING.md).

## CLI reference

```bash
npm run bot -- status                        # mode, balances, positions, live readiness
npm run bot -- config-check                  # validate .env, RPC, chain id
npm run bot -- scan [--blocks 2000]          # one-shot historical pool scan
npm run bot -- watch                         # monitor only: discover + safety-check, never trade
npm run bot -- paper                         # full pipeline, simulated fills
npm run bot -- buy --token 0x... --amount 0.01
npm run bot -- sell --token 0x... --percent 100
npm run bot -- positions [--all]
npm run bot -- trades [--limit 25]
npm run bot -- safety-check --token 0x...
npm run bot -- confirm-live                  # interactive live-arming step
npm run bot -- emergency-stop                # kill switch
npm run bot -- resume                        # clear the emergency stop
npm run bot -- backtest [--take-profit 80 --stop-loss 15 --trailing 10]
npm run bot -- dashboard [--port 3000]       # read-only local web dashboard
```

`npm run start` runs the long-lived scanner and auto-trade pipeline in whatever `MODE` your `.env` specifies. `npm run scan`, `npm run paper`, `npm run testnet`, and `npm run live` are shortcuts.

## Docker

```bash
docker build -t robinhood-sniper-bot .
docker run --env-file .env -v "$PWD/data:/app/data" robinhood-sniper-bot
```

The SQLite database lives in `/app/data`. Mount it to keep state across restarts.

## Common errors

| Symptom | Cause / fix |
| --- | --- |
| `Invalid configuration: …` at startup | A `.env` value failed validation; the message names the variable. |
| `RPC reports chain id X, expected Y` | The RPC URL and `CHAIN_ID` disagree. Fix one of them. |
| `cannot reach RPC` | Endpoint down, typo, or firewall. Try the other official endpoint. |
| `trade blocked: … MAX_BUY_ETH` | Expected: a risk limit refused the trade. |
| `simulation reverted — not sending` | The swap would fail on-chain (honeypot, no liquidity, bad path). No gas spent. |
| `network max fee … exceeds MAX_GAS_GWEI` | Gas-spike protection. Raise the cap only if you mean to. |
| `SELL QUOTE REVERTED — possible honeypot` | The safety layer caught an unsellable token. Don't override it. |
| `paper balance too low` | The paper wallet is spent. Reset by deleting `data/bot.db` or lower the buy size. |
| `stream error — will resubscribe` | A routine RPC/WebSocket hiccup; the scanner reconnects with backoff. |

## Testing

```bash
npm test            # vitest: config, db, safety, paper, TP/SL, adapters, engine gating, scanner
npm run typecheck   # tsc --noEmit
npm run build       # compile to dist/
```

## Security model

- The private key lives only in `.env` / the process environment. It is never logged (pino redaction as a backstop) and never written to SQLite.
- Live trading is off by default and needs five separate switches plus the interactive confirmation.
- ERC20 approvals are for the exact amount only, never unlimited.
- Every transaction is simulated with `eth_call` before sending. Gas is capped by `MAX_GAS_GWEI`; total exposure is capped by `MAX_BUY_ETH` × `MAX_OPEN_POSITIONS`.
- `bot emergency-stop` blocks all trading, including paper, immediately, and revokes the live confirmation.

See [docs/SAFETY.md](docs/SAFETY.md), [docs/CONFIG.md](docs/CONFIG.md), and [docs/ROBINHOOD_CHAIN.md](docs/ROBINHOOD_CHAIN.md).

## Contact

Questions or issues: [t.me/lachancelab](https://t.me/lachancelab)

## License

MIT
