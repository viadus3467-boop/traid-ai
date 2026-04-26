export const FOREX_PAIRS = [
  { id: "eurusd", pair: "EUR/USD", base: "EUR", quote: "USD", market: "forex", decimals: 4, timeframe: "1d" },
  { id: "gbpusd", pair: "GBP/USD", base: "GBP", quote: "USD", market: "forex", decimals: 4, timeframe: "1d" },
  { id: "usdjpy", pair: "USD/JPY", base: "USD", quote: "JPY", market: "forex", decimals: 2, timeframe: "1d" },
  { id: "usdchf", pair: "USD/CHF", base: "USD", quote: "CHF", market: "forex", decimals: 4, timeframe: "1d" },
  { id: "audusd", pair: "AUD/USD", base: "AUD", quote: "USD", market: "forex", decimals: 4, timeframe: "1d" },
  { id: "nzdusd", pair: "NZD/USD", base: "NZD", quote: "USD", market: "forex", decimals: 4, timeframe: "1d" },
  { id: "usdcad", pair: "USD/CAD", base: "USD", quote: "CAD", market: "forex", decimals: 4, timeframe: "1d" },
  { id: "eurjpy", pair: "EUR/JPY", base: "EUR", quote: "JPY", market: "forex", decimals: 2, timeframe: "1d" },
  { id: "gbpjpy", pair: "GBP/JPY", base: "GBP", quote: "JPY", market: "forex", decimals: 2, timeframe: "1d" },
  { id: "eurgbp", pair: "EUR/GBP", base: "EUR", quote: "GBP", market: "forex", decimals: 4, timeframe: "1d" },
];

export const CRYPTO_PAIRS = [
  { id: "btcusdt", pair: "BTC/USDT", base: "BTC", quote: "USDT", market: "crypto", symbol: "BTCUSDT", decimals: 2, timeframe: "15m" },
  { id: "ethusdt", pair: "ETH/USDT", base: "ETH", quote: "USDT", market: "crypto", symbol: "ETHUSDT", decimals: 2, timeframe: "15m" },
];

export const SUPPORTED_PAIRS = [...FOREX_PAIRS, ...CRYPTO_PAIRS];

export function getPairById(id) {
  return SUPPORTED_PAIRS.find((pair) => pair.id === id) || null;
}

export function getPairLabelList() {
  return SUPPORTED_PAIRS.map((pair) => pair.pair);
}
