import fs from 'fs/promises';
import * as xrpl from 'xrpl';
import { getWallets } from './utils.js';

// node .\nft_buy_sell.js X X X CO
const data = await fs.readFile('./config.json', 'utf8');
const config = JSON.parse(data);
const { CURRENCY, ENV, TEST_NET, DEV_NET, WARM_WALLET_SEED, HOT_WALLET_SEED, COLD_WALLET_SEED, ENCRYPTION, ed25519_ENCRYPTION, secp256k1_ENCRYPTION } = config;

const environment = ENV === 'DEVNET' ? DEV_NET : TEST_NET;
const algo = ENCRYPTION === 'secp256k1' ? secp256k1_ENCRYPTION : ed25519_ENCRYPTION;

async function main() {
     const client = new xrpl.Client(environment);
     await client.connect();
     console.log('Connected to XRPL Testnet');

     const warm_wallet_seed = 'sEdTee85qhRvZdwAXQ55HiVuzBjTnvw'; // 9201.995036
     const cold_wallet_seed = 'sEd7Cmz2mbgPuh8yCEf915pZfLef3e5'; // 9296.79961
     const hot_wallet_seed = 'sEdSdcfYQgv8oQ1MGJzaqD9JRTi5ncY'; // 9356.00362
     const warm_wallet_destination = 'rJr862RsQMpjPz8g7621t6KoUBaN2GBbTn';
     const cold_wallet_destination = 'r9DZiCr2eejjRUqqTnTahL5UpLfku9Fe9D';
     const hot_wallet_destination = 'rJgMxirfYbjD73PoeepUiqzgKWfexzzigi';
     const fee = '1200000'; // Reserve for tx fee

     const { cold_wallet, hot_wallet, warm_wallet } = getWallets(warm_wallet_seed, hot_wallet_seed, cold_wallet_seed, 'ed25519');

     const tx = {
          TransactionType: 'Payment',
          Account: warm_wallet.address,
          Destination: warm_wallet_destination,
          Amount: xrpl.xrpToDrops(9000),
          Fee: fee,
     };

     const prepared = await client.autofill(tx);
     const signed = warm_wallet.sign(prepared);
     const result = await client.submitAndWait(signed.tx_blob);

     console.log('  TX result:', result.result.meta.TransactionResult);
     console.log('  Explorer:', `https://testnet.xrpl.org/transactions/${signed.hash}`);

     const tx1 = {
          TransactionType: 'Payment',
          Account: cold_wallet.address,
          Destination: cold_wallet_destination,
          Amount: xrpl.xrpToDrops(9000),
          Fee: fee,
     };

     const prepared1 = await client.autofill(tx1);
     const signed1 = cold_wallet.sign(prepared1);
     const result1 = await client.submitAndWait(signed1.tx_blob);

     console.log('  TX result:', result1.result.meta.TransactionResult);
     console.log('  Explorer:', `https://testnet.xrpl.org/transactions/${signed1.hash}`);

     const tx2 = {
          TransactionType: 'Payment',
          Account: hot_wallet.address,
          Destination: hot_wallet_destination,
          Amount: xrpl.xrpToDrops(9000),
          Fee: fee,
     };

     const prepared2 = await client.autofill(tx2);
     const signed2 = hot_wallet.sign(prepared2);
     const result2 = await client.submitAndWait(signed2.tx_blob);

     console.log('  TX result:', result2.result.meta.TransactionResult);
     console.log('  Explorer:', `https://testnet.xrpl.org/transactions/${signed2.hash}`);

     await client.disconnect();
     console.log('\nAll done.');
}

main().catch(console.error);
