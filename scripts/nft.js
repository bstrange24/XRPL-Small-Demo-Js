import fs from 'fs/promises';
import * as xrpl from 'xrpl';
import { getWallets } from './utils.js';

//   Usage
//   node nft.js X T P B S G OB X X X X X X X X

// const data = await fs.readFile('./config.json', 'utf8');
// const config = JSON.parse(data);
const config = {
     CURRENCY: 'CTZ',
     ENV: 'DEVNET',
     TEST_NET: 'wss://s.altnet.rippletest.net:51233/',
     DEV_NET: 'wss://s.devnet.rippletest.net:51233/',
     WARM_WALLET_SEED: 'shfXfN5Q6TnJ8mbAJrw6zhqU392Z4',
     HOT_WALLET_SEED: 'saw4g5zDe6gTktn8PmJrHbRuhPK5h',
     COLD_WALLET_SEED: 'spADR8o6kMrF9onePscGPizSD5uWS',
     ENCRYPTION: 'secp256k1',
     ed25519_ENCRYPTION: 'ed25519',
     secp256k1_ENCRYPTION: 'secp256k1',
};
const { CURRENCY, ENV, TEST_NET, DEV_NET, WARM_WALLET_SEED, HOT_WALLET_SEED, COLD_WALLET_SEED, ENCRYPTION, ed25519_ENCRYPTION, secp256k1_ENCRYPTION } = config;

const environment = ENV === 'DEVNET' ? DEV_NET : TEST_NET;
const algo = ENCRYPTION === 'secp256k1' ? secp256k1_ENCRYPTION : ed25519_ENCRYPTION;
const NFT_FLAGS = {
     Burnable: 1,
     OnlyXRP: 2,
     TrustLine: 4,
     Transferable: 8,
     Mutable: 16,
};

async function sleep(ms) {
     return new Promise(resolve => setTimeout(resolve, ms));
}

async function getAccountObjects(client, address, ledgerIndex, type) {
     try {
          if (type) {
               const response = await client.request({
                    command: 'account_objects',
                    account: address,
                    ledger_index: ledgerIndex,
                    type: '',
               });
               return response;
          } else {
               const response = await client.request({
                    command: 'account_objects',
                    account: address,
                    ledger_index: ledgerIndex,
               });
               return response;
          }
     } catch (error) {
          console.error('Error fetching account objects:', error);
          throw new Error(`Failed to fetch account objects: ${error.message || 'Unknown error'}`);
     }
}

async function getAccountInfo(client, address, ledgerIndex, type) {
     try {
          if (type) {
               const response = await client.request({
                    command: 'account_info',
                    account: address,
                    ledger_index: ledgerIndex,
                    type: type,
               });
               return response;
          } else {
               const response = await client.request({
                    command: 'account_info',
                    account: address,
                    ledger_index: ledgerIndex,
               });
               return response;
          }
     } catch (error) {
          console.error('Error fetching account info:', error);
          throw new Error(`Failed to fetch account info: ${error.message || 'Unknown error'}`);
     }
}

/**
 * Get all NFT buy offers created by an account
 * (scans account_objects for NFTokenOffer with Flags=0)
 *
 * @param client XRPL Client
 * @param address Account classic address
 */
export async function getBuyOffersByAccount(client, address) {
     const resp = await client.request({
          command: 'account_objects',
          account: address,
          ledger_index: 'validated',
          type: 'nft_offer',
     });

     // Filter only buy offers (Flags = 0)
     const buyOffers = resp.result.account_objects.filter(obj => {
          return obj.LedgerEntryType === 'NFTokenOffer' && obj.Flags === 0;
     });

     return buyOffers.map(o => ({
          nftOfferIndex: o.index,
          nftId: o.NFTokenID,
          amount: xrpl.dropsToXrp(o.Amount),
          owner: o.Owner, // the NFT’s current owner (seller)
          buyer: address, // the account that submitted this offer
          expiration: o.Expiration ?? null,
     }));
}

async function getAccountNFTs(client, address, ledgerIndex, type) {
     try {
          if (type) {
               const response = await client.request({
                    command: 'account_nfts',
                    account: address,
                    ledger_index: ledgerIndex,
                    type: type,
               });
               return response;
          } else {
               const response = await client.request({
                    command: 'account_nfts',
                    account: address,
                    ledger_index: ledgerIndex,
               });
               return response;
          }
     } catch (error) {
          console.error('Error fetching account nft info:', error);
          throw new Error(`Failed to fetch account nft info: ${error.message || 'Unknown error'}`);
     }
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

async function fetchAllOffersSafe(client, method, nftId) {
     let marker = undefined;
     const offers = [];

     try {
          do {
               const req = { command: method, nft_id: nftId, limit: 200 };
               if (marker) req.marker = marker;

               const resp = await client.request(req);
               if (resp.result.offers) offers.push(...resp.result.offers);

               marker = resp.result.marker;
          } while (marker);
     } catch (err) {
          if (err.data && err.data.error === 'objectNotFound') {
               return []; // no offers exist
          }
          throw err;
     }

     return offers;
}

function decodeNftFlags(value) {
     const active = [];
     for (const [name, bit] of Object.entries(NFT_FLAGS)) {
          if ((value & bit) !== 0) {
               active.push(name);
          }
     }
     return active.join(', ');
}

async function main() {
     const client = new xrpl.Client(environment);
     await client.connect();
     console.log(`Connected to XRPL ${ENV}`);

     const args = process.argv.slice(2); // Ignore node path and script name
     const offers = args.includes('O');
     const mint = args.includes('M');

     const rateLimitMs = 200;

     const { cold_wallet, hot_wallet, warm_wallet } = getWallets(WARM_WALLET_SEED, HOT_WALLET_SEED, COLD_WALLET_SEED, algo);

     if (offers) {
          // No NFT ID → fetch ALL NFTs & offers
          const [accountInfo, accountObjects, nftInfo, buyOffers] = await Promise.all([getAccountInfo(client, warm_wallet.classicAddress, 'validated', ''), getAccountObjects(client, warm_wallet.classicAddress, 'validated', ''), getAccountNFTs(client, warm_wallet.classicAddress, 'validated', '').catch(() => ({ result: { account_nfts: [] } })), getBuyOffersByAccount(client, hot_wallet.classicAddress)]);

          const results = [];
          const allBuyOffers = [];
          const allSellOffers = [];
          // console.log(`nftInfo`, JSON.stringify(nftInfo.result, null, '\t'));

          for (const nft of nftInfo.result.account_nfts) {
               const nftId = nft.NFTokenID;

               // Fetch buy & sell offers for this NFT
               const [buyOffers, sellOffers] = await Promise.all([fetchAllOffersSafe(client, 'nft_buy_offers', nftId), fetchAllOffersSafe(client, 'nft_sell_offers', nftId)]);

               // console.log(`buyOffers`, JSON.stringify(buyOffers, null, '\t'));
               // console.log(`sellOffers`, JSON.stringify(sellOffers, null, '\t'));
               // Full detail per NFT
               results.push({ nftId, buyOffers, sellOffers });

               // Collect separately for global arrays
               allBuyOffers.push({ nftId, offers: buyOffers });
               allSellOffers.push({ nftId, offers: sellOffers });
          }

          // Flatten if you want everything in one array
          const flatBuyOffers = allBuyOffers.flatMap(x => x.offers);
          const flatSellOffers = allSellOffers.flatMap(x => x.offers);

          // console.log('results for NFTs:', results);
          // console.log('allBuyOffers:', allBuyOffers);
          // console.log('allSellOffers:', allSellOffers);
          // console.log('flatBuyOffers:', flatBuyOffers);
          // console.log('flatSellOffers:', flatSellOffers);

          // const results = [];
          // for (const nft of nftInfo.result.account_nfts) {
          //      const nftId = nft.NFTokenID;
          //      const [buyOffers, sellOffers] = await Promise.all([fetchAllOffersSafe1(client, 'nft_buy_offers', nftId), fetchAllOffersSafe1(client, 'nft_sell_offers', nftId)]);
          //      results.push({ nftId, buyOffers, sellOffers });
          //      buyOffers.push({ nftId, buyOffers });
          //      sellOffers.push({ nftId, sellOffers });
          // }

          // console.debug(`results for NFTs:`, results);

          // const allBuyOffers = results.flatMap(o => o.buyOffers);
          // const allSellOffers = results.flatMap(o => o.sellOffers);

          // console.log('All Buy Offers:', allBuyOffers);
          // console.log('All Sell Offers:', allSellOffers);
          // console.debug(`offers for NFTs:`, JSON.stringify(results.buyOffers, null, '\t'));
          // console.debug(`buyOffers for NFTs:`, JSON.stringify(buyOffers, null, '\t'));
          // console.debug(`sellOffers for NFTs:`, JSON.stringify(sellOffers, null, '\t'));

          // console.log(`Fetching NFTs for account: ${warm_wallet.classicAddress}`);
          // const warmWalletNfts = await fetchAllAccountNFTs(client, warm_wallet.classicAddress);
          // console.log(`Found ${warmWalletNfts.length} NFTs`);

          // for (const nft of warmWalletNfts) {
          //      console.log(`\nNFT ${nft.NFTokenID}`);

          //      const buyOffers = await fetchAllOffers(client, 'nft_buy_offers', nft.NFTokenID);
          //      console.log(`  Buy offers: ${buyOffers.length}`);
          //      for (const offer of buyOffers) {
          //           console.log(`\t${offer.owner} offers ${offer.amount}`);
          //           console.log(`offer: ${JSON.stringify(offer, null, '\t')}`);
          //      }

          //      const sellOffers = await fetchAllOffers(client, 'nft_sell_offers', nft.NFTokenID);
          //      console.log(`  Sell offers: ${sellOffers.length}`);
          //      for (const offer of sellOffers) {
          //           console.log(`\t${offer.owner} offers ${offer.amount}`);
          //           console.log(`offer: ${JSON.stringify(offer, null, '\t')}`);
          //      }

          //      await sleep(rateLimitMs); // rate limit between NFTs
          // }

          // console.log(`\nFetching NFTs for account: ${hot_wallet.classicAddress}`);
          // const hotWalletNfts = await fetchAllAccountNFTs(client, hot_wallet.classicAddress);
          // console.log(`Found ${hotWalletNfts.length} NFTs`);

          // for (const nft of hotWalletNfts) {
          //      console.log(`\nNFT ${nft.NFTokenID}`);

          //      const buyOffers = await fetchAllOffers(client, 'nft_buy_offers', nft.NFTokenID);
          //      console.log(`  Buy offers: ${buyOffers.length}`);
          //      for (const offer of buyOffers) {
          //           console.log(`\t${offer.owner} offers ${offer.amount}`);
          //           console.log(`offer: ${JSON.stringify(offer, null, '\t')}`);
          //      }

          //      const sellOffers = await fetchAllOffers(client, 'nft_sell_offers', nft.NFTokenID);
          //      console.log(`  Sell offers: ${sellOffers.length}`);
          //      for (const offer of sellOffers) {
          //           console.log(`\t${offer.owner} offers ${offer.amount}`);
          //           console.log(`offer: ${JSON.stringify(offer, null, '\t')}`);
          //      }

          //      await sleep(rateLimitMs); // rate limit between NFTs
          // }

          // console.log(`\nFetching NFTs for account: ${cold_wallet.classicAddress}`);
          // const coldWalletNfts = await fetchAllAccountNFTs(client, cold_wallet.classicAddress);
          // console.log(`Found ${coldWalletNfts.length} NFTs`);

          // for (const nft of coldWalletNfts) {
          //      console.log(`\nNFT ${nft.NFTokenID}`);

          //      const buyOffers = await fetchAllOffers(client, 'nft_buy_offers', nft.NFTokenID);
          //      console.log(`  Buy offers: ${buyOffers.length}`);
          //      for (const offer of buyOffers) {
          //           console.log(`\t${offer.owner} offers ${offer.amount}`);
          //           console.log(`offer: ${JSON.stringify(offer, null, '\t')}`);
          //      }

          //      const sellOffers = await fetchAllOffers(client, 'nft_sell_offers', nft.NFTokenID);
          //      console.log(`  Sell offers: ${sellOffers.length}`);
          //      for (const offer of sellOffers) {
          //           console.log(`\t${offer.owner} offers ${offer.amount}`);
          //           console.log(`offer: ${JSON.stringify(offer, null, '\t')}`);
          //      }

          //      await sleep(rateLimitMs); // rate limit between NFTs
          // }

          console.log('Buy offers created by', hot_wallet.classicAddress, buyOffers);

          const tx_json = {
               TransactionType: 'AccountSet',
               Account: warm_wallet.classicAddress,
               NFTokenMinter: hot_wallet.classicAddress,
               SetFlag: xrpl.AccountSetAsfFlags.asfAuthorizedNFTokenMinter,
          };

          const prepared = await client.autofill(tx_json);
          const signed = warm_wallet.sign(prepared);
          const result = await client.submitAndWait(signed.tx_blob);
          console.log(`result: `, result);
     }

     if (mint) {
          const [accountInfo, ledgerResponse, accountNfts] = await Promise.all([getAccountInfo(client, warm_wallet.classicAddress, 'validated', ''), client.request({ command: 'ledger', ledger_index: 'closed' }), getAccountNFTs(client, warm_wallet.classicAddress, 'validated', '').catch(() => ({ result: { account_nfts: [] } }))]);

          const preparedTx = {
               TransactionType: 'NFTokenMint',
               Account: warm_wallet.classicAddress,
               URI: xrpl.convertStringToHex('https://ipfs.io/ipfs/bafybeigjro2d2tc43bgv7e4sxqg7f5jga7kjizbk7nnmmyhmq35dtz6deq'),
               Flags: 27, // Parse to integer
               TransferFee: parseInt(2.5, 10), // Parse to integer
               NFTokenTaxon: parseInt(0, 10), // Parse to integer
               Fee: '10',
               LastLedgerSequence: ledgerResponse.result.ledger_index + 20,
               Sequence: accountInfo.result.account_data.Sequence,
          };

          // console.log('Mint NFT Transaction Parameters:', preparedTx); // Log before submitting
          // const signedTx = warm_wallet.sign(preparedTx);
          // const tx = await client.submitAndWait(signedTx.tx_blob);
          // console.log(`Transaction result: `, tx.result.meta.TransactionResult);
          // console.log();

          // const [nfts, xrpBalance] = await Promise.all([await client.request({ method: 'account_nfts', account: warm_wallet.classicAddress }), await client.getXrpBalance(warm_wallet.classicAddress)]);
          // console.log(`NFTs: `, nfts.result.account_nfts);
          // for (const n of nfts.result.account_nfts) {
          //      // console.log(`NFT Token ID `, decodeNftFlags(n.Flags));
          //      // const isMutable = (n.flags & 0x00010000) !== 0;
          //      if (decodeNftFlags(n.Flags).includes('Burnable')) {
          //           console.log(`NFT Token ID `, n.NFTokenID);
          //           console.log(`NFT Token ID `, decodeNftFlags(n.Flags));
          //      } else {
          //           console.log(`\nI AM SPECIAL`);
          //           console.log(`NFT Token ID `, n.NFTokenID);
          //           console.log(`NFT Token ID `, decodeNftFlags(n.Flags));
          //      }
          // }
          // console.log(`XRP Balance: `, xrpBalance);

          const nftId = '001B00003216D9D4672573232AE1E939D17DBD8251E60AEB008E5E3200630D97';
          const nfts = accountNfts.result.account_nfts;
          const targetNFT = nfts.find(nft => nft.NFTokenID === nftId);
          console.log(`targetNFT: `, targetNFT);

          if (decodeNftFlags(targetNFT.Flags).includes('Mutable')) {
               console.log(`SUPPPPPPPPPPPER: `, targetNFT);
          }
     }
     await client.disconnect();
     console.log('\nAll done.');
}

main().catch(console.error);
