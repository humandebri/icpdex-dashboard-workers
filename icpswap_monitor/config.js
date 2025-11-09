// ファイル位置: icpswap_monitor/config.js
// 目的: ICPSwapモニタリング処理の設定値とターゲットプール一覧を集中管理する
// 背景: 環境変数を散在させるとデプロイトラブルに繋がるため、ここで一元読み込みする
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

const pools = [
  { title: 'BOB / ICP', poolId: 'ybilh-nqaaa-aaaag-qkhzq-cai' },
  { title: 'CHAT / ICP', poolId: 'ne2vj-6yaaa-aaaag-qb3ia-cai' },
  { title: 'KINIC / ICP', poolId: '335nz-cyaaa-aaaag-qcdka-cai' },
  { title: 'MOTOKO / ICP', poolId: 'h2bmy-uaaaa-aaaag-qnffq-cai' },
  { title: 'ELNA / ICP', poolId: 'yonq6-5qaaa-aaaag-qdklq-cai' },
  { title: 'DCD / ICP', poolId: 'tupjz-uyaaa-aaaag-qcjmq-cai' },
  { title: 'EXE / ICP', poolId: 'dlfvj-eqaaa-aaaag-qcs3a-cai' },
  { title: 'TAGGR / ICP', poolId: 'opl73-raaaa-aaaag-qcunq-cai' },
  { title: 'WTN / ICP', poolId: 'oqn67-kaaaa-aaaag-qj72q-cai' },
  { title: 'ICP / USDC', poolId: 'mohjv-bqaaa-aaaag-qjyia-cai' },
  { title: 'Querio / ICP', poolId: '7flwa-kaaaa-aaaag-qcxhq-cai' },
  { title: 'ckETH / ICP', poolId: 'angxa-baaaa-aaaag-qcvnq-cai' },
  { title: 'ckBTC / ICP', poolId: 'xmiu5-jqaaa-aaaag-qbz7q-cai' },
];

export const icpswapMonitorConfig = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey,
  apiBaseUrl: process.env.ICPSWAP_API_BASE_URL ?? 'https://api.icpswap.com',
  pollIntervalMs: Number(process.env.ICPSWAP_POLL_INTERVAL_MS ?? 60000),
  requestTimeoutMs: Number(process.env.ICPSWAP_REQUEST_TIMEOUT_MS ?? 15000),
  initialSync: {
    pageLimit: Number(process.env.ICPSWAP_INITIAL_PAGE_LIMIT ?? 300),
    maxPages: Number(process.env.ICPSWAP_INITIAL_MAX_PAGES ?? 20),
  },
  incrementalFetch: {
    baseLimit: Number(process.env.ICPSWAP_BASE_LIMIT ?? 10),
    maxLimit: Number(process.env.ICPSWAP_MAX_LIMIT ?? 640),
  },
  priceAlert: {
    enabled: process.env.ICPSWAP_PRICE_ALERT_ENABLED !== 'false',
    thresholdPercent: Number(process.env.ICPSWAP_PRICE_ALERT_THRESHOLD ?? 15),
    windowMinutes: Number(process.env.ICPSWAP_PRICE_ALERT_WINDOW_MINUTES ?? 60),
    minSamples: Number(process.env.ICPSWAP_PRICE_ALERT_MIN_SAMPLES ?? 2),
    cooldownMinutes: Number(process.env.ICPSWAP_PRICE_ALERT_COOLDOWN_MINUTES ?? 10),
  },
  volumeAlert: {
    enabled: process.env.ICPSWAP_VOLUME_ALERT_ENABLED !== 'false',
    windowMinutes: Number(process.env.ICPSWAP_VOLUME_ALERT_WINDOW_MINUTES ?? 60),
    baselineHours: Number(process.env.ICPSWAP_VOLUME_ALERT_BASELINE_HOURS ?? 24),
    increasePercent: Number(process.env.ICPSWAP_VOLUME_ALERT_INCREASE_PERCENT ?? 100),
    minBaselineVolume: Number(process.env.ICPSWAP_VOLUME_ALERT_MIN_BASELINE ?? 0),
    cooldownMinutes: Number(process.env.ICPSWAP_VOLUME_ALERT_COOLDOWN_MINUTES ?? 30),
  },
  notifier: {
    discordWebhookUrl: process.env.NOTIFY_DISCORD_WEBHOOK_URL ?? null,
  },
  pools,
};
