"""Pons launch exit strategy: scale-out TP + trailing stop + hard SL.

Numbers from watch tokens / Cronos Army setup (replaces prior 14/75/7):
  - Hard stop: -37.5%
  - TP1: +50% sell 35% of size; arms trailing
  - TP2: +100% sell 30% of size
  - Trailing: -25% off peak after TP1
  - Position size: 1% bankroll risk to hard stop

Config JSON mirror: config/pons_exit_setup.json
Launchpad filter + treat unknown registry as fail stay ON.
"""
from dataclasses import dataclass, field

SETUP = {
    "safety_checks_enabled": True,
    "launchpad_filter_enabled": True,
    "treat_unknown_registry_as_fail": True,
    "take_profit_pct": 50.0,
    "trailing_stop_pct": 25.0,
    "stop_loss_pct": 37.5,
}

TP1_PCT, TP1_SELL = 50.0, 0.35
TP2_PCT, TP2_SELL = 100.0, 0.30
TRAIL_ARM_PCT = 50.0
BANKROLL_RISK = 0.01


@dataclass
class Position:
    entry: float
    size: float
    peak: float = 0.0
    remaining: float = field(init=False)
    tp1_done: bool = False
    tp2_done: bool = False
    trail_armed: bool = False

    def __post_init__(self):
        self.remaining = self.size
        self.peak = self.entry

    def on_price(self, price: float) -> list[tuple[str, float]]:
        self.peak = max(self.peak, price)
        pnl_pct = (price / self.entry - 1.0) * 100.0
        peak_dd = (1.0 - price / self.peak) * 100.0
        sells = []

        if pnl_pct <= -SETUP["stop_loss_pct"]:
            sells.append(("stop_loss", self.remaining))
            self.remaining = 0.0
            return sells

        if not self.tp1_done and pnl_pct >= TP1_PCT:
            q = self.size * TP1_SELL
            sells.append(("tp1_+50%", q))
            self.remaining -= q
            self.tp1_done = True
            self.trail_armed = True

        if not self.tp2_done and pnl_pct >= TP2_PCT:
            q = self.size * TP2_SELL
            sells.append(("tp2_+100%", q))
            self.remaining -= q
            self.tp2_done = True

        if self.trail_armed and peak_dd >= SETUP["trailing_stop_pct"]:
            sells.append(("trailing_stop", self.remaining))
            self.remaining = 0.0

        return sells


def position_size(bankroll: float, entry: float) -> float:
    risk_usd = bankroll * BANKROLL_RISK
    stop_frac = SETUP["stop_loss_pct"] / 100.0
    return risk_usd / (entry * stop_frac)
