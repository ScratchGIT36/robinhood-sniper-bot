# Cronos Launch — birth sniping

Official pad: https://launch.cronos.com/

## Verified contracts (Cronos mainnet, chain id 25)

Pulled from Ultra Cat (`ULTCAT`) birth tx `0x4fba36c5…2b70` (block ~94299951):

| Role | Address |
| --- | --- |
| Launch **entry** (create + curve buy/sell) | `0xa18f14a35853bc619132ba9e126bf2ec63183c8e` |
| Launch **factory** (AMM) | `0x227205a020bd5522e45436176d85603d2dcc43c5` |
| Launch **router** | `0xe39873ffe547cecdba62e032b08c332c597ea695` |
| WCRO | `0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23` |

Entry `factory()` returns the launch factory. Proxies use EIP-1967 implementations.

## Birth signal

```text
event Launched(address indexed token, address indexed pair, uint256 n)
topic0 = 0x714aa39317ad9a7a7a99db52b44490da5d068a0b2710fffb1a1282ad3cadae1f
emitted by: launch entry (bonding)
```

Watch this event for **token birth**. The same create tx seeds the curve pool.

## Buy / sell (pre-graduation)

On the launch entry:

- `buy(uint256 amountOutMin, address tokenAddress, uint256 deadline) payable returns (bool)` — CRO in `msg.value`
- `sell(uint256 amountIn, uint256 amountOutMin, address tokenAddress, uint256 deadline) returns (bool)`

After graduation, `buy` reverts `NOT_TRADING`. Graduated tokens trade on VVS — set `DEX_TYPE=uniswap_v2`.

Helpers: `isGraduated(token)`, `curvePair(token)`.

## Bot config

```ini
DEX_TYPE=cronos_launch
CRONOS_RPC_URL=https://evm.cronos.com/
CHAIN_ID=25
DEX_FACTORY_ADDRESS=0x227205a020bd5522e45436176d85603d2dcc43c5
DEX_ROUTER_ADDRESS=0xa18f14a35853bc619132ba9e126bf2ec63183c8e
BASE_TOKEN_ADDRESS=0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23
BASE_TOKEN_IS_NATIVE_WRAPPER=true
MODE=watch   # or paper first; live only after confirm-live
```

`DEX_ROUTER_ADDRESS` is the **launch entry** for this adapter (not the VVS router).

## Safety

- Prefer `npm run bot -- watch` before any live buys.
- Birth snipes are extremely competitive; public RPC rate limits will lose.
- Never fund more than you can lose; use a dedicated hot wallet.
