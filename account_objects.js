import fs from 'fs/promises';
import * as xrpl from 'xrpl';

const data = await fs.readFile('./config.json', 'utf8');
const config = JSON.parse(data);
const { CURRENCY, ENV, TEST_NET, DEV_NET, WARM_WALLET_SEED, HOT_WALLET_SEED, COLD_WALLET_SEED, ENCRYPTION,ed25519_ENCRYPTION,secp256k1_ENCRYPTION} = config;

console.log(CURRENCY);
console.log(ENV);
console.log(TEST_NET);
console.log(DEV_NET);
console.log(WARM_WALLET_SEED);
console.log(HOT_WALLET_SEED);
console.log(COLD_WALLET_SEED);
console.log(ENCRYPTION);
console.log(ed25519_ENCRYPTION);
console.log(secp256k1_ENCRYPTION);

const environment = ENV === 'DEVNET' ? DEV_NET: TEST_NET;
const algo = ENCRYPTION === 'secp256k1' ? secp256k1_ENCRYPTION :ed25519_ENCRYPTION;

async function main() {
    const client = new xrpl.Client(environment);
    await client.connect();
    console.log(`Connected to XRPL ${ENV}`);

    const cold_wallet = xrpl.Wallet.fromSeed(COLD_WALLET_SEED, { algorithm: algo });
    console.log('Cold wallet address:', cold_wallet.address);

    const hot_wallet = xrpl.Wallet.fromSeed(HOT_WALLET_SEED, { algorithm: algo });
    console.log('Hot wallet address:', hot_wallet.address);

    const warm_wallet = xrpl.Wallet.fromSeed(WARM_WALLET_SEED, { algorithm: algo });
    console.log('Warm wallet address:', warm_wallet.address);

    const hotWalletAccountObjects = await client.request({
        command: 'account_objects',
        account: hot_wallet.classicAddress,
    });
    console.log(`hot wallet account_objects: ${JSON.stringify(hotWalletAccountObjects, null, '\t')}`);

    const coldWalletAccountObjects = await client.request({
        command: 'account_objects',
        account: cold_wallet.classicAddress,
    });
    console.log(`cold wallet account_objects: ${JSON.stringify(coldWalletAccountObjects, null, '\t')}`);

    const warmWalletAccountObjects = await client.request({
        command: 'account_objects',
        account: warm_wallet.classicAddress,
    });
    console.log(`warm wallet account_objects: ${JSON.stringify(warmWalletAccountObjects, null, '\t')}`);

    await client.disconnect();
    console.log('All done.');
}

main().catch(console.error);