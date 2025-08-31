// amm_demo.js
// Run: node amm_demo.js
// Config via env vars:
//   NET=wss://s.altnet.rippletest.net:51233
//   SEED_COLD_ISSUER=...
//   SEED_HOT=...
//   SEED_WARM=...

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
const SEED_WARM = 'sEdTPXyyVHDxGmDRkQk5nPpmYAea8z7'; // performs swap
const SEED_HOT = 'sEdTozppS3PwQ7GR3UZWhFY3B2iS9aw'; // deposits liquidity
const SEED_COLD_ISSUER = 'sEdTbj6rqRpuC2yv4kHttbXVre9Hcju'; // issues USD

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
     // console.log(`res ${JSON.stringify(res, null, '\t')}`);
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

// Smart wrapper for deposit
export async function ammDeposit(client, wallet, assetDef, asset2Def, options) {
     // options = { amount, amount2, singleSide }
     const tx = {
          TransactionType: 'AMMDeposit',
          Account: wallet.classicAddress,
          Asset: assetDef,
          Asset2: asset2Def,
     };

     if (options.amount && options.amount2) {
          // Two-sided deposit
          tx.Amount = options.amount;
          tx.Amount2 = options.amount2;
          tx.Flags = xrpl.AMMDepositFlags.tfTwoAsset;
     } else if (options.singleSide === 'xrp') {
          tx.Amount = options.amount;
          tx.Flags = xrpl.AMMDepositFlags.tfOneAssetDeposit;
     } else if (options.singleSide === 'iou') {
          tx.Amount2 = options.amount2;
          tx.Flags = xrpl.AMMDepositFlags.tfOneAssetDeposit;
     } else {
          throw new Error('Invalid deposit options');
     }

     return submitTx(client, wallet, tx);
}

// Smart wrapper for withdraw
export async function ammWithdraw(client, wallet, assetDef, asset2Def, options) {
     // options = { lpTokenIn, oneSide, amount, amount2 }
     const tx = {
          TransactionType: 'AMMWithdraw',
          Account: wallet.classicAddress,
          Asset: assetDef,
          Asset2: asset2Def,
          LPTokenIn: options.lpTokenIn,
     };

     if (!options.oneSide) {
          // Regular LP redemption (both assets)
          tx.Flags = xrpl.AMMWithdrawFlags.tfLPToken;
     } else {
          // One-sided withdraw
          tx.Flags = xrpl.AMMWithdrawFlags.tfOneAssetWithdrawAll;
          if (options.amount) {
               tx.Amount = options.amount; // XRP in drops
               tx.Flags = xrpl.AMMWithdrawFlags.tfOneAssetWithdrawSpecified;
          } else if (options.amount2) {
               tx.Amount2 = options.amount2; // IOU
               tx.Flags = xrpl.AMMWithdrawFlags.tfOneAssetWithdrawSpecified;
          }
     }

     return submitTx(client, wallet, tx);
}

async function ammDepositOneAsset(client, lpWallet, assetDef, asset2Def, singleAmount, isXrpSide) {
     const tx = {
          TransactionType: 'AMMDeposit',
          Account: lpWallet.classicAddress,
          Asset: assetDef,
          Asset2: asset2Def,
          Flags: xrpl.AMMDepositFlags.tfOneAssetDeposit,
     };

     if (isXrpSide) {
          tx.Amount = singleAmount; // string (drops)
     } else {
          tx.Amount2 = singleAmount; // IssuedCurrencyAmount
     }

     return submitTx(client, lpWallet, tx);
}

async function ammWithdrawOneAsset(client, lpWallet, assetDef, asset2Def, lpTokenIn, wantXrpSide) {
     const tx = {
          TransactionType: 'AMMWithdraw',
          Account: lpWallet.classicAddress,
          Asset: assetDef,
          Asset2: asset2Def,
          LPTokenIn: lpTokenIn,
          Flags: xrpl.AMMWithdrawFlags.tfOneAssetWithdrawAll,
     };

     // You can add Amount or Amount2 if using tfOneAssetWithdrawSpecified
     // Example: tx.Amount = xrpDrops("1") to pull ~1 XRP from the pool

     return submitTx(client, lpWallet, tx);
}

// export async function getLpTokenAndBalance(client: xrpl.Client, walletAddr: string, asset: xrpl.Currency, asset2: xrpl.Currency) {
export async function getLpTokenAndBalance(client, walletAddr, asset, asset2) {
     // Step 1: get AMM info
     const resp = await client.request({
          command: 'amm_info',
          asset,
          asset2,
     });

     if (!resp.result?.amm?.lp_token) {
          throw new Error('AMM not found or LPToken missing for given asset pair');
     }

     const lpTokenDef = resp.result.amm.lp_token;

     // Step 2: get wallet trust lines (to find LP balance)
     const accountLines = await client.request({
          command: 'account_lines',
          account: walletAddr,
          peer: lpTokenDef.issuer, // only LP issuer
     });

     let lpBalance = '0';

     if (accountLines.result?.lines) {
          // const lpLine = accountLines.result.lines.find((line: any) => line.account === lpTokenDef.issuer && line.currency === lpTokenDef.currency);
          const lpLine = accountLines.result.lines.find(line => line.account === lpTokenDef.issuer && line.currency === lpTokenDef.currency);
          if (lpLine) {
               lpBalance = lpLine.balance;
          }
     }

     return {
          lpTokenDef, // { currency, issuer, value? }
          lpBalance, // string
     };
}

// Deposit two assets into AMM (classic two-sided add).
// Either depositor is the HOT wallet, and must hold sufficient balances for both assets.
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

// Withdraw from AMM by specifying HOT tokens to redeem (pulls out proportional assets).
async function ammWithdrawByLP(client, lpWallet, assetDef, asset2Def, lpTokensOut, lpTokenIn) {
     const tx = {
          TransactionType: 'AMMWithdraw',
          Account: lpWallet.classicAddress,
          Asset: assetDef,
          Asset2: asset2Def,
          LPTokenIn: lpTokenIn,
          Flags: 0x00010000,
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

// export async function getLpToken(client: xrpl.Client, asset: any, asset2: any) {
export async function getLpToken(client, asset, asset2) {
     const resp = await client.request({
          command: 'amm_info',
          asset,
          asset2,
     });

     if (!resp.result || !resp.result.amm) {
          throw new Error('AMM not found for given asset pair');
     }

     // The LPToken field looks like { currency: "...", issuer: "...", value: "..." }
     return resp.result.amm.lp_token;
}

(async () => {
     if (!SEED_COLD_ISSUER || !SEED_HOT || !SEED_WARM) {
          console.error('Please set SEED_COLD_ISSUER, SEED_HOT, SEED_WARM in environment.');
          process.exit(1);
     }

     const client = await connect();
     console.log('Connected:', NET);

     const issuer = xrpl.Wallet.fromSeed(SEED_COLD_ISSUER);
     const hot = xrpl.Wallet.fromSeed(SEED_HOT);
     const warm = xrpl.Wallet.fromSeed(SEED_WARM);

     console.log('Issuer:', issuer.classicAddress);
     console.log('HOT:    ', hot.classicAddress);
     console.log('Warm:', warm.classicAddress);

     // // Define assets: XRP / USD (issued by issuer)
     const ASSET_XRP = { currency: 'XRP' };
     const ASSET_USD = { currency: 'USD', issuer: issuer.classicAddress };

     // // console.log('Enabling DefaultRipple on issuer...');
     // await enableDefaultRipple(client, issuer);

     // // 1) Ensure trust lines for USD (HOT + Warm)
     // console.log('Setting trust lines for USD...');
     // await ensureTrustLine(client, hot, 'USD', issuer.classicAddress, '1000000');
     // await ensureTrustLine(client, warm, 'USD', issuer.classicAddress, '1000000');

     // // 2) Fund HOT & Warm with USD IOU from Issuer
     // console.log('Issuing USD to HOT and Warm...');
     // await sendIOU(client, issuer, hot.classicAddress, 'USD', '10000');
     // await sendIOU(client, issuer, warm.classicAddress, 'USD', '5000');

     // // 3) Check for existing AMM
     // console.log('Checking AMM for XRP/USD...');
     // let amm = await ammInfoByAssets(client, ASSET_XRP, ASSET_USD);
     // if (amm) {
     //      console.log('AMM exists. AMM Account:', amm.account);
     // } else {
     //      console.log('No AMM found. Creating...');
     //      await ammCreate(client, hot, xrpDrops(5), issuedAmount('USD', issuer.classicAddress, '5000'), 500);
     //      // Give ledger a moment & fetch info
     //      amm = await ammInfoByAssets(client, ASSET_XRP, ASSET_USD);
     //      if (!amm) {
     //           console.warn('AMM not immediately visible via asset query; trying amm_info by account if known.');
     //      } else {
     //           console.log('AMM created. AMM Account:', amm.amm_account);
     //      }
     // }

     // // 4) Deposit two assets into AMM (HOT adds initial liquidity)
     // // Example: deposit 5 XRP + 5000 USD
     // console.log('Depositing liquidity (two-asset)...');
     // await ammDepositTwoAsset(client, hot, xrpDrops(5), issuedAmount('USD', issuer.classicAddress, '5000'), ASSET_XRP, ASSET_USD);
     // console.log('Deposit complete.');

     // // 5) Perform a swap via AMM with a Payment (Warm swaps XRP -> USD)
     // // Ask for 100 USD, allow up to 2 XRP (example) — adjust values to succeed
     // console.log('Swapping via Payment (XRP -> USD)...');
     // await swapViaPayment(client, warm, issuedAmount('USD', issuer.classicAddress, '100'), xrpDrops(10));
     // console.log('Swap complete.');

     // // 6) Withdraw liquidity by HOT tokens (HOT redeems a small portion)
     // // You can inspect HOT token balance via account_lines (currency is 40-hex HOT token).
     // console.log('Withdrawing via HOT tokens...');
     // const lines = await accountLines(client, hot.classicAddress);
     // const lpTokenLine = lines.find(l => /^[A-F0-9]{40}$/i.test(l.currency));
     // if (!lpTokenLine) {
     //      console.warn('No HOT token line found on HOT account; cannot withdraw by HOT tokens right now.');
     // } else {
     //      console.log(`HOT Token Balance: ${lpTokenLine.balance} (Currency: ${lpTokenLine.currency})`);
     //      const current = parseFloat(lpTokenLine.balance || '0');
     //      const redeem = (current * 0.1).toFixed(4).toString(); // Use 4 decimal places
     //      if (parseFloat(lpTokenLine.balance) < parseFloat(redeem)) {
     //           throw new Error(`Insufficient HOT tokens: ${lpTokenLine.balance} available, ${redeem} required`);
     //      }
     //      console.log(`Redeeming HOT tokens: ${redeem} of ${current}`);
     //      // Check AMM pool asset order
     //      let amm = await ammInfoByAssets(client, ASSET_XRP, ASSET_USD);
     //      console.log(`amm ${JSON.stringify(amm, null, '\t')}`);
     //      const ammIssuer = amm.lp_token.issuer;
     //      const ammCurrency = amm.lp_token.currency;
     //      const LP_TOKEN_IN = { currency: ammCurrency, issuer: ammIssuer, value: redeem };

     //      if (!amm) {
     //           amm = await ammInfoByAssets(client, ASSET_USD, ASSET_XRP);
     //           if (amm) {
     //                console.log('Using USD/XRP pool order');
     //                await ammWithdrawByLP(client, hot, ASSET_USD, ASSET_XRP, redeem, LP_TOKEN_IN);
     //           } else {
     //                throw new Error('AMM pool does not exist');
     //           }
     //      } else {
     //           await ammWithdrawByLP(client, hot, ASSET_XRP, ASSET_USD, redeem, LP_TOKEN_IN);
     //      }
     //      console.log('Withdraw complete.');
     // }

     // Example asset definitions
     // Example asset definitions
     // const xrpAsset: xrpl.Currency = { currency: 'XRP' };
     // const usdAsset: xrpl.Currency = {
     //      currency: 'USD',
     //      issuer: 'rwcdkLpcRpPnULPEMf5HtkLKmCAtfD8rFm',
     // };
     const xrpAsset = { currency: 'XRP' };
     const usdAsset = {
          currency: 'USD',
          issuer: 'rwcdkLpcRpPnULPEMf5HtkLKmCAtfD8rFm',
     };

     const { lpTokenDef, lpBalance } = await getLpTokenAndBalance(client, hot.classicAddress, xrpAsset, usdAsset);

     console.log('LP Token:', lpTokenDef);
     console.log('My LP Balance:', lpBalance);

     // // // Example usage (inside an async function):
     // await ammDepositOneAsset(client, wallet, xrpAsset, usdAsset, '5000000', true); // Deposit 5 XRP only
     // await ammWithdrawOneAsset(client, wallet, xrpAsset, usdAsset, lpTokenObj, false); // Withdraw only USD side

     // // Deposit 5 XRP + 10 USD
     // await ammDeposit(client, wallet, xrpAsset, usdAsset, {
     //      amount: '5000000', // 5 XRP in drops
     //      amount2: { currency: 'USD', issuer: 'rwcdkLpcRpPnULPEMf5HtkLKmCAtfD8rFm', value: '10' },
     // });

     // // Deposit only 2 XRP
     // await ammDeposit(client, wallet, xrpAsset, usdAsset, {
     //      singleSide: 'xrp',
     //      amount: '2000000',
     // });

     // // Withdraw both sides
     // await ammWithdraw(client, wallet, xrpAsset, usdAsset, {
     //      lpTokenIn: lpTokenObj,
     // });

     // // Withdraw only USD worth of LP
     // await ammWithdraw(client, wallet, xrpAsset, usdAsset, {
     //      lpTokenIn: lpTokenObj,
     //      oneSide: true,
     //      amount2: { currency: 'USD', issuer: 'rwcdkLpcRpPnULPEMf5HtkLKmCAtfD8rFm', value: '5' },
     // });

     // // Final check
     // const finalAmm = await ammInfoByAssets(client, ASSET_XRP, ASSET_USD);
     // if (finalAmm) {
     //      console.log('AMM status:', {
     //           account: finalAmm.account,
     //           amount: finalAmm.amount,
     //           amount2: finalAmm.amount2,
     //           lp_token: finalAmm.lp_token,
     //           trading_fee: finalAmm.trading_fee,
     //      });
     // } else {
     //      console.log('AMM not found via assets query at the end.');
     // }

     // const finalAmm1 = await ammInfoByAssets(client, ASSET_USD, ASSET_XRP);
     // if (finalAmm1) {
     //      console.log('AMM status:', {
     //           account: finalAmm1.account,
     //           amount: finalAmm1.amount,
     //           amount2: finalAmm1.amount2,
     //           lp_token: finalAmm1.lp_token,
     //           trading_fee: finalAmm1.trading_fee,
     //      });
     // } else {
     //      console.log('AMM not found via assets query at the end.');
     // }

     await client.disconnect();
     console.log('Done.');
})().catch(async e => {
     console.error('Error:', e?.message || e);
     process.exit(1);
});
