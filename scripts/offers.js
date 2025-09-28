import fs from 'fs/promises';
import * as xrpl from 'xrpl';
import { getWallets } from './utils.js';

const data = await fs.readFile('./config.json', 'utf8');
const config = JSON.parse(data);
const { CURRENCY, ENV, TEST_NET, DEV_NET, WARM_WALLET_SEED, HOT_WALLET_SEED, COLD_WALLET_SEED, ENCRYPTION, ed25519_ENCRYPTION, secp256k1_ENCRYPTION } = config;

// console.log(CURRENCY);
// console.log(ENV);
// console.log(TEST_NET);
// console.log(DEV_NET);
// console.log(WARM_WALLET_SEED);
// console.log(HOT_WALLET_SEED);
// console.log(COLD_WALLET_SEED);
// console.log(ENCRYPTION);
// console.log(ed25519_ENCRYPTION);
// console.log(secp256k1_ENCRYPTION);

const environment = ENV === 'DEVNET' ? DEV_NET : TEST_NET;
const algo = ENCRYPTION === 'secp256k1' ? secp256k1_ENCRYPTION : ed25519_ENCRYPTION;

async function main() {
     const client = new xrpl.Client(environment);
     await client.connect();
     console.log('Connected to XRPL Testnet');

     const { cold_wallet, hot_wallet, warm_wallet } = getWallets(WARM_WALLET_SEED, HOT_WALLET_SEED, COLD_WALLET_SEED, algo);

     const hotWalletOffers = await client.request({
          command: 'account_offers',
          account: hot_wallet.classicAddress,
     });
     console.log('Offers placed by hot wallet:', hotWalletOffers.result.offers);
     console.log('Hot Wallet Sequence Numbers:');
     for (const offer of hotWalletOffers.result.offers) {
          console.log(offer['seq'] + ',');
     }

     const coldWalletOffers = await client.request({
          command: 'account_offers',
          account: cold_wallet.classicAddress,
     });
     console.log('Offers placed by cold wallet:', coldWalletOffers.result.offers);
     console.log('Cold Wallet Sequence Numbers:');
     for (const offer of coldWalletOffers.result.offers) {
          console.log(offer['seq'] + ',');
     }

     const warmWalletOffers = await client.request({
          command: 'account_offers',
          account: warm_wallet.classicAddress,
     });
     console.log('Offers placed by warm wallet:', warmWalletOffers.result.offers);
     console.log('Warm Wallet Sequence Numbers:');
     for (const offer of warmWalletOffers.result.offers) {
          console.log(offer['seq'] + ',');
     }

     await client.disconnect();
     console.log('\nAll done.');
}

main().catch(console.error);
