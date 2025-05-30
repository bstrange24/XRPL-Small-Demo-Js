import * as xrpl from 'xrpl';
import { getClient, disconnectClient, validatInput, getEnvironment, populate1, populate2, populate3, populateTakerGetsTakerPayFields, parseOffersTransactionDetails, parseTransactionDetails, getNet, amt_str, getOnlyTokenBalance, getCurrentLedger, parseXRPLAccountObjects, displayAccountObjects, setError, autoResize } from './utils.js';
import { fetchAccountObjects, getTrustLines } from './account.js';
import BigNumber from 'bignumber.js';

async function createOffer() {
     console.log('Entering createOffer');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     let we_want;
     let takerGetsString;
     let we_spend;
     let takerPaysString;

     const fields = {
          accountName: document.getElementById('accountNameField'),
          accountAddress: document.getElementById('accountAddressField'),
          accountSeed: document.getElementById('accountSeedField'),
          xrpBalance: document.getElementById('xrpBalanceField'),
          weWantCurrency: document.getElementById('weWantCurrencyField'),
          weSpendCurrency: document.getElementById('weSpendCurrencyField'),
          weWantIssuer: document.getElementById('weWantIssuerField'),
          weSpendIssuer: document.getElementById('weSpendIssuerField'),
          weWantAmount: document.getElementById('weWantAmountField'),
          weSpendAmount: document.getElementById('weSpendAmountField'),
     };

     // DOM existence check
     for (const [name, field] of Object.entries(fields)) {
          if (!field) return setError(`ERROR: DOM element ${name} not found`, spinner);
     }

     // Destructure fields
     const { accountName: accountNameField, accountAddress: accountAddressField, accountSeed: accountSeedField, xrpBalance: xrpBalanceField, weWantCurrency: weWantCurrencyField, weWantIssuer: weWantIssuerField, weWantAmount: weWantAmountField, weSpendCurrency: weSpendCurrencyField, weSpendIssuer: weSpendIssuerField, weSpendAmount: weSpendAmountField } = fields;

     // Validation checks
     const validations = [
          [!validatInput(accountAddressField.value), 'ERROR: Account Address can not be empty'],
          [!validatInput(accountSeedField.value), 'ERROR: Account seed amount can not be empty'],
          [!validatInput(xrpBalanceField.value), 'ERROR: XRP balance can not be empty'],
          [!validatInput(weWantCurrencyField.value), 'ERROR: Taker Gets currency can not be empty'],
          [!validatInput(weSpendCurrencyField.value), 'ERROR: Taker Pays currency can not be empty'],
          [!validatInput(weWantAmountField.value), 'ERROR: Taker Gets amount cannot be empty'],
          [isNaN(weWantAmountField.value), 'ERROR: Taker Gets amount must be a valid number'],
          [parseFloat(weWantAmountField.value) <= 0, 'ERROR: Taker Gets amount must be greater than zero'],
          [!validatInput(weSpendAmountField.value), 'ERROR: Taker Pays amount cannot be empty'],
          [isNaN(weSpendAmountField.value), 'ERROR: Taker Pays amount must be a valid number'],
          [parseFloat(weSpendAmountField.value) <= 0, 'ERROR: Taker Pays amount must be greater than zero'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

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
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving createOffer');
     }
}

async function getOffers() {
     console.log('Entering getOffers');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const accountSeedField = document.getElementById('accountSeedField');
     const xrpBalanceField = document.getElementById('xrpBalanceField');

     if (!accountSeedField || !xrpBalanceField) return setError('ERROR: DOM elements not found', spinner);

     const seed = accountSeedField.value.trim();
     if (!validatInput(seed)) return setError('ERROR: Seed cannot be empty', spinner);

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
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving getOffers');
     }
}

async function cancelOffer() {
     console.log('Entering cancelOffer');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          accountSeed: document.getElementById('accountSeedField'),
          xrpBalance: document.getElementById('xrpBalanceField'),
          offerSequence: document.getElementById('offerSequenceField'),
     };

     // DOM existence check
     for (const [name, field] of Object.entries(fields)) {
          if (!field) return setError(`ERROR: DOM element ${name} not found`, spinner);
     }

     // Destructure fields
     const { accountSeed: accountSeedField, xrpBalance: xrpBalanceField, offerSequence: offerSequenceField } = fields;

     // Validation checks
     const validations = [
          [!validatInput(accountSeedField.value), 'ERROR: Account seed amount can not be empty'],
          [!validatInput(xrpBalanceField.value), 'ERROR: XRP balance can not be empty'],
          [!validatInput(offerSequenceField.value), 'ERROR: Offer Sequence amount cannot be empty'],
          [isNaN(offerSequenceField.value), 'ERROR: Offer Sequence must be a valid number'],
          [parseFloat(offerSequenceField.value) <= 0, 'ERROR: Offer Sequence must be greater than zero'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

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

          xrpBalanceField.value = await client.getXrpBalance(wallet.address);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving cancelOffer');
     }
}

async function getOrderBook() {
     console.log('Entering getOrderBook');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          accountName: document.getElementById('accountNameField'),
          accountAddress: document.getElementById('accountAddressField'),
          accountSeed: document.getElementById('accountSeedField'),
          xrpBalance: document.getElementById('xrpBalanceField'),
          weWantCurrency: document.getElementById('weWantCurrencyField'),
          weWantIssuer: document.getElementById('weWantIssuerField'),
          weWantAmount: document.getElementById('weWantAmountField'),
          weSpendCurrency: document.getElementById('weSpendCurrencyField'),
          weSpendIssuer: document.getElementById('weSpendIssuerField'),
          weSpendAmount: document.getElementById('weSpendAmountField'),
     };

     // DOM existence check
     for (const [name, field] of Object.entries(fields)) {
          if (!field) return setError(`ERROR: DOM element ${name} not found`, spinner);
     }

     // Destructure fields
     const { accountName: accountNameField, accountAddress: accountAddressField, accountSeed: accountSeedField, xrpBalance: xrpBalanceField, weWantCurrency: weWantCurrencyField, weWantIssuer: weWantIssuerField, weWantAmount: weWantAmountField, weSpendCurrency: weSpendCurrencyField, weSpendIssuer: weSpendIssuerField, weSpendAmount: weSpendAmountField } = fields;

     // Validation checks
     const validations = [
          [!validatInput(accountNameField.value), 'ERROR: Account Name can not be empty'],
          [!validatInput(accountAddressField.value), 'ERROR: Account Address can not be empty'],
          [!validatInput(accountSeedField.value), 'ERROR: Account seed amount can not be empty'],
          [!validatInput(xrpBalanceField.value), 'ERROR: XRP balance can not be empty'],
          [!validatInput(weWantCurrencyField.value), 'ERROR: Taker Gets currency can not be empty'],
          [!validatInput(weSpendCurrencyField.value), 'ERROR: Taker Pays currency can not be empty'],
          [!validatInput(weWantAmountField.value), 'ERROR: Taker Gets amount cannot be empty'],
          [isNaN(weWantAmountField.value), 'ERROR: Taker Gets amount must be a valid number'],
          [parseFloat(weWantAmountField.value) <= 0, 'ERROR: Taker Gets amount must be greater than zero'],
          [!validatInput(weSpendAmountField.value), 'ERROR: Taker Pays amount cannot be empty'],
          [isNaN(weSpendAmountField.value), 'ERROR: Taker Pays amount must be a valid number'],
          [parseFloat(weSpendAmountField.value) <= 0, 'ERROR: Taker Pays amount must be greater than zero'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     const buildCurrencyObject = (currency, issuer, value) => (currency === 'XRP' ? { currency, value } : { currency, issuer, value });

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

          const wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'secp256k1' });

          let results = `Connected to ${environment}.\nGet Order Book.\n\n`;
          results += `${accountNameField.value} account: ${wallet.address}\n\n*** Order Book ***\n`;

          const we_want = buildCurrencyObject(weWantCurrencyField.value, weWantIssuerField.value, weWantAmountField.value);
          const we_spend = buildCurrencyObject(weSpendCurrencyField.value, weSpendIssuerField.value, weSpendAmountField.value);

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
          results += formatOffers(sortedOffers);
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
          results += formatOffers(reverseSorted);
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
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving getOrderBook');
     }
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

function formatOffers(offers) {
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
window.populate1 = populate1;
window.populate2 = populate2;
window.populate3 = populate3;
window.populateTakerGetsTakerPayFields = populateTakerGetsTakerPayFields;
window.autoResize = autoResize;
window.disconnectClient = disconnectClient;
