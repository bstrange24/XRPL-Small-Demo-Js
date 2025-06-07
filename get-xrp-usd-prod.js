import * as xrpl from 'xrpl';

// const NET = 'wss://s.devnet.rippletest.net:51233/';
const NET = 'wss://s.altnet.rippletest.net:51233/';
// const NET = 'wss://s1.ripple.com';

// const MY_WALLET_ADDRESS = 'rETbLUGdjTo2PScLT5xCUZ8ov7B9zHnRqo'; // RLUSD
const MY_WALLET_ADDRESS = 'rhuaX1t5XP4mSzW5pXSUbpVoqUjadV3HcH'; // DOG

// RLUSD Test net Ripple Issuer
// const RIPPLE_RLUSD_ISSUER = 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV';
// RLUSD Main net Ripple Issuer
// const RIPPLE_RLUSD_ISSUER = 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De';

// const RLUSD_CURRENCY = 'RLUSD';
const RLUSD_AMOUNT = 1;

const RIPPLE_RLUSD_ISSUER = 'rETbLUGdjTo2PScLT5xCUZ8ov7B9zHnRqo';
const RLUSD_CURRENCY = 'DOG';

// const CIRCLE_USDC_ISSUER = 'rMwjYedjc7qqtKYVLiAccJSmCwih4LnE2q'; // CIRCLE_USDC_ISSUER
// const USDC_CURRENCY = 'USDC'; // CIRCLE_USDC_ISSUER

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

export function formatRlusdOutput(data, currency = 'RLUSD', offerType = 'bids') {
     if (!data || data.offerCount === 0) {
          if (offerType === 'bids') {
               return `RLUSD Bid-side (Someone is buying XRP using ${currency}) Order Book:\n  No offers available`;
          }
          return `RLUSD Ask-side (Someone is selling XRP using ${currency}) Order Book:\n  No offers available`;
     }

     let issuer, offerCount, bids, asks, averagePrice, topPrice, pricePerXrp, offerOperation;
     if (offerType === 'bids') {
          offerOperation = 'buying';
          ({ issuer, offerCount, bids, averagePrice, topPrice, pricePerXrp } = data);
     } else {
          offerOperation = 'selling';
          ({ issuer, offerCount, asks, averagePrice, topPrice, pricePerXrp } = data);
     }

     if (offerType === 'bids') {
          console.table(bids, ['price', 'rlusdAmount', 'xrpAmount']);
     } else {
          console.table(asks, ['price', 'rlusdAmount', 'xrpAmount']);
     }

     return '';
}

export async function getXrpRlusdDexBids(client, maxOffers = 10) {
     try {
          let currency;
          if (RLUSD_CURRENCY.length <= 3) {
               currency = RLUSD_CURRENCY;
          } else {
               currency = encodeCurrencyCode(RLUSD_CURRENCY);
          }
          // const currencyHex = encodeCurrencyCode(RLUSD_CURRENCY);
          const response = await client.request({
               command: 'book_offers',
               taker_gets: { currency: 'XRP' },
               taker_pays: {
                    currency: currency,
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

          const bids = filterExtremeOffers(
               offers.slice(0, maxOffers).map(offer => {
                    const xrp = parseFloat(xrpl.dropsToXrp(offer.TakerGets));
                    const rlusd = parseFloat(offer.TakerPays.value);
                    const price = xrp / rlusd;
                    return {
                         price: parseFloat(price.toFixed(6)),
                         rlusdAmount: rlusd,
                         xrpAmount: xrp,
                    };
               })
          );

          // const bids = offers.slice(0, maxOffers).map(offer => {
          //      const xrp = parseFloat(xrpl.dropsToXrp(offer.TakerGets)); // XRP amount (buying XRP)
          //      const rlusd = parseFloat(offer.TakerPays.value); // RLUSD amount (paying RLUSD)
          //      const price = xrp / rlusd; // XRP/RLUSD (price of 1 RLUSD in XRP)

          //      return {
          //           price: parseFloat(price.toFixed(6)),
          //           rlusdAmount: rlusd,
          //           xrpAmount: xrp,
          //      };
          // });

          const averagePrice = bids.reduce((sum, b) => sum + b.price, 0) / bids.length;
          const topPrice = bids[0].price; // Highest bid price (best bid)
          const rlusdPerXrp = 1 / topPrice; // 1 XRP = n RLUSD

          // Log order book for debugging
          console.log(`\nBest XRP/${RLUSD_CURRENCY} bid: ${topPrice.toFixed(6)} XRP/${RLUSD_CURRENCY} → 1 XRP = ${rlusdPerXrp.toFixed(6)} ${RLUSD_CURRENCY}`);
          console.log(`RLUSD Issuer: ${RIPPLE_RLUSD_ISSUER} Offer Count: ${offers.length}`);
          console.log(`RLUSD bids-side (Someone is buying XRP using RLUSD) Order Book:`);

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
          console.log(formatRlusdOutput(result, RLUSD_CURRENCY, 'bids'));

          return result;
     } catch (err) {
          console.error('Full error:', err);
          console.error('Error fetching RLUSD bids from DEX:', err.message);
          return null;
     }
}

export async function getXrpRlusdDexAsk(client, maxOffers = 10) {
     try {
          let currency;
          if (RLUSD_CURRENCY.length <= 3) {
               currency = RLUSD_CURRENCY;
          } else {
               currency = encodeCurrencyCode(RLUSD_CURRENCY);
          }
          // const currencyHex = encodeCurrencyCode(RLUSD_CURRENCY);

          // Query RLUSD/XRP order book (asks: sell RLUSD for XRP)
          const response = await client.request({
               command: 'book_offers',
               taker_gets: {
                    currency: currency,
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
          const asks = filterExtremeOffers(
               offers.slice(0, maxOffers).map(offer => {
                    const rlusd = parseFloat(offer.TakerGets.value);
                    const xrp = parseFloat(xrpl.dropsToXrp(offer.TakerPays));
                    const price = xrp / rlusd;
                    return {
                         price: parseFloat(price.toFixed(6)),
                         rlusdAmount: rlusd,
                         xrpAmount: xrp,
                    };
               })
          );
          // const asks = offers.slice(0, maxOffers).map(offer => {
          //      const rlusd = parseFloat(offer.TakerGets.value); // RLUSD amount (selling)
          //      const xrp = parseFloat(xrpl.dropsToXrp(offer.TakerPays)); // XRP amount (receiving)
          //      const price = xrp / rlusd; // XRP/RLUSD (price of 1 RLUSD in XRP)

          //      return {
          //           price: parseFloat(price.toFixed(6)),
          //           rlusdAmount: rlusd,
          //           xrpAmount: xrp,
          //      };
          // });

          // Calculate average and top price
          const averagePrice = asks.reduce((sum, a) => sum + a.price, 0) / asks.length;
          const topPrice = asks[0].price; // Lowest ask price (best ask)
          const rlusdPerXrp = 1 / topPrice; // 1 XRP = n RLUSD

          // Log order book for debugging
          console.log(`\nBest ${RLUSD_CURRENCY}/XRP ask: ${topPrice.toFixed(6)} XRP/${RLUSD_CURRENCY} → 1 XRP = ${rlusdPerXrp.toFixed(6)} ${RLUSD_CURRENCY}`);
          console.log(`RLUSD Issuer: ${RIPPLE_RLUSD_ISSUER} Offer Count: ${offers.length}`);
          console.log(`RLUSD ask-side (Someone is selling XRP using RLUSD) Order Book:`);

          const result = {
               issuer: RIPPLE_RLUSD_ISSUER,
               offerCount: offers.length,
               asks,
               averagePrice: parseFloat(averagePrice.toFixed(6)),
               topPrice,
               pricePerXrp: parseFloat(rlusdPerXrp.toFixed(2)),
          };

          // Log formatted output
          console.log(formatRlusdOutput(result, RLUSD_CURRENCY, 'asks'));

          return result;
     } catch (err) {
          console.error('Full error:', err);
          console.error('Error fetching RLUSD asks from DEX:', err.message);
          return null;
     }
}

export async function getXrpUsdPriceFromDex(client, maxOffers = 10) {
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

export async function getXrpRlusdDexBids1(client, maxOffers = 10) {
     try {
          let currency;
          if (RLUSD_CURRENCY.length <= 3) {
               currency = RLUSD_CURRENCY;
          } else {
               currency = encodeCurrencyCode(RLUSD_CURRENCY);
          }
          // const currencyHex = encodeCurrencyCode(currency);

          const response = await client.request({
               command: 'book_offers',
               taker_gets: { currency: 'XRP' },
               taker_pays: {
                    currency: currency,
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

          const bids = filterExtremeOffers(
               offers.slice(0, maxOffers).map(offer => {
                    const xrp = parseFloat(xrpl.dropsToXrp(offer.TakerGets));
                    const rlusd = parseFloat(offer.TakerPays.value);
                    const price = xrp / rlusd;
                    return {
                         price: parseFloat(price.toFixed(6)),
                         rlusdAmount: rlusd,
                         xrpAmount: xrp,
                    };
               })
          );

          // const bids = offers.slice(0, maxOffers).map(offer => {
          //      const xrp = parseFloat(xrpl.dropsToXrp(offer.TakerGets));
          //      const rlusd = parseFloat(offer.TakerPays.value);
          //      const price = xrp / rlusd;

          //      return {
          //           price: parseFloat(price.toFixed(6)),
          //           rlusdAmount: rlusd,
          //           xrpAmount: xrp,
          //      };
          // });

          const averagePrice = bids.reduce((sum, b) => sum + b.price, 0) / bids.length;
          const topPrice = bids[0].price;
          const rlusdPerXrp = 1 / topPrice;

          return {
               issuer: RIPPLE_RLUSD_ISSUER,
               offerCount: offers.length,
               bids,
               averagePrice: parseFloat(averagePrice.toFixed(6)),
               topPrice,
               pricePerXrp: parseFloat(rlusdPerXrp.toFixed(2)),
          };
     } catch (err) {
          console.error('Full error:', err);
          console.error('Error fetching RLUSD bids from DEX:', err.message);
          return null;
     }
}

export async function getXrpRlusdDexAsks1(client, maxOffers = 10) {
     try {
          let currency;
          if (RLUSD_CURRENCY.length <= 3) {
               currency = RLUSD_CURRENCY;
          } else {
               currency = encodeCurrencyCode(RLUSD_CURRENCY);
          }
          // const currencyHex = encodeCurrencyCode(currency);

          // Query RLUSD/XRP order book (asks: sell RLUSD for XRP)
          const response = await client.request({
               command: 'book_offers',
               taker_gets: {
                    currency: currency,
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
          const asks = filterExtremeOffers(
               offers.slice(0, maxOffers).map(offer => {
                    const rlusd = parseFloat(offer.TakerGets.value);
                    const xrp = parseFloat(xrpl.dropsToXrp(offer.TakerPays));
                    const price = xrp / rlusd;
                    return {
                         price: parseFloat(price.toFixed(6)),
                         rlusdAmount: rlusd,
                         xrpAmount: xrp,
                    };
               })
          );
          // const asks = offers.slice(0, maxOffers).map(offer => {
          //      const rlusd = parseFloat(offer.TakerGets.value); // RLUSD amount (selling)
          //      const xrp = parseFloat(xrpl.dropsToXrp(offer.TakerPays)); // XRP amount (receiving)
          //      const price = xrp / rlusd; // XRP/RLUSD (price of 1 RLUSD in XRP)

          //      return {
          //           price: parseFloat(price.toFixed(6)),
          //           rlusdAmount: rlusd,
          //           xrpAmount: xrp,
          //      };
          // });

          // Calculate average and top price
          const averagePrice = asks.reduce((sum, a) => sum + a.price, 0) / asks.length;
          const topPrice = asks[0].price; // Lowest ask price (best ask)
          const rlusdPerXrp = 1 / topPrice; // 1 XRP = n RLUSD

          // Log order book for debugging
          // console.log(`Current ${currency}/XRP asks:`);
          // asks.forEach(a => console.log(`  Price: ${a.price.toFixed(6)} XRP/${currency}, RLUSD Amount: ${a.rlusdAmount.toFixed(6)}, XRP Amount: ${a.xrpAmount.toFixed(6)}`));
          // console.log(`Best ${currency}/XRP ask: ${topPrice.toFixed(6)} XRP/${currency} → 1 XRP = ${rlusdPerXrp.toFixed(2)} ${currency}`);

          return {
               issuer: RIPPLE_RLUSD_ISSUER,
               offerCount: offers.length,
               asks,
               averagePrice: parseFloat(averagePrice.toFixed(6)),
               topPrice,
               pricePerXrp: parseFloat(rlusdPerXrp.toFixed(2)),
          };
     } catch (err) {
          console.error('Full error:', err);
          console.error('Error fetching RLUSD asks from DEX:', err.message);
          return null;
     }
}

// Estimate profit/loss for a trade
async function estimateTradeProfit(client, tradeParams) {
     const {
          tradeType = 'buy', // 'buy', 'sell', or 'round-trip'
          rlusdAmount = 1, // RLUSD amount to trade
          immediate = true, // Immediate (market) or limit order
          slippageTolerance = 0.01, // 1% slippage allowance
          maxPrice = 1000, // Max XRP/RLUSD price to prevent outliers
          minLiquidity = 1000, // Minimum RLUSD liquidity
          maxSpreadPercent = 10, // Max spread as % of ask price
          currency = RLUSD_CURRENCY,
          issuer = RIPPLE_RLUSD_ISSUER,
     } = tradeParams;

     try {
          // Fetch current transaction fee
          const serverState = await client.request({ command: 'server_state' });
          const baseFeeXrp = parseFloat(serverState.result.state.validated_ledger.base_fee);
          const baseFeeDrops = xrpl.xrpToDrops(baseFeeXrp);
          const loadFactor = serverState.result.state.load_factor;
          const loadFactorMultiplier = loadFactor / 1_000_000;
          const adjustedFeeXrp = baseFeeXrp * loadFactorMultiplier;
          const adjustedFeeDrops = xrpl.xrpToDrops(Number(adjustedFeeXrp.toFixed(6)));
          console.log(`Server State base_fee (XRP): ${baseFeeXrp}`);
          console.log(`Server State base_fee (drops): ${baseFeeDrops}`);
          console.log(`Server State base_fee (XRP) with load factor: ${adjustedFeeXrp}`);
          console.log(`Server State base_fee (drops) with load factor: ${adjustedFeeDrops}`);

          let transactionFeeXrp = adjustedFeeDrops;
          transactionFeeXrp = Math.min(transactionFeeXrp, 0.000012); // Cap fee

          // Fetch order book data
          const bidsData = await getXrpRlusdDexBids1(client, 10);
          const asksData = await getXrpRlusdDexAsks1(client, 10);

          if (!bidsData || !asksData || bidsData.offerCount === 0 || asksData.offerCount === 0) {
               throw new Error('Empty order book or fetch failed');
          }

          // Get best prices
          const bestBidPrice = bidsData.topPrice; // XRP/RLUSD (sell RLUSD)
          const bestAskPrice = asksData.topPrice; // XRP/RLUSD (buy RLUSD)

          // Validate price
          if (bestAskPrice > maxPrice) {
               throw new Error(`Ask price too high: ${bestAskPrice} XRP/${RLUSD_CURRENCY} exceeds max ${maxPrice}`);
          }

          // Calculate effective prices
          const effectiveBuyPrice = immediate ? bestAskPrice * (1 + slippageTolerance) : bestAskPrice;
          const effectiveSellPrice = immediate ? bestBidPrice * (1 - slippageTolerance) : bestBidPrice;

          const slippageTotal = 1 + slippageTolerance;
          console.log(`Effective prices with slippage tolerance of ${slippageTotal}%`);
          console.log(`Best Ask Price: ${bestAskPrice}`);
          console.log(`Best Bid Price: ${bestBidPrice}`);
          console.log(`Slippage fee: ${(bestAskPrice * (1 + slippageTolerance) - bestAskPrice).toFixed(6)}`);

          // Check spread
          const spread = bestAskPrice - bestBidPrice;
          const spreadPercent = (spread / bestAskPrice) * 100;
          if (spreadPercent > maxSpreadPercent) {
               console.warn(`Warning: High spread (${spreadPercent.toFixed(1)}% > ${maxSpreadPercent}%)`);
          }

          // Check liquidity
          const availableBuyLiquidity = asksData.asks.reduce((sum, a) => sum + a.rlusdAmount, 0);
          const availableSellLiquidity = bidsData.bids.reduce((sum, b) => sum + b.rlusdAmount, 0);
          if (rlusdAmount > availableBuyLiquidity || (tradeType === 'round-trip' && rlusdAmount > availableSellLiquidity)) {
               throw new Error(`Insufficient liquidity: need ${rlusdAmount} ${RLUSD_CURRENCY}, buy: ${availableBuyLiquidity}, sell: ${availableSellLiquidity}`);
          }
          if (availableBuyLiquidity < minLiquidity || availableSellLiquidity < minLiquidity) {
               console.warn(`Warning: Low liquidity (buy: ${availableBuyLiquidity.toFixed(6)}, sell: ${availableSellLiquidity.toFixed(6)}) < ${minLiquidity} ${RLUSD_CURRENCY}`);
          }

          // Fetch wallet balance
          const accountInfo = await client.request({
               command: 'account_info',
               account: MY_WALLET_ADDRESS,
               ledger_index: 'current',
          });
          const xrpBalance = parseFloat(xrpl.dropsToXrp(accountInfo.result.account_data.Balance));
          const rlusdBalance = await getRlusdBalance(client, MY_WALLET_ADDRESS, RIPPLE_RLUSD_ISSUER); // rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV

          // Calculate costs and proceeds
          let xrpSpent = 0;
          let xrpReceived = 0;
          let feesXrp = transactionFeeXrp;

          if (tradeType === 'buy' || tradeType === 'round-trip') {
               xrpSpent = rlusdAmount * effectiveBuyPrice;
               if (xrpSpent + feesXrp > xrpBalance) {
                    throw new Error(`Insufficient XRP balance: need ${xrpSpent + feesXrp}, have ${xrpBalance}`);
               }
          }

          if (tradeType === 'sell' || tradeType === 'round-trip') {
               xrpReceived = rlusdAmount * effectiveSellPrice;
               if (rlusdAmount > rlusdBalance) {
                    throw new Error(`Insufficient ${RLUSD_CURRENCY} balance: need ${rlusdAmount}, have ${rlusdBalance}`);
               }
               if (tradeType === 'round-trip') {
                    feesXrp += transactionFeeXrp;
               }
          }

          // Calculate net RLUSD amounts
          const rlusdFees = await getRlusdTransferFee(client, RIPPLE_RLUSD_ISSUER);
          let netRlusdReceived = 0;
          let netRlusdSpent = 0;
          if (tradeType === 'buy') {
               netRlusdReceived = rlusdAmount; // Receive RLUSD
               netRlusdSpent = 0; // Spend XRP
          } else if (tradeType === 'sell') {
               netRlusdReceived = 0; // Receive XRP
               netRlusdSpent = rlusdAmount; // Spend RLUSD
          } else if (tradeType === 'round-trip') {
               netRlusdReceived = rlusdAmount; // Receive on buy
               netRlusdSpent = rlusdAmount; // Spend on sell
          }

          // Calculate profit/loss
          let profitXrp = 0;
          if (tradeType === 'round-trip') {
               profitXrp = xrpReceived - xrpSpent - feesXrp;
          } else if (tradeType === 'buy') {
               profitXrp = -xrpSpent - feesXrp;
          } else if (tradeType === 'sell') {
               profitXrp = xrpReceived - feesXrp;
          }

          // Break-even price for buy trade
          const breakEvenPrice = tradeType === 'buy' ? (xrpSpent + feesXrp) / rlusdAmount : null;

          // Result
          const result = {
               tradeType,
               rlusdAmount,
               buyPrice: tradeType === 'buy' || tradeType === 'round-trip' ? effectiveBuyPrice : null,
               sellPrice: tradeType === 'sell' || tradeType === 'round-trip' ? effectiveSellPrice : null,
               xrpSpent,
               xrpReceived,
               feesXrp,
               rlusdFees,
               netRlusdReceived,
               netRlusdSpent,
               profitXrp,
               isProfitable: profitXrp > 0,
               marketSpread: spread,
               liquidity: { buy: availableBuyLiquidity, sell: availableSellLiquidity },
               breakEvenPrice,
          };

          // Log formatted result
          console.log(formatProfitResult(result, RLUSD_CURRENCY));
          return result;
     } catch (err) {
          console.error('Error estimating trade profit:', err.message);
          return null;
     }
}

// Helper: Fetch RLUSD balance
async function getRlusdBalance(client, account, issuer) {
     const lines = await client.request({
          command: 'account_lines',
          account: account,
          ledger_index: 'current',
     });

     let currency;
     let rlusdLine;
     if (RLUSD_CURRENCY.length > 3) {
          currency = encodeCurrencyCode(RLUSD_CURRENCY);
          rlusdLine = lines.result.lines.find(line => line.currency === currency && line.account === issuer);
     } else {
          rlusdLine = lines.result.lines.find(line => line.currency === RLUSD_CURRENCY && line.account === issuer);
     }

     return rlusdLine ? parseFloat(rlusdLine.balance) : 0;
}

// Helper: Fetch RLUSD transfer fee
async function getRlusdTransferFee(client, issuer) {
     const accountInfo = await client.request({
          command: 'account_info',
          account: issuer,
          ledger_index: 'current',
     });
     return accountInfo.result.account_data.TransferRate ? (accountInfo.result.account_data.TransferRate - 1_000_000_000) / 10_000_000 : 0; // Percentage (e.g., 1% = 1)
}

// Format profit result
function formatProfitResult(data, currency = 'RLUSD') {
     const { tradeType, rlusdAmount, buyPrice, sellPrice, xrpSpent, xrpReceived, feesXrp, rlusdFees, netRlusdReceived, netRlusdSpent, profitXrp, isProfitable, marketSpread, liquidity, breakEvenPrice } = data;

     let output = `Trade Profitability Analysis (${tradeType.toUpperCase()}):\n`;
     output += ` Currency Pair: ${currency}/XRP\n`;
     output += ` Trade Amount: ${rlusdAmount.toFixed(6)} ${currency}\n`;
     if (buyPrice) {
          output += ` Buy Price: ${buyPrice.toFixed(6)} XRP/${currency}`;
          if (buyPrice != null) {
               output += ` in drops: ${xrpl.xrpToDrops(buyPrice.toFixed(8))}\n`;
          } else {
               output += `\n`;
          }
     } else {
          output += ` Buy Price: 0 XRP/${currency}\n`;
     }
     if (sellPrice) {
          output += ` Sell Price: ${sellPrice.toFixed(6)} XRP/${currency}`;
          if (sellPrice != null) {
               output += ` in drops: ${xrpl.xrpToDrops(sellPrice.toFixed(8))}\n`;
          } else {
               output += `\n`;
          }
     } else {
          output += ` Sell Price: 0 XRP/${currency}\n`;
     }
     output += ` XRP Spent: ${xrpSpent.toFixed(6)} XRP\n`;
     output += ` XRP Received: ${xrpReceived.toFixed(6)} XRP\n`;
     output += ` Transaction Fees: ${feesXrp.toFixed(6)} XRP\n`;
     output += ` ${currency} Transfer Fees: ${rlusdFees.toFixed(6)} ${currency}\n`;
     output += ` Net ${currency} Received: ${netRlusdReceived.toFixed(6)} ${currency}\n`;
     output += ` Net ${currency} Spent: ${netRlusdSpent.toFixed(6)} ${currency}\n`;
     output += ` Profit/Loss: ${profitXrp.toFixed(6)} XRP (${isProfitable ? 'Profitable' : 'Loss'})\n`;
     if (breakEvenPrice) output += ` Break-Even Sell Price: ${breakEvenPrice.toFixed(6)} XRP/${currency}\n`;
     output += ` Market Spread: ${marketSpread.toFixed(6)} XRP/${currency}\n`;
     output += ` Liquidity: Buy ${liquidity.buy.toFixed(6)} ${currency}, Sell ${liquidity.sell.toFixed(6)} ${currency}`;

     return output;
}

function filterExtremeOffers(offers, priceKey = 'price', threshold = 5) {
     if (!offers.length) return offers;
     // Calculate median price
     const sorted = [...offers].sort((a, b) => a[priceKey] - b[priceKey]);
     const mid = Math.floor(sorted.length / 2);
     const median = sorted.length % 2 !== 0 ? sorted[mid][priceKey] : (sorted[mid - 1][priceKey] + sorted[mid][priceKey]) / 2;

     // Filter out offers with price > threshold * median or < median / threshold
     return offers.filter(o => o[priceKey] <= median * threshold && o[priceKey] >= median / threshold);
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
     //      console.log(`Total Ask Count: ${priceData.askCount.toFixed(4)} USD`);
     //      console.log(`Total Bid Count: ${priceData.bidCount.toFixed(4)} USD`);
     // }

     // const issuers = await getActiveUsdIssuers(client);
     // console.log('Active USD issuers:', issuers);

     // const rlusdDexData = await getXrpRlusdDexBids(client);
     // const rlusdDexAskData = await getXrpRlusdDexAsk(client);

     // Allowed trade types
     const allowedTypes = ['buy', 'sell', 'round-trip'];

     // 'buy', 'sell', or 'round-trip'
     const args = process.argv.slice(2);

     // Show usage if no argument or too many arguments
     if (args.length !== 1 || !allowedTypes.includes(args[0].toLowerCase())) {
          console.log('Usage: node get-xrp-usd-prod.js <tradeType>');
          console.log('  <tradeType> must be one of: buy, sell, round-trip');
          process.exit(1);
     }

     const tradeType = args[0].toLowerCase();

     if (tradeType === 'round-trip') {
          await getXrpRlusdDexBids(client);
          await getXrpRlusdDexAsk(client);
     } else if (tradeType === 'buy') {
          await getXrpRlusdDexAsk(client);
     } else if (tradeType === 'sell') {
          await getXrpRlusdDexBids(client);
     }

     const tradeParams = {
          tradeType: tradeType,
          rlusdAmount: RLUSD_AMOUNT,
          MY_WALLET_ADDRESS,
          immediate: true,
          slippageTolerance: 0.01,
          transactionFeeXrp: 0.000012,
          maxPrice: 1000, // Max XRP/RLUSD price to prevent outliers
          minLiquidity: 1000, // Minimum RLUSD liquidity
          maxSpreadPercent: 10, // Max spread as % of ask price
     };

     const result = await estimateTradeProfit(client, tradeParams);
     console.log(result);

     await client.disconnect();
}

main().catch(console.error);
