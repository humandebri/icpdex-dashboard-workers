// ファイル位置: icpswap_monitor/utils.js
// 目的: 価格計算やフォーマットなどロジックに依存しないヘルパー群
// 背景: Processor や Charting から重複実装を排除し、テスト容易性を高める

// 外部I/Oがハングした際に呼び出し元へ明示的に失敗を返すためのタイムアウトラッパー
// cleanupFnはタイムアウト時に中断処理（例: AbortController.abort）を行うための任意のコールバック
export function withTimeout(promise, ms, label = 'operation', cleanupFn) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => {
        if (cleanupFn) {
          try {
            cleanupFn();
          } catch (cleanupError) {
            // cleanup失敗はログのみ（呼び出し元で捕捉されるrejectを優先）
            console.error(`cleanup failed for ${label}:`, cleanupError);
          }
        }
        reject(new Error(`${label} timed out after ${ms}ms`));
      },
      ms
    );
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

export function decimalToNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const ICP_LEDGER_ID = 'ryjl3-tyaaa-aaaaa-aaaba-cai';

export function computeTradePrice(tx) {
  const token0In = decimalToNumber(tx.token0AmountIn);
  const token0Out = decimalToNumber(tx.token0AmountOut);
  const token1In = decimalToNumber(tx.token1AmountIn);
  const token1Out = decimalToNumber(tx.token1AmountOut);
  const isToken0ICP = (tx.token0LedgerId ?? '') === ICP_LEDGER_ID;
  const isToken1ICP = (tx.token1LedgerId ?? '') === ICP_LEDGER_ID;

  if (isToken0ICP) {
    if (isPositive(token0In) && isPositive(token1Out)) {
      return {
        direction: 'ICP_SELL',
        price: token1Out / token0In,
        quoteSymbol: tx.token1Symbol ?? null,
      };
    }
    if (isPositive(token0Out) && isPositive(token1In)) {
      return {
        direction: 'ICP_BUY',
        price: token1In / token0Out,
        quoteSymbol: tx.token1Symbol ?? null,
      };
    }
  }

  if (isToken1ICP) {
    if (isPositive(token1In) && isPositive(token0Out)) {
      return {
        direction: 'ICP_SELL',
        price: token0Out / token1In,
        quoteSymbol: tx.token0Symbol ?? null,
      };
    }
    if (isPositive(token1Out) && isPositive(token0In)) {
      return {
        direction: 'ICP_BUY',
        price: token0In / token1Out,
        quoteSymbol: tx.token0Symbol ?? null,
      };
    }
  }

  if (
    isPositive(token0In) &&
    isPositive(token1Out)
  ) {
    return {
      direction: 'TOKEN0_SELL',
      price: token1Out / token0In,
      quoteSymbol: tx.token1Symbol ?? null,
    };
  }

  if (
    isPositive(token1In) &&
    isPositive(token0Out)
  ) {
    return {
      direction: 'TOKEN1_SELL',
      price: token1In / token0Out,
      quoteSymbol: tx.token0Symbol ?? null,
    };
  }

  return {
    direction: 'UNKNOWN',
    price: null,
    quoteSymbol: tx.token1Symbol ?? tx.token0Symbol ?? null,
  };
}

function isPositive(value) {
  return value !== null && value !== undefined && value > 0;
}

export function formatTimestampLabel(date) {
  return date
    .toLocaleString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    .replace(',', '');
}
