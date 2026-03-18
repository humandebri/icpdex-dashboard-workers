import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPriceAlertMessage } from './price_alert.js';
import { shouldStartScheduler } from './run_monitor.js';

test('buildPriceAlertMessage uses real newlines for Discord readability', () => {
  const message = buildPriceAlertMessage({
    title: 'BOB / ICP',
    direction: '上昇',
    changePercent: 12.3,
    displayBasePrice: 1.23,
    displayCurrentPrice: 1.45,
    rangeLabel: '03/18 10:00 → 03/18 10:10',
    windowMinutes: 10,
  });

  assert.match(message, /\n/);
  assert.doesNotMatch(message, /\\n/);
});

test('shouldStartScheduler returns true for direct execution', async () => {
  const moduleUrl = await import.meta.resolve('./run_monitor.js');
  const modulePath = new URL(moduleUrl).pathname;

  assert.equal(shouldStartScheduler({ entryFilePath: modulePath }), true);
  assert.equal(shouldStartScheduler({ entryFilePath: '/tmp/other-entry.js' }), false);
});

test('shouldStartScheduler returns true for pm2 execution', () => {
  assert.equal(shouldStartScheduler({ pmId: '16' }), true);
  assert.equal(shouldStartScheduler({ pm2Home: '/root/.pm2' }), true);
});
