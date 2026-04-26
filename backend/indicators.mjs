function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

export function average(values) {
  if (!values.length) {
    return 0;
  }
  return sum(values) / values.length;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function emaSeries(values, period) {
  if (!values.length) {
    return [];
  }

  const multiplier = 2 / (period + 1);
  const result = [];
  let previous = values[0];
  result.push(previous);

  for (let index = 1; index < values.length; index += 1) {
    previous = (values[index] - previous) * multiplier + previous;
    result.push(previous);
  }

  return result;
}

export function ema(values, period) {
  const series = emaSeries(values, period);
  return series.length ? series[series.length - 1] : 0;
}

export function rsiSeries(values, period = 14) {
  if (values.length <= period) {
    return [];
  }

  const deltas = [];
  for (let index = 1; index < values.length; index += 1) {
    deltas.push(values[index] - values[index - 1]);
  }

  let gains = 0;
  let losses = 0;

  for (let index = 0; index < period; index += 1) {
    const delta = deltas[index];
    if (delta >= 0) {
      gains += delta;
    } else {
      losses += Math.abs(delta);
    }
  }

  let averageGain = gains / period;
  let averageLoss = losses / period;
  const result = [];

  result.push(averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss));

  for (let index = period; index < deltas.length; index += 1) {
    const delta = deltas[index];
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? Math.abs(delta) : 0;

    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;

    if (averageLoss === 0) {
      result.push(100);
      continue;
    }

    const rs = averageGain / averageLoss;
    result.push(100 - 100 / (1 + rs));
  }

  return result;
}

export function rsi(values, period = 14) {
  const series = rsiSeries(values, period);
  return series.length ? series[series.length - 1] : 50;
}

export function macd(values, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (values.length < slowPeriod + signalPeriod) {
    return {
      line: 0,
      signal: 0,
      histogram: 0,
    };
  }

  const fast = emaSeries(values, fastPeriod);
  const slow = emaSeries(values, slowPeriod);
  const macdLineSeries = values.map((_, index) => fast[index] - slow[index]);
  const signalSeries = emaSeries(macdLineSeries, signalPeriod);
  const line = macdLineSeries[macdLineSeries.length - 1];
  const signal = signalSeries[signalSeries.length - 1];

  return {
    line,
    signal,
    histogram: line - signal,
  };
}

export function atr(candles, period = 14) {
  if (candles.length < period + 1) {
    return 0;
  }

  const ranges = [];
  for (let index = 1; index < candles.length; index += 1) {
    const current = candles[index];
    const previousClose = candles[index - 1].close;
    const highLow = current.high - current.low;
    const highClose = Math.abs(current.high - previousClose);
    const lowClose = Math.abs(current.low - previousClose);
    ranges.push(Math.max(highLow, highClose, lowClose));
  }

  return average(ranges.slice(-period));
}

export function supportResistance(candles, lookback = 40) {
  const sample = candles.slice(-lookback);
  const supports = sample.map((candle) => candle.low ?? candle.close);
  const resistances = sample.map((candle) => candle.high ?? candle.close);

  return {
    support: Math.min(...supports),
    resistance: Math.max(...resistances),
  };
}

export function percentChange(current, previous) {
  if (!previous) {
    return 0;
  }
  return ((current - previous) / previous) * 100;
}

export function trailingAverage(values, period) {
  return average(values.slice(-period));
}
