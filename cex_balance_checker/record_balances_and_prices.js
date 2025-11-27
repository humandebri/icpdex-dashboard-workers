// ICP残高と取引所価格を5分ごとに取得し、Supabaseへスナップショット保存する常駐スクリプト
import { HttpAgent, Actor } from '@dfinity/agent';
import { IDL } from '@dfinity/candid';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import ccxt from 'ccxt';

import { appConfig } from './config.js';
import { EXCHANGE_ACCOUNTS, LEDGER_CANISTER_ID } from './accounts.js';

global.fetch = fetch;

const ledgerIdlFactory = ({ IDL }) =>
  IDL.Service({
    account_balance: IDL.Func(
      [IDL.Record({ account: IDL.Vec(IDL.Nat8) })],
      [IDL.Record({ e8s: IDL.Nat64 })],
      ['query']
    ),
  });

const hexToBytes = (hex) => Uint8Array.from(Buffer.from(hex, 'hex'));

const supabase = createClient(appConfig.supabaseUrl, appConfig.supabaseKey);

const priceClients = {
  binance: new ccxt.binance({ enableRateLimit: true }),
  coinbase: new ccxt.coinbase(),
  bybit: new ccxt.bybit({ enableRateLimit: true }),
};

const ledgerAgent = new HttpAgent({ host: appConfig.ledgerHost });
const ledgerActor = Actor.createActor(ledgerIdlFactory, {
  agent: ledgerAgent,
  canisterId: LEDGER_CANISTER_ID,
});

let isRunning = false;

// 外部I/Oのハングを検知して処理ロックを解除するためのタイムアウトラッパー
function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
  isRunning = false;
});

async function fetchBalance(ledger, account) {
  const { name, accountHex } = account;
  try {
    const result = await withTimeout(
      ledger.account_balance({
        account: Array.from(hexToBytes(accountHex)),
      }),
      appConfig.ledgerRequestTimeoutMs,
      `ledger account_balance for ${name}`
    );
    const balanceICP = Number(result.e8s) / 1e8;
    return { ...account, balanceICP, balanceError: null };
  } catch (error) {
    return { ...account, balanceICP: null, balanceError: error.message };
  }
}

async function fetchPrice(source) {
  const client = priceClients[source];
  const symbol = appConfig.priceSymbols[source];
  if (!client || !symbol) {
    return { price: null, priceError: `Price configuration missing for ${source}`, symbol };
  }

  try {
    const ticker = await withTimeout(
      client.fetchTicker(symbol),
      appConfig.priceRequestTimeoutMs,
      `fetchTicker for ${source}`
    );
    const lastPrice = ticker.last ?? ticker.close ?? null;
    if (lastPrice === null) {
      return { price: null, priceError: `Ticker missing price for ${source}`, symbol };
    }
    return { price: Number(lastPrice), priceError: null, symbol };
  } catch (error) {
    return { price: null, priceError: error.message, symbol };
  }
}

async function fetchAllPrices() {
  const priceSources = Object.keys(priceClients);
  const results = await Promise.all(
    priceSources.map(async (source) => [source, await fetchPrice(source)])
  );
  return Object.fromEntries(results);
}

function buildSnapshotPayload(balanceResults) {
  const hadError = balanceResults.some(({ balanceError }) => balanceError);
  const totalICP = hadError
    ? null
    : balanceResults.reduce((acc, { balanceICP }) => acc + (balanceICP ?? 0), 0);
  return { hadError, totalICP };
}

async function persistSnapshot(balanceResults, priceResults) {
  const { hadError, totalICP } = buildSnapshotPayload(balanceResults);
  const { data: snapshot, error: snapshotError } = await withTimeout(
    supabase
      .from('balance_snapshots')
      .insert([{ total_icp: totalICP, had_error: hadError }])
      .select()
      .single(),
    appConfig.supabaseRequestTimeoutMs,
    'insert balance_snapshots'
  );

  if (snapshotError) {
    throw new Error(`Failed to insert snapshot: ${snapshotError.message}`);
  }

  const entriesPayload = balanceResults.map(
    ({ name, accountHex, balanceICP, balanceError, priceSource }) => {
      const priceInfo = priceSource ? priceResults[priceSource] : null;
      return {
        snapshot_id: snapshot.id,
        exchange_name: name,
        account_hex: accountHex,
        balance_icp: balanceICP,
        error_message: balanceError,
        price_usd: priceInfo?.price ?? null,
        price_error_message: priceInfo?.priceError ?? null,
        price_source: priceSource,
        price_symbol: priceInfo?.symbol ?? null,
      };
    }
  );

  const { error: entriesError } = await withTimeout(
    supabase.from('balance_snapshot_entries').insert(entriesPayload),
    appConfig.supabaseRequestTimeoutMs,
    'insert balance_snapshot_entries'
  );

  if (entriesError) {
    throw new Error(`Failed to insert snapshot entries: ${entriesError.message}`);
  }
}

async function captureSnapshot() {
  const [balanceResults, priceResults] = await Promise.all([
    Promise.all(EXCHANGE_ACCOUNTS.map((account) => fetchBalance(ledgerActor, account))),
    fetchAllPrices(),
  ]);

  await persistSnapshot(balanceResults, priceResults);
  console.log(
    `[${new Date().toISOString()}] Snapshot stored (hadError=${balanceResults.some(
      ({ balanceError }) => balanceError
    )})`
  );
}

async function runScheduledSnapshot() {
  if (isRunning) {
    console.warn('Previous snapshot still in progress. Skipping this interval.');
    return;
  }

  isRunning = true;
  try {
    await captureSnapshot();
  } catch (error) {
    console.error('Failed to record snapshot:', error);
  } finally {
    isRunning = false;
  }
}

await runScheduledSnapshot();
setInterval(runScheduledSnapshot, appConfig.snapshotIntervalMs);
