# Cronos Sniper Bot

Token monitor and trading bot for **Cronos Chain** (EVM, chain ID `25`). Fork of [LaChance-Lab/robinhood-sniper-bot](https://github.com/LaChance-Lab/robinhood-sniper-bot), retargeted to Cronos with **VVS Finance** (Uniswap V2–compatible) as the default DEX.

It watches DEX factories for newly created liquidity pools, runs safety checks, and can simulate or execute buys/sells within risk limits.

## Risk warning

Automated trading of newly launched tokens is speculative and can lose everything you allocate. Defaults to paper mode; live trading needs several independent switches. Read [docs/LIVE_TRADING_WARNING.md](docs/LIVE_TRADING_WARNING.md).

## Cronos quick start

```bash
git clone https://github.com/ScratchGIT36/robinhood-sniper-bot.git
cd robinhood-sniper-bot
npm install
cp .env.example .env
npm test
npm run paper
```

| Network | Chain ID | RPC |
| --- | --- | --- |
| Mainnet | `25` | `https://evm.cronos.com/` |
| Testnet | `338` | `https://evm-t3.cronos.com/` |

In `.env` for live/watch on Cronos mainnet:

```ini
CRONOS_RPC_URL=https://evm.cronos.com/
CHAIN_ID=25
MODE=paper
DEX_TYPE=uniswap_v2
DEX_FACTORY_ADDRESS=0x3b44b2a187a7b3824131f8db5a74194d0a42fc15
DEX_ROUTER_ADDRESS=0x145863Eb42Cf62847A6Ca784e6416C1682b1b2Ae
BASE_TOKEN_ADDRESS=0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23
BASE_TOKEN_IS_NATIVE_WRAPPER=true
MAX_GAS_GWEI=10000
```

Verify those VVS/WCRO addresses on [Cronos Explorer](https://explorer.cronos.com/) before enabling live trading. Details: [docs/CRONOS_CHAIN.md](docs/CRONOS_CHAIN.md).

For **Cronos Launch birth snipes** set `DEX_TYPE=cronos_launch` (watches `Launched` on the launch entry and buys via curve `buy`). See [docs/CRONOS_LAUNCH.md](docs/CRONOS_LAUNCH.md).


```bash
npm run bot -- config-check
npm run bot -- watch
```

## Components

Same architecture as upstream: scanner, safety pipeline, trading engine, TP/SL, V2/V3/mock/cronos_launch DEX adapters, CLI, SQLite. See CLI via `npm run bot -- help`.

## Live trading

Requires `MODE=live`, `CHAIN_ID=25`, `ENABLE_LIVE_TRADING=true`, a funded hot wallet, real DEX addresses, valid risk limits, and `npm run bot -- confirm-live`.

## License

MIT (upstream + this Cronos retarget)
