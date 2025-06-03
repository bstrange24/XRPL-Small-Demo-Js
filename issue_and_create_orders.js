import * as xrpl from 'xrpl';

// Sleep helper
function sleep(ms) {
     return new Promise(resolve => setTimeout(resolve, ms));
}

//   Usage
//   node issue_and_create_orders.js X T P B S G
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

     const client = new xrpl.Client(NET);
     await client.connect();
     console.log('Connected to XRPL Testnet');

     // Issuer wallet (cold)
     const cold_wallet = xrpl.Wallet.fromSeed(COLD_WALLET_SEED, { algorithm: 'secp256k1' });
     console.log('Cold wallet address:', cold_wallet.address);

     // Static hot wallet (buyer)
     const hot_wallet = xrpl.Wallet.fromSeed(HOT_WALLET_SEED, { algorithm: 'secp256k1' });
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

          const amountBOB = 10;
          const minPrice = 0.1;
          const maxPrice = 1.0;
          const step = 0.2;

          console.log('createBuyOffer: ' + createBuyOffer);
          if (createBuyOffer) {
               console.log(`\n=== Placing BUY Offers (XRP → ${CURRENCY}) ===`);
               for (let price = minPrice; price <= maxPrice; price += step) {
                    const totalXRP = (amountBOB * price).toFixed(6);
                    const takerGets = xrpl.xrpToDrops(totalXRP);
                    const takerPays = {
                         currency: CURRENCY,
                         issuer: cold_wallet.address,
                         value: amountBOB.toString(),
                    };

                    const offer = {
                         TransactionType: 'OfferCreate',
                         Account: hot_wallet.address,
                         TakerGets: takerGets, // Pay XRP
                         TakerPays: takerPays, // Receive BOB
                         Flags: 0,
                    };

                    try {
                         const res = await client.submitAndWait(offer, { wallet: hot_wallet });
                         console.log(`Buy: ${amountBOB} ${CURRENCY} @ ${price.toFixed(2)} XRP/${CURRENCY} → ${res.result.meta.TransactionResult}`);
                    } catch (err) {
                         console.error(`Buy offer failed at ${price.toFixed(2)} XRP/${CURRENCY}:`, err.message);
                    }
                    await sleep(1000);
               }
          }

          console.log('createSellOffer: ' + createSellOffer);
          if (createSellOffer) {
               console.log(`\n=== Placing SELL Offers (${CURRENCY} → XRP) ===`);
               for (let price = minPrice; price <= maxPrice; price += step) {
                    const takerGets = {
                         currency: CURRENCY,
                         issuer: cold_wallet.address,
                         value: amountBOB.toString(),
                    };
                    const totalXRP = (amountBOB * price).toFixed(6);
                    const takerPays = xrpl.xrpToDrops(totalXRP);

                    const sellOffer = {
                         TransactionType: 'OfferCreate',
                         Account: hot_wallet.address,
                         TakerGets: takerGets, // Pay BOB
                         TakerPays: takerPays, // Receive XRP
                         Flags: 0,
                    };

                    try {
                         const res = await client.submitAndWait(sellOffer, { wallet: hot_wallet });
                         console.log(`Sell: ${amountBOB} ${CURRENCY} @ ${price.toFixed(2)} XRP/${CURRENCY} → ${res.result.meta.TransactionResult}`);
                    } catch (err) {
                         console.error(`Sell offer failed at ${price.toFixed(2)} XRP/${CURRENCY}:`, err.message);
                    }
                    await sleep(1000);
               }
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
