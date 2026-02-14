import requests
import config


COINGECKO_BASE = "https://api.coingecko.com/api/v3"


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
