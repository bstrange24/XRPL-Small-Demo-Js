import * as xrpl from 'xrpl';
import { XRP_CURRENCY, ed25519_ENCRYPTION, secp256k1_ENCRYPTION, MAINNET, TES_SUCCESS } from './constants.js';

//   Usage
//   node account_data.js A
// const NET = 'wss://s.altnet.rippletest.net:51233/';
const NET = 'wss://s.devnet.rippletest.net:51233/';

const WARM_WALLET_SEED = 'spA74dCWmco7TmbbqRc8op8x9yrwZ';
const HOT_WALLET_SEED = 'kick youth first pumpkin trade security spell loyal wheat donkey morning oval protect exhibit essence panic chuckle manage expand electric rabbit agent young alarm';
const COLD_WALLET_SEED = 'shrfGpSTY627uP5jaG3QeDY1UqJLn';

async function main() {
     const args = process.argv.slice(2); // Ignore node path and script name
     const getAccountInfo = args.includes('A');

     const client = new xrpl.Client(NET);
     await client.connect();
     console.log('Connected to XRPL Testnet');

     // Cold Wallet (issuing address)
     // const cold_wallet = xrpl.Wallet.fromSeed(COLD_WALLET_SEED, { algorithm: ed25519_ENCRYPTION });
     const cold_wallet = xrpl.Wallet.fromSeed(COLD_WALLET_SEED, { algorithm: secp256k1_ENCRYPTION });
     console.log('Cold wallet address:', cold_wallet.address);

     // Hot Wallet (operational address)
     // const hot_wallet = xrpl.Wallet.fromSeed(HOT_WALLET_SEED, { algorithm: ed25519_ENCRYPTION });
     const hot_wallet = xrpl.Wallet.fromMnemonic(HOT_WALLET_SEED, { algorithm: secp256k1_ENCRYPTION });
     console.log('Hot wallet address:', hot_wallet.address);

     // Account 1 (warm wallet)
     // const warm_wallet = xrpl.Wallet.fromSeed(WARM_WALLET_SEED, { algorithm: ed25519_ENCRYPTION });
     const warm_wallet = xrpl.Wallet.fromSeed(WARM_WALLET_SEED, { algorithm: secp256k1_ENCRYPTION });
     console.log('Warm wallet address:', warm_wallet.address);

     console.log('process.argv' + process.argv);

     const h_wallet_addr = hot_wallet.address;
     const c_wallet_addr = cold_wallet.address;
     const w_wallet_addr = warm_wallet.address;
     // const h_wallet_addr = 'r3oUj2qJw7WmMJreCjJmyBA7wUTvxUmDNv';
     // const c_wallet_addr = 'r4dF7pnCdVXvbQAf3i1Yktcb8YMp6gkpr7';
     // const account1_wallet_addr = 'rhuaX1t5XP4mSzW5pXSUbpVoqUjadV3HcH';

     if (getAccountInfo) {
          // const hotWalletOffers = await client.request({
          //      command: 'account_objects',
          //      account: h_wallet_addr,
          // });
          // console.log(`hot wallet account_objects: ${JSON.stringify(hotWalletOffers, null, '\t')}`);

          // const coldWalletOffers = await client.request({
          //      command: 'account_objects',
          //      account: c_wallet_addr,
          // });
          // console.log(`cold wallet account_objects: ${JSON.stringify(coldWalletOffers, null, '\t')}`);

          const warmWalletOffers = await client.request({
               command: 'account_info',
               account: w_wallet_addr,
               ledger_index: 'validated',
          });
          console.log(`disableMasterKey: ${JSON.stringify(warmWalletOffers.result.account_flags.disableMasterKey, null, '\t')}`);
     }
     await client.disconnect();
     console.log('All done.');
}

main().catch(console.error);
