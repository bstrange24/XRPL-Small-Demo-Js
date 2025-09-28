// amm_demo_fixed.js
// Run: node amm_demo_fixed.js
import * as xrpl from 'xrpl';

// --- CONFIG (Devnet) ---
const NET = 'wss://s.devnet.rippletest.net:51233';

const SEED_WARM = 'shfQrKNneg98KFCBVkHtA8L6akRNc'; // performs swap / test LP user rpP6yyNoxAaFcQ7AGYcpWS8VLfu14fBxGW
const SEED_HOT = 'siege name fringe member science predict drill entry market board eight train sea ribbon hood rebel train fragile style keen material they pencil near'; // deposits liquidity (initial creator) rBuUS3Gp9DpRYkGnADy9h4uR2ZKFz53diF
const SEED_COLD_ISSUER = 'shqzgFrVfYWwAqMhcVseFRBYfvm2e'; // issues BOB token rHGxxu4kvnviEc77qEoKfYSD9GEHtJ8J1p

// --- AMM flag constants (numeric to avoid enum mismatch) ---
const AMM_DEPOSIT_FLAG_SINGLE_ASSET = 0x00080000; // tfSingleAsset
const AMM_DEPOSIT_FLAG_TWO_ASSET = 0x00100000; // tfTwoAsset

const AMM_WITHDRAW_FLAG_LP_TOKEN = 0x00010000; // tfLPToken (proportional)
const AMM_WITHDRAW_FLAG_ONE_ASSET_LP_TOKEN = 0x00200000; // tfOneAssetLPToken (burn LP, receive single asset)

// --- Helpers ---
async function connect() {
     const client = new xrpl.Client(NET);
     await client.connect();
     return client;
}

async function submitTx(client, wallet, tx) {
     console.log('==> submitting tx:', JSON.stringify(tx, null, 2));
     const prepared = await client.autofill(tx);
     const signed = wallet.sign(prepared);
     const res = await client.submitAndWait(signed.tx_blob);
     console.log('==> submit result:', JSON.stringify(res.result || res, null, 2));
     // check engine_result or meta transaction result
     const engine = res?.result?.engine_result || res?.result?.meta?.TransactionResult;
     if (engine && engine !== 'tesSUCCESS') {
          throw new Error(`TX failed: ${engine}`);
     }
     return res;
}

function xrpDrops(x) {
     return xrpl.xrpToDrops(x.toString());
}

function issuedAmount(currency, issuer, value) {
     return { currency, issuer, value: value.toString() };
}

// --- Missing functions added here ---

// Enable default ripple on issuer (so IOUs can ripple)
async function enableDefaultRipple(client, issuerWallet) {
     const tx = {
          TransactionType: 'AccountSet',
          Account: issuerWallet.classicAddress,
          SetFlag: xrpl.AccountSetAsfFlags.asfDefaultRipple,
     };
     return submitTx(client, issuerWallet, tx);
}

// Ensure a trust line exists between wallet -> issuer for given currency
async function ensureTrustLine(client, wallet, currency, issuer, limit = '1000000000') {
     // check existing
     const linesRes = await client.request({ command: 'account_lines', account: wallet.classicAddress });
     const lines = linesRes.result?.lines || [];
     const exists = lines.some(line => line.account === issuer && line.currency === currency);
     if (exists) {
          console.log(`Trust line ${currency}/${issuer} already exists for ${wallet.classicAddress}`);
          return;
     }

     console.log(`Creating trust line ${currency}/${issuer} for ${wallet.classicAddress} ...`);
     const tx = {
          TransactionType: 'TrustSet',
          Account: wallet.classicAddress,
          LimitAmount: { currency, issuer, value: limit },
          Flags: xrpl.TrustSetFlags.tfClearNoRipple, // safe default
     };
     return submitTx(client, wallet, tx);
}

// Send IOU from issuer to a destination
async function sendIOU(client, issuerWallet, toAddress, currency, value) {
     const tx = {
          TransactionType: 'Payment',
          Account: issuerWallet.classicAddress,
          Destination: toAddress,
          Amount: issuedAmount(currency, issuerWallet.classicAddress, value),
     };
     return submitTx(client, issuerWallet, tx);
}

// Query helpers
async function accountLines(client, account) {
     const res = await client.request({ command: 'account_lines', account });
     return res.result?.lines || [];
}

// --- AMM operations ---
async function ammInfoByAssets(client, wallet, asset, asset2) {
     try {
          const res = await client.request({ command: 'amm_info', asset, asset2, account: wallet.classicAddress });
          return res.result?.amm || null;
     } catch (e) {
          return null;
     }
}

async function ammCreate(client, creatorWallet, amount, amount2, tradingFeeBps = 500) {
     const tx = {
          TransactionType: 'AMMCreate',
          Account: creatorWallet.classicAddress,
          Amount: amount,
          Amount2: amount2,
          TradingFee: tradingFeeBps,
     };
     return submitTx(client, creatorWallet, tx);
}

async function ammDepositTwoAsset(client, wallet, assetAmount, asset2Amount, assetDef, asset2Def) {
     if (asset2Def.issuer !== asset2Amount.issuer) {
          console.error('MISMATCH: asset2Def.issuer:', asset2Def.issuer);
          console.error('MISMATCH: asset2Amount.issuer:', asset2Amount.issuer);
          throw new Error('Asset2 issuer mismatch between definition and amount');
     }

     const tx = {
          TransactionType: 'AMMDeposit',
          Account: wallet.classicAddress,
          Asset: assetDef,
          Asset2: asset2Def,
          Amount: assetAmount,
          Amount2: asset2Amount,
          Flags: AMM_DEPOSIT_FLAG_TWO_ASSET,
     };
     return submitTx(client, wallet, tx);
}

async function ammDepositOneAsset(client, wallet, assetDef, asset2Def, singleAmount, isXrpSide) {
     const tx = {
          TransactionType: 'AMMDeposit',
          Account: wallet.classicAddress,
          Asset: assetDef,
          Asset2: asset2Def,
          Flags: AMM_DEPOSIT_FLAG_SINGLE_ASSET,
     };
     if (isXrpSide) {
          tx.Amount = singleAmount; // drops string
     } else {
          tx.Amount2 = {
               currency: asset2Def.currency,
               issuer: asset2Def.issuer,
               value: singleAmount.toString(),
          };
     }
     return submitTx(client, wallet, tx);
}

async function ammWithdrawByLP(client, wallet, assetDef, asset2Def, lpTokenInValue) {
     const tx = {
          TransactionType: 'AMMWithdraw',
          Account: wallet.classicAddress,
          Asset: assetDef,
          Asset2: asset2Def,
          LPTokenIn: lpTokenInValue,
          Flags: AMM_WITHDRAW_FLAG_LP_TOKEN,
     };
     return submitTx(client, wallet, tx);
}

async function ammWithdrawSingleAssetByLP(client, wallet, asset, asset2, lpTokenDef, lpTokenAmount, wantXrp, singleAmount) {
     if (!lpTokenDef || !lpTokenDef.currency || !lpTokenDef.issuer) {
          throw new Error('Invalid LP token definition');
     }

     const tx = {
          TransactionType: 'AMMWithdraw',
          Account: wallet.classicAddress,
          Asset: asset,
          Asset2: asset2,
          Flags: 0x00020000, // tfSingleAsset - withdraw single asset
          LPTokenIn: { ...lpTokenDef, value: lpTokenAmount.toString() }, // Max LP tokens willing to burn
     };

     // For tfSingleAsset, both Amount and Amount2 must be present
     // The "unwanted" asset gets a high maximum value to effectively disable it
     // The "wanted" asset gets the exact amount you want to receive
     if (wantXrp) {
          if (!singleAmount) throw new Error('Must specify XRP amount for single-asset withdrawal');
          tx.Amount = singleAmount; // Exact XRP amount you want to receive (in drops)
          // Set Amount2 to a very high value to effectively disable BOB withdrawal
          tx.Amount2 = {
               currency: asset2.currency,
               issuer: asset2.issuer,
               value: '1000000000000', // Very high value (1 trillion BOB) = effectively unlimited
          };
     } else {
          if (!singleAmount) throw new Error('Must specify IOU amount for single-asset withdrawal');
          // Set Amount to a very high value to effectively disable XRP withdrawal
          tx.Amount = xrpDrops('100000'); // 100,000 XRP = effectively unlimited
          tx.Amount2 = {
               currency: asset2.currency,
               issuer: asset2.issuer,
               value: singleAmount.toString(), // Exact BOB amount you want to receive
          };
     }

     const res = await submitTx(client, wallet, tx);
     return res;
}

async function swapViaPayment(client, traderWallet, outAmount, sendMax) {
     const tx = {
          TransactionType: 'Payment',
          Account: traderWallet.classicAddress,
          Destination: traderWallet.classicAddress,
          Amount: outAmount,
          SendMax: sendMax,
          Flags: xrpl.PaymentFlags?.tfPartialPayment || 0,
     };
     return submitTx(client, traderWallet, tx);
}

// get LP token definition and your balance in that LP token
async function getLpTokenAndBalance(client, walletAddr, assetDef, asset2Def) {
     const resp = await client.request({ command: 'amm_info', asset: assetDef, asset2: asset2Def });
     if (!resp.result?.amm?.lp_token) {
          throw new Error('AMM not found or lp_token missing');
     }
     const lpTokenDef = resp.result.amm.lp_token; // { currency, issuer, value? }

     const lines = await client.request({ command: 'account_lines', account: walletAddr, peer: lpTokenDef.issuer });
     let lpBalance = '0';
     if (lines.result?.lines) {
          const found = lines.result.lines.find(l => l.account === lpTokenDef.issuer && l.currency === lpTokenDef.currency);
          if (found) lpBalance = found.balance;
     }
     return { lpTokenDef, lpBalance };
}

async function checkAMMPosition(client, wallet, asset1, asset2) {
     const request = {
          command: 'amm_info',
          asset: asset1,
          asset2: asset2,
          account: wallet.classicAddress,
     };

     const response = await client.request(request);

     if (response.result.amm) {
          const amm = response.result.amm;

          console.log(`  LP Tokens: ${amm.lp_token.value}`);
          console.log(`  Pool Share: ${(amm.lp_token.value / amm.lp_token.issuer_held) * 100}%`);
          console.log(`  Equivalent XRP: ${amm.amount.value}`);
          console.log(`  Equivalent BOB: ${amm.amount2.value}`);
     } else {
          console.log('No AMM position found for this wallet');
     }
}

// --- Main flow ---
(async () => {
     try {
          const client = await connect();
          console.log('Connected to', NET);

          const issuer = xrpl.Wallet.fromSeed(SEED_COLD_ISSUER);
          // const hot = xrpl.Wallet.fromSeed(SEED_HOT);
          const hot = xrpl.Wallet.fromMnemonic(SEED_HOT);
          const warm = xrpl.Wallet.fromSeed(SEED_WARM);

          console.log('Issuer:', issuer.classicAddress);
          console.log('HOT:', hot.classicAddress);
          console.log('WARM:', warm.classicAddress);

          // pool assets: XRP / BOB
          const xrpAsset = { currency: 'XRP' };
          const bobAsset = { currency: 'CTZ', issuer: issuer.classicAddress };

          // Make sure issuer allows ripple
          // console.log('Ensuring DefaultRipple on issuer...');
          // await enableDefaultRipple(client, issuer);
          // await enableDefaultRipple(client, hot);

          // // Ensure trust lines for HOT and WARM to BOB
          // console.log('Ensuring trust lines...');
          // await ensureTrustLine(client, hot, 'BOB', issuer.classicAddress);
          // await ensureTrustLine(client, warm, 'BOB', issuer.classicAddress);

          // // Issue IOUs from issuer to HOT/WARM
          // console.log('Issuing BOB IOUs to HOT/WARM...');
          // await sendIOU(client, issuer, hot.classicAddress, 'BOB', '10000');
          // await sendIOU(client, issuer, warm.classicAddress, 'BOB', '5000');

          // Check/create AMM
          // console.log('Checking AMM for XRP/BOB...');
          // let amm = await ammInfoByAssets(client, xrpAsset, bobAsset);
          // if (!amm) {
          //      console.log('AMM not found — creating with initial deposit (5 XRP + 5000 BOB)...');
          //      await ammCreate(client, hot, xrpDrops(5), issuedAmount('BOB', issuer.classicAddress, '5000'), 500);
          //      amm = await ammInfoByAssets(client, xrpAsset, bobAsset);
          //      if (!amm) throw new Error("AMM creation succeeded but amm_info didn't return the pool");
          //      console.log('AMM created:', JSON.stringify(amm, null, 2));
          // } else {
          //      console.log('AMM exists:', JSON.stringify(amm, null, 2));
          // }

          // // Two-sided deposit by HOT
          // console.log('Two-sided deposit (HOT) 5 XRP + 5000 BOB ...');
          // const bobAmount = issuedAmount('BOB', issuer.classicAddress, '5000'); // Uses Cold issuer
          // await ammDepositTwoAsset(client, hot, xrpDrops(5), bobAmount, xrpAsset, bobAsset);

          // // Get LP token & balances for HOT & WARM
          // const hotLp = await getLpTokenAndBalance(client, hot.classicAddress, xrpAsset, bobAsset);
          // console.log('AMM LP token def:', hotLp.lpTokenDef);
          // console.log('HOT LP balance:', hotLp.lpBalance);

          // const warmLpBefore = await getLpTokenAndBalance(client, warm.classicAddress, xrpAsset, bobAsset);
          // console.log('WARM LP balance (before):', warmLpBefore.lpBalance);

          // // One-sided deposit: WARM deposits only XRP
          // console.log('One-sided deposit: WARM deposits 5 XRP only');
          // await ammDepositOneAsset(client, warm, xrpAsset, bobAsset, xrpDrops(5), true);

          // // Re-fetch WARM LP balance after deposit
          // const warmLpAfter = await getLpTokenAndBalance(client, warm.classicAddress, xrpAsset, bobAsset);
          // console.log('WARM LP balance (after one-sided deposit):', warmLpAfter.lpBalance);

          // // Swap example: WARM swaps XRP -> BOB
          // console.log('Swap via Payment: WARM wants 100 BOB, willing to spend up to 10 XRP');
          // await swapViaPayment(client, warm, issuedAmount('BOB', hot.classicAddress, '100'), xrpDrops(10));

          // // Withdraw: WARM will burn some LP tokens to withdraw only BOB side
          // const warmLpInfo = await getLpTokenAndBalance(client, warm.classicAddress, xrpAsset, bobAsset);
          // console.log('WARM LP token:', warmLpInfo.lpTokenDef);
          // console.log('WARM LP balance:', warmLpInfo.lpBalance);

          // const warmBalanceNum = parseFloat(warmLpInfo.lpBalance || '0');
          // if (warmBalanceNum > 0) {
          //      const burn = Math.min(5000, warmBalanceNum * 0.1).toFixed(6); // Use smaller amount or 10%
          //      const lpTokenInValue = { currency: warmLpInfo.lpTokenDef.currency, issuer: warmLpInfo.lpTokenDef.issuer, value: burn };
          //      console.log(`Burning ${burn} LP tokens to withdraw single-asset (BOB) ...`);

          //      // To withdraw BOB: wantXrp = false, singleAmount = BOB amount you want
          //      await ammWithdrawSingleAssetByLP(
          //           client,
          //           warm,
          //           xrpAsset, // { currency: 'XRP' }
          //           bobAsset, // { currency: 'BOB', issuer }
          //           warmLpInfo.lpTokenDef,
          //           burn, // LP tokens to burn (max)
          //           false, // wantXrp = false (want BOB)
          //           '100' // Want 100 BOB
          //      );
          //      console.log('Single-asset withdraw completed.');
          // } else {
          //      console.log('No WARM LP tokens to burn — skip withdraw.');
          // }

          // Final AMM state
          console.log(`WARM Wallet AMM Position:`);
          await checkAMMPosition(client, warm, xrpAsset, bobAsset);
          console.log(`HOT Wallet AMM Position:`);
          await checkAMMPosition(client, hot, xrpAsset, bobAsset);
          console.log(`COLD Wallet AMM Position:`);
          await checkAMMPosition(client, issuer, xrpAsset, bobAsset);
          // const finalAmm = await ammInfoByAssets(client, warm, xrpAsset, bobAsset);
          // console.log('Final AMM:', JSON.stringify(finalAmm, null, 2));

          await client.disconnect();
          console.log('Done.');
     } catch (err) {
          console.error('Fatal error:', err && (err.message || err));
          process.exit(1);
     }
})();
