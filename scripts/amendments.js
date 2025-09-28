import fs from 'fs/promises';
import * as xrpl from 'xrpl';

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

function filterFeatures(features, criteria) {
     return Object.entries(features).filter(([id, feature]) => {
          return Object.keys(criteria).every(key => feature[key] === criteria[key]);
     });
}

function formatFeatures(features) {
     return Object.entries(features).map(([id, feature]) => ({
          id,
          ...feature,
     }));
}

async function main() {
     const client = new xrpl.Client(environment);
     await client.connect();
     console.log(`Connected to XRPL ${ENV}\n`);

     const result = await client.request({ command: 'feature' });
     const features = result.result.features;
     // console.log(`features: `, features);

     // Find by exact name
     const nftFeature = Object.entries(features).find(([id, feature]) => feature.name === 'NonFungibleTokensV1_1');
     // console.log('NFT Feature:', nftFeature);

     // Find by partial name (case-sensitive)
     const ammFeatures = Object.entries(features).filter(([id, feature]) => feature.name.includes('AMM'));
     // console.log('AMM Features:', ammFeatures);

     // Usage examples:
     const nftFeatures = filterFeatures(features, { name: 'NonFungibleTokensV1_1' });
     // console.log('NFT Features:', nftFeatures);
     const disabledSupported = filterFeatures(features, { enabled: false, supported: true });
     // console.log('Disabled Features:', disabledSupported);

     const enabledSupported = filterFeatures(features, { enabled: true, supported: true });
     // console.log('Enabled Features:', enabledSupported);
     const formattedEnabledSupporte = formatFeatures(enabledSupported);
     // console.log('Enabled Features:', formattedEnabledSupporte);

     const enabledAMM = filterFeatures(features, { enabled: true, name: 'AMM' });
     // console.log('Enabled AMM:', enabledAMM);

     // Get all enabled features
     const enabledFeatures = Object.entries(features).filter(([id, feature]) => feature.enabled === true);
     // console.log('Enabled features:', enabledFeatures);

     // Get all disabled features
     const disabledFeatures = Object.entries(features).filter(([id, feature]) => feature.enabled === false);
     // console.log('Disabled features:', disabledFeatures);

     // Get features that are supported but not enabled
     const supportedButDisabled = Object.entries(features).filter(([id, feature]) => feature.supported === true && feature.enabled === false);
     // console.log('Supported but disabled:', supportedButDisabled);

     // Create a lookup by name
     const featuresByName = Object.entries(features).reduce((acc, [id, feature]) => {
          acc[feature.name] = { id, ...feature };
          return acc;
     }, {});
     // console.log('AMM feature:', featuresByName['AMM']);
     // console.log('Clawback status:', featuresByName['Clawback']?.enabled);

     // Create lookup by ID
     const featuresById = Object.entries(features).reduce((acc, [id, feature]) => {
          acc[id] = { name: feature.name, ...feature };
          return acc;
     }, {});
     // console.log('Feature By ID:', featuresById);

     await client.disconnect();
     console.log('\nAll done.');
}

main().catch(console.error);
