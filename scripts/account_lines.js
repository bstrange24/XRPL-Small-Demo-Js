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

     const warmAccountLines = await client.request({
          command: 'account_lines',
          account: warm_wallet.classicAddress,
          ledger_index: 'validated',
     });
     console.log(`warm wallet account_lines: ${JSON.stringify(warmAccountLines, null, '\t')}`);

     const hotAccountLines = await client.request({
          command: 'account_lines',
          account: hot_wallet.classicAddress,
          ledger_index: 'validated',
     });
     console.log(`warm wallet account_lines: ${JSON.stringify(hotAccountLines, null, '\t')}`);

     const coldAccountLines = await client.request({
          command: 'account_lines',
          account: cold_wallet.classicAddress,
          ledger_index: 'validated',
     });
     console.log(`warm wallet account_lines: ${JSON.stringify(coldAccountLines, null, '\t')}`);

     await client.disconnect();
     console.log('\nAll done.');
}

main().catch(console.error);
