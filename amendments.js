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

    const result = await client.request({ command: 'feature' });
    const features = result.result.features;
    console.log(`features: `, features);
    // The amendment ID you want to check (example: fix1512)
    const targetAmendment = 'fixNFTokenMinter';

    // Find the amendment by name
    // const amendmentEntry = Object.entries(features).find(([id, feature]) => feature.name === targetAmendment);
    const amendmentEntry = Object.entries(features).find(([id, feature]) => feature.enabled);

    if (amendmentEntry) {
        const [id, feature] = amendmentEntry;
        console.log(`\t${targetAmendment} found!`);
        console.log('\tFeature ID:', id);
        console.log('\tEnabled:', feature.enabled);
        console.log('\tVoting:', feature.voting);
        console.log('\tApproved:', feature.approved);
    } else {
        console.log(`\t${targetAmendment} not found on this server.`);
    }

    await client.disconnect();
    console.log('All done.');
}

main().catch(console.error);