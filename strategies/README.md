# Strategies

## `pons_exit_strategy.py`

Pons launch scale-out exits (Python reference module). Pair with `config/pons_exit_setup.json`.

| Rule | Value |
|------|-------|
| Hard stop | −37.5% |
| TP1 | +50%, sell 35% of size; arms trail |
| TP2 | +100%, sell 30% of size |
| Trailing | −25% off peak after TP1 |
| Risk | 1% bankroll to hard stop |

Safety: `safety_checks_enabled`, `launchpad_filter_enabled`, and `treat_unknown_registry_as_fail` remain **true**.

This repo’s runtime bot is TypeScript; these files are the Cronos Army / watch-tokens strategy source of truth until wired into `src/`.
