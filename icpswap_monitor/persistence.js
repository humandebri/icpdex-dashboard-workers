// ファイル位置: icpswap_monitor/persistence.js
// 目的: Supabase(Postgres)を介したトランザクション永続化と再取得を担当する
// 背景: 取得済みデータを元に差分同期することでAPI呼び出し件数を最小化する
import { createClient } from '@supabase/supabase-js';

import { icpswapMonitorConfig } from './config.js';

const supabase = createClient(icpswapMonitorConfig.supabaseUrl, icpswapMonitorConfig.supabaseKey);
const TABLE = 'icpswap_pool_transactions';

export async function getLatestStoredTransaction(poolId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('tx_hash, tx_time')
    .eq('pool_id', poolId)
    .order('tx_time', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to load latest transaction for ${poolId}: ${error.message}`);
  }

  return data ?? null;
}

export async function upsertTransactions(records) {
  if (records.length === 0) {
    return { inserted: 0 };
  }

  const deduped = dedupeBy(records, (record) => record.tx_hash);

  const { error } = await supabase
    .from(TABLE)
    .upsert(deduped, { onConflict: 'tx_hash' });

  if (error) {
    throw new Error(`Failed to upsert transactions: ${error.message}`);
  }

  return { inserted: deduped.length };
}

export async function fetchTransactionsSince(poolId, sinceIso) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('pool_id', poolId)
    .gte('tx_time', sinceIso)
    .order('tx_time', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch transactions for ${poolId}: ${error.message}`);
  }

  return data ?? [];
}

function dedupeBy(items, keyFn) {
  const seen = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.set(key, item);
    }
  }
  return Array.from(seen.values());
}
