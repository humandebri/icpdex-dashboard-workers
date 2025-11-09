// ファイル位置: icpswap_monitor/icpswap_client.js
// 目的: ICPSwap REST API から対象プールのトランザクションを取得する薄いクライアント
// 背景: fetch周りの例外処理・URL組み立てを一箇所に閉じ込め、上位ロジックをシンプルに保つ
import fetch from 'node-fetch';

import { icpswapMonitorConfig } from './config.js';

const { apiBaseUrl, requestTimeoutMs } = icpswapMonitorConfig;

export async function fetchPoolTransactions(poolId, { page = 1, limit = 10 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const endpoint = new URL(`${apiBaseUrl}/info/pool/${poolId}/transaction`);
    endpoint.searchParams.set('page', page);
    endpoint.searchParams.set('limit', limit);

    const response = await fetch(endpoint, { signal: controller.signal });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`ICPSwap API error (${response.status}): ${body}`);
    }

    const payload = await response.json();
    if (payload.code !== 200) {
      throw new Error(`ICPSwap API returned non-success code: ${payload.code}`);
    }

    const data = payload.data ?? { totalElements: 0, content: [] };
    return {
      poolId,
      totalElements: data.totalElements ?? 0,
      content: Array.isArray(data.content) ? data.content : [],
    };
  } finally {
    clearTimeout(timeout);
  }
}

