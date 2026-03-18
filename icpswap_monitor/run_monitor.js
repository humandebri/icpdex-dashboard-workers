// ファイル位置: icpswap_monitor/run_monitor.js
// 目的: 1分ごとのICPSwapモニタリングループを起動し、差分同期と通知を担うエントリーポイント
// 背景: Python版スクリプトをNode.jsへ置き換え、REST API + Supabaseベースで再構成した
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import { icpswapMonitorConfig } from './config.js';
import { syncPool } from './processor.js';
import { notify } from './notifier.js';
import { checkPriceAlert } from './price_alert.js';

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

async function runOnce() {
  if (isRunning) {
    console.warn('[icpswap] previous run still in progress, skipping this interval');
    return;
  }

  isRunning = true;
  const startedAt = Date.now();
  console.log(
    `[icpswap] runOnce start at ${new Date(startedAt).toISOString()} (pools=${icpswapMonitorConfig.pools.length})`
  );
  try {
    const stats = [];
    for (const pool of icpswapMonitorConfig.pools) {
      const poolStart = Date.now();
      console.log(`[icpswap] start ${pool.title} at ${new Date(poolStart).toISOString()}`);
      try {
        const result = await syncPool(pool);
        stats.push(result);
        console.log(
          `[icpswap] ${pool.title}: ${result.mode} sync inserted ${result.inserted} rows (took ${
            Date.now() - poolStart
          }ms)`
        );
        await runPriceAlertCheck(pool);
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
    const duration = Date.now() - startedAt;
    console.log(`[icpswap] runOnce finished in ${duration}ms`);
    if (duration > icpswapMonitorConfig.pollIntervalMs) {
      console.warn(
        `[icpswap] runOnce exceeded poll interval: ${duration}ms > ${icpswapMonitorConfig.pollIntervalMs}ms`
      );
    }
  }
}

function startScheduler() {
  console.log('[icpswap] monitor started in', __dirname);
  runOnce().catch((error) => {
    console.error('[icpswap] initial run failed', error);
  });

  setInterval(() => {
    runOnce().catch((error) => {
      console.error('[icpswap] scheduled run failed', error);
    });
  }, icpswapMonitorConfig.pollIntervalMs);
}

export function shouldStartScheduler({
  entryFilePath = process.argv[1],
  pmId = process.env.pm_id,
  pm2Home = process.env.PM2_HOME,
} = {}) {
  return entryFilePath === __filename || pmId !== undefined || Boolean(pm2Home);
}

if (shouldStartScheduler()) {
  console.log('[icpswap] startScheduler triggered via execution context');
  try {
    startScheduler();
  } catch (error) {
    console.error('[icpswap] fatal error during startup', error);
    process.exit(1);
  }
} else {
  console.log('[icpswap] module loaded without starting scheduler');
}

// 価格アラート判定で例外が出ても全体ループを止めないよう握り潰す
async function runPriceAlertCheck(pool) {
  try {
    await checkPriceAlert(pool);
  } catch (error) {
    console.error(`[icpswap] price alert evaluation failed for ${pool.title}`, error);
  }
}

export { runOnce, startScheduler };
