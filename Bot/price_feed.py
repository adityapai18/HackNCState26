import random
import time
import requests
import config


COINGECKO_BASE = "https://api.coingecko.com/api/v3"

# For simulation: persistent price state
_sim_price = config.ETH_BASE_PRICE
_sim_last_ts = 0.0


def _headers():
    headers = {"accept": "application/json"}
    if config.COINGECKO_API_KEY:
        headers["x-cg-demo-key"] = config.COINGECKO_API_KEY
    return headers


def get_price_history(coin_id, vs_currency="usd", days=None):
    """Fetch historical prices from CoinGecko.

    Returns list of (timestamp_ms, price) tuples.
    """
    if days is None:
        days = config.PRICE_HISTORY_DAYS

    url = f"{COINGECKO_BASE}/coins/{coin_id}/market_chart"
    params = {"vs_currency": vs_currency, "days": days}
    resp = requests.get(url, params=params, headers=_headers(), timeout=30)
    resp.raise_for_status()
    return resp.json()["prices"]  # [[timestamp_ms, price], ...]


def get_current_price(coin_id, vs_currency="usd"):
    """Fetch the current price of a coin from CoinGecko.

    Returns the price as a float.
    """
    url = f"{COINGECKO_BASE}/simple/price"
    params = {"ids": coin_id, "vs_currencies": vs_currency}
    resp = requests.get(url, params=params, headers=_headers(), timeout=30)
    resp.raise_for_status()
    return float(resp.json()[coin_id][vs_currency])


def get_simulated_price_history(coin_id, vs_currency="usd", days=None):
    """Generate simulated price history using random walk near ETH value.

    Returns list of (timestamp_ms, price) tuples matching CoinGecko format.
    """
    global _sim_price, _sim_last_ts
    if days is None:
        days = config.PRICE_HISTORY_DAYS

    now_ms = int(time.time() * 1000)
    # ~1 point per hour for 7 days
    n_points = max(50, min(200, days * 24))
    step_ms = (days * 24 * 3600 * 1000) // n_points

    prices = []
    ts = now_ms - (days * 24 * 3600 * 1000)
    # Reset to base if we haven't simulated recently
    if time.time() - _sim_last_ts > 300:
        _sim_price = config.ETH_BASE_PRICE
    _sim_last_ts = time.time()

    for _ in range(n_points):
        # Random walk: ±0.2% per step for realistic, subtle price movement
        change_pct = (random.random() - 0.5) * 0.004
        _sim_price = max(500, min(10000, _sim_price * (1 + change_pct)))
        prices.append([ts, round(_sim_price, 2)])
        ts += step_ms

    # One extra "tick" so current price changes each bot iteration (±0.15%)
    change_pct = (random.random() - 0.5) * 0.003
    _sim_price = max(500, min(10000, _sim_price * (1 + change_pct)))
    prices.append([now_ms, round(_sim_price, 2)])

    return prices


def get_price_history_or_simulated(coin_id, vs_currency="usd", days=None):
    """Get price history. Override: use simulated only (no CoinGecko) to avoid rate limits."""
    return get_simulated_price_history(coin_id, vs_currency, days)
