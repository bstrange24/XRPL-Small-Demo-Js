import fs from 'fs/promises';
import * as xrpl from 'xrpl';
import { getWallets } from './utils.js';

const data = await fs.readFile('./config.json', 'utf8');
const config = JSON.parse(data);
const { CURRENCY, ENV, TEST_NET, DEV_NET, WARM_WALLET_SEED, HOT_WALLET_SEED, COLD_WALLET_SEED, ENCRYPTION, ed25519_ENCRYPTION, secp256k1_ENCRYPTION } = config;

const environment = ENV === 'DEVNET' ? DEV_NET : TEST_NET;
const algo = ENCRYPTION === 'secp256k1' ? secp256k1_ENCRYPTION : ed25519_ENCRYPTION;

async function sleep(ms) {
     return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAllAccountNFTs(client, account) {
     let marker = undefined;
     const nfts = [];

     do {
          const req = {
               command: 'account_nfts',
               account,
               limit: 200,
          };
          if (marker) req.marker = marker;

          const resp = await client.request(req);
          nfts.push(...resp.result.account_nfts);
          marker = resp.result.marker;
          if (marker) await sleep(rateLimitMs);
     } while (marker);

     return nfts;
}

async function fetchAllOffers(client, method, nft_id) {
     let marker = undefined;
     const offers = [];

     try {
          do {
               const req = {
                    command: method,
                    nft_id,
                    limit: 200,
               };
               if (marker) req.marker = marker;

               const resp = await client.request(req);
               if (resp.result.offers) {
                    offers.push(...resp.result.offers);
               }
               marker = resp.result.marker;
               if (marker) await sleep(rateLimitMs);
          } while (marker);
     } catch (err) {
          if (err.data && err.data.error === 'objectNotFound') {
               // No offers exist for this NFT
               return [];
          }
          throw err;
     }

     return offers;
}

async function main() {
     const client = new xrpl.Client(environment);
     await client.connect();
     console.log(`Connected to XRPL ${ENV}`);
     const rateLimitMs = 200;

     const { cold_wallet, hot_wallet, warm_wallet } = getWallets(WARM_WALLET_SEED, HOT_WALLET_SEED, COLD_WALLET_SEED, algo);

     console.log(`Fetching NFTs for account: ${warm_wallet.classicAddress}`);
     const warmWalletNfts = await fetchAllAccountNFTs(client, warm_wallet.classicAddress);
     console.log(`Found ${warmWalletNfts.length} NFTs`);

     for (const nft of warmWalletNfts) {
          console.log(`\nNFT ${nft.NFTokenID}`);

          const buyOffers = await fetchAllOffers(client, 'nft_buy_offers', nft.NFTokenID);
          console.log(`  Buy offers: ${buyOffers.length}`);
          for (const offer of buyOffers) {
               console.log(`    ${offer.owner} offers ${offer.amount}`);
          }

          const sellOffers = await fetchAllOffers(client, 'nft_sell_offers', nft.NFTokenID);
          console.log(`  Sell offers: ${sellOffers.length}`);
          for (const offer of sellOffers) {
               console.log(`    ${offer.owner} wants ${offer.amount}`);
          }

          await sleep(rateLimitMs); // rate limit between NFTs
     }

     console.log(`\nFetching NFTs for account: ${hot_wallet.classicAddress}`);
     const hotWalletNfts = await fetchAllAccountNFTs(client, hot_wallet.classicAddress);
     console.log(`Found ${hotWalletNfts.length} NFTs`);

     for (const nft of hotWalletNfts) {
          console.log(`\nNFT ${nft.NFTokenID}`);

          const buyOffers = await fetchAllOffers(client, 'nft_buy_offers', nft.NFTokenID);
          console.log(`  Buy offers: ${buyOffers.length}`);
          for (const offer of buyOffers) {
               console.log(`    ${offer.owner} offers ${offer.amount}`);
          }

          const sellOffers = await fetchAllOffers(client, 'nft_sell_offers', nft.NFTokenID);
          console.log(`  Sell offers: ${sellOffers.length}`);
          for (const offer of sellOffers) {
               console.log(`    ${offer.owner} wants ${offer.amount}`);
          }

          await sleep(rateLimitMs); // rate limit between NFTs
     }

     console.log(`\nFetching NFTs for account: ${cold_wallet.classicAddress}`);
     const coldWalletNfts = await fetchAllAccountNFTs(client, cold_wallet.classicAddress);
     console.log(`Found ${coldWalletNfts.length} NFTs`);

     for (const nft of coldWalletNfts) {
          console.log(`\nNFT ${nft.NFTokenID}`);

          const buyOffers = await fetchAllOffers(client, 'nft_buy_offers', nft.NFTokenID);
          console.log(`  Buy offers: ${buyOffers.length}`);
          for (const offer of buyOffers) {
               console.log(`    ${offer.owner} offers ${offer.amount}`);
          }

          const sellOffers = await fetchAllOffers(client, 'nft_sell_offers', nft.NFTokenID);
          console.log(`  Sell offers: ${sellOffers.length}`);
          for (const offer of sellOffers) {
               console.log(`    ${offer.owner} wants ${offer.amount}`);
          }

          await sleep(rateLimitMs); // rate limit between NFTs
     }

     await client.disconnect();
     console.log('\nAll done.');
}

main().catch(console.error);
