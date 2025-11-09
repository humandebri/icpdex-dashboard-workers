// ファイル位置: icpswap_monitor/notifier.js
// 目的: Discord Webhook 経由で障害通知を送る共通ユーティリティ
// 背景: 常駐バッチが止まった際に即座に気付けるよう、Webhook処理を分離する
import fetch from 'node-fetch';

import { icpswapMonitorConfig } from './config.js';

const { discordWebhookUrl } = icpswapMonitorConfig.notifier;

export async function notify(message) {
  if (!discordWebhookUrl) {
    return;
  }

  const response = await fetch(discordWebhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content: message }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord webhook failed (${response.status}): ${body}`);
  }
}
