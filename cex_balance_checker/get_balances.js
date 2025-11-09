import { HttpAgent, Actor } from '@dfinity/agent';
import { IDL } from '@dfinity/candid';
import fetch from 'node-fetch';

import { EXCHANGE_ACCOUNTS, LEDGER_CANISTER_ID } from './accounts.js';

global.fetch = fetch;

const ledgerIdlFactory = ({ IDL }) =>
  IDL.Service({
    account_balance: IDL.Func(
      [IDL.Record({ account: IDL.Vec(IDL.Nat8) })],
      [IDL.Record({ e8s: IDL.Nat64 })], // ← 型を修正！
      ['query']
    ),
  });

const hexToBytes = (hex) => Uint8Array.from(Buffer.from(hex, 'hex'));

async function fetchBalance(ledger, name, accountHex) {
  try {
    const result = await ledger.account_balance({
      account: Array.from(hexToBytes(accountHex)),
    });
    const balanceE8s = Number(result.e8s);
    const balanceICP = balanceE8s / 1e8;
    return { name, balanceICP, error: null };
  } catch (e) {
    return { name, balanceICP: null, error: e.message };
  }
}

async function main() {
  const agent = new HttpAgent({ host: 'https://icp-api.io' });
  const ledger = Actor.createActor(ledgerIdlFactory, {
    agent,
    canisterId: LEDGER_CANISTER_ID,
  });

  const balancePromises = EXCHANGE_ACCOUNTS.map(({ name, accountHex }) =>
    fetchBalance(ledger, name, accountHex)
  );

  const results = await Promise.all(balancePromises);

  let total = 0;
  let encounteredError = false; // エラー検出時は合計を null 表示してグラフ落ち込みを避ける
  for (const { name, balanceICP, error } of results) {
    if (error) {
      console.error(`${name}: Error ${error}`);
      encounteredError = true;
    } else {
      console.log(`${name}: ${balanceICP.toFixed(4)} ICP`);
      total += balanceICP;
    }
  }

  console.log('----------------------');
  if (encounteredError) {
    console.log('Total: null (集計に失敗した口座があります)');
  } else {
    console.log(`Total: ${total.toFixed(4)} ICP`);
  }
}

main().catch(console.error);
