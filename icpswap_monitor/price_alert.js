// ファイル位置: icpswap_monitor/price_alert.js
// 目的: 価格変動を監視し、閾値を超えた際にDiscord通知を送る
// 背景: バッチ監視だけでなく相場急変も即時検知したい要求に応える
import { icpswapMonitorConfig } from './config.js';
import { fetchTransactionsSince } from './persistence.js';
import { notify } from './notifier.js';
import { formatTimestampLabel } from './utils.js';

const lastAlertAt = new Map();

export async function checkPriceAlert(pool) {
  const alertConfig = icpswapMonitorConfig.priceAlert;
  if (!alertConfig?.enabled) {
    return;
  }

  const windowMs = alertConfig.windowMinutes * 60 * 1000;
  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    return;
  }

  const sinceIso = new Date(Date.now() - windowMs).toISOString();
  const records = await fetchTransactionsSince(pool.poolId, sinceIso);
  const priced = records.filter((record) => isValidPrice(record.trade_price));
  if (priced.length < alertConfig.minSamples) {
    return;
  }

  const first = priced[0];
  const latest = priced[priced.length - 1];
  const basePrice = Number(first.trade_price);
  const currentPrice = Number(latest.trade_price);
  if (!isValidPrice(basePrice) || !isValidPrice(currentPrice)) {
    return;
  }

  const displayBasePrice = invertPrice(basePrice);
  const displayCurrentPrice = invertPrice(currentPrice);
  if (displayBasePrice === null || displayCurrentPrice === null) {
    return;
  }

  const changePercent =
    ((displayCurrentPrice - displayBasePrice) / displayBasePrice) * 100;
  if (!Number.isFinite(changePercent) || Math.abs(changePercent) < alertConfig.thresholdPercent) {
    return;
  }

  const now = Date.now();
  const lastNotifiedAt = lastAlertAt.get(pool.poolId) ?? 0;
  const cooldownMs = alertConfig.cooldownMinutes * 60 * 1000;
  if (cooldownMs > 0 && now - lastNotifiedAt < cooldownMs) {
    return;
  }

  const direction = changePercent > 0 ? '上昇' : '下落';
  const rangeLabel = `${formatTimestampLabel(new Date(first.tx_time))} → ${formatTimestampLabel(
    new Date(latest.tx_time)
  )}`;
  const message = [
    'ICPSwap価格アラート',
    `${pool.title}: ${direction} ${changePercent.toFixed(1)}%`,
    `価格 ${formatPrice(displayBasePrice)} → ${formatPrice(displayCurrentPrice)}`,
    `期間 ${rangeLabel} (過去${alertConfig.windowMinutes}分)`,
  ].join('\\n');

  await notify(message);
  lastAlertAt.set(pool.poolId, now);
}

function isValidPrice(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0;
}

function formatPrice(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '-';
  }
  return numeric >= 1 ? numeric.toFixed(3) : numeric.toPrecision(3);
}

function invertPrice(value) {
  const numeric = Number(value);
  if (!isValidPrice(numeric)) {
    return null;
  }
  return 1 / numeric;
}
