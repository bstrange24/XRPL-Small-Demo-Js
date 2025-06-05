import * as xrpl from 'xrpl';

// const NET = 'wss://s.devnet.rippletest.net:51233/';
// const NET = 'wss://s.altnet.rippletest.net:51233/';
const NET = 'wss://s1.ripple.com';

// RLUSD Test net Ripple Issuer
// const RIPPLE_RLUSD_ISSUER = 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV';
// RLUSD Main net Ripple Issuer
const RIPPLE_RLUSD_ISSUER = 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De';

const COMMON_USD_ISSUERS = [
     { name: 'GateHub', address: 'rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq' },
     { name: 'BTC2Ripple', address: 'rMwjYedjc7qqtKYVLiAccJSmCwih4LnE2q' },
     { name: 'RippleFox', address: 'rKiCet8SdvWxPXnAgYarFUXMh1zCPz432Y' },
     { name: 'Bitstamp', address: 'rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv' },
];

function encodeCurrencyCode(code) {
     const buffer = Buffer.alloc(20);
     buffer.write(code);
     return buffer.toString('hex').toUpperCase();
}

/**
 * Fetch bid-side XRP/RLUSD prices from XRPL DEX.
 * @param {xrpl.Client} client - Connected xrpl.Client instance.
 * @param {number} maxOffers - Max number of offers to fetch (default: 20)
 * @returns {Object} Summary with top bids and average price
 */
export async function getXrpRlusdDexBids(client, maxOffers = 20) {
     try {
          const currencyHex = encodeCurrencyCode('RLUSD');
          const response = await client.request({
               command: 'book_offers',
               taker_gets: {
                    currency: currencyHex,
                    issuer: RIPPLE_RLUSD_ISSUER,
               },
               taker_pays: { currency: 'XRP' },
               ledger_index: 'current',
          });

          const offers = response.result.offers || [];

          if (offers.length === 0) {
               return {
                    issuer: RIPPLE_RLUSD_ISSUER,
                    offerCount: 0,
                    bids: [],
                    averagePrice: null,
                    topPrice: null,
               };
          }

          const bids = offers.slice(0, maxOffers).map(offer => {
               const rlusd = parseFloat(offer.TakerGets.value);
               const xrp = parseFloat(xrpl.dropsToXrp(offer.TakerPays));
               const price = xrp / rlusd;

               return {
                    price: parseFloat(price.toFixed(6)),
                    rlusdAmount: rlusd,
                    xrpAmount: xrp,
               };
          });

          const averagePrice = bids.reduce((sum, b) => sum + b.price, 0) / bids.length;

          // const bids1 = offers.map(o => {
          //      const price = typeof o.TakerGets === 'string' ? parseFloat(o.TakerGets) / 1e6 / parseFloat(o.TakerPays.value) : parseFloat(o.TakerGets.value) / parseFloat(o.TakerPays);
          //      let amount;
          //      if (typeof o.TakerPays === 'object' && o.TakerPays.value) {
          //           amount = parseFloat(o.TakerPays.value);
          //      } else {
          //           console.warn('Invalid TakerPays format:', o.TakerPays);
          //           amount = NaN;
          //      }
          //      return { price, amount };
          // });

          // const bestBids1 = offers.length ? (typeof offers[0].TakerGets === 'string' ? parseFloat(offers[0].TakerGets) / 1e6 / parseFloat(offers[0].TakerPays.value) : parseFloat(offers[0].TakerGets.value) / parseFloat(offers[0].TakerPays)) : 0.1;

          return {
               issuer: RIPPLE_RLUSD_ISSUER,
               offerCount: offers.length,
               // bestBids1: bestBids1,
               bids,
               averagePrice: parseFloat(averagePrice.toFixed(6)),
               topPrice: bids[0].price,
               pricePerXrp: 1 / bids[0].price,
          };
     } catch (err) {
          console.error('Full error:', err);
          console.error('Error fetching RLUSD bids from DEX:', err.message);
          return null;
     }
}

export async function getXrpRlusdDexAsk(client, maxOffers = 20) {
     try {
          const currencyHex = encodeCurrencyCode('RLUSD');

          // === Ask-side (sellers want to get XRP and pay RLUSD)
          const asksResponse = await client.request({
               command: 'book_offers',
               taker_gets: { currency: 'XRP' },
               taker_pays: {
                    currency: currencyHex,
                    issuer: RIPPLE_RLUSD_ISSUER,
               },
               ledger_index: 'current',
               limit: 20,
          });

          const askOffers = asksResponse.result.offers || [];

          if (askOffers.length === 0) {
               return {
                    issuer: RIPPLE_RLUSD_ISSUER,
                    offerCount: 0,
                    bids: [],
                    averagePrice: null,
                    topPrice: null,
               };
          }

          const ask = askOffers.slice(0, maxOffers).map(offer => {
               const rlusd = parseFloat(offer.TakerPays.value);
               const xrp = parseFloat(xrpl.dropsToXrp(offer.TakerGets));
               const price = xrp / rlusd;

               return {
                    price: parseFloat(price.toFixed(6)),
                    rlusdAmount: rlusd,
                    xrpAmount: xrp,
               };
          });

          const averagePrice = ask.reduce((sum, b) => sum + b.price, 0) / ask.length;

          return {
               issuer: RIPPLE_RLUSD_ISSUER,
               offerCount: askOffers.length,
               ask,
               averagePrice: parseFloat(averagePrice.toFixed(6)),
               topPrice: ask[0].price,
               pricePerXrp: 1 / ask[0].price,
          };
     } catch (err) {
          console.error('Full error:', err);
          console.error('Error fetching RLUSD bids from DEX:', err.message);
          return null;
     }
}

/**
 * Fetches the XRP/USD price from the XRPL DEX using GateHub as the USD issuer.
 * Supports both ask (sell XRP) and bid (buy XRP) prices.
 */
export async function getXrpUsdPriceFromDex(client, maxOffers = 5) {
     const BITSTAMP_USD_ISSUER = 'rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv'; // Bitstamp
     const GATEHUB_USD_ISSUER = 'rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq'; // GateHub
     const RIPPLE_RLUSD_ISSUER = 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De'; // GateHub

     const askRequest = {
          command: 'book_offers',
          taker_gets: {
               currency: 'USD',
               issuer: GATEHUB_USD_ISSUER,
          },
          taker_pays: {
               currency: 'XRP',
          },
          ledger_index: 'current',
     };

     const bidRequest = {
          command: 'book_offers',
          taker_gets: {
               currency: 'XRP',
          },
          taker_pays: {
               currency: 'USD',
               issuer: GATEHUB_USD_ISSUER,
          },
          ledger_index: 'current',
     };

     try {
          const askResponse = await client.request(askRequest);
          const bidResponse = await client.request(bidRequest);

          const askOffers = askResponse.result.offers;
          const bidOffers = bidResponse.result.offers;

          if (askOffers.length === 0 || bidOffers.length === 0) {
               throw new Error('No sufficient XRP/USD offers on the DEX.');
          }

          // Calculate average ask price (selling XRP for USD)
          const topAsks = askOffers.slice(0, maxOffers);
          const avgAsk =
               topAsks.reduce((sum, offer) => {
                    const usd = parseFloat(offer.TakerGets.value);
                    const xrp = parseFloat(xrpl.dropsToXrp(offer.TakerPays));
                    return sum + usd / xrp;
               }, 0) / topAsks.length;

          // Calculate average bid price (buying XRP using USD)
          const topBids = bidOffers.slice(0, maxOffers);
          const avgBid =
               topBids.reduce((sum, offer) => {
                    const usd = parseFloat(offer.TakerPays.value);
                    const xrp = parseFloat(xrpl.dropsToXrp(offer.TakerGets));
                    return sum + usd / xrp;
               }, 0) / topBids.length;

          return {
               topAsk: parseFloat(topAsks[0].TakerGets.value) / parseFloat(xrpl.dropsToXrp(topAsks[0].TakerPays)),
               averageAsk: avgAsk,
               topBid: parseFloat(topBids[0].TakerPays.value) / parseFloat(xrpl.dropsToXrp(topBids[0].TakerGets)),
               averageBid: avgBid,
               askCount: askOffers.length,
               bidCount: bidOffers.length,
          };
     } catch (err) {
          console.error('Full error:', err);
          console.error('Error fetching XRP/USD price from DEX:', err.message);
          return null;
     }
}

/**
 * Scans the XRPL DEX for active USD issuers by checking order book bids for XRP/USD.
 * Returns issuers sorted by number of active offers.
 */
export async function getActiveUsdIssuers(client, maxOffers = 10) {
     const results = [];

     for (const issuer of COMMON_USD_ISSUERS) {
          try {
               const orderbook = await client.request({
                    command: 'book_offers',
                    taker_gets: {
                         currency: 'USD',
                         issuer: issuer.address,
                    },
                    taker_pays: {
                         // Selling XRP, receiving USD
                         currency: 'XRP',
                         // xrpl.xrpToDrops(1)
                    },
                    ledger_index: 'current',
               });

               const offers = orderbook.result.offers || [];
               const topPrices = offers.slice(0, maxOffers).map(offer => {
                    const usd = parseFloat(offer.TakerGets.value);
                    const xrp = parseFloat(xrpl.dropsToXrp(offer.TakerPays));
                    return usd / xrp;
               });

               if (offers.length > 0) {
                    const avgPrice = topPrices.reduce((a, b) => a + b, 0) / topPrices.length;
                    results.push({
                         name: issuer.name,
                         issuer: issuer.address,
                         offerCount: offers.length,
                         averagePrice: avgPrice,
                         topPrice: topPrices[0],
                    });
               }
          } catch (err) {
               console.warn('Error fetching order book for issuer:', issuer.name, err.message);
          }
     }

     results.sort((a, b) => b.offerCount - a.offerCount); // Most active first
     return results;
}

async function main() {
     const client = new xrpl.Client(NET);
     await client.connect();

     // | Term          | Meaning                         |
     // | ------------- | ------------------------------- |
     // | **Ask price** | Someone is selling XRP for USD  |
     // | **Bid price** | Someone is buying XRP using USD |

     // const priceData = await getXrpUsdPriceFromDex(client);
     // if (priceData) {
     //      console.log(`Top Ask Price (sell XRP): ${priceData.topAsk.toFixed(4)} USD`);
     //      console.log(`Avg Ask Price: ${priceData.averageAsk.toFixed(4)} USD`);
     //      console.log(`Top Bid Price (buy XRP): ${priceData.topBid.toFixed(4)} USD`);
     //      console.log(`Avg Bid Price: ${priceData.averageBid.toFixed(4)} USD`);
     // }

     // const issuers = await getActiveUsdIssuers(client);
     // console.log('Active USD issuers:', issuers);

     const rlusdDexData = await getXrpRlusdDexBids(client);
     console.log('RLUSD Bid-side (Someone is buying XRP using RLUSD) Order Book:', rlusdDexData);

     // const rlusdDexAskData = await getXrpRlusdDexAsk(client);
     // console.log('RLUSD Ask-side (Someone is selling XRP for RLUSD) Order Book:', rlusdDexAskData);

     await client.disconnect();
}

main().catch(console.error);
