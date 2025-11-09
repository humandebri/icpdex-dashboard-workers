// ファイル位置: icpswap_monitor/processor.js
// 目的: REST API→DB永続化までの差分同期ロジックを司る
// 背景: 1分ごとのポーリングで同じ履歴を何度も取得しないよう、指数的にリミットを調整しながら取得する
import { fetchPoolTransactions } from './icpswap_client.js';
import { getLatestStoredTransaction, upsertTransactions } from './persistence.js';
import { icpswapMonitorConfig } from './config.js';
import { computeTradePrice, decimalToNumber } from './utils.js';

const { initialSync, incrementalFetch } = icpswapMonitorConfig;

export async function syncPool(pool) {
  const latest = await getLatestStoredTransaction(pool.poolId);
  if (!latest) {
    const inserted = await runInitialSync(pool);
    return { poolId: pool.poolId, inserted, mode: 'initial' };
  }

  const inserted = await runIncrementalSync(pool, latest);
  return { poolId: pool.poolId, inserted, mode: 'incremental' };
}

async function runInitialSync(pool) {
  let page = 1;
  let totalInserted = 0;

  while (page <= initialSync.maxPages) {
    const { content } = await fetchPoolTransactions(pool.poolId, {
      page,
      limit: initialSync.pageLimit,
    });

    const swapContent = content.filter(isSwapTransaction);
    if (swapContent.length > 0) {
      const records = swapContent.map((tx) => mapTransaction(pool, tx));
      await upsertTransactions(records);
      totalInserted += records.length;
    }

    if (content.length < initialSync.pageLimit) {
      break;
    }

    page += 1;
  }

  return totalInserted;
}

async function runIncrementalSync(pool, latest) {
  let limit = incrementalFetch.baseLimit;
  let inserted = 0;
  const lastTimestamp = new Date(latest.tx_time).getTime();
  const lastHash = latest.tx_hash;

  let hitKnownRecord = false;

  while (limit <= incrementalFetch.maxLimit) {
    const { content } = await fetchPoolTransactions(pool.poolId, { page: 1, limit });
    if (!content.length) {
      break;
    }

    const { records, reachedKnownRecord } = extractNewRecords(pool, content, {
      lastTimestamp,
      lastHash,
    });

    if (reachedKnownRecord) {
      hitKnownRecord = true;
    }

    if (records.length > 0) {
      await upsertTransactions(records);
      inserted += records.length;
    }

    if (reachedKnownRecord || content.length < limit) {
      break;
    }

    const nextLimit = limit * 2;
    if (nextLimit === limit) {
      break;
    }
    limit = Math.min(nextLimit, incrementalFetch.maxLimit);
  }

  if (!hitKnownRecord && inserted === 0 && limit >= incrementalFetch.maxLimit) {
    console.warn(
      `[icpswap] ${pool.title}: max incremental limit ${incrementalFetch.maxLimit} reached without hitting known record`
    );
  }

  return inserted;
}

function extractNewRecords(pool, content, { lastTimestamp, lastHash }) {
  const records = [];
  let reachedKnownRecord = false;

  for (const tx of content) {
    if (!isSwapTransaction(tx)) {
      // Swap以外のイベントは価格計算不要なので保存対象から除外する
      continue;
    }

    const txTimestamp = Number(tx.txTime ?? 0);
    if (!Number.isFinite(txTimestamp)) {
      continue;
    }

    if (txTimestamp < lastTimestamp) {
      reachedKnownRecord = true;
      break;
    }

    if (txTimestamp === lastTimestamp && tx.txHash === lastHash) {
      reachedKnownRecord = true;
      continue;
    }

    records.push(mapTransaction(pool, tx));
  }

  return { records: records.reverse(), reachedKnownRecord };
}

function mapTransaction(pool, tx) {
  const txTimeMs = Number(tx.txTime ?? 0);
  const executedAt = new Date(txTimeMs);
  const priceInfo = computeTradePrice(tx);
  const txHash = deriveTxHash(pool, tx);

  return {
    pool_id: pool.poolId,
    pool_label: pool.title,
    tx_hash: txHash,
    tx_time: executedAt.toISOString(),
    action_type: tx.actionType ?? null,
    direction: priceInfo.direction,
    token0_symbol: tx.token0Symbol ?? null,
    token1_symbol: tx.token1Symbol ?? null,
    token0_amount_in: decimalToNumber(tx.token0AmountIn),
    token1_amount_out: decimalToNumber(tx.token1AmountOut),
    trade_price: priceInfo.price,
    quote_symbol: priceInfo.quoteSymbol ?? null,
  };
}

function isSwapTransaction(tx) {
  return (tx.actionType ?? '').toLowerCase() === 'swap';
}

function deriveTxHash(pool, tx) {
  const rawHash = typeof tx.txHash === 'string' ? tx.txHash.trim() : '';
  const isPlaceholderHash =
    rawHash.length === 0 || rawHash === pool.poolId || rawHash.endsWith('_hash');

  if (!isPlaceholderHash) {
    return rawHash;
  }

  // 一部プールではtxHashが固定値のため、プールID/タイムスタンプ/入出力量で擬似的に一意キーを組み立てる
  const fallbackParts = [
    pool.poolId,
    String(tx.txTime ?? 0),
    tx.actionType ?? 'swap',
    tx.token0AmountIn ?? '',
    tx.token1AmountOut ?? '',
  ];

  return fallbackParts.join(':');
}
