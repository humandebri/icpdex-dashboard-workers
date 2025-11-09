// 環境変数を一元管理し、runtimeパラメータをここからのみ参照する
import dotenv from 'dotenv';

dotenv.config();

const REQUIRED_ENV_VARS = ['SUPABASE_URL'];
const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseKey = supabaseServiceKey ?? supabaseAnonKey;

if (!supabaseKey) {
  throw new Error('Supabase credentials missing: SUPABASE_SERVICE_KEY か SUPABASE_ANON_KEY のいずれかを設定してください');
}

export const appConfig = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey,
  supabaseKeyType: supabaseServiceKey ? 'service' : 'anon',
  ledgerHost: process.env.LEDGER_HOST ?? 'https://icp-api.io',
  snapshotIntervalMs: Number(process.env.SNAPSHOT_INTERVAL_MS ?? 300000),
  priceSymbols: {
    binance: process.env.PRICE_SYMBOL_BINANCE ?? 'ICP/USDT',
    coinbase: process.env.PRICE_SYMBOL_COINBASE ?? 'ICP/USD',
    bybit: process.env.PRICE_SYMBOL_BYBIT ?? 'ICP/USDT',
  },
};
