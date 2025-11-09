// ファイル位置: icpswap_monitor/volume_alert.js
// 目的: 出来高の急増を検知し、Discordへ通知する
// 背景: 直近ウィンドウの出来高が24時間平均より大きく乖離した場合に即座に把握したいニーズに対応する
import { icpswapMonitorConfig } from './config.js';
import { fetchTransactionsSince } from './persistence.js';
import { notify } from './notifier.js';
import { formatTimestampLabel } from './utils.js';

const lastVolumeAlertAt = new Map();

export async function checkVolumeAlert(pool) {
  const alertConfig = icpswapMonitorConfig.volumeAlert;
  if (!alertConfig?.enabled) {
    return;
  }

  const windowMs = minutesToMs(alertConfig.windowMinutes);
  const baselineMs = hoursToMs(alertConfig.baselineHours);
  if (!isPositiveNumber(windowMs) || !isPositiveNumber(baselineMs) || baselineMs <= windowMs) {
    return;
  }

  const now = Date.now();
  const baselineStartIso = new Date(now - baselineMs).toISOString();
  const records = await fetchTransactionsSince(pool.poolId, baselineStartIso);
  if (!records.length) {
    return;
  }

  const windowStartMs = now - windowMs;
  let baselineVolume = 0;
  let windowVolume = 0;

  for (const record of records) {
    const icpVolume = extractIcpVolume(record);
    if (!isPositiveNumber(icpVolume)) {
      continue;
    }

    baselineVolume += icpVolume;

    const txTimeMs = new Date(record.tx_time).getTime();
    if (txTimeMs >= windowStartMs) {
      windowVolume += icpVolume;
    }
  }

  if (!isPositiveNumber(baselineVolume)) {
    return;
  }

  const windowsInBaseline = baselineMs / windowMs;
  if (!isPositiveNumber(windowsInBaseline)) {
    return;
  }

  const averageWindowVolume = baselineVolume / windowsInBaseline;
  if (
    !isPositiveNumber(averageWindowVolume) ||
    averageWindowVolume < (alertConfig.minBaselineVolume ?? 0)
  ) {
    return;
  }

  const increasePercent = ((windowVolume - averageWindowVolume) / averageWindowVolume) * 100;
  if (!Number.isFinite(increasePercent) || increasePercent < alertConfig.increasePercent) {
    return;
  }

  const cooldownMs = minutesToMs(alertConfig.cooldownMinutes);
  const lastNotifiedAt = lastVolumeAlertAt.get(pool.poolId) ?? 0;
  if (cooldownMs > 0 && now - lastNotifiedAt < cooldownMs) {
    return;
  }

  const message = [
    'ICPSwap出来高アラート',
    `${pool.title}: 直近${alertConfig.windowMinutes}分の出来高が平均比 +${increasePercent.toFixed(0)}%`,
    `現在: ${formatVolume(windowVolume)} / 平均: ${formatVolume(averageWindowVolume)}`,
    `比較対象: 過去${alertConfig.baselineHours}時間のウィンドウ平均`,
    `対象期間: ${formatTimestampLabel(new Date(windowStartMs))} → ${formatTimestampLabel(
      new Date(now)
    )}`,
  ].join('\n');

  await notify(message);
  lastVolumeAlertAt.set(pool.poolId, now);
}

function extractIcpVolume(record) {
  const token0Symbol = (record.token0_symbol ?? '').toUpperCase();
  const token1Symbol = (record.token1_symbol ?? '').toUpperCase();
  if (token0Symbol === 'ICP') {
    const volume = toNumber(record.token0_amount_in);
    return isPositiveNumber(volume) ? volume : null;
  }
  if (token1Symbol === 'ICP') {
    const volume = toNumber(record.token1_amount_out);
    return isPositiveNumber(volume) ? volume : null;
  }
  return null;
}

function formatVolume(value) {
  if (!Number.isFinite(value)) {
    return '-';
  }
  const formatted = value >= 1 ? value.toFixed(2) : value.toPrecision(3);
  return `${formatted} ICP`;
}

function minutesToMs(value) {
  return toNumber(value) * 60 * 1000;
}

function hoursToMs(value) {
  return toNumber(value) * 3600 * 1000;
}

function toNumber(value) {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return Number(value);
}

function isPositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
