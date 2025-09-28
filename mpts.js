import * as xrpl from 'xrpl';
import { XRP_CURRENCY, ed25519_ENCRYPTION, secp256k1_ENCRYPTION, MAINNET, TES_SUCCESS } from './constants.js';

//   Usage
//   MPT's
// Get MPT details
// node mpts.js get X X X
// Send MPT
// node mpts.js X send X X
// MPTokenIssuanceCreate
// node mpts.js X X issu X
// MPTokenIssuanceSet
// node mpts.js X X X auth
const CURRENCY = 'CTZ';
// const NET = 'wss://s.altnet.rippletest.net:51233/';
const NET = 'wss://s.devnet.rippletest.net:51233/';

// raYp4pcuTokY8tWAPt7jxZ1fzpLmPbg7uJ sEdS4eJg1nvoNhD35Qh6DN3Z69seon2
const WARM_WALLET_SEED = 'ssijGfGcRQxYeAkE5mwnFhzBRTKu8';
// rPiHBVoQEzbEVLA15ZcesUtU9xW6C7U4QA sEdTZqBbgk4hwXMY91Lhggc5tcJKZyq
const HOT_WALLET_SEED = 'shT9Rkw4RPoRB1S9LdX49vuC8iPgS';
// rh1ncoTdWXz4pP2FxB6MnTFLztvQJXYHVP sEdTaVdEf44sQeVZThvsj3Q5UBCkQkT
const COLD_WALLET_SEED = 'spvvMm1qzEJ9moWHVF1rEyKNJu768'; //

async function main() {
     const args = process.argv.slice(2); // Ignore node path and script name
     const getMpt = args.includes('get');
     const sendMpt = args.includes('send');
     const issuanceCreate = args.includes('issu');
     const authMpt = args.includes('auth');

     const client = new xrpl.Client(NET);
     await client.connect();
     console.log('Connected to XRPL Testnet');

     // Cold Wallet (issuing address)
     // const cold_wallet = xrpl.Wallet.fromSeed(COLD_WALLET_SEED, { algorithm: ed25519_ENCRYPTION });
     const cold_wallet = xrpl.Wallet.fromSeed(COLD_WALLET_SEED, { algorithm: secp256k1_ENCRYPTION });
     console.log('Cold wallet address:', cold_wallet.address);

     // Hot Wallet (operational address)
     const hot_wallet = xrpl.Wallet.fromSeed(HOT_WALLET_SEED, { algorithm: secp256k1_ENCRYPTION });
     // const hot_wallet = xrpl.Wallet.fromMnemonic(HOT_WALLET_SEED, { algorithm: secp256k1_ENCRYPTION });
     console.log('Hot wallet address:', hot_wallet.address);

     // Account 1 (warm wallet)
     // const warm_wallet = xrpl.Wallet.fromSeed(WARM_WALLET_SEED, { algorithm: ed25519_ENCRYPTION });
     const warm_wallet = xrpl.Wallet.fromSeed(WARM_WALLET_SEED, { algorithm: secp256k1_ENCRYPTION });
     console.log('Warm wallet address:', warm_wallet.address);

     console.log('process.argv' + process.argv);

     const h_wallet_addr = hot_wallet.address;
     const c_wallet_addr = cold_wallet.address;
     const w_wallet_addr = warm_wallet.address;

     if (getMpt) {
          const warm_mpts = await client.request({
               command: 'account_objects',
               account: w_wallet_addr,
               ledger_index: 'validated',
               type: 'mptoken',
          });
          console.log('Warm mpts', JSON.stringify(warm_mpts, null, '\t'));

          const cold_mpts = await client.request({
               command: 'account_objects',
               account: c_wallet_addr,
               ledger_index: 'validated',
               type: 'mptoken',
          });
          console.log('Cold mpts', JSON.stringify(cold_mpts, null, '\t'));

          const hot_mpts = await client.request({
               command: 'account_objects',
               account: h_wallet_addr,
               ledger_index: 'validated',
               type: 'mptoken',
          });
          console.log('Hot mpts', JSON.stringify(hot_mpts, null, '\t'));
     }

     if (sendMpt) {
          const send_mpt_tx = {
               TransactionType: 'Payment',
               Account: h_wallet_addr,
               Amount: {
                    mpt_issuance_id: '0060BB17EA8CACD97FC80F3D56CCB6E54E589FA1027A3A1E',
                    value: '1',
               },
               Destination: w_wallet_addr,
          };

          const pay_prepared = await client.autofill(send_mpt_tx);
          const pay_signed = hot_wallet.sign(pay_prepared);
          const pay_result = await client.submitAndWait(pay_signed.tx_blob);
          const resultCode = pay_result.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               console.error(`ERROR: Transaction failed: ${resultCode}\n${JSON.stringify(pay_result.result, null, '\t')}`);
          } else {
               console.info(`Transaction succesful: ${resultCode}\n${JSON.stringify(pay_result.result, null, '\t')}`);
          }
     }

     if (issuanceCreate) {
          const createTx = {
               TransactionType: 'MPTokenIssuanceCreate',
               Account: cold_wallet.classicAddress,
               // AssetClass: 'GOL', // Max 16 bytes
               Flags: xrpl.MPTokenIssuanceCreateFlags.tfMPTCanLock | xrpl.MPTokenIssuanceCreateFlags.tfMPTRequireAuth | xrpl.MPTokenIssuanceCreateFlags.tfMPTCanEscrow | xrpl.MPTokenIssuanceCreateFlags.tfMPTCanTrade | xrpl.MPTokenIssuanceCreateFlags.tfMPTCanTransfer | xrpl.MPTokenIssuanceCreateFlags.tfMPTCanClawback, // tfMPTRequireAuth
               MaximumAmount: '1000000',
               // TransferFee: 500, // 0.5%
               Fee: '1000000', // 1 XRP (safe for testnet)
          };

          const pay_prepared = await client.autofill(createTx);
          const pay_signed = cold_wallet.sign(pay_prepared);
          console.log('Submitting MPTokenIssuanceCreate...');
          const pay_result = await client.submitAndWait(pay_signed.tx_blob);
          const resultCode = pay_result.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               console.error(`ERROR: Transaction failed: ${resultCode}\n${JSON.stringify(pay_result.result, null, '\t')}`);
          } else {
               console.info(`Transaction succesful: ${resultCode}\n${JSON.stringify(pay_result.result, null, '\t')}`);
          }
     }

     if (authMpt) {
          const authorizeTx = {
               TransactionType: 'MPTokenAuthorize',
               Account: cold_wallet.classicAddress,
               MPTokenIssuanceID: '0060BAC353AF90A04608A4F08AF72DCE5F87DF95144E27A3',
               // AuthorizedAccounts: [warm_wallet.classicAddress],
               Holder: warm_wallet.classicAddress,
               Flags: 0,
               Fee: '1000000',
          };

          const pay_prepared = await client.autofill(authorizeTx);
          const pay_signed = cold_wallet.sign(pay_prepared);
          const pay_result = await client.submitAndWait(pay_signed.tx_blob);
          const resultCode = pay_result.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               console.error(`ERROR: Transaction failed: ${resultCode}\n${JSON.stringify(pay_result.result, null, '\t')}`);
          } else {
               console.info(`Transaction succesful: ${resultCode}\n${JSON.stringify(pay_result.result, null, '\t')}`);
          }
     }

     await client.disconnect();
     console.log('All done.');
}

main().catch(console.error);
