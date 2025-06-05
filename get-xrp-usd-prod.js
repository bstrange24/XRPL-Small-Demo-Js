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

function formatRlusdBidsOutput(data, currency = 'RLUSD') {
     if (!data || data.offerCount === 0) {
          return `RLUSD Bid-side (Someone is buying XRP using ${currency}) Order Book:\n  No offers available`;
     }

     const { issuer, offerCount, bids, averagePrice, topPrice, pricePerXrp } = data;
     let output = `RLUSD Bid-side (Someone is buying XRP using ${currency}) Order Book:\n`;
     output += `issuer: '${issuer}'\n`;
     output += `offerCount: ${offerCount}\n`;
     output += `bids:\n`;

     bids.forEach(b => {
          output += `\tprice: ${b.price.toFixed(6)} rlusdAmount: ${b.rlusdAmount} xrpAmount: ${b.xrpAmount}\n`;
     });

     output += `averagePrice: ${averagePrice.toFixed(6)}\n`;
     output += `topPrice: ${topPrice.toFixed(6)}\n`;
     output += `pricePerXrp: ${pricePerXrp.toFixed(6)}`;

     return output;
}

function formatRlusdAsksOutput(data, currency = 'RLUSD') {
     if (!data || data.offerCount === 0) {
          return `RLUSD Ask-side (Someone is selling XRP using ${currency}) Order Book:\n  No offers available`;
     }

     const { issuer, offerCount, asks, averagePrice, topPrice, pricePerXrp } = data;
     let output = `RLUSD Ask-side (Someone is selling XRP using ${currency}) Order Book:\n`;
     output += `issuer: '${issuer}'\n`;
     output += `offerCount: ${offerCount}\n`;
     output += `asks:\n`;

     asks.forEach(b => {
          output += `\tprice: ${b.price.toFixed(6)} rlusdAmount: ${b.rlusdAmount} xrpAmount: ${b.xrpAmount}\n`;
     });

     output += `averagePrice: ${averagePrice.toFixed(6)}\n`;
     output += `topPrice: ${topPrice.toFixed(6)}\n`;
     output += `pricePerXrp: ${pricePerXrp.toFixed(6)}`;

     return output;
}

function formatRlusdOutput(data, currency = 'RLUSD', offerType = 'bids') {
     if (!data || data.offerCount === 0) {
          return `RLUSD ${offerType}-side (Someone is selling XRP using ${currency}) Order Book:\n  No offers available`;
     }

     const { issuer, offerCount, asks, averagePrice, topPrice, pricePerXrp } = data;
     // let output = `RLUSD ${offerType}-side (Someone is selling XRP using ${currency}) Order Book:\n`;
     let output = '';
     output += `issuer: '${issuer}'\n`;
     output += `offerCount: ${offerCount}\n`;
     // output += `${offerType}:\n`;

     // asks.forEach(b => {
     // output += `\tprice: ${b.price.toFixed(6)} rlusdAmount: ${b.rlusdAmount} xrpAmount: ${b.xrpAmount}\n`;
     // });

     output += `averagePrice: ${averagePrice.toFixed(6)}\n`;
     output += `topPrice: ${topPrice.toFixed(6)}\n`;
     output += `pricePerXrp: ${pricePerXrp.toFixed(6)}`;

     return output;
}

export async function getXrpRlusdDexBids(client, maxOffers = 5) {
     try {
          const currency = 'RLUSD';
          const currencyHex = encodeCurrencyCode(currency);
          const response = await client.request({
               command: 'book_offers',
               taker_gets: { currency: 'XRP' },
               taker_pays: {
                    currency: currencyHex,
                    issuer: RIPPLE_RLUSD_ISSUER,
               },
               ledger_index: 'current',
               limit: maxOffers,
          });

          const offers = response.result.offers || [];

          if (offers.length === 0) {
               return {
                    issuer: RIPPLE_RLUSD_ISSUER,
                    offerCount: 0,
                    bids: [],
                    averagePrice: null,
                    topPrice: null,
                    pricePerXrp: null,
               };
          }

          const bids = offers.slice(0, maxOffers).map(offer => {
               const xrp = parseFloat(xrpl.dropsToXrp(offer.TakerGets)); // XRP amount (buying XRP)
               const rlusd = parseFloat(offer.TakerPays.value); // RLUSD amount (paying RLUSD)
               const price = xrp / rlusd; // XRP/RLUSD (price of 1 RLUSD in XRP)

               return {
                    price: parseFloat(price.toFixed(6)),
                    rlusdAmount: rlusd,
                    xrpAmount: xrp,
               };
          });

          const averagePrice = bids.reduce((sum, b) => sum + b.price, 0) / bids.length;
          const topPrice = bids[0].price; // Highest bid price (best bid)
          const rlusdPerXrp = 1 / topPrice; // 1 XRP = n RLUSD

          // Log order book for debugging
          // console.log(`Current XRP/${currency} bids:`);
          // bids.forEach(b => console.log(`  Price: ${b.price.toFixed(6)} XRP/${currency}, RLUSD Amount: ${b.rlusdAmount.toFixed(6)}, XRP Amount: ${b.xrpAmount.toFixed(6)}`));
          console.log(`Best XRP/${currency} bid: ${topPrice.toFixed(6)} XRP/${currency} → 1 XRP = ${rlusdPerXrp.toFixed(6)} ${currency}`);

          // Prepare result object
          const result = {
               issuer: RIPPLE_RLUSD_ISSUER,
               offerCount: offers.length,
               bids,
               averagePrice: parseFloat(averagePrice.toFixed(6)),
               topPrice,
               pricePerXrp: parseFloat(rlusdPerXrp.toFixed(2)),
          };

          // Log formatted output
          console.log(formatRlusdOutput(result, currency, 'bids'));

          return result;
     } catch (err) {
          console.error('Full error:', err);
          console.error('Error fetching RLUSD bids from DEX:', err.message);
          return null;
     }
}

export async function getXrpRlusdDexAsk(client, maxOffers = 5) {
     try {
          const currency = 'RLUSD';
          const currencyHex = encodeCurrencyCode(currency);

          // Query RLUSD/XRP order book (asks: sell RLUSD for XRP)
          const response = await client.request({
               command: 'book_offers',
               taker_gets: {
                    currency: currencyHex,
                    issuer: RIPPLE_RLUSD_ISSUER,
               },
               taker_pays: { currency: 'XRP' },
               ledger_index: 'current',
               limit: maxOffers,
          });

          const offers = response.result.offers || [];

          if (offers.length === 0) {
               return {
                    issuer: RIPPLE_RLUSD_ISSUER,
                    offerCount: 0,
                    asks: [],
                    averagePrice: null,
                    topPrice: null,
                    pricePerXrp: null,
               };
          }

          // Parse asks: price in XRP/RLUSD, amounts in RLUSD and XRP
          const asks = offers.slice(0, maxOffers).map(offer => {
               const rlusd = parseFloat(offer.TakerGets.value); // RLUSD amount (selling)
               const xrp = parseFloat(xrpl.dropsToXrp(offer.TakerPays)); // XRP amount (receiving)
               const price = xrp / rlusd; // XRP/RLUSD (price of 1 RLUSD in XRP)

               return {
                    price: parseFloat(price.toFixed(6)),
                    rlusdAmount: rlusd,
                    xrpAmount: xrp,
               };
          });

          // Calculate average and top price
          const averagePrice = asks.reduce((sum, a) => sum + a.price, 0) / asks.length;
          const topPrice = asks[0].price; // Lowest ask price (best ask)
          const rlusdPerXrp = 1 / topPrice; // 1 XRP = n RLUSD

          // Log order book for debugging
          // console.log(`Current ${currency}/XRP asks:`);
          // asks.forEach(a => console.log(`  Price: ${a.price.toFixed(6)} XRP/${currency}, RLUSD Amount: ${a.rlusdAmount.toFixed(6)}, XRP Amount: ${a.xrpAmount.toFixed(6)}`));
          console.log(`Best ${currency}/XRP ask: ${topPrice.toFixed(6)} XRP/${currency} → 1 XRP = ${rlusdPerXrp.toFixed(6)} ${currency}`);

          const result = {
               issuer: RIPPLE_RLUSD_ISSUER,
               offerCount: offers.length,
               asks,
               averagePrice: parseFloat(averagePrice.toFixed(6)),
               topPrice,
               pricePerXrp: parseFloat(rlusdPerXrp.toFixed(2)),
          };

          // Log formatted output
          console.log(formatRlusdOutput(result, currency, 'asks'));

          return result;
     } catch (err) {
          console.error('Full error:', err);
          console.error('Error fetching RLUSD asks from DEX:', err.message);
          return null;
     }
}

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

export async function getActiveUsdIssuers(client, maxOffers = 5) {
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

     await getXrpRlusdDexBids(client);
     // const rlusdDexData = await getXrpRlusdDexBids(client);
     // console.log('RLUSD Bid-side (Someone is buying XRP using RLUSD) Order Book:', rlusdDexData);

     await getXrpRlusdDexAsk(client);
     // const rlusdDexAskData = await getXrpRlusdDexAsk(client);
     // console.log('RLUSD Ask-side (Someone is selling XRP for RLUSD) Order Book:', rlusdDexAskData);

     await client.disconnect();
}

main().catch(console.error);
