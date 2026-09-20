# Cronos Chain notes

This bot was retargeted from Robinhood Chain to **Cronos EVM** (Crypto.com).
Standard Ethereum tooling (viem, MetaMask custom network) works unchanged.

## Network parameters

| | Mainnet | Testnet |
| --- | --- | --- |
| Chain ID | `25` | `338` |
| RPC | `https://evm.cronos.com/` | `https://evm-t3.cronos.com/` |
| Native gas token | CRO | TCRO |
| Explorer | https://explorer.cronos.com/ | https://explorer.cronos.com/testnet |

Defaults live in `src/chain/chains.ts` and `src/config/index.ts`. Override with `CRONOS_RPC_URL` / `CHAIN_ID` in `.env` (legacy `ROBINHOOD_RPC_URL` still accepted).

## Primary DEX: VVS Finance (Uniswap V2–compatible)

| Role | Address | Notes |
| --- | --- | --- |
| `DEX_TYPE` | `uniswap_v2` | Use the existing V2 adapter |
| Factory | `0x3b44b2a187a7b3824131f8db5a74194d0a42fc15` | VVS Factory — verify on explorer |
| Router | `0x145863Eb42Cf62847A6Ca784e6416C1682b1b2Ae` | VVS Router — verify on explorer |
| Base token (WCRO) | `0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23` | Wrapped CRO |

Sources: [Cronos docs](https://docs.cronos.com/), [VVS docs](https://docs.vvs.finance/). Always re-check on the block explorer before live trading — a wrong router can drain approvals.

## Gas

Cronos often prices gas in the **thousands of gwei**. The bot’s `MAX_GAS_GWEI` default is `10000` for this fork. If you see `network max fee … exceeds MAX_GAS_GWEI`, raise it deliberately — do not leave the old Robinhood-era `5`.

## Startup verification

`bot config-check` (and every non-paper startup) calls `eth_chainId` and refuses to proceed if the RPC’s chain id doesn’t match `CHAIN_ID`.

## WebSocket vs HTTP

Set `CRONOS_WS_URL` if you have a WS endpoint; otherwise the scanner polls `eth_getLogs` over HTTP.

## Discover factories from logs

```bash
npm run discover -- --rpc https://evm.cronos.com/ --blocks 6000 --chunk 500
```

## Paper / watch first

```bash
npm run paper
npm run bot -- watch   # after setting DEX_TYPE=uniswap_v2 and VVS addresses
```
