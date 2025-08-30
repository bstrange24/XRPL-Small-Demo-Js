// amm_demo.js
// Run: node amm_demo.js
// Config via env vars:
//   NET=wss://s.altnet.rippletest.net:51233
//   SEED_ISSUER=...
//   SEED_LP=...
//   SEED_TRADER=...

import * as xrpl from 'xrpl';
import { XRP_CURRENCY, ed25519_ENCRYPTION, secp256k1_ENCRYPTION, MAINNET, TES_SUCCESS } from './constants.js';

// Account 1 (warm wallet)
// rGmU8kqozDSDGopQwbcB5zivjFoAtoGJKc;
// sEdTPXyyVHDxGmDRkQk5nPpmYAea8z7;

// Hot Wallet (operational address)
// rD4YFdgy2riRwGWY7Zx7javcA1d8VAPxm8;
// sEdTozppS3PwQ7GR3UZWhFY3B2iS9aw;

// Cold Wallet (issuing address)
// rwcdkLpcRpPnULPEMf5HtkLKmCAtfD8rFm
// sEdTbj6rqRpuC2yv4kHttbXVre9Hcju

// const NET = 'wss://s.altnet.rippletest.net:51233/';
const NET = 'wss://s.devnet.rippletest.net:51233/';
const SEED_TRADER = 'sEdTPXyyVHDxGmDRkQk5nPpmYAea8z7'; // performs swap
const SEED_LP = 'sEdTozppS3PwQ7GR3UZWhFY3B2iS9aw'; // deposits liquidity
const SEED_ISSUER = 'sEdTbj6rqRpuC2yv4kHttbXVre9Hcju'; // issues USD

// ---- Helpers ----
async function connect() {
     const client = new xrpl.Client(NET);
     await client.connect();
     return client;
}

async function submitTx(client, wallet, tx) {
     console.log(`tx ${JSON.stringify(tx, null, '\t')}`);
     const prepared = await client.autofill(tx);
     const signed = wallet.sign(prepared);
     const res = await client.submitAndWait(signed.tx_blob);
     console.log(`res ${JSON.stringify(res, null, '\t')}`);
     if (res.result.meta && typeof res.result.meta !== 'string' && res.result.meta.TransactionResult !== 'tesSUCCESS') {
          throw new Error(`TX failed: ${res.result.meta.TransactionResult}`);
     }
     return res;
}

function xrpDrops(xrpFloat) {
     return xrpl.xrpToDrops(xrpFloat.toString());
}

function issuedAmount(currency, issuer, value) {
     return { currency, issuer, value: value.toString() };
}

async function enableDefaultRipple(client, issuerWallet) {
     const tx = {
          TransactionType: 'AccountSet',
          Account: issuerWallet.classicAddress,
          SetFlag: xrpl.AccountSetAsfFlags.asfDefaultRipple,
     };
     return submitTx(client, issuerWallet, tx);
}

async function ensureTrustLine(client, wallet, currency, issuer, limit = '1000000000') {
     const tx = {
          TransactionType: 'TrustSet',
          Account: wallet.classicAddress,
          LimitAmount: { currency, issuer, value: limit },
          Flags: xrpl.TrustSetFlags.tfClearNoRipple,
     };
     return submitTx(client, wallet, tx);
}

async function sendIOU(client, issuerWallet, toAddress, currency, value) {
     const tx = {
          TransactionType: 'Payment',
          Account: issuerWallet.classicAddress,
          Destination: toAddress,
          Amount: issuedAmount(currency, issuerWallet.classicAddress, value),
     };
     return submitTx(client, issuerWallet, tx);
}

async function accountLines(client, account) {
     const res = await client.request({ command: 'account_lines', account });
     return res.result.lines || [];
}

async function ammInfoByAssets(client, asset, asset2) {
     // Some servers accept amm_info by assets; some require amm_account.
     // We try assets first.
     try {
          const res = await client.request({
               command: 'amm_info',
               asset: asset,
               asset2: asset2,
          });
          return res.result?.amm || null;
     } catch (e) {
          return null;
     }
}

async function ammInfoByAccount(client, ammAccount) {
     try {
          const res = await client.request({
               command: 'amm_info',
               amm_account: ammAccount,
          });
          return res.result?.amm || null;
     } catch (e) {
          return null;
     }
}

// ---- AMM operations ----

// Create an AMM for (asset, asset2). The ledger derives a special AMM account for the pair.
// TradingFee is in basis points (0–1000 => 0%–10%).
async function ammCreate(client, creatorWallet, amount, amount2, tradingFeeBps = 500) {
     const tx = {
          TransactionType: 'AMMCreate',
          Account: creatorWallet.classicAddress,
          Amount: amount, // e.g. xrpDrops(5)
          Amount2: amount2, // e.g. {currency:"USD", issuer:..., value:"5000"}
          TradingFee: tradingFeeBps,
     };
     return submitTx(client, creatorWallet, tx);
}

// Deposit two assets into AMM (classic two-sided add).
// Either depositor is the LP wallet, and must hold sufficient balances for both assets.
async function ammDepositTwoAsset(client, lpWallet, assetAmount, asset2Amount, assetDef, asset2Def) {
     const tx = {
          TransactionType: 'AMMDeposit',
          Account: lpWallet.classicAddress,
          Asset: assetDef, // Use {} for XRP
          Asset2: asset2Def,
          Amount: assetAmount,
          Amount2: asset2Amount,
          Flags: xrpl.AMMDepositFlags.tfTwoAsset, // Explicitly set tfTwoAsset flag
     };
     return submitTx(client, lpWallet, tx);
}

// Withdraw from AMM by specifying LP tokens to redeem (pulls out proportional assets).
async function ammWithdrawByLP(client, lpWallet, assetDef, asset2Def, lpTokensOut, lpTokenIn) {
     // ammwithdraw = {
     //      TransactionType: 'AMMWithdraw',
     //      Asset: {
     //           currency: 'XRP',
     //      },
     //      Asset2: {
     //           currency: asset2_currency,
     //           issuer: asset2_issuer,
     //      },
     //      Account: standby_wallet.address,
     //      LPTokenIn: {
     //           currency: ammCurrency,
     //           issuer: ammIssuer,
     //           value: LPTokens,
     //      },
     //      Flags: 0x00010000,
     // };

     const tx = {
          TransactionType: 'AMMWithdraw',
          Account: lpWallet.classicAddress,
          Asset: assetDef,
          Asset2: asset2Def,
          // Amount: lpTokensOut,
          LPTokenIn: lpTokenIn,
          Flags: 0x00010000,
          // LPTokenOut: lpTokensOut.toString(),
          // Optional flags can force single-asset withdrawals, etc.
     };
     return submitTx(client, lpWallet, tx);
}

// Perform a swap via AMM using a Payment that pathfinds through the pool.
// Example: swap XRP -> USD by sending a Payment to self with Amount in USD and SendMax in XRP.
async function swapViaPayment(client, traderWallet, outAmount, sendMax) {
     const tx = {
          TransactionType: 'Payment',
          Account: traderWallet.classicAddress,
          Destination: traderWallet.classicAddress, // self-payment swap
          Amount: outAmount, // desired output (e.g., IOU)
          SendMax: sendMax, // max input you’re willing to spend (e.g., drops of XRP)
          // You can add DeliverMin for slippage protection.
          // Paths: leave empty to allow rippled to find the AMM path automatically.
     };
     return submitTx(client, traderWallet, tx);
}

(async () => {
     if (!SEED_ISSUER || !SEED_LP || !SEED_TRADER) {
          console.error('Please set SEED_ISSUER, SEED_LP, SEED_TRADER in environment.');
          process.exit(1);
     }

     const client = await connect();
     console.log('Connected:', NET);

     const issuer = xrpl.Wallet.fromSeed(SEED_ISSUER);
     const lp = xrpl.Wallet.fromSeed(SEED_LP);
     const trader = xrpl.Wallet.fromSeed(SEED_TRADER);

     console.log('Issuer:', issuer.classicAddress);
     console.log('LP:    ', lp.classicAddress);
     console.log('Trader:', trader.classicAddress);

     // // Define assets: XRP / USD (issued by issuer)
     const ASSET_XRP = { currency: 'XRP' };
     const ASSET_USD = { currency: 'USD', issuer: issuer.classicAddress };

     // console.log('Enabling DefaultRipple on issuer...');
     await enableDefaultRipple(client, issuer);

     // 1) Ensure trust lines for USD (LP + Trader)
     console.log('Setting trust lines for USD...');
     await ensureTrustLine(client, lp, 'USD', issuer.classicAddress, '1000000');
     await ensureTrustLine(client, trader, 'USD', issuer.classicAddress, '1000000');

     // 2) Fund LP & Trader with USD IOU from Issuer
     console.log('Issuing USD to LP and Trader...');
     await sendIOU(client, issuer, lp.classicAddress, 'USD', '10000');
     await sendIOU(client, issuer, trader.classicAddress, 'USD', '5000');

     // 3) Check for existing AMM
     console.log('Checking AMM for XRP/USD...');
     let amm = await ammInfoByAssets(client, ASSET_XRP, ASSET_USD);
     if (amm) {
          console.log('AMM exists. AMM Account:', amm.account);
     } else {
          console.log('No AMM found. Creating...');
          await ammCreate(client, lp, xrpDrops(5), issuedAmount('USD', issuer.classicAddress, '5000'), 500);
          // Give ledger a moment & fetch info
          amm = await ammInfoByAssets(client, ASSET_XRP, ASSET_USD);
          if (!amm) {
               console.warn('AMM not immediately visible via asset query; trying amm_info by account if known.');
          } else {
               console.log('AMM created. AMM Account:', amm.amm_account);
          }
     }

     // 4) Deposit two assets into AMM (LP adds initial liquidity)
     // Example: deposit 5 XRP + 5000 USD
     console.log('Depositing liquidity (two-asset)...');
     await ammDepositTwoAsset(client, lp, xrpDrops(5), issuedAmount('USD', issuer.classicAddress, '5000'), ASSET_XRP, ASSET_USD);
     console.log('Deposit complete.');

     // 5) Perform a swap via AMM with a Payment (Trader swaps XRP -> USD)
     // Ask for 100 USD, allow up to 2 XRP (example) — adjust values to succeed
     console.log('Swapping via Payment (XRP -> USD)...');
     await swapViaPayment(client, trader, issuedAmount('USD', issuer.classicAddress, '100'), xrpDrops(10));
     console.log('Swap complete.');

     // 6) Withdraw liquidity by LP tokens (LP redeems a small portion)
     // You can inspect LP token balance via account_lines (currency is 40-hex LP token).
     console.log('Withdrawing via LP tokens...');
     const lines = await accountLines(client, lp.classicAddress);
     const lpTokenLine = lines.find(l => /^[A-F0-9]{40}$/i.test(l.currency));
     if (!lpTokenLine) {
          console.warn('No LP token line found on LP account; cannot withdraw by LP tokens right now.');
     } else {
          console.log(`LP Token Balance: ${lpTokenLine.balance} (Currency: ${lpTokenLine.currency})`);
          const current = parseFloat(lpTokenLine.balance || '0');
          const redeem = (current * 0.1).toFixed(4).toString(); // Use 4 decimal places
          // const redeem = '1';
          if (parseFloat(lpTokenLine.balance) < parseFloat(redeem)) {
               throw new Error(`Insufficient LP tokens: ${lpTokenLine.balance} available, ${redeem} required`);
          }
          console.log(`Redeeming LP tokens: ${redeem} of ${current}`);
          // Check AMM pool asset order
          let amm = await ammInfoByAssets(client, ASSET_XRP, ASSET_USD);
          console.log(`amm ${JSON.stringify(amm, null, '\t')}`);
          const ammIssuer = amm.lp_token.issuer;
          const ammCurrency = amm.lp_token.currency;
          const LP_TOKEN_IN = { currency: ammCurrency, issuer: ammIssuer, value: redeem };

          if (!amm) {
               amm = await ammInfoByAssets(client, ASSET_USD, ASSET_XRP);
               if (amm) {
                    console.log('Using USD/XRP pool order');
                    await ammWithdrawByLP(client, lp, ASSET_USD, ASSET_XRP, redeem, LP_TOKEN_IN);
               } else {
                    throw new Error('AMM pool does not exist');
               }
          } else {
               await ammWithdrawByLP(client, lp, ASSET_XRP, ASSET_USD, redeem, LP_TOKEN_IN);
          }
          console.log('Withdraw complete.');
     }

     // Final check
     const finalAmm = await ammInfoByAssets(client, ASSET_XRP, ASSET_USD);
     if (finalAmm) {
          console.log('AMM status:', {
               account: finalAmm.account,
               amount: finalAmm.amount,
               amount2: finalAmm.amount2,
               lp_token: finalAmm.lp_token,
               trading_fee: finalAmm.trading_fee,
          });
     } else {
          console.log('AMM not found via assets query at the end.');
     }

     const finalAmm1 = await ammInfoByAssets(client, ASSET_USD, ASSET_XRP);
     if (finalAmm1) {
          console.log('AMM status:', {
               account: finalAmm1.account,
               amount: finalAmm1.amount,
               amount2: finalAmm1.amount2,
               lp_token: finalAmm1.lp_token,
               trading_fee: finalAmm1.trading_fee,
          });
     } else {
          console.log('AMM not found via assets query at the end.');
     }

     await client.disconnect();
     console.log('Done.');
})().catch(async e => {
     console.error('Error:', e?.message || e);
     process.exit(1);
});
