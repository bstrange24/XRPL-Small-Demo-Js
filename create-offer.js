import * as xrpl from 'xrpl';
import { getClient, disconnectClient, validatInput, populate1, populate2, populate3, populateTakerGetsTakerPayFields, parseXRPLTransaction, getNet, amt_str, getOnlyTokenBalance, getCurrentLedger, parseXRPLAccountObjects, setError, autoResize, gatherAccountInfo, clearFields, distributeAccountInfo, getTransaction, updateOwnerCountAndReserves, safeDrops } from './utils.js';
import { fetchAccountObjects, getTrustLines } from './account.js';
import { getTokenBalance } from './send-currency.js';
import BigNumber from 'bignumber.js';

async function createOffer() {
     console.log('Entering createOffer');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const isMarketOrder = document.getElementById('isMarketOrder')?.checked;
     // const unit = document.getElementById('unitSelect').value;

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');

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
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim(); // Trim whitespace
          }
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

          let results = `Connected to ${environment} ${net}\nCreating Offer.\n\n`;
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

          let tokenBalance = weSpendCurrencyField.value === 'XRP' ? weWantCurrencyField.value : weSpendCurrencyField.value;
          const tstBalance = await getOnlyTokenBalance(client, wallet.address, tokenBalance);
          console.log(`${tokenBalance} Balance: ${tstBalance}`);
          resultField.value += `\nInital ${tokenBalance} Balance: ${tstBalance}\n\n`;

          // Build currency objects
          let we_want = weWantCurrencyField.value === 'XRP' ? { currency: 'XRP', value: weWantAmountField.value } : { currency: weWantCurrencyField.value, issuer: weWantIssuerField.value, value: weWantAmountField.value };
          let we_spend = weSpendCurrencyField.value === 'XRP' ? { currency: 'XRP', value: weSpendAmountField.value } : { currency: weSpendCurrencyField.value, issuer: weSpendIssuerField.value, value: weSpendAmountField.value };

          if (weSpendCurrencyField.value === 'XRP' && xrpl.xrpToDrops(xrpBalance) < Number(weSpendAmountField.value)) {
               throw new Error('Insufficient XRP balance');
          } else if (weSpendCurrencyField.value !== 'XRP' && tstBalance < weSpendAmountField.value) {
               throw new Error(`Insufficient ${weSpendCurrencyField.value} balance`);
          }

          console.log(`we_want ${we_want}`);
          console.log(`we_spend ${we_spend}`);

          const offerType = we_spend.currency === 'XRP' ? 'buy' : 'sell';
          console.log(`Offer Type: ${offerType}`);

          // Get reserve requirements
          const xrpReserve = await getXrpReserveRequirements(client, wallet.address);

          // "Quality" is defined as TakerPays / TakerGets. The lower the "quality"
          // number, the better the proposed exchange rate is for the taker.
          // The quality is rounded to a number of significant digits based on the
          // issuer's TickSize value (or the lesser of the two for token-token trades.)

          // const proposed_quality = BigNumber(weSpendAmountField.value) / BigNumber(weWantAmountField.value);
          const proposed_quality = new BigNumber(weSpendAmountField.value).dividedBy(weWantAmountField.value); // XRP/TOKEN

          // Calculate effective rate
          const effectiveRate = calculateEffectiveRate(proposed_quality, xrpReserve, offerType);
          console.log(`Proposed rate: ${proposed_quality.toString()}`);
          console.log(`Effective rate (including reserves): ${effectiveRate.toString()}`);

          resultField.value += `Rate Analysis:\n- Proposed Rate: 1 ${we_want.currency} = ${proposed_quality.toFixed(6)} ${we_spend.currency}\n`;
          resultField.value += `- Effective Rate: 1 ${we_want.currency} = ${effectiveRate.toFixed(6)} ${we_spend.currency}\n\n`;

          if (effectiveRate.gt(proposed_quality)) {
               console.log(`Note: Effective rate is worse than proposed due to XRP reserve requirements`);
          }

          // Look up Offers. -----------------------------------------------------------
          // To buy TOKEN, look up Offers where "TakerGets" is TOKEN and "TakerPays" is XRP.:
          console.log(`To buy ${we_want.currency}, look up Offers where "TakerGets" is ${we_want.currency} and "TakerPays" is ${we_spend.currency}.`);
          const orderbook_resp = await client.request({
               method: 'book_offers',
               taker: wallet.address,
               ledger_index: 'current',
               taker_gets: we_want,
               taker_pays: we_spend,
          });
          console.log(`orderbook_resp: ${orderbook_resp.result}`);

          let oppositeOrderBook = await client.request({
               method: 'book_offers',
               taker: wallet.address,
               ledger_index: 'current',
               taker_gets: we_spend,
               taker_pays: we_want,
          });
          console.log(`oppositeOrderBook: ${oppositeOrderBook.result}`);

          // Estimate whether a proposed Offer would execute immediately, and...
          // If so, how much of it? (Partial execution is possible)
          // If not, how much liquidity is above it? (How deep in the order book would
          //    other Offers have to go before ours would get taken?)
          // Note: These estimates can be thrown off by rounding if the token issuer
          // uses a TickSize setting other than the default (15). In that case, you
          // can increase the TakerGets amount of your final Offer to compensate.

          const MAX_SLIPPAGE = 0.05; // 5% slippage tolerance
          const offers = orderbook_resp.result.offers;
          let running_total = new BigNumber(0);
          const want_amt = new BigNumber(we_want.value);
          let best_offer_quality = new BigNumber(0);

          if (offers.length > 0) {
               for (const o of offers) {
                    const offer_quality = new BigNumber(o.quality);
                    if (!best_offer_quality || offer_quality.lt(best_offer_quality)) {
                         best_offer_quality = offer_quality;
                    }
                    if (offer_quality.lte(effectiveRate.times(1 + MAX_SLIPPAGE))) {
                         const slippage = proposed_quality.minus(offer_quality).dividedBy(offer_quality);
                         if (slippage.gt(MAX_SLIPPAGE)) {
                              throw new Error(`Slippage ${slippage.times(100).toFixed(2)}% exceeds ${MAX_SLIPPAGE * 100}%`);
                         }
                         resultField.value += `Market Analysis:\n- Best Rate: 1 ${we_want.currency} = ${offer_quality.toFixed(6)} ${we_spend.currency}\n`;
                         resultField.value += `- Proposed Rate: 1 ${we_want.currency} = ${proposed_quality.toFixed(6)} ${we_spend.currency}\n`;
                         resultField.value += `- Slippage: ${slippage.times(100).toFixed(2)}%\n`;
                         running_total = running_total.plus(new BigNumber(o.owner_funds || o.TakerGets.value));
                         if (running_total.gte(want_amt)) break;
                    }
               }
          }

          // if (!offers) {
          //      console.log(`No Offers in the matching book. Offer probably won't execute immediately.`);
          // } else {
          //      for (const o of offers) {
          //           // if (o.quality <= proposed_quality) {
          //           if (o.quality <= effectiveRate) {
          //                // Get the best offer quality (first offer in the list is always best price)
          //                const best_offer_quality = new BigNumber(o.quality);
          //                const proposed_quality = new BigNumber(weSpendAmountField.value).dividedBy(weWantAmountField.value);
          //                console.log(`best_offer_quality: ${best_offer_quality} proposed_quality: ${proposed_quality}`);
          //                console.log(`Best available rate: 1 ${we_want.currency} = ${best_offer_quality} ${we_spend.currency}`);
          //                console.log(`Your proposed rate: 1 ${we_want.currency} = ${proposed_quality} ${we_spend.currency}`);

          //                // Calculate slippage percentage
          //                const slippage = proposed_quality.minus(best_offer_quality).dividedBy(best_offer_quality);
          //                console.log(`Slippage: ${slippage}%`);
          //                console.log(`Slippage: ${slippage.times(100).toFixed(2)}%`);

          //                if (slippage.gt(MAX_SLIPPAGE)) {
          //                     throw new Error(`Potential slippage ${slippage.times(100).toFixed(2)}% exceeds maximum allowed ${MAX_SLIPPAGE * 100}%`);
          //                }

          //                // Add this information to your UI
          //                resultField.value += `\nMarket Analysis:\n`;
          //                resultField.value += `- Best available rate: 1 ${we_want.currency} = ${best_offer_quality.toFixed(6)} ${we_spend.currency}\n`;
          //                resultField.value += `- Your proposed rate: 1 ${we_want.currency} = ${proposed_quality.toFixed(6)} ${we_spend.currency}\n`;
          //                resultField.value += `- Slippage: ${slippage.times(100).toFixed(2)}%\n`;

          //                console.log(`Matching Offer found, funded with ${o.owner_funds} ${we_want.currency}`);
          //                running_total = running_total.plus(BigNumber(o.owner_funds));
          //                if (running_total >= want_amt) {
          //                     console.log('Full Offer will probably fill');
          //                     break;
          //                }
          //           } else {
          //                // Offers are in ascending quality order, so no others after this
          //                // will match, either
          //                console.log(`Remaining orders too expensive.`);
          //                break;
          //           }
          //      }

          //      console.log(`Total matched: ${Math.min(running_total, want_amt)} ${we_want.currency}`);
          //      if (running_total > 0 && running_total < want_amt) {
          //           console.log(`Remaining ${want_amt - running_total} ${we_want.currency} would probably be placed on top of the order book.`);
          //      }
          // }

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
               console.log('orderbook2_resp: ', orderbook2_resp.result);

               // Since TakerGets/TakerPays are reversed, the quality is the inverse.
               // You could also calculate this as 1/proposed_quality.
               const offered_quality = BigNumber(we_want.value) / BigNumber(we_spend.value);

               // Calculate effective rate
               const effectiveRate = calculateEffectiveRate(proposed_quality, xrpReserve, offerType);
               console.log(`Proposed rate: ${proposed_quality.toString()}`);
               console.log(`Effective rate (including reserves): ${effectiveRate.toString()}`);

               resultField.value += `Rate Analysis:\n`;
               resultField.value += `- Proposed Rate: 1 ${we_spend.currency} = ${proposed_quality} ${we_want.currency}\n`;
               resultField.value += `- Effective Rate (incl. costs): 1 ${we_spend.currency} = ${effectiveRate.toFixed(6)} ${we_want.currency}\n\n`;

               if (effectiveRate.gt(offered_quality)) {
                    resultField.value += `Note: Effective rate is worse than proposed due to XRP reserve requirements\n\n`;
               }

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
                         if (o.quality <= effectiveRate) {
                              // if (o.quality <= offered_quality) {
                              // Get the best offer quality (first offer in the list is always best price)
                              const best_offer_quality = new BigNumber(o.quality);
                              const proposed_quality = new BigNumber(weSpendAmountField.value).dividedBy(weWantAmountField.value);

                              console.log(`Best available rate: 1 ${we_spend.currency} = ${best_offer_quality} ${we_want.currency}`);
                              console.log(`Your proposed rate: 1 ${we_spend.currency} = ${proposed_quality} ${we_want.currency}`);

                              // Calculate slippage percentage
                              const slippage = proposed_quality.minus(best_offer_quality).dividedBy(best_offer_quality);
                              console.log(`Slippage: ${slippage.times(100).toFixed(2)}%`);

                              if (slippage.gt(MAX_SLIPPAGE)) {
                                   throw new Error(`Potential slippage ${slippage.times(100).toFixed(2)}% exceeds maximum allowed ${MAX_SLIPPAGE * 100}%`);
                              }

                              // Add this information to your UI
                              resultField.value += `\nMarket Analysis:\n`;
                              resultField.value += `- Best available rate: 1 ${we_spend.currency} = ${best_offer_quality.toFixed(6)} ${we_want.currency}\n`;
                              resultField.value += `- Your proposed rate: 1 ${we_spend.currency} = ${proposed_quality.toFixed(6)} ${we_want.currency}\n`;
                              resultField.value += `- Slippage: ${slippage.times(100).toFixed(2)}%\n`;

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
                    Flags: isMarketOrder ? xrpl.OfferCreateFlags.tfImmediateOrCancel : 0,
               });
          } else {
               prepared = await client.autofill({
                    TransactionType: 'OfferCreate',
                    Account: wallet.address,
                    TakerGets: we_spend,
                    TakerPays: we_want.value,
                    Flags: isMarketOrder ? xrpl.OfferCreateFlags.tfImmediateOrCancel : 0,
               });
          }

          console.debug(`prepared ${prepared}`);

          const signed = wallet.sign(prepared);
          results += '\nSubmitting transaction';
          const tx = await client.submitAndWait(signed.tx_blob);
          console.debug(`create offer tx ${tx}`);

          if (tx.result.meta.TransactionResult == 'tesSUCCESS') {
               console.log(`Transaction succeeded: https://testnet.xrpl.org/transactions/${signed.hash}`);
               // resultField.value += `Transaction succeeded: https://testnet.xrpl.org/transactions/${signed.hash}\n`;
               resultField.value += parseXRPLTransaction(tx.result);
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
          console.log('Total balance changes:', balance_changes);

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
                         console.log(`Created an Offer owned by ${offer.Account} with TakerGets=${amt_str(offer.TakerGets)} and TakerPays=${amt_str(offer.TakerPays)}.`);
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
          console.log('Balances', balances.result);

          // Check Offers --------------------------------------------------------------
          console.log(`Getting outstanding Offers from ${wallet.address} as of validated ledger`);
          const acct_offers = await client.request({
               command: 'account_offers',
               account: wallet.address,
               ledger_index: 'validated',
          });
          console.log('Getting outstanding Offers ', acct_offers.result);

          const updatedBalance = await getOnlyTokenBalance(client, wallet.address, tokenBalance);
          console.log(`${tokenBalance} Updated Balance: ${updatedBalance}`);
          resultField.value += `\n\n${tokenBalance} Updated Balance: ${updatedBalance}\n`;

          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
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

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');

     const accountSeedField = document.getElementById('accountSeedField');
     const xrpBalanceField = document.getElementById('xrpBalanceField');

     if (!accountSeedField || !xrpBalanceField) return setError('ERROR: DOM elements not found', spinner);

     const seed = accountSeedField.value.trim();
     if (!validatInput(seed)) return setError('ERROR: Seed cannot be empty', spinner);

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          let results = `Connected to ${environment} ${net}\nGetting Offers\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed, { algorithm: 'secp256k1' });

          const offers = await client.request({
               method: 'account_offers',
               account: wallet.address,
               ledger_index: 'validated',
          });

          console.log('offers:', offers);

          if (offers.result.offers.length <= 0) {
               results += `No offers found for ${wallet.address}`;
               resultField.value = results;
               resultField.classList.add('success');
               return;
          }

          results += parseXRPLAccountObjects(offers.result);
          // results += parseXRPLTransaction(offers.result);
          resultField.value = results;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
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

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');

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
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.value = `Connected to ${environment} ${net}\nCancel Offers.\n\n`;

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
               resultField.value += 'Transaction succeeded:\n';
               resultField.value += parseXRPLTransaction(tx.result);
               console.log(`Transaction succeeded: https://testnet.xrpl.org/transactions/${tx.result.hash}`);
               console.log();
               resultField.classList.add('success');
          } else {
               results += `Error sending transaction: ${tx.result.meta.TransactionResult}`;
               resultField.value += results;
               resultField.classList.add('error');
          }

          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
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

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');

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
          const { net, environment } = getNet();
          const client = await getClient();

          const wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'secp256k1' });

          let results = `Connected to ${environment} ${net}\nGet Order Book.\n\n`;
          results += `${accountNameField.value} account: ${wallet.address}\n\n*** Order Book ***\n`;

          const we_want = buildCurrencyObject(weWantCurrencyField.value, weWantIssuerField.value, weWantAmountField.value);
          const we_spend = buildCurrencyObject(weSpendCurrencyField.value, weSpendIssuerField.value, weSpendAmountField.value);
          console.log('we_want:', we_want);
          console.log('we_spend:', we_spend);

          const offerType = we_spend.currency === 'XRP' ? 'buy' : 'sell';
          console.log(`Offer Type: ${offerType}`);
          let orderBook;
          let buySideOrderBook;
          let sellSideOrderBook;
          let spread;
          let liquidity;
          if (offerType === 'sell') {
               console.log(`SELLING`);
               orderBook = await client.request({
                    method: 'book_offers',
                    taker: wallet.address,
                    ledger_index: 'current',
                    taker_gets: we_want,
                    taker_pays: we_spend,
               });

               buySideOrderBook = await client.request({
                    method: 'book_offers',
                    taker: wallet.address,
                    ledger_index: 'current',
                    taker_gets: we_spend,
                    taker_pays: we_want,
               });
               console.log('buySideOrderBook: ' + JSON.stringify(buySideOrderBook.result.offers, null, 2));
               spread = computeBidAskSpread(buySideOrderBook.result.offers, orderBook.result.offers);
               liquidity = computeLiquidityRatio(buySideOrderBook.result.offers, orderBook.result.offers, false);
          } else {
               console.log(`BUYING`);
               orderBook = await client.request({
                    method: 'book_offers',
                    taker: wallet.address,
                    ledger_index: 'current',
                    taker_gets: we_want,
                    taker_pays: we_spend,
               });

               sellSideOrderBook = await client.request({
                    method: 'book_offers',
                    taker: wallet.address,
                    ledger_index: 'current',
                    taker_gets: we_spend,
                    taker_pays: we_want,
               });
               console.log('sellSideOrderBook: ' + JSON.stringify(sellSideOrderBook.result.offers, null, 2));
               spread = computeBidAskSpread(orderBook.result.offers, sellSideOrderBook.result.offers);
               liquidity = computeLiquidityRatio(orderBook.result.offers, sellSideOrderBook.result.offers);
          }

          if (orderBook.result.offers.length <= 0) {
               results += `No orders in the order book for ${we_spend.currency}/${we_want.currency}\n`;
          } else {
               results += formatOffers(orderBook.result.offers);
               // results += `\n--- Aggregate Exchange Rate Stats ---\n`;
               const stats = computeAverageExchangeRateBothWays(orderBook.result.offers, 15);

               populateStatsFields(stats, we_want, we_spend, spread, liquidity, offerType);

               // results += `VWAP: ${stats.forward.vwap.toFixed(8)} ${we_want.currency}/${we_spend.currency}\n`;
               // results += `Simple Avg: ${stats.forward.simpleAvg.toFixed(8)} ${we_want.currency}/${we_spend.currency}\n`;
               // results += `Best Rate: ${stats.forward.bestRate.toFixed(8)} ${we_want.currency}/${we_spend.currency}\n`;
               // results += `Worst Rate: ${stats.forward.worstRate.toFixed(8)} ${we_want.currency}/${we_spend.currency}\n`;

               // results += `Depth (5% slippage): ${stats.forward.depthDOG.toFixed(2)} ${we_want.currency} for ${stats.forward.depthXRP.toFixed(2)} ${we_spend.currency}\n`;
               // if (stats.forward.insufficientLiquidity) {
               //      results += `For ${15} ${we_spend.currency}: Insufficient liquidity (only ${stats.forward.executionDOG.toFixed(2)} ${we_want.currency} for ${stats.forward.executionXRP.toFixed(2)} ${we_spend.currency} available), Avg Rate: ${stats.forward.executionPrice.toFixed(8)} ${we_want.currency}/${we_spend.currency}\n`;
               // } else {
               //      results += `For ${15} ${we_spend.currency}: Receive ${stats.forward.executionDOG.toFixed(2)} ${we_want.currency}, Avg Rate: ${stats.forward.executionPrice.toFixed(8)} ${we_want.currency}/${we_spend.currency}\n`;
               // }
               // results += `Price Volatility: Mean ${stats.forward.simpleAvg.toFixed(8)} ${we_want.currency}/${we_spend.currency}, StdDev ${stats.forward.volatility.toFixed(8)} (${stats.forward.volatilityPercent.toFixed(2)}%)\n`;
               // if (offerType === 'buy') {
               //      results += `Spread: ${spread.spread.toFixed(8)} ${we_want.currency}/${we_spend.currency} (${spread.spreadPercent.toFixed(2)}%)\n`;
               // } else {
               //      results += `Spread: ${spread.spread.toFixed(8)} ${we_spend.currency}/${we_want.currency} (${spread.spreadPercent.toFixed(2)}%)\n`;
               // }
               // results += `Liquidity Ratio: ${liquidity.ratio.toFixed(2)} (${we_want.currency}/${we_spend.currency} vs ${we_spend.currency}/${we_want.currency})\n`;
          }

          resultField.value = results;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
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

function computeBidAskSpread(tokenXrpOffers, xrpTokenOffers) {
     let bestTokenXrp = 0;
     if (tokenXrpOffers.length > 0) {
          const getsValue = tokenXrpOffers[0].TakerGets.value ? parseFloat(tokenXrpOffers[0].TakerGets.value) : parseFloat(tokenXrpOffers[0].TakerGets) / 1_000_000;
          const paysValue = tokenXrpOffers[0].TakerPays.value ? parseFloat(tokenXrpOffers[0].TakerPays.value) : parseFloat(tokenXrpOffers[0].TakerPays) / 1_000_000;
          bestTokenXrp = getsValue / paysValue;
     }

     let bestXrpToken = 0;
     if (xrpTokenOffers.length > 0) {
          const getsValue = xrpTokenOffers[0].TakerGets.value ? parseFloat(xrpTokenOffers[0].TakerGets.value) : parseFloat(xrpTokenOffers[0].TakerGets) / 1_000_000;
          const paysValue = xrpTokenOffers[0].TakerPays.value ? parseFloat(xrpTokenOffers[0].TakerPays.value) : parseFloat(xrpTokenOffers[0].TakerPays) / 1_000_000;
          bestXrpToken = getsValue / paysValue;
     }

     const bestXrpTokenInverse = bestXrpToken > 0 ? 1 / bestXrpToken : 0;
     const spread = bestTokenXrp > 0 && bestXrpToken > 0 ? Math.abs(bestTokenXrp - bestXrpTokenInverse) : 0;
     const midPrice = bestTokenXrp > 0 && bestXrpToken > 0 ? (bestTokenXrp + bestXrpTokenInverse) / 2 : 0;
     const spreadPercent = midPrice > 0 ? (spread / midPrice) * 100 : 0;
     return { spread, spreadPercent, bestTokenXrp, bestXrpToken };
}

function computeLiquidityRatio(tokenXrpOffers, xrpTokenOffers, isTokenXrp = true) {
     let tokenVolume = 0;
     if (tokenXrpOffers.length > 0) {
          tokenVolume = tokenXrpOffers.reduce((sum, offer) => sum + (offer.TakerGets.value ? parseFloat(offer.TakerGets.value) : parseFloat(offer.TakerGets) / 1_000_000), 0);
     }

     let xrpVolume = 0;
     if (xrpTokenOffers.length > 0) {
          xrpVolume = xrpTokenOffers.reduce((sum, offer) => sum + (offer.TakerGets.value ? parseFloat(offer.TakerGets.value) : parseFloat(offer.TakerGets) / 1_000_000), 0);
     }

     const ratio = isTokenXrp ? (xrpVolume > 0 ? tokenVolume / xrpVolume : 0) : tokenVolume > 0 ? xrpVolume / tokenVolume : 0;
     return { tokenVolume, xrpVolume, ratio };
}

function computeAverageExchangeRateBothWays(offers, tradeSizeXRP = 15) {
     let totalPays = 0; // XRP
     let totalGets = 0; // TOKEN
     let forwardRates = []; // TOKEN/XRP
     let inverseRates = []; // XRP/TOKEN
     let bestQuality = Infinity;

     offers.forEach(offer => {
          let getsValue = typeof offer.TakerGets === 'string' ? parseFloat(offer.TakerGets) / 1_000_000 : parseFloat(offer.TakerGets.value); // TOKEN
          let paysValue = typeof offer.TakerPays === 'string' ? parseFloat(offer.TakerPays) / 1_000_000 : parseFloat(offer.TakerPays.value); // XRP
          if (getsValue > 0 && paysValue > 0) {
               totalPays += paysValue;
               totalGets += getsValue;
               forwardRates.push(getsValue / paysValue); // TOKEN/XRP
               inverseRates.push(paysValue / getsValue); // XRP/TOKEN
               bestQuality = Math.min(bestQuality, paysValue / getsValue); // Quality = XRP/TOKEN
          }
     });

     // Depth at 5% slippage
     const maxQuality = bestQuality * 1.05;
     let depthGets = 0; // TOKEN
     let depthPays = 0; // XRP
     offers.forEach(offer => {
          const getsValue = typeof offer.TakerGets === 'string' ? parseFloat(offer.TakerGets) / 1_000_000 : parseFloat(offer.TakerGets.value);
          const paysValue = typeof offer.TakerPays === 'string' ? parseFloat(offer.TakerPays) / 1_000_000 : parseFloat(offer.TakerPays.value);
          if (paysValue / getsValue <= maxQuality) {
               depthGets += getsValue;
               depthPays += paysValue;
          }
     });

     // Execution price for paying tradeSizeXRP XRP
     let execGets = 0; // TOKEN
     let execPays = 0; // XRP
     let remainingPays = tradeSizeXRP; // Want to pay tradeSizeXRP XRP
     let insufficientLiquidity = false;
     for (const offer of offers) {
          const getsValue = typeof offer.TakerGets === 'string' ? parseFloat(offer.TakerGets) / 1_000_000 : parseFloat(offer.TakerGets.value);
          const paysValue = typeof offer.TakerPays === 'string' ? parseFloat(offer.TakerPays) / 1_000_000 : parseFloat(offer.TakerPays.value);
          const paysToUse = Math.min(remainingPays, paysValue);
          if (paysToUse > 0) {
               execGets += (paysToUse / paysValue) * getsValue;
               execPays += paysToUse;
               remainingPays -= paysToUse;
          }
          if (remainingPays <= 0) break;
     }
     if (remainingPays > 0) {
          insufficientLiquidity = true;
     }

     // Volatility
     const meanForward = forwardRates.length > 0 ? forwardRates.reduce((a, b) => a + b, 0) / forwardRates.length : 0;
     const varianceForward = forwardRates.length > 0 ? forwardRates.reduce((sum, rate) => sum + Math.pow(rate - meanForward, 2), 0) / forwardRates.length : 0;
     const stdDevForward = Math.sqrt(varianceForward);

     return {
          forward: {
               // TOKEN/XRP
               vwap: totalPays > 0 ? totalGets / totalPays : 0,
               simpleAvg: meanForward,
               bestRate: forwardRates.length > 0 ? Math.max(...forwardRates) : 0,
               worstRate: forwardRates.length > 0 ? Math.min(...forwardRates) : 0,
               depthDOG: depthGets,
               depthXRP: depthPays,
               executionPrice: execPays > 0 ? execGets / execPays : 0, // TOKEN/XRP
               executionDOG: execGets,
               executionXRP: execPays,
               insufficientLiquidity,
               volatility: stdDevForward,
               volatilityPercent: meanForward > 0 ? (stdDevForward / meanForward) * 100 : 0,
          },
          inverse: {
               // XRP/TOKEN
               vwap: totalGets > 0 ? totalPays / totalGets : 0,
               simpleAvg: inverseRates.length > 0 ? inverseRates.reduce((a, b) => a + b, 0) / inverseRates.length : 0,
               bestRate: inverseRates.length > 0 ? Math.max(...inverseRates) : 0,
               worstRate: inverseRates.length > 0 ? Math.min(...inverseRates) : 0,
          },
     };
}

async function getXrpReserveRequirements(client, address) {
     const accountInfo = await client.request({
          command: 'account_info',
          account: address,
          ledger_index: 'validated',
     });

     // Current XRP reserve requirements (in drops)
     const ownerReserve = 2 * 1000000; // 2 XRP per owned item (offer/trustline)
     const baseReserve = 10 * 1000000; // 10 XRP base reserve

     return {
          baseReserve: baseReserve,
          ownerReserve: ownerReserve,
          currentReserve: accountInfo.result.account_data.Reserve,
          ownerCount: accountInfo.result.account_data.OwnerCount,
     };
}

function calculateEffectiveRate(proposedQuality, reserveInfo, offerType) {
     // Convert to BigNumber for precise calculations
     const quality = new BigNumber(proposedQuality);

     // Estimate additional reserve requirements for this offer
     // Each new offer typically requires 2 XRP owner reserve
     const additionalReserveCost = new BigNumber(reserveInfo.ownerReserve);

     // For simplicity, we'll amortize the reserve cost over the offer amount
     // This is a simplified model - adjust based on your trading strategy
     const reserveCostFactor = additionalReserveCost
          .dividedBy(new BigNumber(10).pow(6)) // Convert to XRP
          .dividedBy(quality); // Spread over the offer amount

     // Adjust the quality based on reserve costs
     // For buy offers: effective rate is slightly worse (higher)
     // For sell offers: effective rate is slightly worse (lower)
     const adjustmentFactor = offerType === 'buy' ? new BigNumber(1).plus(reserveCostFactor) : new BigNumber(1).minus(reserveCostFactor);

     return quality.multipliedBy(adjustmentFactor);
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

     let outputTotal = `Total Offers: ${offers.length}\n`;
     function formatOffer(offer, index) {
          let output = outputTotal + `offers (${index + 1}):\n`;
          outputTotal = '';
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

function populateStatsFields(stats, we_want, we_spend, spread, liquidity, offerType) {
     document.getElementById('orderBookDirectionField').value = `${we_want.currency}/${we_spend.currency}`;
     document.getElementById('vwapField').value = stats.forward.vwap.toFixed(8);
     document.getElementById('simpleAverageField').value = stats.forward.simpleAvg.toFixed(8);
     document.getElementById('bestRateField').value = stats.forward.bestRate.toFixed(8);
     document.getElementById('worstRateField').value = stats.forward.worstRate.toFixed(8);
     document.getElementById('depthField').value = `${stats.forward.depthDOG.toFixed(2)} ${we_want.currency} for ${stats.forward.depthXRP.toFixed(2)} ${we_spend.currency}`;

     if (stats.forward.insufficientLiquidity) {
          document.getElementById('liquidityField').value = `${15} ${we_spend.currency}: Insufficient liquidity (only ${stats.forward.executionDOG.toFixed(2)} ${we_want.currency} for ${stats.forward.executionXRP.toFixed(2)} ${we_spend.currency} available)`;
          document.getElementById('averageRateField').value = `${stats.forward.executionPrice.toFixed(8)} ${we_want.currency}/${we_spend.currency}`;
     } else {
          document.getElementById('liquidityField').value = `${15} ${we_spend.currency} for ${stats.forward.executionDOG.toFixed(2)} ${we_want.currency}`;
          document.getElementById('averageRateField').value = `${stats.forward.executionPrice.toFixed(8)} ${we_want.currency}/${we_spend.currency}`;
     }

     document.getElementById('liquidityRatioField').value = `${liquidity.ratio.toFixed(2)} (${we_want.currency}/${we_spend.currency} vs ${we_spend.currency}/${we_want.currency})`;
     document.getElementById('priceVolatilityField').value = `${stats.forward.simpleAvg.toFixed(8)} ${we_want.currency}/${we_spend.currency}`;
     document.getElementById('stdDeviationField').value = `${stats.forward.volatility.toFixed(8)} (${stats.forward.volatilityPercent.toFixed(2)}%)`;

     if (offerType === 'buy') {
          document.getElementById('spreadField').value = `${spread.spread.toFixed(8)} ${we_want.currency}/${we_spend.currency} (${spread.spreadPercent.toFixed(2)}%)`;
     } else {
          document.getElementById('spreadField').value = `${spread.spread.toFixed(8)} ${we_spend.currency}/${we_want.currency} (${spread.spreadPercent.toFixed(2)}%)`;
     }
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
window.getTransaction = getTransaction;
window.getTokenBalance = getTokenBalance;
window.populate1 = populate1;
window.populate2 = populate2;
window.populate3 = populate3;
window.populateTakerGetsTakerPayFields = populateTakerGetsTakerPayFields;
window.autoResize = autoResize;
window.disconnectClient = disconnectClient;
window.gatherAccountInfo = gatherAccountInfo;
window.clearFields = clearFields;
window.distributeAccountInfo = distributeAccountInfo;
