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

     const args = process.argv.slice(2); // Ignore node path and script name
     const createSellOffer = args.includes('CSO');
     const buyNft = args.includes('B');
     const sellNft = args.includes('S');
     const cancelOffer = args.includes('CO');

     const { cold_wallet, hot_wallet, warm_wallet } = getWallets(WARM_WALLET_SEED, HOT_WALLET_SEED, COLD_WALLET_SEED, algo);

     // Example NFT ID (replace with your own)
     const nftId = '001B0000705E42A6AD73AE8B5E3EF1A9A33883393D8A2693106439E100630A46';
     const buyOfferIdx = 'A4E4DDED6D878FC7784CF5FC5D582A13B51109406CF67B8FC19C0085E12E5FA9';
     let sellOfferIndex;
     let buyOfferIndex;

     // ---- 1. SELL OFFER ----
     if (createSellOffer) {
          const sellOfferTx = {
               TransactionType: 'NFTokenCreateOffer',
               Account: hot_wallet.classicAddress,
               NFTokenID: nftId,
               Amount: xrpl.xrpToDrops('5'), // sell for 5 XRP
               Flags: 1, // tfSellNFToken = 1
          };

          const preparedSell = await client.autofill(sellOfferTx);
          const signedSell = hot_wallet.sign(preparedSell);
          const sellResult = await client.submitAndWait(signedSell.tx_blob);
          console.log('Sell offer result:', sellResult);

          // Grab sell offer index from meta
          sellOfferIndex = sellResult.result?.meta?.AffectedNodes?.find(n => n.CreatedNode?.LedgerEntryType === 'NFTokenOffer')?.CreatedNode?.LedgerIndex;
     }

     if (buyNft) {
          // ---- 2. BUY OFFER ----
          const buyOfferTx = {
               TransactionType: 'NFTokenCreateOffer',
               Account: warm_wallet.classicAddress,
               Owner: hot_wallet.classicAddress, // NFT owner
               NFTokenID: nftId,
               Amount: xrpl.xrpToDrops('5'), // match the sell offer
          };

          const preparedBuy = await client.autofill(buyOfferTx);
          const signedBuy = warm_wallet.sign(preparedBuy);
          const buyResult = await client.submitAndWait(signedBuy.tx_blob);
          console.log('Buy offer result:', buyResult);

          // Grab buy offer index from meta
          buyOfferIndex = buyResult.result?.meta?.AffectedNodes?.find(n => n.CreatedNode?.LedgerEntryType === 'NFTokenOffer')?.CreatedNode?.LedgerIndex;

          // ---- 3. ACCEPT SELL OFFER ----
          if (sellOfferIndex) {
               const acceptTx = {
                    TransactionType: 'NFTokenAcceptOffer',
                    Account: warm_wallet.classicAddress,
                    NFTokenSellOffer: sellOfferIndex,
               };

               const preparedAccept = await client.autofill(acceptTx);
               const signedAccept = warm_wallet.sign(preparedAccept);
               const acceptResult = await client.submitAndWait(signedAccept.tx_blob);
               console.log('Accept offer result:', acceptResult);
          }
     }

     // ---- 4. CANCEL OFFER ----
     if (cancelOffer) {
          if (buyOfferIndex) {
               const cancelTx = {
                    TransactionType: 'NFTokenCancelOffer',
                    Account: warm_wallet.classicAddress,
                    NFTokenOffers: [buyOfferIndex], // array of one or more offer indices
               };

               const preparedCancel = await client.autofill(cancelTx);
               const signedCancel = warm_wallet.sign(preparedCancel);
               const cancelResult = await client.submitAndWait(signedCancel.tx_blob);
               console.log('Cancel offer result:', cancelResult);
          }
     }

     // if (cancelOffer) {
     //      const cancelTx = {
     //           TransactionType: 'NFTokenCancelOffer',
     //           Account: warm_wallet.classicAddress,
     //           NFTokenOffers: [buyOfferIdx], // array of one or more offer indices
     //      };

     //      const preparedCancel = await client.autofill(cancelTx);
     //      const signedCancel = warm_wallet.sign(preparedCancel);
     //      const cancelResult = await client.submitAndWait(signedCancel.tx_blob);
     //      console.log('Cancel offer result:', cancelResult);
     // }

     await client.disconnect();
     console.log('\nAll done.');
}

main().catch(console.error);
