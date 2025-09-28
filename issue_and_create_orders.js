import * as xrpl from 'xrpl';
import { XRP_CURRENCY, ed25519_ENCRYPTION, secp256k1_ENCRYPTION, MAINNET, TES_SUCCESS } from './constants.js';

// Sleep helper
function sleep(ms) {
     return new Promise(resolve => setTimeout(resolve, ms));
}

//   Usage
//   node issue_and_create_orders.js X T P B S G OB X X X X X X X X
//   Buy
//   node issue_and_create_orders.js X X X B X X X X X X X X X X X
//   Sell
//   node issue_and_create_orders.js X X X X S X X X X X X X X X X
//   Buy and Sell
//   node issue_and_create_orders.js X X X B S X X X X X X X X X X
//   Trustline and Issue
//   node issue_and_create_orders.js X T P X X X X X X X X X X X X
//   Trustlines and Account objects
//   node issue_and_create_orders.js X T X X X X X A X X X X X X X
//   Account objects
//   node issue_and_create_orders.js X X X X X X X A X X X X X X X
//   Gateway Balance
//   node issue_and_create_orders.js X X X X X X X X GW X X X X X X
//   Get AMM
//   node issue_and_create_orders.js X X X X X X X X X AMM X X X X X
//   PermissionedDomainSet
//   node issue_and_create_orders.js X X X X X X X X X X PDSet X X X X
//   PermissionedDomainDelete
//   node issue_and_create_orders.js X X X X X X X X X X X PDDel X X X
//   Batch
//   node issue_and_create_orders.js X X X X X X X X X X X X BAT X X
//   Paychaneel
//   node issue_and_create_orders.js X X X X X X X X X X X X X PC X
//   Account Currecies
//   node issue_and_create_orders.js X X X X X X X X X X X X X X CUR
const CURRENCY = 'CTZ';
// const NET = 'wss://s.altnet.rippletest.net:51233/';
const NET = 'wss://s.devnet.rippletest.net:51233/';
// const NET = 'ws://localhost:5006';

// raYp4pcuTokY8tWAPt7jxZ1fzpLmPbg7uJ sEdS4eJg1nvoNhD35Qh6DN3Z69seon2
const WARM_WALLET_SEED = 'shfXfN5Q6TnJ8mbAJrw6zhqU392Z4';
// rPiHBVoQEzbEVLA15ZcesUtU9xW6C7U4QA sEdTZqBbgk4hwXMY91Lhggc5tcJKZyq
const HOT_WALLET_SEED = 'saw4g5zDe6gTktn8PmJrHbRuhPK5h';
// rh1ncoTdWXz4pP2FxB6MnTFLztvQJXYHVP sEdTaVdEf44sQeVZThvsj3Q5UBCkQkT
const COLD_WALLET_SEED = 'spADR8o6kMrF9onePscGPizSD5uWS'; //

async function main() {
     const args = process.argv.slice(2); // Ignore node path and script name
     const cancelOffer = args.includes('C');
     const setTrustLine = args.includes('T');
     const sendTokenPayment = args.includes('P');
     const createBuyOffer = args.includes('B');
     const createSellOffer = args.includes('S');
     const getOffers = args.includes('G');
     const getOrderBook = args.includes('OB');
     const getAccountInfo = args.includes('A');
     const getGateWayBalance = args.includes('GW');
     const getAMM = args.includes('AMM');
     const getPermissionedDomainSet = args.includes('PDSet');
     const getPermissionedDomainDelete = args.includes('PDDel');
     const getBatch = args.includes('BAT');
     const getPaymentChannel = args.includes('PC');
     const getAccountCurrencies = args.includes('CUR');
     const getMpt = args.includes('MPT');

     const minPrice = 0.05; // More aggressive
     const maxPrice = 3.0; // Wider range
     const step = 0.3; // Larger steps
     const baseAmount = 8;
     const numSteps = 5;
     const weight = 2;
     const spreadFactor = 0.95;
     const sellBaseAmount = 8;
     const sellMinPrice = 0.05; // XRP/DOG (e.g., 20 DOG/XRP)
     const sellMaxPrice = 3.0; // XRP/DOG (e.g., 0.3333 DOG/XRP)
     const sellNumSteps = 10;
     const sellWeight = 2; // Controls amount scaling
     const sellSpreadFactor = 1.05; // 5% above best bid

     const client = new xrpl.Client(NET);
     await client.connect();
     console.log('Connected to XRPL Testnet');

     // Cold Wallet (issuing address)
     // const cold_wallet = xrpl.Wallet.fromSeed(COLD_WALLET_SEED, { algorithm: ed25519_ENCRYPTION });
     const cold_wallet = xrpl.Wallet.fromSeed(COLD_WALLET_SEED, { algorithm: secp256k1_ENCRYPTION });
     console.log('Cold wallet address:', cold_wallet.address);

     // Hot Wallet (operational address)
     const hot_wallet = xrpl.Wallet.fromSeed(HOT_WALLET_SEED, { algorithm: secp256k1_ENCRYPTION });
     // const hot_wallet = xrpl.Wallet.fromMnemonic(HOT_WALLET_SEED, { algorithm: secp256k1_ENCRYPTION });
     console.log('Hot wallet address:', hot_wallet.address);

     // Account 1 (warm wallet)
     // const warm_wallet = xrpl.Wallet.fromSeed(WARM_WALLET_SEED, { algorithm: ed25519_ENCRYPTION });
     const warm_wallet = xrpl.Wallet.fromSeed(WARM_WALLET_SEED, { algorithm: secp256k1_ENCRYPTION });
     console.log('Warm wallet address:', warm_wallet.address);

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
                         value: '100000000',
                    },
               };
               const response = await client.submitAndWait(trustSetTx, { wallet: hot_wallet });
               console.log('Trustline set.');
               console.log(`response: ${JSON.stringify(response, null, '\t')}`);
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
               const response = await client.submitAndWait(payment, { wallet: cold_wallet });
               console.log(`Issued 100000 ${CURRENCY} to hot wallet: ${JSON.stringify(response, null, '\t')}`);
               await sleep(1000);
          }

          console.log('createBuyOffer: ' + createBuyOffer);
          if (createBuyOffer) {
               try {
                    console.log(`\n=== Placing BUY Offers (XRP → ${CURRENCY}) ===`);
                    const dogXrpBook = await client.request({
                         command: 'book_offers',
                         taker_gets: { currency: CURRENCY, issuer: hot_wallet.address },
                         taker_pays: { currency: 'XRP' },
                    });
                    const bestAsk = dogXrpBook.result.offers.length ? (typeof dogXrpBook.result.offers[0].TakerPays === 'string' ? parseFloat(dogXrpBook.result.offers[0].TakerPays) / 1e6 / parseFloat(dogXrpBook.result.offers[0].TakerGets.value) : parseFloat(dogXrpBook.result.offers[0].TakerPays.value) / parseFloat(dogXrpBook.result.offers[0].TakerGets)) : 0.1;
                    console.log(`Current XRP/${CURRENCY} ask: ${bestAsk}`);

                    for (let i = 0; i < numSteps; i++) {
                         console.log(`Looping...`);
                         let price = minPrice * Math.pow(maxPrice / minPrice, i / (numSteps - 1));
                         if (bestAsk) price = Math.min(price, bestAsk * spreadFactor);
                         price = Math.max(price, minPrice);
                         const amountBOB = (baseAmount * (1 + (weight * (maxPrice - price)) / (maxPrice - minPrice)) * (0.9 + Math.random() * 0.2)).toFixed(6);
                         const totalXRP = (amountBOB * price).toFixed(6);
                         const takerGets = xrpl.xrpToDrops(totalXRP);
                         const takerPays = {
                              currency: CURRENCY,
                              issuer: hot_wallet.address,
                              value: amountBOB,
                         };

                         console.log(`Creating offer...`);
                         const offer = {
                              TransactionType: 'OfferCreate',
                              Account: warm_wallet.address,
                              TakerGets: takerGets,
                              TakerPays: takerPays,
                              Flags: 0,
                         };

                         const res = await client.submitAndWait(offer, { wallet: warm_wallet });
                         console.log(`Buy: ${amountBOB} ${CURRENCY} @ ${price.toFixed(4)} XRP/${CURRENCY} → ${res.result.meta.TransactionResult}`);

                         await sleep(1000);
                    }
               } catch (err) {
                    console.error(`Buy offer failed at ${price.toFixed(4)} XRP/${CURRENCY}:`, err.message);
               }
          }

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
          const w_wallet_addr = warm_wallet.address;
          console.log('getOffers: ' + getOffers);
          if (getOffers) {
               // const hotWalletOffers = await client.request({
               //      command: 'account_offers',
               //      account: h_wallet_addr,
               // });
               // console.log('Offers placed by hot wallet:', hotWalletOffers.result.offers);

               // const coldWalletOffers = await client.request({
               //      command: 'account_offers',
               //      account: c_wallet_addr,
               // });
               // console.log('Offers placed by cold wallet:', coldWalletOffers.result.offers.length);

               const account1WalletOffers = await client.request({
                    command: 'account_offers',
                    account: w_wallet_addr,
               });

               console.log('Offers placed by account1 wallet:', account1WalletOffers.result.offers.length);
               console.log('Sequence Numbers:');
               for (const offer of account1WalletOffers.result.offers) {
                    console.log(offer['seq'] + ',');
               }
          }

          console.log('getAccountCurrencies: ' + getAccountCurrencies);
          if (getAccountCurrencies) {
               const hotWalletAccountCurrencies = await client.request({
                    command: 'account_currencies',
                    account: h_wallet_addr,
               });
               // console.log(`hot wallet account_currencies: ${JSON.stringify(hotWalletAccountCurrencies, null, '\t')}`);

               const coldWalletAccountCurrencies = await client.request({
                    command: 'account_currencies',
                    account: c_wallet_addr,
               });
               // console.log(`cold wallet account_currencies: ${JSON.stringify(coldWalletAccountCurrencies, null, '\t')}`);

               const warmWalletAccountCurrencies = await client.request({
                    command: 'account_currencies',
                    account: w_wallet_addr,
                    type: 'permissioned_domain',
               });
               // console.log(`warm wallet account_currencies: ${JSON.stringify(warmWalletAccountCurrencies, null, '\t')}`);

               const result = await client.request({ command: 'feature' });
               const features = result.result.features;
               console.log(`features: `, features);
               // The amendment ID you want to check (example: fix1512)
               const targetAmendment = 'fixNFTokenMinter';

               // Find the amendment by name
               const amendmentEntry = Object.entries(features).find(([id, feature]) => feature.name === targetAmendment);

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
          }

          console.log('getAccountInfo: ' + getAccountInfo);
          if (getAccountInfo) {
               const hotWalletAccountObjects = await client.request({
                    command: 'account_objects',
                    account: h_wallet_addr,
               });
               console.log(`hot wallet account_objects: ${JSON.stringify(hotWalletAccountObjects, null, '\t')}`);

               const coldWalletAccountObjects = await client.request({
                    command: 'account_objects',
                    account: c_wallet_addr,
               });
               console.log(`cold wallet account_objects: ${JSON.stringify(coldWalletAccountObjects, null, '\t')}`);

               const warmWalletAccountObjects = await client.request({
                    command: 'account_objects',
                    account: w_wallet_addr,
                    type: 'permissioned_domain',
               });
               console.log(`warm wallet account_objects: ${JSON.stringify(warmWalletAccountObjects, null, '\t')}`);
          }

          console.log('getGateWayBalance: ' + getGateWayBalance);
          if (getGateWayBalance) {
               const hotWalletGetGateWayBalance = await client.request({
                    command: 'gateway_balances',
                    account: h_wallet_addr,
                    ledger_index: 'validated',
               });
               console.log(`hot wallet account_objects: ${JSON.stringify(hotWalletGetGateWayBalance, null, '\t')}`);

               const coldWalletGetGateWayBalance = await client.request({
                    command: 'gateway_balances',
                    account: c_wallet_addr,
                    // hotwallet: [h_wallet_addr],
                    ledger_index: 'validated',
               });
               console.log(`cold wallet account_objects: ${JSON.stringify(coldWalletGetGateWayBalance, null, '\t')}`);

               const warmWalletGetGateWayBalance = await client.request({
                    command: 'gateway_balances',
                    account: w_wallet_addr,
                    // hotwallet: [h_wallet_addr],
                    ledger_index: 'validated',
               });
               console.log(`warm wallet account_objects: ${JSON.stringify(warmWalletGetGateWayBalance, null, '\t')}`);

               const warmAccountLines = await client.request({
                    command: 'account_lines',
                    account: w_wallet_addr,
                    ledger_index: 'validated',
               });
               // console.log(`warm wallet account_lines: ${JSON.stringify(warmAccountLines, null, '\t')}`);

               const hotAccountLines = await client.request({
                    command: 'account_lines',
                    account: h_wallet_addr,
                    ledger_index: 'validated',
               });
               // console.log(`warm wallet account_lines: ${JSON.stringify(hotAccountLines, null, '\t')}`);

               const coldAccountLines = await client.request({
                    command: 'account_lines',
                    account: c_wallet_addr,
                    ledger_index: 'validated',
               });
               // console.log(`warm wallet account_lines: ${JSON.stringify(coldAccountLines, null, '\t')}`);

               const warmAccountCurrencies = await client.request({
                    command: 'account_currencies',
                    account: w_wallet_addr,
                    ledger_index: 'validated',
               });
               // console.log(`warm wallet account_currencies: ${JSON.stringify(warmAccountCurrencies, null, '\t')}`);

               // const warmAccountChannels = await client.request({
               //      command: 'account_channels',
               //      account: w_wallet_addr,
               //      ledger_index: 'validated',
               // });
               // console.log(`warm wallet account_channels: ${JSON.stringify(warmAccountChannels, null, '\t')}`);

               // const warmAccountNftHistory = await client.request({
               //      command: 'nft_history',
               //      nft_id: nft_id,
               //      ledger_index: ledgerIndex,
               // });
               // console.log(`warm wallet account_channels: ${JSON.stringify(warmAccountNftHistory, null, '\t')}`);

               // const warmAccountNftByIssuer = await client.request({
               //      command: 'nfts_by_issuer',
               //      nft_id: nft_id,
               //      issuer: issuer,
               //      ledger_index: ledgerIndex,
               // });
               // console.log(`warm wallet account_channels: ${JSON.stringify(warmAccountNftByIssuer, null, '\t')}`);

               // const warmAccountChannelVerify = await client.request({
               //      command: 'channel_verify',
               //      amount: amount,
               //      public_key: publicKey,
               //      signature: signature,
               //      channel_id: channelId,
               // });
               // console.log(`warm wallet account_channels: ${JSON.stringify(warmAccountChannelVerify, null, '\t')}`);

               const warmAccountNoRippleCheck = await client.request({
                    command: 'noripple_check',
                    account: w_wallet_addr,
                    role: 'user',
               });
               // console.log(`warm wallet account NoRippleCheck: ${JSON.stringify(warmAccountNoRippleCheck.result.problems, null, '\t')}`);

               const hotAccountNoRippleCheck = await client.request({
                    command: 'noripple_check',
                    account: h_wallet_addr,
                    role: 'user',
               });
               // console.log(`hot wallet account NoRippleCheck: ${JSON.stringify(hotAccountNoRippleCheck.result.problems, null, '\t')}`);

               const coldAccountNoRippleCheck = await client.request({
                    command: 'noripple_check',
                    account: c_wallet_addr,
                    role: 'gateway',
               });
               // console.log(`cold wallet account NoRippleCheck: ${JSON.stringify(coldAccountNoRippleCheck.result.problems, null, '\t')}`);
          }

          console.log('getAMM: ' + getAMM);
          if (getAMM) {
               // const issuer = hot_wallet.classicAddress;
               // const issuer = warm_wallet.classicAddress;
               const issuer = cold_wallet.classicAddress;

               const asset = {
                    currency: 'CTZ',
                    issuer: issuer,
               };
               const asset2 = {
                    currency: 'XRP',
               };
               console.log('asset:', JSON.stringify(asset, null, 2));
               console.log('asset2:', JSON.stringify(asset2, null, 2));

               try {
                    const ammResponse = await client.request({
                         command: 'amm_info',
                         asset: asset,
                         asset2: asset2,
                         ledger_index: 'validated',
                    });

                    console.log('AMM Info:', JSON.stringify(ammResponse.result.amm, null, 2));
               } catch (error) {
                    if (error.name === 'RippledError') {
                         // ripple responded with a structured error
                         if (error.data?.error === 'actNotFound') {
                              console.error('No AMM pool exists yet for this asset pair.');
                              // e.g. show user-friendly message in UI
                         } else {
                              console.error('RippledError:', error.data?.error_message || error.message);
                         }
                    } else {
                         // some other runtime error (network, JSON, etc.)
                         console.error('Unexpected error:', error);
                    }
               }
          }

          console.log('getPermissionedDomainSet: ' + getPermissionedDomainSet);
          if (getPermissionedDomainSet) {
               // Ensure trustline exists
               const permissionedDomainSetTx = {
                    TransactionType: 'PermissionedDomainSet',
                    Account: 'rHFcP3ZCmcpsijUsmJsQmCUuaH15PZzK3p',
                    Fee: '10',
                    AcceptedCredentials: [
                         {
                              Credential: {
                                   Issuer: 'rfnjWoXho5JZnaCEwPUvJHzFp7KSwqxXEA',
                                   CredentialType: '4B594343726564656E7469616C',
                              },
                         },
                    ],
               };
               const response = await client.submitAndWait(permissionedDomainSetTx, { wallet: warm_wallet });
               console.log('getPermissionedDomainSet set.');
               console.log(`response: ${JSON.stringify(response, null, '\t')}`);
          }

          console.log('getPermissionedDomainDelete: ' + getPermissionedDomainDelete);
          if (getPermissionedDomainDelete) {
               // Ensure trustline exists
               const permissionedDomainSetTx = {
                    TransactionType: 'PermissionedDomainDelete',
                    Account: 'rHFcP3ZCmcpsijUsmJsQmCUuaH15PZzK3p',
                    Fee: '10',
                    DomainID: 'EEA77C2944F6569D1EB0AF23C24AE0D26D2E3F6A0299804EFEEF80EDDC0BE729',
               };
               const response = await client.submitAndWait(permissionedDomainSetTx, { wallet: warm_wallet });
               console.log('getPermissionedDomainSet Delete.');
               console.log(`response: ${JSON.stringify(response, null, '\t')}`);
          }

          console.log('getBatch: ' + getBatch);
          if (getBatch) {
               const batchTx1 = {
                    TransactionType: 'Batch',
                    Account: warm_wallet.classicAddress,
                    Flags: 65536,
                    RawTransactions: [
                         {
                              RawTransaction: {
                                   TransactionType: 'NFTokenMint',
                                   Account: warm_wallet.classicAddress,
                                   URI: '697066733A2F2F6261667962656964663567656B753637357365726C76757463696263356E35666A6E7A7161637634336D6A666372683475723668636E34786B77342E6D657461646174612E6A736F6E',
                                   NFTokenTaxon: 0,
                                   Fee: '0',
                                   SigningPubKey: '',
                              },
                         },
                         {
                              RawTransaction: {
                                   TransactionType: 'NFTokenMint',
                                   Account: warm_wallet.classicAddress,
                                   URI: '697066733A2F2F6261667962656964663567656B753637357365726C76757463696263356E35666A6E7A7161637634336D6A666372683475723668636E34786B77342E6D657461646174612E6A736F6E',
                                   NFTokenTaxon: 0,
                                   Fee: '0',
                                   SigningPubKey: '',
                              },
                         },
                    ],
                    Fee: '40',
               };
               const batchTx2 = {
                    TransactionType: 'Batch',
                    Account: warm_wallet.classicAddress, //'rUserBSM7T3b6nHX3Jjua62wgX9unH8s9b',
                    Flags: 65536,
                    RawTransactions: [
                         {
                              RawTransaction: {
                                   TransactionType: 'Payment',
                                   Flags: 1073741824,
                                   Account: warm_wallet.classicAddress,
                                   Destination: 'rfnjWoXho5JZnaCEwPUvJHzFp7KSwqxXEA',
                                   Amount: '10',
                                   SigningPubKey: '',
                                   Fee: '0',
                              },
                         },
                         {
                              RawTransaction: {
                                   TransactionType: 'Payment',
                                   Flags: 1073741824,
                                   Account: warm_wallet.classicAddress,
                                   Destination: 'rRDgDZvdt1XiJqyCynaeEC5a4kD8TGhcb',
                                   Amount: '10',
                                   SigningPubKey: '',
                                   Fee: '0',
                              },
                         },
                    ],
                    Fee: '50',
                    SigningPubKey: warm_wallet.SigningPubKey,
               };
               const response = await client.submitAndWait(batchTx2, { wallet: warm_wallet });
               console.log('batchTx.');
               console.log(`response: ${JSON.stringify(response, null, '\t')}`);
          }

          console.log('getPaymentChannel: ' + getPaymentChannel);
          if (getPaymentChannel) {
               const channelVerify = await client.request({
                    command: 'channel_verify',
                    channel_id: '69DA73410D5C22ABCBDD6E4F10491F3D088C8A2D4C714CB9E7A3E97AD55EFF6F',
                    signature: '3045022100B9CAE00E3DFD49DDEF4FD33CF39E6FA29DB1A4CDAC080B70520CC46821E94E300220756C13104A24A042CAAF2FB3F2AF064ABD10D6AAED07BC9B4CBB86C4FD783548',
                    public_key: '0358785A571CAEEA41B60EDEAC1633A2D7714BAFD60AA8132148E5797F1B9F3FBB',
                    amount: '1000000',
               });
               console.log(`Channel Verify: ${JSON.stringify(channelVerify, null, '\t')}`);

               const channelAuthorize = await client.request({
                    // id: 'channel_authorize_example_id1',
                    command: 'channel_authorize',
                    channel_id: '3CD1EF85AEE151CFCB3CFAFA06BFE73E23B85144B12A8DC0E4AB8033DC580C75',
                    seed: WARM_WALLET_SEED,
                    key_type: 'secp256k1',
                    amount: '1000000',
               });
               console.log(`Channel Verify: ${JSON.stringify(channelAuthorize, null, '\t')}`);
          }
     }
     await client.disconnect();
     console.log('All done.');
}

main().catch(console.error);
