import os
from dotenv import load_dotenv

load_dotenv()

# --- Credentials ---
PRIVATE_KEY = os.getenv("PRIVATE_KEY")
RPC_URL = os.getenv("RPC_URL")
COINGECKO_API_KEY = os.getenv("COINGECKO_API_KEY")
PINATA_JWT = os.getenv("PINATA_JWT")
TRADE_LOGGER_ADDRESS = os.getenv("TRADE_LOGGER_ADDRESS")

# --- Contract Addresses (Sepolia Testnet) ---
SWAP_ROUTER_ADDRESS = "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E"  # SwapRouter02
QUOTER_ADDRESS = "0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3"       # QuoterV2

# --- Token Registry (Sepolia Testnet) ---
# coingecko_id still references mainnet tokens (for price signals)
TOKENS = {
    "WETH": {
        "address": "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
        "decimals": 18,
        "coingecko_id": "ethereum",
    },
    "USDC": {
        "address": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
        "decimals": 6,
        "coingecko_id": "usd-coin",
    },
}

# --- Trading Parameters ---
TRADE_TOKEN_IN = "WETH"       # Symbol from TOKENS dict
TRADE_TOKEN_OUT = "USDC"      # Symbol from TOKENS dict
POOL_FEE = 3000               # 3000 = 0.3%, 500 = 0.05%, 100 = 0.01%
TRADE_AMOUNT = 0.001           # Amount in human-readable units (e.g. 0.001 ETH)
SLIPPAGE_PERCENT = 0.5         # 0.5% slippage tolerance

# --- Strategy Parameters ---
SHORT_SMA_PERIOD = 10
LONG_SMA_PERIOD = 30
PRICE_HISTORY_DAYS = 7

# --- Bot Loop ---
CHECK_INTERVAL_SECONDS = 30    # 30 seconds (CoinGecko free tier rate limit)
