from enum import Enum


class Signal(Enum):
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"


def compute_sma(prices, period):
    """Compute Simple Moving Average over the last `period` prices.

    Args:
        prices: list of price floats (oldest first)
        period: number of data points to average

    Returns:
        SMA as a float, or None if not enough data.
    """
    if len(prices) < period:
        return None
    return sum(prices[-period:]) / period


def evaluate_signal(prices, short_period, long_period):
    """Detect SMA crossover signal.

    Compares the short and long SMAs at the current and previous time step.
    - Short crosses above long → BUY
    - Short crosses below long → SELL
    - Otherwise → HOLD

    Args:
        prices: list of price floats (oldest first), needs at least
                long_period + 1 entries for crossover detection.
        short_period: period for the fast SMA
        long_period: period for the slow SMA

    Returns:
        Signal enum value.
    """
    if len(prices) < long_period + 1:
        return Signal.HOLD

    # Current SMAs
    short_now = compute_sma(prices, short_period)
    long_now = compute_sma(prices, long_period)

    # Previous SMAs (exclude the last price)
    prev_prices = prices[:-1]
    short_prev = compute_sma(prev_prices, short_period)
    long_prev = compute_sma(prev_prices, long_period)

    if any(v is None for v in (short_now, long_now, short_prev, long_prev)):
        return Signal.HOLD

    # Crossover detection
    if short_prev <= long_prev and short_now > long_now:
        return Signal.BUY
    elif short_prev >= long_prev and short_now < long_now:
        return Signal.SELL
    else:
        return Signal.HOLD
