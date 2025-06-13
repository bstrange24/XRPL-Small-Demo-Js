import * as xrpl from 'xrpl';
import { XRP_CURRENCY, ed25519_ENCRYPTION, secp256k1_ENCRYPTION, MAINNET, TES_SUCCESS } from './constants.js';

// Sleep helper
function sleep(ms) {
     return new Promise(resolve => setTimeout(resolve, ms));
}

//   Usage
//   node issue_and_create_orders.js X T P B S G OB
//   Sell
//   node issue_and_create_orders.js X X P X X X X
//

const CURRENCY = 'DOG';
const NET = 'wss://s.altnet.rippletest.net:51233/';
// const NET = 'wss://s.devnet.rippletest.net:51233/';

const COLD_WALLET_SEED = 'shNTx357ynZ5qHoJ4opfdjLeX3fDY';
const HOT_WALLET_SEED = 'snsvu5L9LBhhs6DZZPtu9kEim7mKc';

async function main() {
     const args = process.argv.slice(2); // Ignore node path and script name
     const cancelOffer = args.includes('C');
     const setTrustLine = args.includes('T');
     const sendTokenPayment = args.includes('P');
     const createBuyOffer = args.includes('B');
     const createSellOffer = args.includes('S');
     const getOffers = args.includes('G');
     const getOrderBook = args.includes('OB');

     const client = new xrpl.Client(NET);
     await client.connect();
     console.log('Connected to XRPL Testnet');

     // Issuer wallet (cold)
     const cold_wallet = xrpl.Wallet.fromSeed(COLD_WALLET_SEED, { algorithm: secp256k1_ENCRYPTION });
     console.log('Cold wallet address:', cold_wallet.address);

     // Static hot wallet (buyer)
     const hot_wallet = xrpl.Wallet.fromSeed(HOT_WALLET_SEED, { algorithm: secp256k1_ENCRYPTION });
     console.log('Hot wallet address:', hot_wallet.address);

     console.log('process.argv' + process.argv);

     console.log('cancelOffer: ' + cancelOffer);
     if (cancelOffer) {
          console.log('Canceling offers');
          // Fetch all offers
          const offersResponse = await client.request({
               command: 'account_offers',
               account: hot_wallet.address,
          });

          const offers = offersResponse.result.offers;
          console.log(`Found ${offers.length} open offer(s).`);

          // Cancel each offer
          for (const offer of offers) {
               const cancelTx = {
                    TransactionType: 'OfferCancel',
                    Account: hot_wallet.address,
                    OfferSequence: offer.seq,
               };

               try {
                    const result = await client.submitAndWait(cancelTx, { wallet: hot_wallet });
                    console.log(`Cancelled offer ${offer.seq}: ${result.result.meta.TransactionResult}`);
               } catch (err) {
                    console.error(`Failed to cancel offer ${offer.seq}:`, err.message);
               }

               await sleep(1000); // Optional delay between transactions
          }
     } else {
          console.log('setTrustLine: ' + setTrustLine);
          if (setTrustLine) {
               // Ensure trustline exists
               const trustSetTx = {
                    TransactionType: 'TrustSet',
                    Account: hot_wallet.address,
                    LimitAmount: {
                         currency: CURRENCY,
                         issuer: cold_wallet.address,
                         value: '1000000',
                    },
               };
               await client.submitAndWait(trustSetTx, { wallet: hot_wallet });
               console.log('Trustline set.');
          }

          console.log('sendTokenPayment: ' + sendTokenPayment);
          if (sendTokenPayment) {
               // Issue 100000 BOB from cold to hot wallet so we can place sell offers
               const payment = {
                    TransactionType: 'Payment',
                    Account: cold_wallet.address,
                    Destination: hot_wallet.address,
                    // Account: hot_wallet.address,
                    // Destination: cold_wallet.address,
                    Amount: {
                         currency: CURRENCY,
                         issuer: cold_wallet.address,
                         value: '100000',
                    },
               };
               const result = await client.submitAndWait(payment, { wallet: cold_wallet });
               console.log('Issued 100000 BOB to hot wallet:', result.result.meta.TransactionResult);
               await sleep(1000);
          }

          const minPrice = 0.05; // More aggressive
          const maxPrice = 3.0; // Wider range
          const step = 0.3; // Larger steps
          const baseAmount = 8;
          const numSteps = 10;
          const weight = 2;
          const spreadFactor = 0.95;

          console.log('createBuyOffer: ' + createBuyOffer);
          if (createBuyOffer) {
               console.log(`\n=== Placing BUY Offers (XRP → ${CURRENCY}) ===`);
               const dogXrpBook = await client.request({
                    command: 'book_offers',
                    taker_gets: { currency: CURRENCY, issuer: cold_wallet.address },
                    taker_pays: { currency: 'XRP' },
               });
               const bestAsk = dogXrpBook.result.offers.length ? (typeof dogXrpBook.result.offers[0].TakerPays === 'string' ? parseFloat(dogXrpBook.result.offers[0].TakerPays) / 1e6 / parseFloat(dogXrpBook.result.offers[0].TakerGets.value) : parseFloat(dogXrpBook.result.offers[0].TakerPays.value) / parseFloat(dogXrpBook.result.offers[0].TakerGets)) : 0.1;
               console.log(`Current XRP/${CURRENCY} ask: ${bestAsk}`);

               for (let i = 0; i < numSteps; i++) {
                    let price = minPrice * Math.pow(maxPrice / minPrice, i / (numSteps - 1));
                    if (bestAsk) price = Math.min(price, bestAsk * spreadFactor);
                    price = Math.max(price, minPrice);
                    const amountBOB = (baseAmount * (1 + (weight * (maxPrice - price)) / (maxPrice - minPrice)) * (0.9 + Math.random() * 0.2)).toFixed(6);
                    const totalXRP = (amountBOB * price).toFixed(6);
                    const takerGets = xrpl.xrpToDrops(totalXRP);
                    const takerPays = {
                         currency: CURRENCY,
                         issuer: cold_wallet.address,
                         value: amountBOB,
                    };

                    const offer = {
                         TransactionType: 'OfferCreate',
                         Account: hot_wallet.address,
                         TakerGets: takerGets,
                         TakerPays: takerPays,
                         Flags: 0,
                    };

                    try {
                         const res = await client.submitAndWait(offer, { wallet: hot_wallet });
                         console.log(`Buy: ${amountBOB} ${CURRENCY} @ ${price.toFixed(4)} XRP/${CURRENCY} → ${res.result.meta.TransactionResult}`);
                    } catch (err) {
                         console.error(`Buy offer failed at ${price.toFixed(4)} XRP/${CURRENCY}:`, err.message);
                    }
                    await sleep(1000);
               }
          }

          const sellBaseAmount = 8;
          const sellMinPrice = 0.05; // XRP/DOG (e.g., 20 DOG/XRP)
          const sellMaxPrice = 3.0; // XRP/DOG (e.g., 0.3333 DOG/XRP)
          const sellNumSteps = 10;
          const sellWeight = 2; // Controls amount scaling
          const sellSpreadFactor = 1.05; // 5% above best bid

          console.log('createSellOffer: ' + createSellOffer);
          if (createSellOffer) {
               // const wallet = xrpl.Wallet.fromSeed('shNTx357ynZ5qHoJ4opfdjLeX3fDY', { algorithm: secp256k1_ENCRYPTION });
               // console.log('wallet address:', wallet.address);
               // const offer = {
               //      TransactionType: 'OfferCreate',
               //      Account: 'rETbLUGdjTo2PScLT5xCUZ8ov7B9zHnRqo',
               //      TakerPays: xrpl.xrpToDrops(1.9),
               //      TakerGets: { currency: '524C555344000000000000000000000000000000', issuer: 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV', value: '1' },
               //      Flags: 0,
               // };

               // try {
               //      const res = await client.submitAndWait(offer, { wallet: wallet });
               //      console.log(`Hack RLUSD offer: ${JSON.stringify(res.result, null, 2)}`);
               //      // console.log(`Sell: ${amountBOB} ${CURRENCY} @ ${price.toFixed(4)} XRP/${CURRENCY} (=${(1 / price).toFixed(4)} ${CURRENCY}/XRP) → ${res.result.meta.TransactionResult}`);
               // } catch (err) {
               //      console.error(`Sell offer failed`, err.message);
               // }
               console.log(`\n=== Placing SELL Offers (${CURRENCY} → XRP) ===`);
               // Fetch XRP/DOG order book to get best bid
               const xrpDogBook = await client.request({
                    command: 'book_offers',
                    taker_gets: { currency: 'XRP' },
                    taker_pays: { currency: CURRENCY, issuer: cold_wallet.address },
               });
               const bids = xrpDogBook.result.offers.map(o => ({
                    price: typeof o.TakerGets === 'string' ? parseFloat(o.TakerGets) / 1e6 / parseFloat(o.TakerPays.value) : parseFloat(o.TakerGets.value) / parseFloat(o.TakerPays), // XRP/DOG
                    amount: parseFloat(o.TakerPays.value), // DOG
               }));
               console.log(`Current XRP/${CURRENCY} bids ${bids}`);

               // Get best bid (highest XRP/DOG price)
               const bestBid = bids.length ? Math.max(...bids.map(b => b.price)) : 0.45; // Fallback to 0.45 XRP/DOG

               for (let i = 0; i < sellNumSteps; i++) {
                    let price = sellMinPrice * Math.pow(sellMaxPrice / sellMinPrice, i / (sellNumSteps - 1)); // Logarithmic price
                    if (bestBid) price = Math.max(price, bestBid * sellSpreadFactor); // Adjust to 5% above best bid
                    price = Math.min(price, sellMaxPrice); // Cap at sellMaxPrice
                    const amountBOB = (sellBaseAmount * (1 + (sellWeight * (sellMaxPrice - price)) / (sellMaxPrice - sellMinPrice)) * (0.9 + Math.random() * 0.2)).toFixed(6);
                    const totalXRP = (amountBOB * price).toFixed(6);
                    const takerGets = {
                         currency: CURRENCY,
                         issuer: cold_wallet.address,
                         value: amountBOB,
                    };
                    const takerPays = xrpl.xrpToDrops(totalXRP);

                    const offer = {
                         TransactionType: 'OfferCreate',
                         Account: hot_wallet.address,
                         TakerGets: takerGets, // Sell DOG
                         TakerPays: takerPays, // Receive XRP
                         Flags: 0,
                    };

                    try {
                         const res = await client.submitAndWait(offer, { wallet: hot_wallet });
                         console.log(`Sell: ${amountBOB} ${CURRENCY} @ ${price.toFixed(4)} XRP/${CURRENCY} (=${(1 / price).toFixed(4)} ${CURRENCY}/XRP) → ${res.result.meta.TransactionResult}`);
                    } catch (err) {
                         console.error(`Sell offer failed at ${price.toFixed(4)} XRP/${CURRENCY}:`, err.message);
                    }
                    await sleep(1000);
               }
          }

          console.log('getOrderBook: ' + getOrderBook);
          if (getOrderBook) {
               console.log(`\n=== Placing BUY Offers (XRP → ${CURRENCY}) ===`);
               const dogXrpBook = await client.request({
                    command: 'book_offers',
                    taker_gets: { currency: CURRENCY, issuer: cold_wallet.address },
                    taker_pays: { currency: 'XRP' },
               });
               // console.log('Raw DOG/XRP offers:', JSON.stringify(dogXrpBook.result.offers, null, 2));

               const ask = dogXrpBook.result.offers.map(o => {
                    const price = typeof o.TakerPays === 'string' ? parseFloat(o.TakerPays) / 1e6 / parseFloat(o.TakerGets.value) : parseFloat(o.TakerPays.value) / parseFloat(o.TakerGets);
                    let amount;
                    if (typeof o.TakerGets === 'object' && o.TakerGets.value) {
                         amount = parseFloat(o.TakerGets.value);
                    } else {
                         console.warn('Invalid TakerGets format:', o.TakerGets);
                         amount = NaN;
                    }
                    return { price, amount };
               });

               const bestAsk = dogXrpBook.result.offers.length ? (typeof dogXrpBook.result.offers[0].TakerPays === 'string' ? parseFloat(dogXrpBook.result.offers[0].TakerPays) / 1e6 / parseFloat(dogXrpBook.result.offers[0].TakerGets.value) : parseFloat(dogXrpBook.result.offers[0].TakerPays.value) / parseFloat(dogXrpBook.result.offers[0].TakerGets)) : 0.1;

               console.log(`Current ${CURRENCY}/XRP ask:`);
               ask.forEach(o => {
                    if (!isNaN(o.amount)) {
                         console.log(`  Price: ${o.price.toFixed(6)} XRP/${CURRENCY}, Amount: ${o.amount.toFixed(6)} ${CURRENCY}`);
                    } else {
                         console.log(`  Price: ${o.price.toFixed(6)} XRP/${CURRENCY}, Amount: Invalid`);
                    }
               });
               console.log(`bestAsk: ${bestAsk}`);

               const xrpDogBook = await client.request({
                    command: 'book_offers',
                    taker_gets: { currency: 'XRP' },
                    taker_pays: { currency: CURRENCY, issuer: cold_wallet.address },
               });
               // console.log('Raw XRP/DOG offers:', JSON.stringify(xrpDogBook.result.offers, null, 2));

               const bids = xrpDogBook.result.offers.map(o => {
                    const price = typeof o.TakerGets === 'string' ? parseFloat(o.TakerGets) / 1e6 / parseFloat(o.TakerPays.value) : parseFloat(o.TakerGets.value) / parseFloat(o.TakerPays);
                    let amount;
                    if (typeof o.TakerPays === 'object' && o.TakerPays.value) {
                         amount = parseFloat(o.TakerPays.value);
                    } else {
                         console.warn('Invalid TakerPays format:', o.TakerPays);
                         amount = NaN;
                    }
                    return { price, amount };
               });

               const bestBids = xrpDogBook.result.offers.length ? (typeof xrpDogBook.result.offers[0].TakerGets === 'string' ? parseFloat(xrpDogBook.result.offers[0].TakerGets) / 1e6 / parseFloat(xrpDogBook.result.offers[0].TakerPays.value) : parseFloat(xrpDogBook.result.offers[0].TakerGets.value) / parseFloat(xrpDogBook.result.offers[0].TakerPays)) : 0.1;

               console.log(`Current XRP/${CURRENCY} bids:`);
               bids.forEach(o => {
                    if (!isNaN(o.amount)) {
                         console.log(`  Price: ${o.price.toFixed(6)} XRP/${CURRENCY}, Amount: ${o.amount.toFixed(6)} ${CURRENCY}`);
                    } else {
                         console.log(`  Price: ${o.price.toFixed(6)} XRP/${CURRENCY}, Amount: Invalid`);
                    }
               });
               console.log(`bestBid: ${bestBids}`);
          }

          const h_wallet_addr = hot_wallet.address;
          const c_wallet_addr = cold_wallet.address;
          // const h_wallet_addr = 'r3oUj2qJw7WmMJreCjJmyBA7wUTvxUmDNv';
          // const c_wallet_addr = 'r4dF7pnCdVXvbQAf3i1Yktcb8YMp6gkpr7';
          const account1_wallet_addr = 'rhuaX1t5XP4mSzW5pXSUbpVoqUjadV3HcH';
          console.log('getOffers: ' + getOffers);
          if (getOffers) {
               const hotWalletOffers = await client.request({
                    command: 'account_offers',
                    account: h_wallet_addr,
               });
               console.log('Offers placed by hot wallet:', hotWalletOffers.result.offers);

               const coldWalletOffers = await client.request({
                    command: 'account_offers',
                    account: c_wallet_addr,
               });
               console.log('Offers placed by cold wallet:', coldWalletOffers.result.offers.length);

               const account1WalletOffers = await client.request({
                    command: 'account_offers',
                    account: account1_wallet_addr,
               });
               console.log('Offers placed by account1 wallet:', account1WalletOffers.result.offers.length);
          }
     }
     await client.disconnect();
     console.log('All done.');
}

main().catch(console.error);
