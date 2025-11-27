// ファイル位置: icpswap_monitor/notifier.js
// 目的: Discord Webhook 経由で障害通知を送る共通ユーティリティ
// 背景: 常駐バッチが止まった際に即座に気付けるよう、Webhook処理を分離する
import fetch from 'node-fetch';

import { icpswapMonitorConfig } from './config.js';
import { withTimeout } from './utils.js';

const { discordWebhookUrl } = icpswapMonitorConfig.notifier;

export async function notify(message) {
  if (!discordWebhookUrl) {
    return;
  }

  const controller = new AbortController();

  const response = await withTimeout(
    fetch(discordWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({ content: message }),
    }),
    icpswapMonitorConfig.notifierRequestTimeoutMs,
    'discord webhook',
    () => controller.abort()
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord webhook failed (${response.status}): ${body}`);
  }
}
