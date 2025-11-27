// ファイル位置: icpswap_monitor/run_monitor.js
// 目的: 1分ごとのICPSwapモニタリングループを起動し、差分同期と通知を担うエントリーポイント
// 背景: Python版スクリプトをNode.jsへ置き換え、REST API + Supabaseベースで再構成した
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import { icpswapMonitorConfig } from './config.js';
import { syncPool } from './processor.js';
import { notify } from './notifier.js';
import { checkPriceAlert } from './price_alert.js';
import { checkVolumeAlert } from './volume_alert.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let isRunning = false;

process.on('unhandledRejection', (reason) => {
  console.error('[icpswap] unhandled promise rejection', reason);
  isRunning = false;
});

process.on('uncaughtException', (error) => {
  console.error('[icpswap] uncaught exception', error);
  // すぐ落ちるよりも状態を見たいので、ここでは終了せずPM2側に任せる
});

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runOnce() {
  if (isRunning) {
    console.warn('[icpswap] previous run still in progress, skipping this interval');
    return;
  }

  isRunning = true;
  try {
    const stats = [];
    for (const pool of icpswapMonitorConfig.pools) {
      try {
        const result = await syncPool(pool);
        stats.push(result);
        console.log(
          `[icpswap] ${pool.title}: ${result.mode} sync inserted ${result.inserted} rows`
        );
        await runPriceAlertCheck(pool);
        await runVolumeAlertCheck(pool);
      } catch (poolError) {
        console.error(`[icpswap] Failed to sync ${pool.title}:`, poolError);
        try {
          await notify(`ICPSwapモニタ同期失敗: ${pool.title} - ${poolError.message}`);
        } catch (notifyError) {
          console.error('[icpswap] notify failed (pool error path)', notifyError);
        }
      }
    }

    return stats;
  } catch (error) {
    console.error('[icpswap] runOnce failed', error);
    try {
      await notify(`ICPSwapモニタが停止しました: ${error.message}`);
    } catch (notifyError) {
      console.error('[icpswap] notify failed (runOnce error path)', notifyError);
    }
    // ここでthrowするとトップレベルまで伝播するのでログのみで継続する
  } finally {
    isRunning = false;
  }
}

async function runOnceWithRetry(maxAttempts = 2, retryDelayMs = 5000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await runOnce();
    if (!isRunning) {
      return;
    }
    if (attempt < maxAttempts) {
      console.warn(`[icpswap] run still marked running, retrying in ${retryDelayMs}ms (attempt ${attempt}/${maxAttempts})`);
      await delay(retryDelayMs);
    }
  }
}

function startScheduler() {
  console.log('[icpswap] monitor started in', __dirname);
  runOnceWithRetry().catch((error) => {
    console.error('[icpswap] initial run failed', error);
  });

  setInterval(() => {
    runOnceWithRetry().catch((error) => {
      console.error('[icpswap] scheduled run failed', error);
    });
  }, icpswapMonitorConfig.pollIntervalMs);
}

if (process.argv[1] === __filename) {
  try {
    startScheduler();
  } catch (error) {
    console.error('[icpswap] fatal error during startup', error);
    process.exit(1);
  }
}

// 価格アラート判定で例外が出ても全体ループを止めないよう握り潰す
async function runPriceAlertCheck(pool) {
  try {
    await checkPriceAlert(pool);
  } catch (error) {
    console.error(`[icpswap] price alert evaluation failed for ${pool.title}`, error);
  }
}

// 出来高アラートも副次的な監視なので、失敗時はログのみ残す
async function runVolumeAlertCheck(pool) {
  try {
    await checkVolumeAlert(pool);
  } catch (error) {
    console.error(`[icpswap] volume alert evaluation failed for ${pool.title}`, error);
  }
}

export { runOnce, startScheduler };
