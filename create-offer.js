import * as xrpl from 'xrpl';
import { getClient, disconnectClient, validatInput, getEnvironment, populate1, populate2, populate3, populateTakerGetsTakerPayFields, parseOffersTransactionDetails, parseTransactionDetails, getNet, amt_str, getOnlyTokenBalance, getCurrentLedger, parseXRPLAccountObjects, displayAccountObjects, setError } from './utils.js';
import { fetchAccountObjects, getTrustLines } from './account.js';
import { getTokenBalance } from './main.js';
import BigNumber from 'bignumber.js';

async function createOffer() {
     console.log('Entering createOffer');

     // Clear previous error styling
     resultField.classList.remove('error');
     resultField.classList.remove('success');

     let we_want;
     let takerGetsString;
     let we_spend;
     let takerPaysString;

     const accountNameField = document.getElementById('accountNameField');
     const accountAddressField = document.getElementById('accountAddressField');
     const accountSeedField = document.getElementById('accountSeedField');
     const xrpBalanceField = document.getElementById('xrpBalanceField');
     const weWantCurrencyField = document.getElementById('weWantCurrencyField');
     const weSpendCurrencyField = document.getElementById('weSpendCurrencyField');
     const weWantIssuerField = document.getElementById('weWantIssuerField');
     const weSpendIssuerField = document.getElementById('weSpendIssuerField');
     const weWantAmountField = document.getElementById('weWantAmountField');
     const weSpendAmountField = document.getElementById('weSpendAmountField');

     if (!accountNameField || !accountAddressField || !accountSeedField || !xrpBalanceField || !weWantCurrencyField || !weSpendCurrencyField || !weWantIssuerField || !weSpendIssuerField || !weWantAmountField || !weSpendAmountField) {
          resultField.value = 'ERROR: DOM elements not found';
          resultField.classList.add('error');
          return;
     }

     if (!validatInput(accountAddressField.value)) {
          resultField.value = 'ERROR: Account Address can not be empty';
          resultField.classList.add('error');
          return;
     }

     if (!validatInput(accountSeedField.value)) {
          resultField.value = 'ERROR: Account seed amount can not be empty';
          resultField.classList.add('error');
          return;
     }

     if (!validatInput(xrpBalanceField.value)) {
          resultField.value = 'ERROR: XRP amount can not be empty';
          resultField.classList.add('error');
          return;
     }

     if (!validatInput(weWantCurrencyField.value)) {
          resultField.value = 'ERROR: Taker Pays currency can not be empty';
          resultField.classList.add('error');
          return;
     }

     if (!validatInput(weSpendCurrencyField.value)) {
          resultField.value = 'ERROR: Taker Gets currency can not be empty';
          resultField.classList.add('error');
          return;
     }

     if (!validatInput(weWantAmountField.value)) {
          resultField.value = 'ERROR: Pay amount can not be empty';
          resultField.classList.add('error');
          return;
     }

     if (!validatInput(weSpendAmountField.value)) {
          resultField.value = 'ERROR: Get amount can not be empty';
          resultField.classList.add('error');
          return;
     }

     const { net, environment } = getNet();
     const client = await getClient();

     try {
          let results = `Connected to ${environment} ${net}.\nCreating Offer.\n\n`;
          const wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'secp256k1' });
          results += accountNameField.value + ' account address: ' + wallet.address + '\n';
          resultField.value = results;

          const doesTrustLinesExists = await getTrustLines(wallet.address, client);
          if (doesTrustLinesExists.length <= 0) {
               // Ensure trustline exists. If not, get trust line from A1 to hotwallet
               let issuerAddr;
               let issuerCur;
               if (weWantIssuerField.value === 'XRP' || weWantIssuerField.value === '') {
                    issuerAddr = weSpendIssuerField.value;
               } else {
                    issuerAddr = weWantIssuerField.value;
               }

               if (weWantCurrencyField.value === 'XRP') {
                    issuerCur = weSpendCurrencyField.value;
               } else {
                    issuerCur = weWantCurrencyField.value;
               }

               const current_ledger = await getCurrentLedger(client);

               try {
                    const trustSetTx = {
                         TransactionType: 'TrustSet',
                         Account: wallet.address,
                         LimitAmount: {
                              currency: issuerCur,
                              issuer: issuerAddr,
                              value: '1000000',
                         },
                         LastLedgerSequence: current_ledger + 50, // Add buffer for transaction processing
                    };

                    console.debug(`trustSetTx ${trustSetTx}`);
                    const ts_prepared = await client.autofill(trustSetTx);
                    console.debug(`ts_prepared ${ts_prepared}`);
                    const ts_signed = wallet.sign(ts_prepared);
                    console.debug(`ts_signed ${ts_signed}`);
                    const tx = await client.submitAndWait(ts_signed.tx_blob);
                    console.debug(`tx ${tx}`);

                    if (tx.result.meta.TransactionResult == 'tesSUCCESS') {
                         results += 'Trustline established between account ' + wallet.address + ' and issuer ' + issuerAddr + ' for ' + issuerCur + ' with amount ' + amountValue.value;
                    } else {
                         throw new Error(`Unable to create trustLine from ${wallet.address} to ${issuerAddr} \nTransaction failed: ${tx.result.meta.TransactionResult}`);
                    }
               } catch (error) {
                    throw new Error(error);
               }
               console.log('Trustline set.');
          } else {
               console.log(`Trustines already exist`);
          }

          const xrpBalance = await getXrpBalance();
          console.log(`XRP Balance ${xrpBalance} (drops): ${xrpl.xrpToDrops(xrpBalance)}`);
          resultField.value += `Initial XRP Balance ${xrpBalance} (drops): ${xrpl.xrpToDrops(xrpBalance)}`;

          let tokenBalance;
          if (weSpendCurrencyField.value === 'XRP' || weSpendCurrencyField.value === '') {
               tokenBalance = weWantCurrencyField.value;
          } else {
               tokenBalance = weSpendCurrencyField.value;
          }

          const tstBalance = await getOnlyTokenBalance(client, wallet.address, tokenBalance);
          console.log(`${tokenBalance} Balance: ${tstBalance}`);
          resultField.value += `\nInital ${tokenBalance} Balance: ${tstBalance}\n\n`;

          if (weWantCurrencyField.value == 'XRP') {
               takerGetsString = '{"currency": "' + weWantCurrencyField.value + '",\n' + '"value": "' + weWantAmountField.value + '"}';
               we_want = JSON.parse(takerGetsString);
          } else {
               takerGetsString = '{"currency": "' + weWantCurrencyField.value + '",\n' + '"issuer": "' + weWantIssuerField.value + '",\n' + '"value": "' + weWantAmountField.value + '"}';
               we_want = JSON.parse(takerGetsString);
          }

          if (weSpendCurrencyField.value == 'XRP') {
               takerPaysString = '{"currency": "' + weSpendCurrencyField.value + '",\n' + '"value": "' + weSpendAmountField.value + '"}';
               we_spend = JSON.parse(takerPaysString);

               if (xrpl.xrpToDrops(xrpBalance) < weWantAmountField.value) {
                    throw new Error('Insufficient XRP to fund the buy offer');
               }
          } else {
               takerPaysString = '{"currency": "' + weSpendCurrencyField.value + '",\n' + '"issuer": "' + weSpendIssuerField.value + '",\n' + '"value": "' + weSpendAmountField.value + '"}';
               we_spend = JSON.parse(takerPaysString);

               if (tstBalance < weSpendAmountField.value) {
                    throw new Error(`Insufficient ${weSpendCurrencyField.value} balance`);
               }
          }
          console.log(`we_want ${we_want}`);
          console.log(`we_spend ${we_spend}`);

          // "Quality" is defined as TakerPays / TakerGets. The lower the "quality"
          // number, the better the proposed exchange rate is for the taker.
          // The quality is rounded to a number of significant digits based on the
          // issuer's TickSize value (or the lesser of the two for token-token trades.)
          const proposed_quality = BigNumber(weSpendAmountField.value) / BigNumber(weWantAmountField.value);

          // Look up Offers. -----------------------------------------------------------
          // To buy TST, look up Offers where "TakerGets" is TST:
          const orderbook_resp = await client.request({
               method: 'book_offers',
               taker: wallet.address,
               ledger_index: 'current',
               taker_gets: we_want,
               taker_pays: we_spend,
          });
          console.log(`orderbook_resp: ${orderbook_resp.result}`);

          // Estimate whether a proposed Offer would execute immediately, and...
          // If so, how much of it? (Partial execution is possible)
          // If not, how much liquidity is above it? (How deep in the order book would
          //    other Offers have to go before ours would get taken?)
          // Note: These estimates can be thrown off by rounding if the token issuer
          // uses a TickSize setting other than the default (15). In that case, you
          // can increase the TakerGets amount of your final Offer to compensate.

          const offers = orderbook_resp.result.offers;
          const want_amt = BigNumber(we_want.value);
          let running_total = BigNumber(0);
          if (!offers) {
               console.log(`No Offers in the matching book. Offer probably won't execute immediately.`);
          } else {
               for (const o of offers) {
                    if (o.quality <= proposed_quality) {
                         console.log(`Matching Offer found, funded with ${o.owner_funds} ${we_want.currency}`);
                         running_total = running_total.plus(BigNumber(o.owner_funds));
                         if (running_total >= want_amt) {
                              console.log('Full Offer will probably fill');
                              break;
                         }
                    } else {
                         // Offers are in ascending quality order, so no others after this
                         // will match, either
                         console.log(`Remaining orders too expensive.`);
                         break;
                    }
               }

               console.log(`Total matched: ${Math.min(running_total, want_amt)} ${we_want.currency}`);
               if (running_total > 0 && running_total < want_amt) {
                    console.log(`Remaining ${want_amt - running_total} ${we_want.currency} would probably be placed on top of the order book.`);
               }
          }

          if (running_total == 0) {
               // If part of the Offer was expected to cross, then the rest would be placed
               // at the top of the order book. If none did, then there might be other
               // Offers going the same direction as ours already on the books with an
               // equal or better rate. This code counts how much liquidity is likely to be
               // above ours.

               // Unlike above, this time we check for Offers going the same direction as
               // ours, so TakerGets and TakerPays are reversed from the previous
               // book_offers request.
               const orderbook2_resp = await client.request({
                    method: 'book_offers',
                    taker: wallet.address,
                    ledger_index: 'current',
                    taker_gets: we_spend,
                    taker_pays: we_want,
               });
               console.log(JSON.stringify(orderbook2_resp.result, null, 2));

               // Since TakerGets/TakerPays are reversed, the quality is the inverse.
               // You could also calculate this as 1/proposed_quality.
               const offered_quality = BigNumber(we_want.value) / BigNumber(we_spend.value);

               const offers2 = orderbook2_resp.result.offers;
               let tally_currency = we_spend.currency;
               if (tally_currency == 'XRP') {
                    tally_currency = 'drops of XRP';
               }
               let running_total2 = BigNumber(0);
               if (!offers2) {
                    console.log(`No similar Offers in the book. Ours would be the first.`);
               } else {
                    for (const o of offers2) {
                         if (o.quality <= offered_quality) {
                              console.log(`Existing offer found, funded with ${o.owner_funds} ${tally_currency}`);
                              running_total2 = running_total2.plus(BigNumber(o.owner_funds));
                         } else {
                              console.log(`Remaining orders are below where ours would be placed.`);
                              break;
                         }
                    }

                    console.log(`Our Offer would be placed below at least ${running_total2} ${tally_currency}`);

                    if (running_total > 0 && running_total < want_amt) {
                         console.log(`Remaining ${want_amt - running_total} ${tally_currency} will probably be placed on top of the order book.`);
                    }
               }
          }

          let prepared;
          if (we_spend.currency === 'XRP') {
               prepared = await client.autofill({
                    TransactionType: 'OfferCreate',
                    Account: wallet.address,
                    TakerGets: we_spend.value,
                    TakerPays: we_want,
               });
          } else {
               prepared = await client.autofill({
                    TransactionType: 'OfferCreate',
                    Account: wallet.address,
                    TakerGets: we_spend,
                    TakerPays: we_want.value,
               });
          }

          console.debug(`prepared ${prepared}`);

          const signed = wallet.sign(prepared);
          results += '\nSubmitting transaction';
          const tx = await client.submitAndWait(signed.tx_blob);
          console.debug(`create offer tx ${tx}`);

          if (tx.result.meta.TransactionResult == 'tesSUCCESS') {
               console.log(`Transaction succeeded: https://testnet.xrpl.org/transactions/${signed.hash}`);
               resultField.value += `Transaction succeeded: https://testnet.xrpl.org/transactions/${signed.hash}\n`;
               resultField.value += parseTransactionDetails(tx.result);
               resultField.classList.add('success');
          } else {
               const errorResults = `Error sending transaction: ${tx.result.meta.TransactionResult}`;
               resultField.value += errorResults;
               resultField.classList.add('error');
          }

          xrpBalanceField.value = await client.getXrpBalance(wallet.address);

          // Check metadata ------------------------------------------------------------
          // In JavaScript, you can use getBalanceChanges() to help summarize all the
          // balance changes caused by a transaction.
          const balance_changes = xrpl.getBalanceChanges(tx.result.meta);
          console.log('Total balance changes:', JSON.stringify(balance_changes, null, 2));

          let offers_affected = 0;
          for (const affnode of tx.result.meta.AffectedNodes) {
               if (affnode.hasOwnProperty('ModifiedNode')) {
                    if (affnode.ModifiedNode.LedgerEntryType == 'Offer') {
                         // Usually a ModifiedNode of type Offer indicates a previous Offer that
                         // was partially consumed by this one.
                         offers_affected += 1;
                    }
               } else if (affnode.hasOwnProperty('DeletedNode')) {
                    if (affnode.DeletedNode.LedgerEntryType == 'Offer') {
                         // The removed Offer may have been fully consumed, or it may have been
                         // found to be expired or unfunded.
                         offers_affected += 1;
                    }
               } else if (affnode.hasOwnProperty('CreatedNode')) {
                    if (affnode.CreatedNode.LedgerEntryType == 'RippleState') {
                         console.log('Created a trust line.');
                    } else if (affnode.CreatedNode.LedgerEntryType == 'Offer') {
                         const offer = affnode.CreatedNode.NewFields;
                         console.log(`Created an Offer owned by ${offer.Account} with
                         TakerGets=${amt_str(offer.TakerGets)} and
                         TakerPays=${amt_str(offer.TakerPays)}.`);
                    }
               }
          }
          console.log(`Modified or removed ${offers_affected} matching Offer(s)`);

          // Check balances ------------------------------------------------------------
          console.log('Getting address balances as of validated ledger');
          const balances = await client.request({
               command: 'account_lines',
               account: wallet.address,
               ledger_index: 'validated',
               // You could also use ledger_index: "current" to get pending data
          });
          console.log(JSON.stringify(balances.result, null, 2));

          // Check Offers --------------------------------------------------------------
          console.log(`Getting outstanding Offers from ${wallet.address} as of validated ledger`);
          const acct_offers = await client.request({
               command: 'account_offers',
               account: wallet.address,
               ledger_index: 'validated',
          });
          console.log(JSON.stringify(acct_offers.result, null, 2));

          const updatedBalance = await getOnlyTokenBalance(client, wallet.address, tokenBalance);
          console.log(`\n${tokenBalance} Updated Balance: ${updatedBalance}`);
          resultField.value += `\n${tokenBalance} Updated Balance: ${updatedBalance}\n`;

          const finalXrpBalance = await client.getXrpBalance(wallet.address);
          console.log(`Final XRP Balance: ${finalXrpBalance}`);
          resultField.value += `Final XRP Balance: ${finalXrpBalance}\n`;

          if (weWantCurrencyField.value === 'XRP') {
               document.getElementById('weWantTokenBalanceField').value = finalXrpBalance;
               document.getElementById('weSpendTokenBalanceField').value = updatedBalance;
          } else {
               document.getElementById('weWantTokenBalanceField').value = updatedBalance;
               document.getElementById('weSpendTokenBalanceField').value = finalXrpBalance;
          }
     } catch (error) {
          console.error('Error:', error);
          resultField.value = 'ERROR: ' + error.message || 'Unknown error';
          resultField.classList.add('error');
          await disconnectClient();
     } finally {
          console.log('Leaving createOffer');
     }
}

async function getOffers() {
     console.log('Entering getOffers');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const accountSeedField = document.getElementById('accountSeedField');
     const xrpBalanceField = document.getElementById('xrpBalanceField');

     if (!accountSeedField || !xrpBalanceField) {
          return setError('ERROR: DOM elements not found');
     }

     const seed = accountSeedField.value.trim();
     if (!validatInput(seed)) return setError('ERROR: Seed cannot be empty');

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\n*** Getting Offers ***.\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed, { algorithm: 'secp256k1' });

          const offers = await client.request({
               method: 'account_offers',
               account: wallet.address,
               ledger_index: 'validated',
          });

          console.log('offers:', offers);

          const details = parseXRPLAccountObjects(offers.result);
          results += displayAccountObjects(details);
          resultField.value = results;
          resultField.classList.add('success');

          xrpBalanceField.value = await client.getXrpBalance(wallet.address);
     } catch (error) {
          console.error('Error:', error);
          setError('ERROR: ' + (error.message || 'Unknown error'));
          await disconnectClient();
     } finally {
          console.log('Leaving getOffers');
     }
}

async function cancelOffer() {
     console.log('Entering cancelOffer');

     // Clear previous error styling
     resultField.classList.remove('error');
     resultField.classList.remove('success');

     const accountSeedField = document.getElementById('accountSeedField');
     const xrpBalanceField = document.getElementById('xrpBalanceField');
     const offerSequenceField = document.getElementById('offerSequenceField');

     if (!accountSeedField || !xrpBalanceField || !offerSequenceField) {
          resultField.value = 'ERROR: DOM elements not found';
          resultField.classList.add('error');
          return;
     }

     if (!validatInput(accountSeedField.value)) {
          resultField.value = 'ERROR: Account seed can not be empty';
          resultField.classList.add('error');
          return;
     }

     if (!validatInput(xrpBalanceField.value)) {
          resultField.value = 'ERROR: Xrp balance amount can not be empty';
          resultField.classList.add('error');
          return;
     }

     if (!validatInput(offerSequenceField.value)) {
          resultField.value = 'ERROR: Offer sequence can not be empty';
          resultField.classList.add('error');
          return;
     }

     if (isNaN(offerSequenceField.value)) {
          resultField.value = 'ERROR: Offer sequence must be a valid number';
          resultField.classList.add('error');
          return;
     }

     if (parseFloat(offerSequenceField.value) <= 0) {
          resultField.value = 'ERROR: Offer sequence must be greater than zero';
          resultField.classList.add('error');
          return;
     }

     const { environment } = getEnvironment();
     const client = await getClient();

     try {
          let results = `Connected to ${environment}.\nCancel Offers.\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'secp256k1' });
          let tx;
          /* OfferSequence is the Seq value when you getOffers. */
          try {
               const prepared = await client.autofill({
                    TransactionType: 'OfferCancel',
                    Account: wallet.address,
                    OfferSequence: parseInt(offerSequenceField.value),
               });

               const signed = wallet.sign(prepared);
               tx = await client.submitAndWait(signed.tx_blob);
          } catch (err) {
               throw new Error(err);
          }

          if (tx.result.meta.TransactionResult == 'tesSUCCESS') {
               results += 'Transaction succeeded:\n';
               results += results + parseTransactionDetails(tx.result);
               console.log(`Transaction succeeded: https://testnet.xrpl.org/transactions/${tx.result.hash}`);
               console.log();
               resultField.value = results;
               resultField.classList.add('success');
          } else {
               results += `Error sending transaction: ${tx.result.meta.TransactionResult}`;
               resultField.value = results;
               resultField.classList.add('error');
          }

          // results  += "\nBalance changes: \n" + JSON.stringify(xrpl.getBalanceChanges(tx.result.meta), null, 2)
          // resultField.value = results
          xrpBalanceField.value = await client.getXrpBalance(wallet.address);
     } catch (error) {
          console.error('Error:', error);
          resultField.value = 'ERROR: ' + error.message || 'Unknown error';
          resultField.classList.add('error');
          await disconnectClient();
     } finally {
          console.log('Leaving cancelOffer');
     }
}

async function getOrderBook() {
     console.log('Entering getOrderBook');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     // Retrieve all required DOM elements in one object
     const dom = {
          name: document.getElementById('accountNameField'),
          address: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          balance: document.getElementById('xrpBalanceField'),
          wantCurrency: document.getElementById('weWantCurrencyField'),
          wantIssuer: document.getElementById('weWantIssuerField'),
          wantAmount: document.getElementById('weWantAmountField'),
          spendCurrency: document.getElementById('weSpendCurrencyField'),
          spendIssuer: document.getElementById('weSpendIssuerField'),
          spendAmount: document.getElementById('weSpendAmountField'),
     };

     // Validate DOM existence
     for (const [key, el] of Object.entries(dom)) {
          if (!el) {
               resultField.value = `ERROR: DOM element '${key}' not found.`;
               resultField.classList.add('error');
               return;
          }
     }

     // Validate required input fields
     const requiredFields = [
          { el: dom.address, msg: 'Account Address cannot be empty' },
          { el: dom.seed, msg: 'Account Seed cannot be empty' },
          { el: dom.balance, msg: 'XRP amount cannot be empty' },
          { el: dom.wantCurrency, msg: 'Taker Pays currency cannot be empty' },
          { el: dom.spendCurrency, msg: 'Taker Gets currency cannot be empty' },
          { el: dom.wantAmount, msg: 'Pay amount cannot be empty' },
          { el: dom.spendAmount, msg: 'Get amount cannot be empty' },
     ];

     for (const { el, msg } of requiredFields) {
          if (!validatInput(el.value)) {
               resultField.value = `ERROR: ${msg}`;
               resultField.classList.add('error');
               return;
          }
     }

     const buildCurrencyObject = (currency, issuer, value) => (currency === 'XRP' ? { currency, value } : { currency, issuer, value });

     try {
          const { environment } = getEnvironment();
          const client = await getClient();
          const wallet = xrpl.Wallet.fromSeed(dom.seed.value, { algorithm: 'secp256k1' });

          let results = `Connected to ${environment}.\nGet Order Book.\n\n`;
          results += `${dom.name.value} account: ${wallet.address}\n\n*** Order Book ***\n`;

          const we_want = buildCurrencyObject(dom.wantCurrency.value, dom.wantIssuer.value, dom.wantAmount.value);
          const we_spend = buildCurrencyObject(dom.spendCurrency.value, dom.spendIssuer.value, dom.spendAmount.value);

          console.log('we_want:', we_want);
          console.log('we_spend:', we_spend);

          const orderBook = await client.request({
               method: 'book_offers',
               taker: wallet.address,
               ledger_index: 'current',
               taker_gets: we_spend,
               taker_pays: we_want,
          });

          const sortedOffers = attachRateAndSort(orderBook.result.offers);
          const stats = computeAverageExchangeRateBothWays(sortedOffers);
          results += formatOffers1(sortedOffers);
          results += `\n--- Aggregate Exchange Rate Stats ---\n`;
          results += `VWAP: ${stats.forward.vwap.toFixed(8)} TST/XRP\n`;
          results += `Simple Avg: ${stats.forward.simpleAvg.toFixed(8)} TST/XRP\n`;
          results += `Best Rate: ${stats.forward.bestRate.toFixed(8)} TST/XRP\n`;
          results += `Worst Rate: ${stats.forward.worstRate.toFixed(8)} TST/XRP\n`;

          // Reverse order book
          results += '\n*** Reverse Order Book ***\n';
          const reverseOrderBook = await client.request({
               method: 'book_offers',
               taker: wallet.address,
               ledger_index: 'current',
               taker_gets: we_want,
               taker_pays: we_spend,
          });

          const reverseSorted = attachRateAndSort(reverseOrderBook.result.offers);
          const reverseStats = computeAverageExchangeRateBothWays(reverseSorted);
          results += formatOffers1(reverseSorted);
          results += `\n--- Aggregate Exchange Rate Stats ---\n`;
          results += `VWAP: ${reverseStats.inverse.vwap.toFixed(8)} TST/XRP\n`;
          results += `Simple Avg: ${reverseStats.inverse.simpleAvg.toFixed(8)} TST/XRP\n`;
          results += `Best Rate: ${reverseStats.inverse.bestRate.toFixed(8)} TST/XRP\n`;
          results += `Worst Rate: ${reverseStats.inverse.worstRate.toFixed(8)} TST/XRP\n`;

          const combinedStats = computeFullExchangeRateStats(sortedOffers, reverseSorted, 20);

          const formatStats = (label, data) => `${label} (from ${data.count} offers)\n` + `    VWAP:        ${data.vwap.toFixed(8)}\n` + `    Average:     ${data.average.toFixed(8)}\n` + `    Median:      ${data.median.toFixed(8)}\n` + `    Mode:        ${data.mode.join(', ')}\n` + `    Best Rate:   ${data.best.toFixed(8)}\n` + `    Worst Rate:  ${data.worst.toFixed(8)}\n`;

          results += '\n--- Combined Exchange Rate Stats ---\n';
          results += formatStats('BOB/XRP', combinedStats.TOKEN_XRP);
          results += formatStats('XRP/BOB', combinedStats.XRP_TOKEN);
          results += '\n--- MINE Combined Exchange Rate Stats ---\n';
          let weWantCurrency;
          let weSpendCurrency;
          if (we_want.currency === 'XRP') {
               weWantCurrency = 'XRP';
               weSpendCurrency = we_spend.currency;
               results += formatStats(weSpendCurrency + '/' + weWantCurrency, combinedStats.TOKEN_XRP);
               results += formatStats(weWantCurrency + '/' + weSpendCurrency, combinedStats.XRP_TOKEN);
          } else {
               weSpendCurrency = 'XRP';
               weWantCurrency = we_want.currency;
               results += formatStats(weWantCurrency + '/' + weSpendCurrency, combinedStats.TOKEN_XRP);
               results += formatStats(weSpendCurrency + '/' + weWantCurrency, combinedStats.XRP_TOKEN);
          }

          resultField.value = results;
          resultField.classList.add('success');
     } catch (error) {
          console.error('Error:', error);
          resultField.value = 'ERROR: ' + (error.message || 'Unknown error');
          resultField.classList.add('error');
          await disconnectClient();
     } finally {
          console.log('Leaving getOrderBook');
     }
}

// async function getOrderBook() {
//      console.log('Entering getOrderBook');

//      // Clear previous error styling
//      resultField.classList.remove('error');
//      resultField.classList.remove('success');

//      let we_want;
//      let takerGetsString;
//      let we_spend;
//      let takerPaysString;

//      const accountNameField = document.getElementById('accountNameField');
//      const accountAddressField = document.getElementById('accountAddressField');
//      const accountSeedField = document.getElementById('accountSeedField');
//      const xrpBalanceField = document.getElementById('xrpBalanceField');
//      const weWantCurrencyField = document.getElementById('weWantCurrencyField');
//      const weSpendCurrencyField = document.getElementById('weSpendCurrencyField');
//      const weWantIssuerField = document.getElementById('weWantIssuerField');
//      const weSpendIssuerField = document.getElementById('weSpendIssuerField');
//      const weWantAmountField = document.getElementById('weWantAmountField');
//      const weSpendAmountField = document.getElementById('weSpendAmountField');

//      if (!accountNameField || !accountAddressField || !accountSeedField || !xrpBalanceField || !weWantCurrencyField || !weSpendCurrencyField || !weWantIssuerField || !weSpendIssuerField || !weWantAmountField || !weSpendAmountField) {
//           resultField.value = 'ERROR: DOM elements not found';
//           resultField.classList.add('error');
//           return;
//      }

//      if (!validatInput(accountAddressField.value)) {
//           resultField.value = 'ERROR: Account Address can not be empty';
//           resultField.classList.add('error');
//           return;
//      }

//      if (!validatInput(accountSeedField.value)) {
//           resultField.value = 'ERROR: Account seed amount can not be empty';
//           resultField.classList.add('error');
//           return;
//      }

//      if (!validatInput(xrpBalanceField.value)) {
//           resultField.value = 'ERROR: XRP amount can not be empty';
//           resultField.classList.add('error');
//           return;
//      }

//      if (!validatInput(weWantCurrencyField.value)) {
//           resultField.value = 'ERROR: Taker Pays currency can not be empty';
//           resultField.classList.add('error');
//           return;
//      }

//      if (!validatInput(weSpendCurrencyField.value)) {
//           resultField.value = 'ERROR: Taker Gets currency can not be empty';
//           resultField.classList.add('error');
//           return;
//      }

//      if (!validatInput(weWantAmountField.value)) {
//           resultField.value = 'ERROR: Pay amount can not be empty';
//           resultField.classList.add('error');
//           return;
//      }

//      if (!validatInput(weSpendAmountField.value)) {
//           resultField.value = 'ERROR: Get amount can not be empty';
//           resultField.classList.add('error');
//           return;
//      }

//      try {
//           const { environment } = getEnvironment();
//           const client = await getClient();

//           let results = `Connected to ${environment}.\nGet Order Book.\n\n`;
//           const wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'secp256k1' });
//           results += accountNameField.value + ' account: ' + wallet.address;

//           if (weWantCurrencyField.value == 'XRP') {
//                takerGetsString = '{"currency": "' + weWantCurrencyField.value + '",\n' + '"value": "' + weWantAmountField.value + '"}';
//                we_want = JSON.parse(takerGetsString);
//           } else {
//                takerGetsString = '{"currency": "' + weWantCurrencyField.value + '",\n' + '"issuer": "' + weWantIssuerField.value + '",\n' + '"value": "' + weWantAmountField.value + '"}';
//                we_want = JSON.parse(takerGetsString);
//           }

//           if (weSpendCurrencyField.value == 'XRP') {
//                takerPaysString = '{"currency": "' + weSpendCurrencyField.value + '",\n' + '"value": "' + weSpendAmountField.value + '"}';
//                we_spend = JSON.parse(takerPaysString);
//           } else {
//                takerPaysString = '{"currency": "' + weSpendCurrencyField.value + '",\n' + '"issuer": "' + weSpendIssuerField.value + '",\n' + '"value": "' + weSpendAmountField.value + '"}';
//                we_spend = JSON.parse(takerPaysString);
//           }
//           console.log('we_want', we_want);
//           console.log('we_spend', we_spend);

//           results += '\n\n*** Order Book ***\n';

//           try {
//                const orderBook = await client.request({
//                     method: 'book_offers',
//                     taker: wallet.address,
//                     ledger_index: 'current',
//                     taker_gets: we_spend,
//                     taker_pays: we_want,
//                });

//                const sortedOffers = attachRateAndSort(orderBook.result.offers);
//                const stats = computeAverageExchangeRateBothWays(sortedOffers);
//                results += formatOffers1(sortedOffers);
//                results += `\n--- Aggregate Exchange Rate Stats ---\n`;
//                results += `VWAP: ${stats.forward.vwap.toFixed(8)} TST/XRP\n`;
//                results += `Simple Avg: ${stats.forward.simpleAvg.toFixed(8)} TST/XRP\n`;
//                results += `Best Rate: ${stats.forward.bestRate.toFixed(8)} TST/XRP\n`;
//                results += `Worst Rate: ${stats.forward.worstRate.toFixed(8)} TST/XRP\n`;

//                // Reverse order book
//                results += '\n*** Reverse Order Book ***\n';
//                const reverseOrderBook = await client.request({
//                     method: 'book_offers',
//                     taker: wallet.address,
//                     ledger_index: 'current',
//                     taker_gets: we_want,
//                     taker_pays: we_spend,
//                });

//                const reverseSorted = attachRateAndSort(reverseOrderBook.result.offers);
//                const reverseStats = computeAverageExchangeRateBothWays(sortedOffers);
//                results += formatOffers1(reverseSorted);
//                results += `\n--- Aggregate Exchange Rate Stats ---\n`;
//                results += `VWAP: ${reverseStats.inverse.vwap.toFixed(8)} TST/XRP\n`;
//                results += `Simple Avg: ${reverseStats.inverse.simpleAvg.toFixed(8)} TST/XRP\n`;
//                results += `Best Rate: ${reverseStats.inverse.bestRate.toFixed(8)} TST/XRP\n`;
//                results += `Worst Rate: ${reverseStats.inverse.worstRate.toFixed(8)} TST/XRP\n`;

//                const stats1 = computeFullExchangeRateStats(sortedOffers, reverseSorted, 20);
//                function formatStats(label, data) {
//                     return `${label} (from ${data.count} offers)
//                   VWAP:        ${data.vwap.toFixed(8)}
//                   Average:     ${data.average.toFixed(8)}
//                   Median:      ${data.median.toFixed(8)}
//                   Mode:        ${data.mode.join(', ')}
//                   Best Rate:   ${data.best.toFixed(8)}
//                   Worst Rate:  ${data.worst.toFixed(8)}\n`;
//                }
//                results += '\n--- Combined Exchange Rate Stats ---\n';
//                results += formatStats('TST/XRP', stats1.TOKEN_XRP);
//                results += formatStats('XRP/TST', stats1.XRP_TOKEN);
//           } catch (err) {
//                throw new Error(err);
//           }

//           resultField.value = results;
//           resultField.classList.add('success');
//      } catch (error) {
//           console.error('Error:', error);
//           resultField.value = 'ERROR: ' + error.message || 'Unknown error';
//           resultField.classList.add('error');
//           await disconnectClient();
//      } finally {
//           console.log('Leaving getOrderBook');
//      }
// }

function attachRateAndSort1(offers, baseCurrency, counterCurrency, maxDeviationPercent = 50) {
     // Attach calculated rate to each offer
     const offersWithRate = offers
          .map(offer => {
               let rate;

               if (offer.TakerGets.currency === baseCurrency && offer.TakerPays.currency === counterCurrency) {
                    rate = parseFloat(offer.TakerPays.value) / parseFloat(offer.TakerGets.value);
               } else if (offer.TakerGets.currency === counterCurrency && offer.TakerPays.currency === baseCurrency) {
                    rate = parseFloat(offer.TakerGets.value) / parseFloat(offer.TakerPays.value);
               } else {
                    return { ...offer, rate: NaN };
               }

               return { ...offer, rate };
          })
          .filter(offer => !isNaN(offer.rate));

     // Compute median rate
     const sortedRates = offersWithRate.map(o => o.rate).sort((a, b) => a - b);
     const medianRate = sortedRates.length % 2 === 0 ? (sortedRates[sortedRates.length / 2 - 1] + sortedRates[sortedRates.length / 2]) / 2 : sortedRates[Math.floor(sortedRates.length / 2)];

     // Filter out outliers based on deviation
     const filteredOffers = offersWithRate.filter(o => {
          const deviation = Math.abs((o.rate - medianRate) / medianRate) * 100;
          return deviation <= maxDeviationPercent;
     });

     // Sort by rate ascending
     return filteredOffers.sort((a, b) => a.rate - b.rate);
}

function attachRateAndSort(offers) {
     return offers
          .map(offer => {
               let gets = offer.TakerGets;
               let pays = offer.TakerPays;
               let getsValue = 0;
               let paysValue = 0;

               // Handle drops (XRP)
               if (typeof gets === 'string') {
                    getsValue = parseFloat(gets) / 1_000_000;
               } else if (typeof gets === 'object' && gets !== null) {
                    getsValue = parseFloat(gets.value);
               }

               if (typeof pays === 'string') {
                    paysValue = parseFloat(pays) / 1_000_000;
               } else if (typeof pays === 'object' && pays !== null) {
                    paysValue = parseFloat(pays.value);
               }

               // Calculate exchange rate
               if (getsValue > 0) {
                    offer._exchangeRate = paysValue / getsValue;
               } else {
                    offer._exchangeRate = 0; // or null/undefined if you prefer
               }

               return offer;
          })
          .sort((a, b) => b._exchangeRate - a._exchangeRate); // descending = best rate first
}

function computeFullExchangeRateStats(forwardOffers, reverseOffers, maxOffers = null) {
     const combinedOffers = [...forwardOffers, ...reverseOffers];

     let forwardRates = []; // TST/XRP
     let inverseRates = []; // XRP/TST

     // Process all offers
     combinedOffers.forEach(offer => {
          let gets = offer.TakerGets;
          let pays = offer.TakerPays;
          let getsValue = 0;
          let paysValue = 0;

          if (typeof gets === 'string') getsValue = parseFloat(gets) / 1_000_000;
          else if (typeof gets === 'object' && gets !== null) getsValue = parseFloat(gets.value);

          if (typeof pays === 'string') paysValue = parseFloat(pays) / 1_000_000;
          else if (typeof pays === 'object' && pays !== null) paysValue = parseFloat(pays.value);

          if (getsValue > 0 && paysValue > 0) {
               forwardRates.push(paysValue / getsValue);
               inverseRates.push(getsValue / paysValue);
          }
     });

     // Optional: limit depth to top N offers
     if (maxOffers && maxOffers > 0) {
          forwardRates = forwardRates.slice(0, maxOffers);
          inverseRates = inverseRates.slice(0, maxOffers);
     }

     // Helper to calculate stats
     function computeStats(rates) {
          const sorted = [...rates].sort((a, b) => a - b);
          const total = sorted.reduce((a, b) => a + b, 0);
          const avg = sorted.length > 0 ? total / sorted.length : 0;
          const vwap = avg;

          // Median
          const mid = Math.floor(sorted.length / 2);
          const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

          // Mode (rounded to 8 decimals)
          const freqMap = {};
          sorted.forEach(rate => {
               const key = rate.toFixed(8);
               freqMap[key] = (freqMap[key] || 0) + 1;
          });
          const maxFreq = Math.max(...Object.values(freqMap));
          const modes = Object.entries(freqMap)
               .filter(([_, freq]) => freq === maxFreq)
               .map(([rateStr]) => parseFloat(rateStr));

          return {
               vwap,
               average: avg,
               median,
               mode: modes,
               best: Math.max(...sorted),
               worst: Math.min(...sorted),
               count: sorted.length,
          };
     }

     return {
          TOKEN_XRP: computeStats(forwardRates),
          XRP_TOKEN: computeStats(inverseRates),
     };
}

function computeAverageExchangeRateBothWays(offers) {
     let totalPays = 0;
     let totalGets = 0;
     let forwardRates = []; // TST / XRP
     let inverseRates = []; // XRP / TST

     offers.forEach(offer => {
          let gets = offer.TakerGets;
          let pays = offer.TakerPays;
          let getsValue = 0;
          let paysValue = 0;

          if (typeof gets === 'string') getsValue = parseFloat(gets) / 1_000_000;
          else if (typeof gets === 'object' && gets !== null) getsValue = parseFloat(gets.value);

          if (typeof pays === 'string') paysValue = parseFloat(pays) / 1_000_000;
          else if (typeof pays === 'object' && pays !== null) paysValue = parseFloat(pays.value);

          if (getsValue > 0 && paysValue > 0) {
               totalPays += paysValue;
               totalGets += getsValue;
               forwardRates.push(paysValue / getsValue);
               inverseRates.push(getsValue / paysValue);
          }
     });

     const forwardVWAP = totalGets > 0 ? totalPays / totalGets : 0; // TST/XRP
     const inverseVWAP = totalPays > 0 ? totalGets / totalPays : 0; // XRP/TST

     const forwardSimpleAvg = forwardRates.length > 0 ? forwardRates.reduce((a, b) => a + b, 0) / forwardRates.length : 0;
     const inverseSimpleAvg = inverseRates.length > 0 ? inverseRates.reduce((a, b) => a + b, 0) / inverseRates.length : 0;

     return {
          forward: {
               vwap: forwardVWAP,
               simpleAvg: forwardSimpleAvg,
               bestRate: Math.max(...forwardRates),
               worstRate: Math.min(...forwardRates),
          },
          inverse: {
               vwap: inverseVWAP,
               simpleAvg: inverseSimpleAvg,
               bestRate: Math.max(...inverseRates),
               worstRate: Math.min(...inverseRates),
          },
     };
}

// function computeAverageExchangeRate(offers) {
//      let totalPays = 0;
//      let totalGets = 0;
//      let simpleRates = [];

//      offers.forEach(offer => {
//          let gets = offer.TakerGets;
//          let pays = offer.TakerPays;
//          let getsValue = 0;
//          let paysValue = 0;

//          if (typeof gets === "string") getsValue = parseFloat(gets) / 1_000_000;
//          else if (typeof gets === "object" && gets !== null) getsValue = parseFloat(gets.value);

//          if (typeof pays === "string") paysValue = parseFloat(pays) / 1_000_000;
//          else if (typeof pays === "object" && pays !== null) paysValue = parseFloat(pays.value);

//          if (getsValue > 0 && paysValue > 0) {
//              totalPays += paysValue;
//              totalGets += getsValue;
//              simpleRates.push(paysValue / getsValue);
//          }
//      });

//      const vwap = totalGets > 0 ? totalPays / totalGets : 0;
//      const simpleAvg = simpleRates.length > 0
//          ? simpleRates.reduce((a, b) => a + b, 0) / simpleRates.length
//          : 0;

//      return {
//          vwap: vwap,
//          simpleAvg: simpleAvg,
//          bestRate: simpleRates.length > 0 ? Math.max(...simpleRates) : 0,
//          worstRate: simpleRates.length > 0 ? Math.min(...simpleRates) : 0
//      };
//  }

function formatOffers(offers, baseCurrency, quoteCurrency) {
     if (!offers || offers.length === 0) {
          return 'No offers found';
     }

     // Conversion factor: 1 XRP = 1,000,000 drops
     const DROPS_PER_XRP = 1000000;

     // Debug: Log the input type and value
     console.log('Input type:', typeof offers, 'Input value:', offers);

     // Check if offers is an array
     if (!Array.isArray(offers)) {
          let errorMessage = 'Error: Input must be an array of offers';
          if (typeof offers === 'object' && offers !== null && Array.isArray(offers.offers)) {
               errorMessage += ". Did you mean to pass 'offers.offers'?";
          } else if (typeof offers === 'string') {
               errorMessage += '. Input is a string; try parsing it with JSON.parse.';
          }
          return errorMessage;
     }

     // Function to format a single offer
     function formatOffer(offer, index) {
          let output = `Total Offers: ${offers.length} \noffers (${index + 1}):\n`;

          // Helper function to format nested objects (e.g., TakerPays)
          function formatNestedObject(obj, indent = '\t') {
               return `{\n${Object.entries(obj)
                    .map(([key, value]) => `${indent}\t${key}: ${value}`)
                    .join('\n')}\n${indent}}`;
          }

          // Validate offer is an object
          if (typeof offer !== 'object' || offer === null) {
               return `\toffers (${index + 1}): Invalid offer data\n`;
          }

          // Calculate price
          let priceBaseInQuote = null; // e.g., TST in XRP (XRP per TST)
          let priceQuoteInBase = null; // e.g., XRP in TST (TST per XRP)
          let takerGetsAmount, takerPaysAmount;

          // Parse TakerGets
          if (typeof offer.TakerGets === 'string') {
               // XRP in drops
               takerGetsAmount = parseInt(offer.TakerGets) / DROPS_PER_XRP;
          } else if (typeof offer.TakerGets === 'object' && offer.TakerGets.value) {
               // Issued currency
               takerGetsAmount = parseFloat(offer.TakerGets.value);
          }

          // Parse TakerPays
          if (typeof offer.TakerPays === 'string') {
               // XRP in drops
               takerPaysAmount = parseInt(offer.TakerPays) / DROPS_PER_XRP;
          } else if (typeof offer.TakerPays === 'object' && offer.TakerPays.value) {
               // Issued currency
               takerPaysAmount = parseFloat(offer.TakerPays.value);
          }

          // Determine currencies
          const getsCurrency = typeof offer.TakerGets === 'string' ? 'XRP' : offer.TakerGets.currency;
          const paysCurrency = typeof offer.TakerPays === 'string' ? 'XRP' : offer.TakerPays.currency;

          // Calculate price based on currency pair
          if (takerGetsAmount && takerPaysAmount && takerGetsAmount !== 0) {
               if (getsCurrency === baseCurrency && paysCurrency === quoteCurrency) {
                    // TakerGets TST, TakerPays XRP: Price of TST in XRP
                    priceBaseInQuote = takerPaysAmount / takerGetsAmount; // XRP per TST
                    priceQuoteInBase = takerGetsAmount / takerPaysAmount; // TST per XRP
               } else if (getsCurrency === quoteCurrency && paysCurrency === baseCurrency) {
                    // TakerGets XRP, TakerPays TST: Price of TST in XRP
                    priceBaseInQuote = takerGetsAmount / takerPaysAmount; // XRP per TST
                    priceQuoteInBase = takerPaysAmount / takerGetsAmount; // TST per XRP
               }
          }

          // Debug: Log currency and amounts
          console.log(`Offer ${index + 1}: GetsCurrency=${getsCurrency}, PaysCurrency=${paysCurrency}, GetsAmount=${takerGetsAmount}, PaysAmount=${takerPaysAmount}, PriceBaseInQuote=${priceBaseInQuote}`);

          // Iterate through offer fields
          for (const [key, value] of Object.entries(offer)) {
               let formattedValue = value;

               // Handle TakerGets
               if (key === 'TakerGets') {
                    if (typeof value === 'string') {
                         // XRP in drops
                         const drops = parseInt(value);
                         formattedValue = isNaN(drops) ? 'Invalid TakerGets value' : `${(drops / DROPS_PER_XRP).toFixed(6)} XRP (${drops} drops)`;
                    } else if (typeof value === 'object' && value !== null) {
                         // Issued currency (object)
                         formattedValue = formatNestedObject(value);
                    } else {
                         formattedValue = 'Invalid TakerGets format';
                    }
               }
               // Handle TakerPays
               else if (key === 'TakerPays') {
                    if (typeof value === 'string') {
                         // XRP in drops
                         const drops = parseInt(value);
                         formattedValue = isNaN(drops) ? 'Invalid TakerPays value' : `${(drops / DROPS_PER_XRP).toFixed(6)} XRP (${drops} drops)`;
                    } else if (typeof value === 'object' && value !== null) {
                         // Issued currency (object)
                         formattedValue = formatNestedObject(value);
                    } else {
                         formattedValue = 'Invalid TakerPays format';
                    }
               }
               // Handle taker_gets_funded and taker_pays_funded
               else if (key === 'taker_gets_funded' || key === 'taker_pays_funded') {
                    if (typeof value === 'string') {
                         const drops = parseInt(value);
                         formattedValue = isNaN(drops) ? 'Invalid funded value' : `${(drops / DROPS_PER_XRP).toFixed(6)} XRP (${drops} drops)`;
                    } else if (typeof value === 'object' && value !== null) {
                         formattedValue = formatNestedObject(value);
                    } else {
                         formattedValue = String(value);
                    }
               }
               // Format other nested objects
               else if (typeof value === 'object' && value !== null) {
                    formattedValue = formatNestedObject(value);
               }
               // Convert other values to strings
               else {
                    formattedValue = String(value);
               }

               output += `\t${key}: ${formattedValue}\n`;
          }

          // Append price information
          if (priceBaseInQuote !== null) {
               output += `\tPrice (TST/XRP): ${priceBaseInQuote.toFixed(6)} XRP per TST\n`;
               output += `\tPrice (XRP/TST): ${priceQuoteInBase.toFixed(6)} TST per XRP\n`;
          } else {
               output += `\tPrice: Unable to calculate\n`;
          }

          return output;
     }

     // Calculate best bid and ask prices
     const pricedOffers = offers.map(offer => {
          let takerGetsAmount, takerPaysAmount, priceBaseInQuote, priceQuoteInBase;

          // Parse TakerGets
          if (typeof offer.TakerGets === 'string') {
               takerGetsAmount = parseInt(offer.TakerGets) / DROPS_PER_XRP;
          } else if (typeof offer.TakerGets === 'object' && offer.TakerGets.value) {
               takerGetsAmount = parseFloat(offer.TakerGets.value);
          }

          // Parse TakerPays
          if (typeof offer.TakerPays === 'string') {
               takerPaysAmount = parseInt(offer.TakerPays) / DROPS_PER_XRP;
          } else if (typeof offer.TakerPays === 'object' && offer.TakerPays.value) {
               takerPaysAmount = parseFloat(offer.TakerPays.value);
          }

          // Determine currencies
          const getsCurrency = typeof offer.TakerGets === 'string' ? 'XRP' : offer.TakerGets.currency;
          const paysCurrency = typeof offer.TakerPays === 'string' ? 'XRP' : offer.TakerPays.currency;

          // Calculate price
          if (takerGetsAmount && takerPaysAmount && takerGetsAmount !== 0) {
               if (getsCurrency === baseCurrency && paysCurrency === quoteCurrency) {
                    priceBaseInQuote = takerPaysAmount / takerGetsAmount; // XRP per TST
                    priceQuoteInBase = takerGetsAmount / takerPaysAmount; // TST per XRP
               } else if (getsCurrency === quoteCurrency && paysCurrency === baseCurrency) {
                    priceBaseInQuote = takerGetsAmount / takerPaysAmount; // XRP per TST
                    priceQuoteInBase = takerPaysAmount / takerGetsAmount; // TST per XRP
               }
          }

          return { offer, priceBaseInQuote, priceQuoteInBase, getsCurrency, paysCurrency };
     });

     // Find best bid and ask
     // Bids: Buying TST (TakerGets TST, TakerPays XRP)
     // Asks: Selling TST (TakerGets XRP, TakerPays TST)
     const bids = pricedOffers.filter(o => o.priceBaseInQuote && o.getsCurrency === baseCurrency && o.paysCurrency === quoteCurrency);
     const asks = pricedOffers.filter(o => o.priceBaseInQuote && o.getsCurrency === quoteCurrency && o.paysCurrency === baseCurrency);
     const bestBid = bids.length > 0 ? Math.max(...bids.map(o => o.priceBaseInQuote)) : null;
     const bestAsk = asks.length > 0 ? Math.min(...asks.map(o => o.priceBaseInQuote)) : null;

     // Format offers
     const formattedOffers = offers.map((offer, index) => formatOffer(offer, index)).join('\n');

     // Append summary
     let summary = '\n*** Order Book Summary ***\n';
     summary += bestBid ? `Best Bid (TST/XRP): ${bestBid.toFixed(6)} XRP per TST\n` : `No bids found for TST/XRP\n`;
     summary += bestAsk ? `Best Ask (TST/XRP): ${bestAsk.toFixed(6)} XRP per TST\n` : `No asks found for TST/XRP\n`;

     return formattedOffers + summary;
}

function formatOffers3(offers, baseCurrency, quoteCurrency) {
     if (!offers || offers.length === 0) {
          return 'No offers found';
     }

     // Conversion factor: 1 XRP = 1,000,000 drops
     const DROPS_PER_XRP = 1000000;

     // Debug: Log the input type and value
     console.log('Input type:', typeof offers, 'Input value:', offers);

     // Check if offers is an array
     if (!Array.isArray(offers)) {
          let errorMessage = 'Error: Input must be an array of offers';
          if (typeof offers === 'object' && offers !== null && Array.isArray(offers.offers)) {
               errorMessage += ". Did you mean to pass 'offers.offers'?";
          } else if (typeof offers === 'string') {
               errorMessage += '. Input is a string; try parsing it with JSON.parse.';
          }
          return errorMessage;
     }

     // Function to format a single offer
     function formatOffer(offer, index) {
          let output = `Total Offers: ${offers.length} \noffers (${index + 1}):\n`;

          // Helper function to format nested objects (e.g., TakerPays)
          function formatNestedObject(obj, indent = '\t') {
               return `{\n${Object.entries(obj)
                    .map(([key, value]) => `${indent}\t${key}: ${value}`)
                    .join('\n')}\n${indent}}`;
          }

          // Validate offer is an object
          if (typeof offer !== 'object' || offer === null) {
               return `\toffers (${index + 1}): Invalid offer data\n`;
          }

          // Calculate price
          let priceBaseInQuote = null; // e.g., TST in XRP
          let priceQuoteInBase = null; // e.g., XRP in TST
          let takerGetsAmount, takerPaysAmount;

          // Parse TakerGets
          if (typeof offer.TakerGets === 'string') {
               // XRP in drops
               takerGetsAmount = parseInt(offer.TakerGets) / DROPS_PER_XRP;
          } else if (typeof offer.TakerGets === 'object' && offer.TakerGets.value) {
               // Issued currency
               takerGetsAmount = parseFloat(offer.TakerGets.value);
          }

          // Parse TakerPays
          if (typeof offer.TakerPays === 'string') {
               // XRP in drops
               takerPaysAmount = parseInt(offer.TakerPays) / DROPS_PER_XRP;
          } else if (typeof offer.TakerPays === 'object' && offer.TakerPays.value) {
               // Issued currency
               takerPaysAmount = parseFloat(offer.TakerPays.value);
          }

          // In formatOffer function
          // Determine currencies
          const getsCurrency = typeof offer.TakerGets === 'string' ? 'XRP' : offer.TakerGets.currency;
          const paysCurrency = typeof offer.TakerPays === 'string' ? 'XRP' : offer.TakerPays.currency;

          console.log(`Offer ${index + 1}: GetsCurrency=${getsCurrency}, PaysCurrency=${paysCurrency}, GetsAmount=${takerGetsAmount}, PaysAmount=${takerPaysAmount}, PriceBaseInQuote=${priceBaseInQuote}`);

          // Calculate price based on currency pair
          if (takerGetsAmount && takerPaysAmount && takerGetsAmount !== 0) {
               if (getsCurrency === baseCurrency && paysCurrency === quoteCurrency) {
                    // TakerGets base, TakerPays quote: Price of base in quote
                    priceBaseInQuote = takerPaysAmount / takerGetsAmount;
                    priceQuoteInBase = takerGetsAmount / takerPaysAmount;
               } else if (getsCurrency === quoteCurrency && paysCurrency === baseCurrency) {
                    // TakerGets quote, TakerPays base: Price of base in quote
                    priceBaseInQuote = takerGetsAmount / takerPaysAmount;
                    priceQuoteInBase = takerPaysAmount / takerGetsAmount;
               }
          }

          // Debug: Log currency and amounts
          console.log(`Offer ${index + 1}: GetsCurrency=${getsCurrency}, PaysCurrency=${paysCurrency}, GetsAmount=${takerGetsAmount}, PaysAmount=${takerPaysAmount}, PriceBaseInQuote=${priceBaseInQuote}`);

          // Iterate through offer fields
          for (const [key, value] of Object.entries(offer)) {
               let formattedValue = value;

               // Handle TakerGets
               if (key === 'TakerGets') {
                    if (typeof value === 'string') {
                         // XRP in drops
                         const drops = parseInt(value);
                         formattedValue = isNaN(drops) ? 'Invalid TakerGets value' : `${(drops / DROPS_PER_XRP).toFixed(6)} XRP (${drops} drops)`;
                    } else if (typeof value === 'object' && value !== null) {
                         // Issued currency (object)
                         formattedValue = formatNestedObject(value);
                    } else {
                         formattedValue = 'Invalid TakerGets format';
                    }
               }
               // Handle TakerPays
               else if (key === 'TakerPays') {
                    if (typeof value === 'string') {
                         // XRP in drops
                         const drops = parseInt(value);
                         formattedValue = isNaN(drops) ? 'Invalid TakerPays value' : `${(drops / DROPS_PER_XRP).toFixed(6)} XRP (${drops} drops)`;
                    } else if (typeof value === 'object' && value !== null) {
                         // Issued currency (object)
                         formattedValue = formatNestedObject(value);
                    } else {
                         formattedValue = 'Invalid TakerPays format';
                    }
               }
               // Handle taker_gets_funded and taker_pays_funded
               else if (key === 'taker_gets_funded' || key === 'taker_pays_funded') {
                    if (typeof value === 'string') {
                         const drops = parseInt(value);
                         formattedValue = isNaN(drops) ? 'Invalid funded value' : `${(drops / DROPS_PER_XRP).toFixed(6)} XRP (${drops} drops)`;
                    } else if (typeof value === 'object' && value !== null) {
                         formattedValue = formatNestedObject(value);
                    } else {
                         formattedValue = String(value);
                    }
               }
               // Format other nested objects
               else if (typeof value === 'object' && value !== null) {
                    formattedValue = formatNestedObject(value);
               }
               // Convert other values to strings
               else {
                    formattedValue = String(value);
               }

               output += `\t${key}: ${formattedValue}\n`;
          }

          // Append price information
          if (priceBaseInQuote !== null) {
               output += `\tPrice (${baseCurrency}/${quoteCurrency}): ${priceBaseInQuote.toFixed(6)} ${quoteCurrency} per ${baseCurrency}\n`;
               output += `\tPrice (${quoteCurrency}/${baseCurrency}): ${priceQuoteInBase.toFixed(6)} ${baseCurrency} per ${quoteCurrency}\n`;
          } else {
               output += `\tPrice: Unable to calculate\n`;
          }

          return output;
     }

     // Calculate best bid and ask prices
     const pricedOffers = offers.map(offer => {
          let takerGetsAmount, takerPaysAmount, priceBaseInQuote, priceQuoteInBase;

          // Parse TakerGets
          if (typeof offer.TakerGets === 'string') {
               takerGetsAmount = parseInt(offer.TakerGets) / DROPS_PER_XRP;
          } else if (typeof offer.TakerGets === 'object' && offer.TakerGets.value) {
               takerGetsAmount = parseFloat(offer.TakerGets.value);
          }

          // Parse TakerPays
          if (typeof offer.TakerPays === 'string') {
               takerPaysAmount = parseInt(offer.TakerPays) / DROPS_PER_XRP;
          } else if (typeof offer.TakerPays === 'object' && offer.TakerPays.value) {
               takerPaysAmount = parseFloat(offer.TakerPays.value);
          }

          // Determine currencies
          const getsCurrency = typeof offer.TakerGets === 'string' ? 'XRP' : offer.TakerGets.currency;
          const paysCurrency = typeof offer.TakerPays === 'string' ? 'XRP' : offer.TakerPays.currency;

          // Calculate price
          if (takerGetsAmount && takerPaysAmount && takerGetsAmount !== 0) {
               if (getsCurrency === baseCurrency && paysCurrency === quoteCurrency) {
                    priceBaseInQuote = takerPaysAmount / takerGetsAmount;
                    priceQuoteInBase = takerGetsAmount / takerPaysAmount;
               } else if (getsCurrency === quoteCurrency && paysCurrency === baseCurrency) {
                    priceBaseInQuote = takerGetsAmount / takerPaysAmount;
                    priceQuoteInBase = takerPaysAmount / takerGetsAmount;
               }
          }

          return { offer, priceBaseInQuote, priceQuoteInBase, getsCurrency, paysCurrency };
     });

     // Find best bid and ask
     // Bids: Buying base (TakerGets base, TakerPays quote)
     // Asks: Selling base (TakerGets quote, TakerPays base)
     const bids = pricedOffers.filter(o => o.priceBaseInQuote && o.getsCurrency === baseCurrency && o.paysCurrency === quoteCurrency);
     const asks = pricedOffers.filter(o => o.priceBaseInQuote && o.getsCurrency === quoteCurrency && o.paysCurrency === baseCurrency);
     const bestBid = bids.length > 0 ? Math.max(...bids.map(o => o.priceBaseInQuote)) : null;
     const bestAsk = asks.length > 0 ? Math.min(...asks.map(o => o.priceBaseInQuote)) : null;

     // Format offers
     const formattedOffers = offers.map((offer, index) => formatOffer(offer, index)).join('\n');

     // Append summary
     let summary = '\n*** Order Book Summary ***\n';
     summary += bestBid ? `Best Bid (${baseCurrency}/${quoteCurrency}): ${bestBid.toFixed(6)} ${quoteCurrency} per ${baseCurrency}\n` : `No bids found for ${baseCurrency}/${quoteCurrency}\n`;
     summary += bestAsk ? `Best Ask (${baseCurrency}/${quoteCurrency}): ${bestAsk.toFixed(6)} ${quoteCurrency} per ${baseCurrency}\n` : `No asks found for ${baseCurrency}/${quoteCurrency}\n`;

     return formattedOffers + summary;
}

function formatOffers2(offers, baseCurrency, quoteCurrency) {
     if (!offers || offers.length === 0) {
          return 'No offers found';
     }

     // Conversion factor: 1 XRP = 1,000,000 drops
     const DROPS_PER_XRP = 1000000;

     // Debug: Log the input type and value
     console.log('Input type:', typeof offers, 'Input value:', offers);

     // Check if offers is an array
     if (!Array.isArray(offers)) {
          let errorMessage = 'Error: Input must be an array of offers';
          if (typeof offers === 'object' && offers !== null && Array.isArray(offers.offers)) {
               errorMessage += ". Did you mean to pass 'offers.offers'?";
          } else if (typeof offers === 'string') {
               errorMessage += '. Input is a string; try parsing it with JSON.parse.';
          }
          return errorMessage;
     }

     // Function to format a single offer
     function formatOffer(offer, index) {
          let output = `Total Offers: ${offers.length} \noffers (${index + 1}):\n`;

          // Helper function to format nested objects (e.g., TakerPays)
          function formatNestedObject(obj, indent = '\t') {
               return `{\n${Object.entries(obj)
                    .map(([key, value]) => `${indent}\t${key}: ${value}`)
                    .join('\n')}\n${indent}}`;
          }

          // Validate offer is an object
          if (typeof offer !== 'object' || offer === null) {
               return `\toffers (${index + 1}): Invalid offer data\n`;
          }

          // Calculate price
          let priceBaseInQuote = null; // e.g., TST in XRP
          let priceQuoteInBase = null; // e.g., XRP in TST
          let takerGetsAmount, takerPaysAmount;

          // Parse TakerGets
          if (typeof offer.TakerGets === 'string') {
               // XRP in drops
               takerGetsAmount = parseInt(offer.TakerGets) / DROPS_PER_XRP;
          } else if (typeof offer.TakerGets === 'object' && offer.TakerGets.value) {
               // Issued currency
               takerGetsAmount = parseFloat(offer.TakerGets.value);
          }

          // Parse TakerPays
          if (typeof offer.TakerPays === 'string') {
               // XRP in drops
               takerPaysAmount = parseInt(offer.TakerPays) / DROPS_PER_XRP;
          } else if (typeof offer.TakerPays === 'object' && offer.TakerPays.value) {
               // Issued currency
               takerPaysAmount = parseFloat(offer.TakerPays.value);
          }

          // Calculate price based on currency pair (TST/XRP)
          if (takerGetsAmount && takerPaysAmount) {
               if ((offer.TakerGets.currency === baseCurrency || offer.TakerGets === baseCurrency) && (offer.TakerPays.currency === quoteCurrency || offer.TakerPays === quoteCurrency)) {
                    // TakerGets TST, TakerPays XRP: Price of TST in XRP
                    priceBaseInQuote = takerPaysAmount / takerGetsAmount;
                    priceQuoteInBase = takerGetsAmount / takerPaysAmount;
               } else if ((offer.TakerGets.currency === quoteCurrency || offer.TakerGets === quoteCurrency) && (offer.TakerPays.currency === baseCurrency || offer.TakerPays === baseCurrency)) {
                    // TakerGets XRP, TakerPays TST: Price of TST in XRP
                    priceBaseInQuote = takerGetsAmount / takerPaysAmount;
                    priceQuoteInBase = takerPaysAmount / takerGetsAmount;
               }
          }

          // Iterate through offer fields
          for (const [key, value] of Object.entries(offer)) {
               let formattedValue = value;

               // Handle TakerGets
               if (key === 'TakerGets') {
                    if (typeof value === 'string') {
                         // XRP in drops
                         const drops = parseInt(value);
                         formattedValue = isNaN(drops) ? 'Invalid TakerGets value' : `${(drops / DROPS_PER_XRP).toFixed(6)} XRP (${drops} drops)`;
                    } else if (typeof value === 'object' && value !== null) {
                         // Issued currency (object)
                         formattedValue = formatNestedObject(value);
                    } else {
                         formattedValue = 'Invalid TakerGets format';
                    }
               }
               // Handle TakerPays
               else if (key === 'TakerPays') {
                    if (typeof value === 'string') {
                         // XRP in drops
                         const drops = parseInt(value);
                         formattedValue = isNaN(drops) ? 'Invalid TakerPays value' : `${(drops / DROPS_PER_XRP).toFixed(6)} XRP (${drops} drops)`;
                    } else if (typeof value === 'object' && value !== null) {
                         // Issued currency (object)
                         formattedValue = formatNestedObject(value);
                    } else {
                         formattedValue = 'Invalid TakerPays format';
                    }
               }
               // Format other nested objects
               else if (typeof value === 'object' && value !== null) {
                    formattedValue = formatNestedObject(value);
               }
               // Convert other values to strings
               else {
                    formattedValue = String(value);
               }

               output += `\t${key}: ${formattedValue}\n`;
          }

          // Append price information
          if (priceBaseInQuote !== null) {
               output += `\tPrice (${baseCurrency}/${quoteCurrency}): ${priceBaseInQuote.toFixed(6)} ${quoteCurrency} per ${baseCurrency}\n`;
               output += `\tPrice (${quoteCurrency}/${baseCurrency}): ${priceQuoteInBase.toFixed(6)} ${baseCurrency} per ${quoteCurrency}\n`;
          } else {
               output += `\tPrice: Unable to calculate\n`;
          }

          return output;
     }

     // Calculate best bid and ask prices
     const pricedOffers = offers.map(offer => {
          let takerGetsAmount, takerPaysAmount, priceBaseInQuote, priceQuoteInBase;

          // Parse TakerGets
          if (typeof offer.TakerGets === 'string') {
               takerGetsAmount = parseInt(offer.TakerGets) / DROPS_PER_XRP;
          } else if (typeof offer.TakerGets === 'object' && offer.TakerGets.value) {
               takerGetsAmount = parseFloat(offer.TakerGets.value);
          }

          // Parse TakerPays
          if (typeof offer.TakerPays === 'string') {
               takerPaysAmount = parseInt(offer.TakerPays) / DROPS_PER_XRP;
          } else if (typeof offer.TakerPays === 'object' && offer.TakerPays.value) {
               takerPaysAmount = parseFloat(offer.TakerPays.value);
          }

          // Calculate price
          if (takerGetsAmount && takerPaysAmount) {
               if ((offer.TakerGets.currency === baseCurrency || offer.TakerGets === baseCurrency) && (offer.TakerPays.currency === quoteCurrency || offer.TakerPays === quoteCurrency)) {
                    priceBaseInQuote = takerPaysAmount / takerGetsAmount;
                    priceQuoteInBase = takerGetsAmount / takerPaysAmount;
               } else if ((offer.TakerGets.currency === quoteCurrency || offer.TakerGets === quoteCurrency) && (offer.TakerPays.currency === baseCurrency || offer.TakerPays === baseCurrency)) {
                    priceBaseInQuote = takerGetsAmount / takerPaysAmount;
                    priceQuoteInBase = takerPaysAmount / takerGetsAmount;
               }
          }

          return { offer, priceBaseInQuote, priceQuoteInBase };
     });

     // Find best bid and ask (for TST/XRP)
     const bids = pricedOffers.filter(o => o.priceBaseInQuote && (o.offer.TakerGets.currency === baseCurrency || o.offer.TakerGets === baseCurrency));
     const asks = pricedOffers.filter(o => o.priceBaseInQuote && (o.offer.TakerPays.currency === baseCurrency || o.offer.TakerPays === baseCurrency));
     const bestBid = bids.length > 0 ? Math.max(...bids.map(o => o.priceBaseInQuote)) : null;
     const bestAsk = asks.length > 0 ? Math.min(...asks.map(o => o.priceBaseInQuote)) : null;

     // Format offers
     const formattedOffers = offers.map((offer, index) => formatOffer(offer, index)).join('\n');

     // Append summary
     let summary = '\n*** Order Book Summary ***\n';
     summary += bestBid ? `Best Bid (${baseCurrency}/${quoteCurrency}): ${bestBid.toFixed(6)} ${quoteCurrency} per ${baseCurrency}\n` : `No bids found for ${baseCurrency}/${quoteCurrency}\n`;
     summary += bestAsk ? `Best Ask (${baseCurrency}/${quoteCurrency}): ${bestAsk.toFixed(6)} ${quoteCurrency} per ${baseCurrency}\n` : `No asks found for ${baseCurrency}/${quoteCurrency}\n`;

     return formattedOffers + summary;
}

function formatOffersOG(offers) {
     // Conversion factor: 1 XRP = 1,000,000 drops
     const DROPS_PER_XRP = 1000000;

     // Debug: Log the input type and value
     console.log('Input type:', typeof offers, 'Input value:', offers);

     // Check if offers is an array
     if (!Array.isArray(offers)) {
          let errorMessage = 'Error: Input must be an array of offers';
          if (typeof offers === 'object' && offers !== null && Array.isArray(offers.offers)) {
               errorMessage += ". Did you mean to pass 'offers.offers'?";
          } else if (typeof offers === 'string') {
               errorMessage += '. Input is a string; try parsing it with JSON.parse.';
          }
          return errorMessage;
     }

     // Handle empty array
     if (offers.length === 0) {
          return 'No offers to display';
     }

     // Function to format a single offer
     function formatOffer(offer, index) {
          let output = `Total Offers: ${offers.length} \noffers (${index + 1}):\n`;

          // Helper function to format nested objects (e.g., TakerPays)
          function formatNestedObject(obj, indent = '\t') {
               return `{\n${Object.entries(obj)
                    .map(([key, value]) => `${indent}\t${key}: ${value}`)
                    .join('\n')}\n${indent}}`;
          }

          // Validate offer is an object
          if (typeof offer !== 'object' || offer === null) {
               return `\toffers (${index + 1}): Invalid offer data\n`;
          }

          // Iterate through offer fields
          for (const [key, value] of Object.entries(offer)) {
               let formattedValue = value;

               // Convert TakerGets from drops to XRP
               if (key === 'TakerGets') {
                    if (typeof value === 'string') {
                         // XRP in drops
                         const drops = parseInt(value);
                         formattedValue = isNaN(drops) ? 'Invalid TakerGets value' : `${(drops / 1_000_000).toFixed(6)} XRP (${drops} drops)`;
                    } else if (typeof value === 'object' && value !== null) {
                         // Issued currency (object)
                         formattedValue = formatNestedObject(value);
                    } else {
                         formattedValue = 'Invalid TakerGets format';
                    }
               } else if (key === 'TakerPays') {
                    // Handle TakerPays
                    if (typeof value === 'string') {
                         // XRP in drops
                         const drops = parseInt(value);
                         formattedValue = isNaN(drops) ? 'Invalid TakerPays value' : `${(drops / 1_000_000).toFixed(6)} XRP (${drops} drops)`;
                    } else if (typeof value === 'object' && value !== null) {
                         // Issued currency (object)
                         formattedValue = formatNestedObject(value);
                    } else {
                         formattedValue = 'Invalid TakerPays format';
                    }
               } else if (typeof value === 'object' && value !== null) {
                    // Format nested objects (TakerPays, taker_pays_funded)
                    formattedValue = formatNestedObject(value);
               } else {
                    // Convert numbers and other values to strings
                    formattedValue = String(value);
               }
               output += `\t${key}: ${formattedValue}\n`;
          }

          return output;
     }

     // Process all offers and join with newlines
     return offers.map((offer, index) => formatOffer(offer, index)).join('\n');
}

function formatOffers1(offers) {
     const DROPS_PER_XRP = 1000000;

     if (!Array.isArray(offers)) {
          let errorMessage = 'Error: Input must be an array of offers';
          if (typeof offers === 'object' && offers !== null && Array.isArray(offers.offers)) {
               errorMessage += ". Did you mean to pass 'offers.offers'?";
          } else if (typeof offers === 'string') {
               errorMessage += '. Input is a string; try parsing it with JSON.parse.';
          }
          return errorMessage;
     }

     if (offers.length === 0) {
          return 'No offers to display';
     }

     function formatNestedObject(obj, indent = '\t') {
          return `{\n${Object.entries(obj)
               .map(([key, value]) => `${indent}\t${key}: ${value}`)
               .join('\n')}\n${indent}}`;
     }

     function formatOffer(offer, index) {
          let output = `Total Offers: ${offers.length} \noffers (${index + 1}):\n`;
          let getsXRP = false;
          let paysXRP = false;
          let getsValue = 0;
          let paysValue = 0;
          let getsCurrency = 'XRP';
          let paysCurrency = 'XRP';

          for (const [key, value] of Object.entries(offer)) {
               if (key === 'Account' || key === 'TakerGets' || key === 'TakerPays') {
                    let formattedValue = value;

                    if (key === 'TakerGets') {
                         if (typeof value === 'string') {
                              const drops = parseInt(value);
                              getsValue = drops / DROPS_PER_XRP;
                              getsXRP = true;
                              formattedValue = `${getsValue.toFixed(6)} XRP (${drops} drops)`;
                         } else if (typeof value === 'object' && value !== null) {
                              getsValue = parseFloat(value.value);
                              getsCurrency = value.currency;
                              formattedValue = formatNestedObject(value);
                         } else {
                              formattedValue = 'Invalid TakerGets format';
                         }
                    } else if (key === 'TakerPays') {
                         if (typeof value === 'string') {
                              const drops = parseInt(value);
                              paysValue = drops / DROPS_PER_XRP;
                              paysXRP = true;
                              formattedValue = `${paysValue.toFixed(6)} XRP (${drops} drops)`;
                         } else if (typeof value === 'object' && value !== null) {
                              paysValue = parseFloat(value.value);
                              paysCurrency = value.currency;
                              formattedValue = formatNestedObject(value);
                         } else {
                              formattedValue = 'Invalid TakerPays format';
                         }
                    } else if (typeof value === 'object' && value !== null) {
                         formattedValue = formatNestedObject(value);
                    } else {
                         formattedValue = String(value);
                    }

                    output += `\t${key}: ${formattedValue}\n`;
               }
          }

          // Add calculated exchange rates
          try {
               if (getsValue > 0 && paysValue > 0) {
                    const forwardRate = paysValue / getsValue;
                    const inverseRate = getsValue / paysValue;

                    output += `\tExchange Rate: 1 ${getsCurrency} = ${forwardRate.toFixed(6)} ${paysCurrency}\n`;
                    output += `\tInverse Rate: 1 ${paysCurrency} = ${inverseRate.toFixed(6)} ${getsCurrency}\n`;
               }
          } catch (e) {
               output += `\tExchange Rate: Error calculating exchange rate\n`;
          }

          return output;
     }

     return offers.map((offer, index) => formatOffer(offer, index)).join('\n');
}

// async function getCurrencyBalance(currencyCode) {
//      try {
//           const accountAddressField = document.getElementById('accountAddressField');
//           const response = await fetchAccountObjects(accountAddressField);
//           const accountObjects = response.result.account_objects;
//           const matchingObject = accountObjects.find(obj => obj.Balance.currency === currencyCode.toUpperCase());
//           return matchingObject ? matchingObject.Balance.value : null;
//      } catch (error) {
//           console.error('Error fetching balance:', error);
//           return null;
//      }
// }

async function getCurrencyBalance(currencyCode) {
     try {
          const accountAddressField = document.getElementById('accountAddressField');
          const response = await fetchAccountObjects(accountAddressField);
          const accountObjects = response.result.account_objects;

          const matchingObjects = accountObjects.filter(obj => obj.Balance && obj.Balance.currency === currencyCode.toUpperCase());

          const total = matchingObjects.reduce((sum, obj) => {
               return sum + parseFloat(obj.Balance.value);
          }, 0);

          return total;
     } catch (error) {
          console.error('Error fetching balance:', error);
          return null;
     }
}

async function getXrpBalance() {
     try {
          const client = await getClient();
          const accountAddressField = document.getElementById('accountAddressField');
          return await client.getXrpBalance(accountAddressField.value);
     } catch (error) {
          console.error('Error fetching balance:', error);
          return null;
     }
}

window.createOffer = createOffer;
window.getOffers = getOffers;
window.cancelOffer = cancelOffer;
window.getOrderBook = getOrderBook;
window.getCurrencyBalance = getCurrencyBalance;
window.getXrpBalance = getXrpBalance;
window.getTokenBalance = getTokenBalance;
window.populate1 = populate1;
window.populate2 = populate2;
window.populate3 = populate3;
window.populateTakerGetsTakerPayFields = populateTakerGetsTakerPayFields;
