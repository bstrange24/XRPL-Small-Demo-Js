import * as xrpl from 'xrpl';
import { getClient, disconnectClient, validatInput, parseXRPLTransaction, getNet, amt_str, getOnlyTokenBalance, getCurrentLedger, setError, gatherAccountInfo, clearFields, distributeAccountInfo, getTransaction, updateOwnerCountAndReserves, prepareTxHashForOutput, encodeCurrencyCode, decodeCurrencyCode, renderOffersDetails, renderOrderBookDetails, renderCreateOfferDetails, buildTransactionSections, renderTransactionDetails } from './utils.js';
import { fetchAccountObjects, getTrustLines } from './account.js';
import { getTokenBalance } from './send-currency.js';
import BigNumber from 'bignumber.js';
import { XRP_CURRENCY, ed25519_ENCRYPTION, secp256k1_ENCRYPTION, MAINNET, TES_SUCCESS } from './constants.js';
import { derive } from 'xrpl-accountlib';

export async function getOffers() {
     console.log('Entering getOffers');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     if (!resultField) {
          console.error('ERROR: resultField not found');
          return;
     }
     resultField.classList.remove('error', 'success');
     resultField.innerHTML = '';

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          accountSeedField: document.getElementById('accountSeedField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
          ownerCountField: document.getElementById('ownerCountField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
          totalExecutionTime: document.getElementById('totalExecutionTime'),
     };

     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          }
          field.value = field.value.trim();
     }

     const { accountSeedField, xrpBalanceField, ownerCountField, totalXrpReservesField, totalExecutionTime } = fields;

     const validations = [[!validatInput(accountSeedField.value), 'Seed cannot be empty']];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          // Check server version
          const serverInfo = await client.request({ method: 'server_info' });
          const serverVersion = serverInfo.result.info.build_version;
          console.log('Server Version: ' + serverVersion);

          // Initialize wallet
          let wallet;
          if (accountSeedField.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(accountSeedField.value, {
                    algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION,
               });
          } else if (accountSeedField.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(accountSeedField.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, {
                    algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION,
               });
          } else {
               wallet = xrpl.Wallet.fromSeed(accountSeedField.value, {
                    algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION,
               });
          }

          // Fetch offers
          const offersResponse = await client.request({
               method: 'account_offers',
               account: wallet.address,
               ledger_index: 'validated',
          });

          console.log('offers:', offersResponse);

          // Prepare data for rendering
          const data = {
               sections: [],
          };

          // Offers section
          if (offersResponse.result.offers.length <= 0) {
               data.sections.push({
                    title: 'Offers',
                    openByDefault: true,
                    content: [{ key: 'Status', value: `No offers found for <code>${wallet.address}</code>` }],
               });
          } else {
               data.sections.push({
                    title: `Offers (${offersResponse.result.offers.length})`,
                    openByDefault: true,
                    subItems: offersResponse.result.offers.map((offer, index) => {
                         const takerGets = typeof offer.taker_gets === 'string' ? `${xrpl.dropsToXrp(offer.taker_gets)} XRP` : `${offer.taker_gets.value} ${offer.taker_gets.currency}${offer.taker_gets.issuer ? ` (Issuer: ${offer.taker_gets.issuer})` : ''}`;
                         const takerPays = typeof offer.taker_pays === 'string' ? `${xrpl.dropsToXrp(offer.taker_pays)} XRP` : `${offer.taker_pays.value} ${offer.taker_pays.currency}${offer.taker_pays.issuer ? ` (Issuer: ${offer.taker_pays.issuer})` : ''}`;
                         return {
                              key: `Offer ${index + 1} (Sequence: ${offer.seq})`,
                              openByDefault: false,
                              content: [{ key: 'Sequence', value: String(offer.seq) }, { key: 'Taker Gets', value: takerGets }, { key: 'Taker Pays', value: takerPays }, ...(offer.expiration ? [{ key: 'Expiration', value: new Date(offer.expiration * 1000).toISOString() }] : []), ...(offer.flags ? [{ key: 'Flags', value: String(offer.flags) }] : [])],
                         };
                    }),
               });
          }

          // Account Details section
          // data.sections.push({
          //      title: 'Account Details',
          //      openByDefault: true,
          //      content: [
          //           { key: 'Address', value: `<code>${wallet.address}</code>` },
          //           { key: 'XRP Balance', value: await client.getXrpBalance(wallet.address) },
          //      ],
          // });

          // Server Info section
          // data.sections.push({
          //      title: 'Server Info',
          //      openByDefault: false,
          //      content: [
          //           { key: 'Environment', value: environment },
          //           { key: 'Network', value: net },
          //           { key: 'Server Version', value: serverVersion },
          //      ],
          // });

          // Render data
          renderOffersDetails(data);

          // Update account fields
          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.address);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`, spinner);
     } finally {
          if (spinner) spinner.style.display = 'none';
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving getOffers in ${now}ms`);
     }
}

export async function createOffer() {
     console.log('Entering createOffer');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     if (!resultField) {
          console.error('ERROR: resultField not found');
          return;
     }
     resultField.classList.remove('error', 'success');
     resultField.innerHTML = '';

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const isMarketOrder = document.getElementById('isMarketOrder')?.checked;
     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');
     const totalExecutionTime = document.getElementById('totalExecutionTime');

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

     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim();
          }
     }

     const { accountName: accountNameField, accountAddress: accountAddressField, accountSeed: accountSeedField, xrpBalance: xrpBalanceField, weWantCurrency: weWantCurrencyField, weWantIssuer: weWantIssuerField, weWantAmount: weWantAmountField, weSpendCurrency: weSpendCurrencyField, weSpendIssuer: weSpendIssuerField, weSpendAmount: weSpendAmountField } = fields;

     const validations = [
          [!validatInput(accountAddressField.value), 'Account Address cannot be empty'],
          [!validatInput(accountSeedField.value), 'Account seed cannot be empty'],
          [!validatInput(xrpBalanceField.value), 'XRP balance cannot be empty'],
          [!validatInput(weWantCurrencyField.value), 'Taker Gets currency cannot be empty'],
          [!validatInput(weSpendCurrencyField.value), 'Taker Pays currency cannot be empty'],
          [!validatInput(weWantAmountField.value), 'Taker Gets amount cannot be empty'],
          [isNaN(weWantAmountField.value), 'Taker Gets amount must be a valid number'],
          [parseFloat(weWantAmountField.value) <= 0, 'Taker Gets amount must be greater than zero'],
          [!validatInput(weSpendAmountField.value), 'Taker Pays amount cannot be empty'],
          [isNaN(weSpendAmountField.value), 'Taker Pays amount must be a valid number'],
          [parseFloat(weSpendAmountField.value) <= 0, 'Taker Pays amount must be greater than zero'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.innerHTML = `Connected to ${environment} ${net}\nCreating Offer.\n\n`;

          // Check server version
          const serverInfo = await client.request({ method: 'server_info' });
          const serverVersion = serverInfo.result.info.build_version;
          console.log('Server Version: ' + serverVersion);

          // Initialize wallet
          let wallet;
          if (accountSeedField.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(accountSeedField.value, {
                    algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION,
               });
          } else if (accountSeedField.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(accountSeedField.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, {
                    algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION,
               });
          } else {
               wallet = xrpl.Wallet.fromSeed(accountSeedField.value, {
                    algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION,
               });
          }

          // Prepare data for rendering
          const data = {
               sections: [],
          };

          // Trust line setup
          let trustSetResult = null;
          const doesTrustLinesExists = await getTrustLines(wallet.address, client);
          if (doesTrustLinesExists.length <= 0) {
               let issuerAddr, issuerCur;
               if (weWantIssuerField.value === XRP_CURRENCY || weWantIssuerField.value === '') {
                    issuerAddr = weSpendIssuerField.value;
                    issuerCur = weSpendCurrencyField.value;
               } else {
                    issuerAddr = weWantIssuerField.value;
                    issuerCur = weWantCurrencyField.value;
               }

               const current_ledger = await getCurrentLedger(client);
               const trustSetTx = {
                    TransactionType: 'TrustSet',
                    Account: wallet.address,
                    LimitAmount: {
                         currency: issuerCur,
                         issuer: issuerAddr,
                         value: '1000000',
                    },
                    LastLedgerSequence: current_ledger + 50,
               };

               const ts_prepared = await client.autofill(trustSetTx);
               const ts_signed = wallet.sign(ts_prepared);
               trustSetResult = await client.submitAndWait(ts_signed.tx_blob);

               if (trustSetResult.result.meta.TransactionResult !== TES_SUCCESS) {
                    throw new Error(`Unable to create trustLine from ${wallet.address} to ${issuerAddr}\nTransaction failed: ${trustSetResult.result.meta.TransactionResult}`);
               }
               data.sections.push({
                    title: 'Trust Line Setup',
                    openByDefault: true,
                    content: [
                         { key: 'Status', value: 'Trust line created' },
                         { key: 'Currency', value: issuerCur },
                         { key: 'Issuer', value: `<code>${issuerAddr}</code>` },
                         { key: 'Limit', value: '1000000' },
                    ],
               });
          } else {
               data.sections.push({
                    title: 'Trust Line Setup',
                    openByDefault: true,
                    content: [{ key: 'Status', value: 'Trust lines already exist' }],
               });
          }

          // Initial balances
          const initialXrpBalance = await client.getXrpBalance(wallet.address);
          console.log(`Initial XRP Balance ${initialXrpBalance} (drops): ${xrpl.xrpToDrops(initialXrpBalance)}`);
          const tokenBalance = weSpendCurrencyField.value === XRP_CURRENCY ? weWantCurrencyField.value : weSpendCurrencyField.value;
          const initialTokenBalance = await getOnlyTokenBalance(client, wallet.address, tokenBalance);
          console.log(`Initial ${tokenBalance} Balance: ${initialTokenBalance}`);
          data.sections.push({
               title: 'Initial Balances',
               openByDefault: true,
               content: [
                    { key: 'XRP', value: `${initialXrpBalance} (${xrpl.xrpToDrops(initialXrpBalance)} drops)` },
                    { key: tokenBalance, value: initialTokenBalance },
               ],
          });

          // Build currency objects
          let we_want = weWantCurrencyField.value === XRP_CURRENCY ? { currency: XRP_CURRENCY, value: weWantAmountField.value } : { currency: weWantCurrencyField.value, issuer: weWantIssuerField.value, value: weWantAmountField.value };
          let we_spend = weSpendCurrencyField.value === XRP_CURRENCY ? { amount: weSpendAmountField.value } : { currency: weSpendCurrencyField.value, issuer: weSpendIssuerField.value, value: weSpendAmountField.value };

          // Validate balances
          if (weSpendCurrencyField.value === XRP_CURRENCY && xrpl.xrpToDrops(initialXrpBalance) < Number(weSpendAmountField.value)) {
               throw new Error('Insufficient XRP balance');
          } else if (weSpendCurrencyField.value !== XRP_CURRENCY && initialTokenBalance < weSpendAmountField.value) {
               throw new Error(`Insufficient ${weSpendCurrencyField.value} balance`);
          }

          if (we_want.currency.length > 3) {
               we_want.currency = encodeCurrencyCode(we_want.currency);
          }
          if (we_spend.currency && we_spend.currency.length > 3) {
               we_spend.currency = encodeCurrencyCode(we_spend.currency);
          }

          const offerType = we_spend.currency ? 'sell' : 'buy';
          console.log(`Type: ${weWantCurrencyField.valueOf}`);

          // Rate analysis
          const xrpReserve = await getXrpReserveRequirements(client, wallet.address);
          const proposedQuality = new BigNumber(weSpendAmountField.value).dividedBy(weWantAmountField.value);
          const effectiveRate = calculateEffectiveRate(proposedQuality, xrpReserve, offerType);
          const rateAnalysis = [
               {
                    key: 'Proposed Rate',
                    value: `1 ${we_want.currency} = ${proposedQuality.toFixed(8)} ${we_spend.currency || XRP_CURRENCY}`,
               },
               {
                    key: 'Effective Rate',
                    value: `1 ${we_want.currency} = ${effectiveRate.toFixed(8)} ${we_spend.currency || XRP_CURRENCY}`,
               },
          ];
          if (effectiveRate.gt(proposedQuality)) {
               rateAnalysis.push({
                    key: 'Note',
                    value: 'Effective rate is worse than proposed due to XRP reserve requirements',
               });
          }
          data.sections.push({
               title: 'Rate Analysis',
               openByDefault: true,
               content: rateAnalysis,
          });

          // Market analysis
          const MAX_SLIPPAGE = 0.05;
          const orderBook = await client.request({
               method: 'book_offers',
               taker: wallet.address,
               ledger_index: 'current',
               taker_gets: we_want,
               taker_pays: we_spend.currency ? we_spend : { currency: XRP_CURRENCY, value: weSpendAmountField.value },
          });
          const oppositeOrderBook = await client.request({
               method: 'book_offers',
               taker: wallet.address,
               ledger_index: 'current',
               taker_gets: we_spend.currency ? we_spend : { currency: XRP_CURRENCY, value: weSpendAmountField.value },
               taker_pays: we_want,
          });

          const offers = orderBook.result.offers;
          let runningTotal = new BigNumber(0);
          const wantAmount = new BigNumber(weWantAmountField.value);
          let bestOfferQuality = null;
          let marketAnalysis = [];
          if (offers.length > 0) {
               for (const o of offers) {
                    const offerQuality = new BigNumber(o.quality);
                    if (!bestOfferQuality || offerQuality.lt(bestOfferQuality)) {
                         bestOfferQuality = offerQuality;
                    }
                    if (offerQuality.lte(proposedQuality.times(1 + MAX_SLIPPAGE))) {
                         const slippage = proposedQuality.minus(offerQuality).dividedBy(offerQuality);
                         marketAnalysis = [
                              {
                                   key: 'Best Rate',
                                   value: `1 ${we_want.currency} = ${bestOfferQuality?.toFixed(6) || '0'} ${we_spend.currency || XRP_CURRENCY}`,
                              },
                              {
                                   key: 'Proposed Rate',
                                   value: `1 ${we_want.currency} = ${proposedQuality.toFixed(6)} ${we_spend.currency || XRP_CURRENCY}`,
                              },
                              { key: 'Slippage', value: `${slippage.times(100).toFixed(2)}%` },
                         ];
                         if (slippage.gt(MAX_SLIPPAGE)) {
                              marketAnalysis.push({
                                   key: 'Warning',
                                   value: `Slippage ${slippage.times(100).toFixed(2)}% exceeds ${MAX_SLIPPAGE * 100}%`,
                              });
                         }
                         runningTotal = runningTotal.plus(new BigNumber(o.owner_funds || o.TakerGets.value));
                         if (runningTotal.gte(wantAmount)) break;
                    }
               }
          }

          if (runningTotal.eq(0)) {
               const orderBook2 = await client.request({
                    method: 'book_offers',
                    taker: wallet.address,
                    ledger_index: 'current',
                    taker_gets: we_spend.currency ? we_spend : { currency: XRP_CURRENCY, value: weSpendAmountField.value },
                    taker_pays: we_want,
               });
               const offeredQuality = new BigNumber(weWantAmountField.value).dividedBy(weSpendAmountField.value);
               const offers2 = orderBook2.result.offers;
               let runningTotal2 = new BigNumber(0);
               let tallyCurrency = we_spend.currency || XRP_CURRENCY;
               if (tallyCurrency === XRP_CURRENCY) {
                    tallyCurrency = 'drops of XRP';
               }
               if (offers2.length > 0) {
                    for (const o of offers2) {
                         if (o.quality <= effectiveRate.toNumber()) {
                              const bestOfferQuality2 = new BigNumber(o.quality);
                              const slippage = proposedQuality.minus(bestOfferQuality2).dividedBy(bestOfferQuality2);
                              marketAnalysis = [
                                   {
                                        key: 'Best Rate',
                                        value: `1 ${we_spend.currency || XRP_CURRENCY} = ${bestOfferQuality2.toFixed(6)} ${we_want.currency}`,
                                   },
                                   {
                                        key: 'Proposed Rate',
                                        value: `1 ${we_spend.currency || XRP_CURRENCY} = ${proposedQuality.toFixed(6)} ${we_want.currency}`,
                                   },
                                   { key: 'Slippage', value: `${slippage.times(100).toFixed(2)}%` },
                              ];
                              if (slippage.gt(MAX_SLIPPAGE)) {
                                   marketAnalysis.push({
                                        key: 'Warning',
                                        value: `Slippage ${slippage.times(100).toFixed(2)}% exceeds ${MAX_SLIPPAGE * 100}%`,
                                   });
                              }
                              runningTotal2 = runningTotal2.plus(new BigNumber(o.owner_funds));
                         } else {
                              break;
                         }
                    }
                    if (runningTotal2.gt(0)) {
                         marketAnalysis.push({
                              key: 'Order Book Position',
                              value: `Offer placed below at least ${runningTotal2.toFixed(2)} ${tallyCurrency}`,
                         });
                    }
               }
               if (!offers2.length) {
                    marketAnalysis.push({
                         key: 'Order Book Position',
                         value: 'No similar offers; this would be the first',
                    });
               }
          }
          data.sections.push({
               title: 'Market Analysis',
               openByDefault: true,
               content: marketAnalysis.length ? marketAnalysis : [{ key: 'Status', value: 'No matching offers found in order book' }],
          });

          // Submit OfferCreate transaction
          let prepared;
          if (we_spend.currency) {
               prepared = await client.autofill({
                    TransactionType: 'OfferCreate',
                    Account: wallet.address,
                    TakerGets: we_spend,
                    TakerPays: we_want.value,
                    Flags: isMarketOrder ? xrpl.OfferCreateFlags.tfImmediateOrCancel : 0,
               });
          } else {
               prepared = await client.autofill({
                    TransactionType: 'OfferCreate',
                    Account: wallet.address,
                    TakerGets: we_spend.amount,
                    TakerPays: we_want,
                    Flags: isMarketOrder ? xrpl.OfferCreateFlags.tfImmediateOrCancel : 0,
               });
          }

          const signed = wallet.sign(prepared);
          const tx = await client.submitAndWait(signed.tx_blob);

          // Transaction result
          if (tx.result.meta.TransactionResult !== TES_SUCCESS) {
               data.sections.push({
                    title: 'Transaction Details',
                    openByDefault: true,
                    content: [
                         { key: 'Status', value: `Transaction failed: ${tx.result.meta.TransactionResult}` },
                         { key: 'Details', value: parseXRPLTransaction(tx.result) },
                    ],
               });
               throw new Error(`Transaction failed: ${tx.result.meta.TransactionResult}`);
          }

          // Transaction Details sections
          const transactionSections = buildTransactionSections(tx);
          data.sections.push(...Object.values(transactionSections));

          // Balance changes
          const balanceChanges = xrpl.getBalanceChanges(tx.result.meta);
          data.sections.push({
               title: 'Balance Changes',
               openByDefault: true,
               content: balanceChanges.length
                    ? balanceChanges.map((change, index) => ({
                           key: `Change ${index + 1}`,
                           value: `${change.balance} ${change.currency}${change.issuer ? ` (Issuer: <code>${change.issuer}</code>)` : ''} for <code>${change.account}</code>`,
                      }))
                    : [{ key: 'Status', value: 'No balance changes recorded' }],
          });

          // Affected offers
          let offersAffected = 0;
          for (const node of tx.result.meta.AffectedNodes) {
               if (node.ModifiedNode?.LedgerEntryType === 'Offer' || node.DeletedNode?.LedgerEntryType === 'Offer') {
                    offersAffected += 1;
               } else if (node.CreatedNode?.LedgerEntryType === 'Offer') {
                    const offer = node.CreatedNode.NewFields;
                    data.sections.push({
                         title: 'Created Offer',
                         openByDefault: true,
                         content: [
                              { key: 'Owner', value: `<code>${offer.Account}</code>` },
                              { key: 'TakerGets', value: amt_str(offer.TakerGets) },
                              { key: 'TakerPays', value: amt_str(offer.TakerPays) },
                         ],
                    });
               } else if (node.CreatedNode?.LedgerEntryType === 'RippleState') {
                    data.sections[0].content.push({ key: 'Additional Note', value: 'Created a trust line' });
               }
          }
          if (offersAffected > 0) {
               data.sections.push({
                    title: 'Affected Offers',
                    openByDefault: true,
                    content: [{ key: 'Count', value: `Modified or removed ${offersAffected} matching offer(s)` }],
               });
          }

          // Updated balances
          const finalXrpBalance = await client.getXrpBalance(wallet.address);
          const updatedTokenBalance = await getOnlyTokenBalance(client, wallet.address, tokenBalance);
          data.sections.push({
               title: 'Updated Balances',
               openByDefault: true,
               content: [
                    { key: 'XRP', value: finalXrpBalance },
                    { key: tokenBalance, value: updatedTokenBalance },
               ],
          });

          // Update token balance fields
          if (weWantCurrencyField.value === XRP_CURRENCY) {
               document.getElementById('weWantTokenBalanceField').value = finalXrpBalance;
               document.getElementById('weSpendTokenBalanceField').value = updatedTokenBalance;
          } else {
               document.getElementById('weWantTokenBalanceField').value = updatedTokenBalance;
               document.getElementById('weSpendTokenBalanceField').value = finalXrpBalance;
          }

          // Outstanding offers
          const acctOffers = await client.request({
               command: 'account_offers',
               account: wallet.address,
               ledger_index: 'validated',
          });
          if (acctOffers.result.offers.length > 0) {
               data.sections.push({
                    title: `Outstanding Offers (${acctOffers.result.offers.length})`,
                    openByDefault: false,
                    subItems: acctOffers.result.offers.map((offer, index) => ({
                         key: `Offer ${index + 1}`,
                         openByDefault: false,
                         content: [{ key: 'Sequence', value: offer.seq }, { key: 'TakerGets', value: amt_str(offer.taker_gets) }, { key: 'TakerPays', value: amt_str(offer.taker_pays) }, ...(offer.expiration ? [{ key: 'Expiration', value: new Date(offer.expiration * 1000).toISOString() }] : [])],
                    })),
               });
          }

          // Account Details
          // data.sections.push({
          //      title: 'Account Details',
          //      openByDefault: true,
          //      content: [
          //           { key: 'Name', value: accountNameField.value },
          //           { key: 'Address', value: `<code>${wallet.address}</code>` },
          //           { key: 'Final XRP Balance', value: finalXrpBalance },
          //      ],
          // });

          // Server Info
          // data.sections.push({
          //      title: 'Server Info',
          //      openByDefault: false,
          //      content: [{ key: 'Environment', value: environment }, { key: 'Network', value: net }, { key: 'Server Version', value: serverVersion }, ...(parseFloat(serverVersion) < 1.9 ? [{ key: 'Warning', value: 'Server version may not fully support offer creation (requires rippled 1.9.0 or higher)' }] : [])],
          // });

          // Render data
          renderCreateOfferDetails(data);

          // Update account fields and balance
          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`, spinner);
     } finally {
          if (spinner) spinner.style.display = 'none';
          totalExecutionTime.value = Date.now() - startTime;
          console.log(`Leaving createOffer in ${totalExecutionTime.value}ms`);
     }
}

// export async function createOffer() {
//      console.log('Entering createOffer');
//      const startTime = Date.now();

//      const resultField = document.getElementById('resultField');
//      if (!resultField) {
//           console.error('ERROR: resultField not found');
//           return;
//      }
//      resultField.classList.remove('error', 'success');
//      resultField.innerHTML = '';

//      const spinner = document.getElementById('spinner');
//      if (spinner) spinner.style.display = 'block';

//      const isMarketOrder = document.getElementById('isMarketOrder')?.checked;
//      const ownerCountField = document.getElementById('ownerCountField');
//      const totalXrpReservesField = document.getElementById('totalXrpReservesField');
//      const totalExecutionTime = document.getElementById('totalExecutionTime');

//      const fields = {
//           accountName: document.getElementById('accountNameField'),
//           accountAddress: document.getElementById('accountAddressField'),
//           accountSeed: document.getElementById('accountSeedField'),
//           xrpBalance: document.getElementById('xrpBalanceField'),
//           weWantCurrency: document.getElementById('weWantCurrencyField'),
//           weSpendCurrency: document.getElementById('weSpendCurrencyField'),
//           weWantIssuer: document.getElementById('weWantIssuerField'),
//           weSpendIssuer: document.getElementById('weSpendIssuerField'),
//           weWantAmount: document.getElementById('weWantAmountField'),
//           weSpendAmount: document.getElementById('weSpendAmountField'),
//      };

//      for (const [name, field] of Object.entries(fields)) {
//           if (!field) {
//                return setError(`ERROR: DOM element ${name} not found`, spinner);
//           } else {
//                field.value = field.value.trim();
//           }
//      }

//      // Destructure fields
//      const { accountName: accountNameField, accountAddress: accountAddressField, accountSeed: accountSeedField, xrpBalance: xrpBalanceField, weWantCurrency: weWantCurrencyField, weWantIssuer: weWantIssuerField, weWantAmount: weWantAmountField, weSpendCurrency: weSpendCurrencyField, weSpendIssuer: weSpendIssuerField, weSpendAmount: weSpendAmountField } = fields;

//      // Validation checks
//      const validations = [
//           [!validatInput(accountAddressField.value), 'ERROR: Account Address can not be empty'],
//           [!validatInput(accountSeedField.value), 'ERROR: Account seed amount can not be empty'],
//           [!validatInput(xrpBalanceField.value), 'ERROR: XRP balance can not be empty'],
//           [!validatInput(weWantCurrencyField.value), 'ERROR: Taker Gets currency can not be empty'],
//           [!validatInput(weSpendCurrencyField.value), 'ERROR: Taker Pays currency can not be empty'],
//           [!validatInput(weWantAmountField.value), 'ERROR: Taker Gets amount cannot be empty'],
//           [isNaN(weWantAmountField.value), 'ERROR: Taker Gets amount must be a valid number'],
//           [parseFloat(weWantAmountField.value) <= 0, 'ERROR: Taker Gets amount must be greater than zero'],
//           [!validatInput(weSpendAmountField.value), 'ERROR: Taker Pays amount cannot be empty'],
//           [isNaN(weSpendAmountField.value), 'ERROR: Taker Pays amount must be a valid number'],
//           [parseFloat(weSpendAmountField.value) <= 0, 'ERROR: Taker Pays amount must be greater than zero'],
//      ];

//      for (const [condition, message] of validations) {
//           if (condition) return setError(`ERROR: ${message}`, spinner);
//      }

//      try {
//           const { net, environment } = getNet();
//           const client = await getClient();

//           resultField.innerHTML = `Connected to ${environment} ${net}\nCreating Offer.\n\n`;

//           let wallet;
//           if (accountSeedField.value.split(' ').length > 1) {
//                wallet = xrpl.Wallet.fromMnemonic(accountSeedField.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
//           } else if (accountSeedField.value.includes(',')) {
//                const derive_account_with_secret_numbers = derive.secretNumbers(accountSeedField.value);
//                wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
//           } else {
//                wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
//           }

//           resultField.innerHTML += accountNameField.value + ' account address: ' + wallet.address + '\n';

//           const doesTrustLinesExists = await getTrustLines(wallet.address, client);
//           if (doesTrustLinesExists.length <= 0) {
//                // Ensure trustline exists. If not, get trust line from A1 to hotwallet
//                let issuerAddr;
//                let issuerCur;
//                if (weWantIssuerField.value === XRP_CURRENCY || weWantIssuerField.value === '') {
//                     issuerAddr = weSpendIssuerField.value;
//                } else {
//                     issuerAddr = weWantIssuerField.value;
//                }

//                if (weWantCurrencyField.value === XRP_CURRENCY) {
//                     issuerCur = weSpendCurrencyField.value;
//                } else {
//                     issuerCur = weWantCurrencyField.value;
//                }

//                const current_ledger = await getCurrentLedger(client);

//                try {
//                     const trustSetTx = {
//                          TransactionType: 'TrustSet',
//                          Account: wallet.address,
//                          LimitAmount: {
//                               currency: issuerCur,
//                               issuer: issuerAddr,
//                               value: '1000000',
//                          },
//                          LastLedgerSequence: current_ledger + 50, // Add buffer for transaction processing
//                     };

//                     console.debug(`trustSetTx ${trustSetTx}`);
//                     const ts_prepared = await client.autofill(trustSetTx);
//                     console.debug(`ts_prepared ${ts_prepared}`);
//                     const ts_signed = wallet.sign(ts_prepared);
//                     console.debug(`ts_signed ${ts_signed}`);
//                     const tx = await client.submitAndWait(ts_signed.tx_blob);
//                     console.debug(`tx ${tx}`);

//                     if (tx.result.meta.TransactionResult == TES_SUCCESS) {
//                          resultField.innerHTML += 'Trustline established between account ' + wallet.address + ' and issuer ' + issuerAddr + ' for ' + issuerCur + ' with amount ' + amountValue.value;
//                          resultField.innerHTML += prepareTxHashForOutput(tx.result.hash) + '\n';
//                     } else {
//                          throw new Error(`Unable to create trustLine from ${wallet.address} to ${issuerAddr} \nTransaction failed: ${tx.result.meta.TransactionResult}`);
//                     }
//                } catch (error) {
//                     throw new Error(error);
//                }
//                console.log('Trustline set.');
//           } else {
//                console.log(`Trustines already exist`);
//           }

//           const xrpBalance = await getXrpBalance();
//           console.log(`XRP Balance ${xrpBalance} (drops): ${xrpl.xrpToDrops(xrpBalance)}`);
//           resultField.value += `Initial XRP Balance ${xrpBalance} (drops): ${xrpl.xrpToDrops(xrpBalance)}`;

//           let tokenBalance = weSpendCurrencyField.value === XRP_CURRENCY ? weWantCurrencyField.value : weSpendCurrencyField.value;
//           const tstBalance = await getOnlyTokenBalance(client, wallet.address, tokenBalance);
//           console.log(`${tokenBalance} Balance: ${tstBalance}`);
//           resultField.value += `\nInital ${tokenBalance} Balance: ${tstBalance}\n\n`;

//           // Build currency objects
//           let we_want = weWantCurrencyField.value === XRP_CURRENCY ? { currency: XRP_CURRENCY, value: weWantAmountField.value } : { currency: weWantCurrencyField.value, issuer: weWantIssuerField.value, value: weWantAmountField.value };
//           let we_spend = weSpendCurrencyField.value === XRP_CURRENCY ? { currency: XRP_CURRENCY, value: weSpendAmountField.value } : { currency: weSpendCurrencyField.value, issuer: weSpendIssuerField.value, value: weSpendAmountField.value };

//           if (weSpendCurrencyField.value === XRP_CURRENCY && xrpl.xrpToDrops(xrpBalance) < Number(weSpendAmountField.value)) {
//                throw new Error('Insufficient XRP balance');
//           } else if (weSpendCurrencyField.value !== XRP_CURRENCY && tstBalance < weSpendAmountField.value) {
//                throw new Error(`Insufficient ${weSpendCurrencyField.value} balance`);
//           }

//           console.log(`we_want ${we_want}`);
//           console.log(`we_spend ${we_spend}`);

//           if (we_want.currency.length > 3) {
//                we_want.currency = encodeCurrencyCode(we_want.currency);
//           }

//           if (we_spend.currency.length > 3) {
//                we_spend.currency = encodeCurrencyCode(we_spend.currency);
//           }

//           const offerType = we_spend.currency === XRP_CURRENCY ? 'buy' : 'sell';
//           console.log(`Offer Type: ${offerType}`);

//           // Get reserve requirements
//           const xrpReserve = await getXrpReserveRequirements(client, wallet.address);

//           // "Quality" is defined as TakerPays / TakerGets. The lower the "quality"
//           // number, the better the proposed exchange rate is for the taker.
//           // The quality is rounded to a number of significant digits based on the
//           // issuer's TickSize value (or the lesser of the two for token-token trades.)

//           // const proposed_quality = BigNumber(weSpendAmountField.value) / BigNumber(weWantAmountField.value);
//           const proposed_quality = new BigNumber(weSpendAmountField.value).dividedBy(weWantAmountField.value); // XRP/TOKEN

//           // Calculate effective rate
//           const effectiveRate = calculateEffectiveRate(proposed_quality, xrpReserve, offerType);
//           console.log(`Proposed rate: ${proposed_quality.toString()}`);
//           console.log(`Effective rate (including reserves): ${effectiveRate.toString()}`);

//           resultField.value += `Rate Analysis:\n- Proposed Rate: 1 ${we_want.currency} = ${proposed_quality.toFixed(6)} ${we_spend.currency}\n`;
//           resultField.value += `- Effective Rate: 1 ${we_want.currency} = ${effectiveRate.toFixed(6)} ${we_spend.currency}\n\n`;

//           if (effectiveRate.gt(proposed_quality)) {
//                console.log(`Note: Effective rate is worse than proposed due to XRP reserve requirements`);
//           }

//           // Look up Offers. -----------------------------------------------------------
//           // To buy TOKEN, look up Offers where "TakerGets" is TOKEN and "TakerPays" is XRP.:
//           console.log(`To buy ${we_want.currency}, look up Offers where "TakerGets" is ${we_want.currency} and "TakerPays" is ${we_spend.currency}.`);
//           const orderbook_resp = await client.request({
//                method: 'book_offers',
//                taker: wallet.address,
//                ledger_index: 'current',
//                taker_gets: we_want,
//                taker_pays: we_spend,
//           });
//           console.log(`orderbook_resp: ${orderbook_resp.result}`);

//           let oppositeOrderBook = await client.request({
//                method: 'book_offers',
//                taker: wallet.address,
//                ledger_index: 'current',
//                taker_gets: we_spend,
//                taker_pays: we_want,
//           });
//           console.log(`oppositeOrderBook: ${oppositeOrderBook.result}`);

//           // Estimate whether a proposed Offer would execute immediately, and...
//           // If so, how much of it? (Partial execution is possible)
//           // If not, how much liquidity is above it? (How deep in the order book would
//           //    other Offers have to go before ours would get taken?)
//           // Note: These estimates can be thrown off by rounding if the token issuer
//           // uses a TickSize setting other than the default (15). In that case, you
//           // can increase the TakerGets amount of your final Offer to compensate.

//           const MAX_SLIPPAGE = 0.05; // 5% slippage tolerance
//           const offers = orderbook_resp.result.offers;
//           let running_total = new BigNumber(0);
//           const want_amt = new BigNumber(we_want.value);
//           let best_offer_quality = new BigNumber(0);

//           if (offers.length > 0) {
//                for (const o of offers) {
//                     const offer_quality = new BigNumber(o.quality);
//                     if (!best_offer_quality || offer_quality.lt(best_offer_quality)) {
//                          best_offer_quality = offer_quality;
//                     }
//                     if (offer_quality.lte(effectiveRate.times(1 + MAX_SLIPPAGE))) {
//                          const slippage = proposed_quality.minus(offer_quality).dividedBy(offer_quality);
//                          if (slippage.gt(MAX_SLIPPAGE)) {
//                               // throw new Error(`Slippage ${slippage.times(100).toFixed(2)}% exceeds ${MAX_SLIPPAGE * 100}%`);
//                               resultField.value += `Slippage ${slippage.times(100).toFixed(2)}% exceeds ${MAX_SLIPPAGE * 100}%`;
//                          }
//                          resultField.value += `Market Analysis:\n- Best Rate: 1 ${we_want.currency} = ${offer_quality.toFixed(6)} ${we_spend.currency}\n`;
//                          resultField.value += `- Proposed Rate: 1 ${we_want.currency} = ${proposed_quality.toFixed(6)} ${we_spend.currency}\n`;
//                          resultField.value += `- Slippage: ${slippage.times(100).toFixed(2)}%\n`;
//                          running_total = running_total.plus(new BigNumber(o.owner_funds || o.TakerGets.value));
//                          if (running_total.gte(want_amt)) break;
//                     }
//                }
//           }

//           // if (!offers) {
//           //      console.log(`No Offers in the matching book. Offer probably won't execute immediately.`);
//           // } else {
//           //      for (const o of offers) {
//           //           // if (o.quality <= proposed_quality) {
//           //           if (o.quality <= effectiveRate) {
//           //                // Get the best offer quality (first offer in the list is always best price)
//           //                const best_offer_quality = new BigNumber(o.quality);
//           //                const proposed_quality = new BigNumber(weSpendAmountField.value).dividedBy(weWantAmountField.value);
//           //                console.log(`best_offer_quality: ${best_offer_quality} proposed_quality: ${proposed_quality}`);
//           //                console.log(`Best available rate: 1 ${we_want.currency} = ${best_offer_quality} ${we_spend.currency}`);
//           //                console.log(`Your proposed rate: 1 ${we_want.currency} = ${proposed_quality} ${we_spend.currency}`);

//           //                // Calculate slippage percentage
//           //                const slippage = proposed_quality.minus(best_offer_quality).dividedBy(best_offer_quality);
//           //                console.log(`Slippage: ${slippage}%`);
//           //                console.log(`Slippage: ${slippage.times(100).toFixed(2)}%`);

//           //                if (slippage.gt(MAX_SLIPPAGE)) {
//           //                     throw new Error(`Potential slippage ${slippage.times(100).toFixed(2)}% exceeds maximum allowed ${MAX_SLIPPAGE * 100}%`);
//           //                }

//           //                // Add this information to your UI
//           //                resultField.value += `\nMarket Analysis:\n`;
//           //                resultField.value += `- Best available rate: 1 ${we_want.currency} = ${best_offer_quality.toFixed(6)} ${we_spend.currency}\n`;
//           //                resultField.value += `- Your proposed rate: 1 ${we_want.currency} = ${proposed_quality.toFixed(6)} ${we_spend.currency}\n`;
//           //                resultField.value += `- Slippage: ${slippage.times(100).toFixed(2)}%\n`;

//           //                console.log(`Matching Offer found, funded with ${o.owner_funds} ${we_want.currency}`);
//           //                running_total = running_total.plus(BigNumber(o.owner_funds));
//           //                if (running_total >= want_amt) {
//           //                     console.log('Full Offer will probably fill');
//           //                     break;
//           //                }
//           //           } else {
//           //                // Offers are in ascending quality order, so no others after this
//           //                // will match, either
//           //                console.log(`Remaining orders too expensive.`);
//           //                break;
//           //           }
//           //      }

//           //      console.log(`Total matched: ${Math.min(running_total, want_amt)} ${we_want.currency}`);
//           //      if (running_total > 0 && running_total < want_amt) {
//           //           console.log(`Remaining ${want_amt - running_total} ${we_want.currency} would probably be placed on top of the order book.`);
//           //      }
//           // }

//           if (running_total == 0) {
//                // If part of the Offer was expected to cross, then the rest would be placed
//                // at the top of the order book. If none did, then there might be other
//                // Offers going the same direction as ours already on the books with an
//                // equal or better rate. This code counts how much liquidity is likely to be
//                // above ours.

//                // Unlike above, this time we check for Offers going the same direction as
//                // ours, so TakerGets and TakerPays are reversed from the previous
//                // book_offers request.
//                const orderbook2_resp = await client.request({
//                     method: 'book_offers',
//                     taker: wallet.address,
//                     ledger_index: 'current',
//                     taker_gets: we_spend,
//                     taker_pays: we_want,
//                });
//                console.log('orderbook2_resp: ', orderbook2_resp.result);

//                // Since TakerGets/TakerPays are reversed, the quality is the inverse.
//                // You could also calculate this as 1/proposed_quality.
//                const offered_quality = BigNumber(we_want.value) / BigNumber(we_spend.value);

//                // Calculate effective rate
//                const effectiveRate = calculateEffectiveRate(proposed_quality, xrpReserve, offerType);
//                console.log(`Proposed rate: ${proposed_quality.toString()}`);
//                console.log(`Effective rate (including reserves): ${effectiveRate.toString()}`);

//                resultField.value += `Rate Analysis:\n`;
//                resultField.value += `- Proposed Rate: 1 ${we_spend.currency} = ${proposed_quality} ${we_want.currency}\n`;
//                resultField.value += `- Effective Rate (incl. costs): 1 ${we_spend.currency} = ${effectiveRate.toFixed(6)} ${we_want.currency}\n\n`;

//                if (effectiveRate.gt(offered_quality)) {
//                     resultField.value += `Note: Effective rate is worse than proposed due to XRP reserve requirements\n\n`;
//                }

//                const offers2 = orderbook2_resp.result.offers;
//                let tally_currency = we_spend.currency;
//                if (tally_currency == XRP_CURRENCY) {
//                     tally_currency = 'drops of XRP';
//                }
//                let running_total2 = BigNumber(0);
//                if (!offers2) {
//                     console.log(`No similar Offers in the book. Ours would be the first.`);
//                } else {
//                     for (const o of offers2) {
//                          if (o.quality <= effectiveRate) {
//                               // if (o.quality <= offered_quality) {
//                               // Get the best offer quality (first offer in the list is always best price)
//                               const best_offer_quality = new BigNumber(o.quality);
//                               const proposed_quality = new BigNumber(weSpendAmountField.value).dividedBy(weWantAmountField.value);

//                               console.log(`Best available rate: 1 ${we_spend.currency} = ${best_offer_quality} ${we_want.currency}`);
//                               console.log(`Your proposed rate: 1 ${we_spend.currency} = ${proposed_quality} ${we_want.currency}`);

//                               // Calculate slippage percentage
//                               const slippage = proposed_quality.minus(best_offer_quality).dividedBy(best_offer_quality);
//                               console.log(`Slippage: ${slippage.times(100).toFixed(2)}%`);

//                               if (slippage.gt(MAX_SLIPPAGE)) {
//                                    // throw new Error(`Potential slippage ${slippage.times(100).toFixed(2)}% exceeds maximum allowed ${MAX_SLIPPAGE * 100}%`);
//                                    resultField.value += `Potential slippage ${slippage.times(100).toFixed(2)}% exceeds maximum allowed ${MAX_SLIPPAGE * 100}%`;
//                               }

//                               // Add this information to your UI
//                               resultField.value += `\nMarket Analysis:\n`;
//                               resultField.value += `- Best available rate: 1 ${we_spend.currency} = ${best_offer_quality.toFixed(6)} ${we_want.currency}\n`;
//                               resultField.value += `- Your proposed rate: 1 ${we_spend.currency} = ${proposed_quality.toFixed(6)} ${we_want.currency}\n`;
//                               resultField.value += `- Slippage: ${slippage.times(100).toFixed(2)}%\n`;

//                               console.log(`Existing offer found, funded with ${o.owner_funds} ${tally_currency}`);
//                               running_total2 = running_total2.plus(BigNumber(o.owner_funds));
//                          } else {
//                               console.log(`Remaining orders are below where ours would be placed.`);
//                               break;
//                          }
//                     }

//                     console.log(`Our Offer would be placed below at least ${running_total2} ${tally_currency}`);

//                     if (running_total > 0 && running_total < want_amt) {
//                          console.log(`Remaining ${want_amt - running_total} ${tally_currency} will probably be placed on top of the order book.`);
//                     }
//                }
//           }

//           let prepared;
//           if (we_spend.currency === XRP_CURRENCY) {
//                prepared = await client.autofill({
//                     TransactionType: 'OfferCreate',
//                     Account: wallet.address,
//                     TakerGets: we_spend.value,
//                     TakerPays: we_want,
//                     Flags: isMarketOrder ? xrpl.OfferCreateFlags.tfImmediateOrCancel : 0,
//                });
//           } else {
//                prepared = await client.autofill({
//                     TransactionType: 'OfferCreate',
//                     Account: wallet.address,
//                     TakerGets: we_spend,
//                     TakerPays: we_want.value,
//                     Flags: isMarketOrder ? xrpl.OfferCreateFlags.tfImmediateOrCancel : 0,
//                });
//           }

//           console.debug(`prepared ${prepared}`);

//           const signed = wallet.sign(prepared);
//           resultField.innerHTML += '\nSubmitting transaction';
//           const tx = await client.submitAndWait(signed.tx_blob);
//           console.debug(`create offer tx ${tx}`);

//           if (tx.result.meta.TransactionResult == TES_SUCCESS) {
//                resultField.value += prepareTxHashForOutput(tx.result.hash) + '\n';
//                resultField.value += parseXRPLTransaction(tx.result);
//                resultField.classList.add('success');
//           } else {
//                const errorResults = `Error sending transaction: ${tx.result.meta.TransactionResult}`;
//                resultField.value += errorResults;
//                resultField.classList.add('error');
//           }

//           xrpBalanceField.value = await client.getXrpBalance(wallet.address);

//           // Check metadata ------------------------------------------------------------
//           // In JavaScript, you can use getBalanceChanges() to help summarize all the
//           // balance changes caused by a transaction.
//           const balance_changes = xrpl.getBalanceChanges(tx.result.meta);
//           console.log('Total balance changes:', balance_changes);

//           let offers_affected = 0;
//           for (const affnode of tx.result.meta.AffectedNodes) {
//                if (affnode.hasOwnProperty('ModifiedNode')) {
//                     if (affnode.ModifiedNode.LedgerEntryType == 'Offer') {
//                          // Usually a ModifiedNode of type Offer indicates a previous Offer that
//                          // was partially consumed by this one.
//                          offers_affected += 1;
//                     }
//                } else if (affnode.hasOwnProperty('DeletedNode')) {
//                     if (affnode.DeletedNode.LedgerEntryType == 'Offer') {
//                          // The removed Offer may have been fully consumed, or it may have been
//                          // found to be expired or unfunded.
//                          offers_affected += 1;
//                     }
//                } else if (affnode.hasOwnProperty('CreatedNode')) {
//                     if (affnode.CreatedNode.LedgerEntryType == 'RippleState') {
//                          console.log('Created a trust line.');
//                     } else if (affnode.CreatedNode.LedgerEntryType == 'Offer') {
//                          const offer = affnode.CreatedNode.NewFields;
//                          console.log(`Created an Offer owned by ${offer.Account} with TakerGets=${amt_str(offer.TakerGets)} and TakerPays=${amt_str(offer.TakerPays)}.`);
//                     }
//                }
//           }
//           console.log(`Modified or removed ${offers_affected} matching Offer(s)`);

//           // Check balances ------------------------------------------------------------
//           console.log('Getting address balances as of validated ledger');
//           const balances = await client.request({
//                command: 'account_lines',
//                account: wallet.address,
//                ledger_index: 'validated',
//                // You could also use ledger_index: "current" to get pending data
//           });
//           console.log('Balances', balances.result);

//           // Check Offers --------------------------------------------------------------
//           console.log(`Getting outstanding Offers from ${wallet.address} as of validated ledger`);
//           const acct_offers = await client.request({
//                command: 'account_offers',
//                account: wallet.address,
//                ledger_index: 'validated',
//           });
//           console.log('Getting outstanding Offers ', acct_offers.result);

//           const updatedBalance = await getOnlyTokenBalance(client, wallet.address, tokenBalance);
//           console.log(`${tokenBalance} Updated Balance: ${updatedBalance}`);
//           resultField.value += `\n\n${tokenBalance} Updated Balance: ${updatedBalance}\n`;

//           await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
//           const finalXrpBalance = await client.getXrpBalance(wallet.address);
//           console.log(`Final XRP Balance: ${finalXrpBalance}`);
//           resultField.value += `Final XRP Balance: ${finalXrpBalance}\n`;

//           if (weWantCurrencyField.value === XRP_CURRENCY) {
//                document.getElementById('weWantTokenBalanceField').value = finalXrpBalance;
//                document.getElementById('weSpendTokenBalanceField').value = updatedBalance;
//           } else {
//                document.getElementById('weWantTokenBalanceField').value = updatedBalance;
//                document.getElementById('weSpendTokenBalanceField').value = finalXrpBalance;
//           }
//      } catch (error) {
//           console.error('Error:', error);
//           setError(`ERROR: ${error.message || 'Unknown error'}`);
//      } finally {
//           if (spinner) spinner.style.display = 'none';
//           const now = Date.now() - startTime;
//           totalExecutionTime.value = now;
//           console.log(`Leaving createOffer in ${now}ms`);
//      }
// }

export async function cancelOffer() {
     console.log('Entering cancelOffer');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     if (!resultField) {
          console.error('ERROR: resultField not found');
          return;
     }
     resultField.classList.remove('error', 'success');
     resultField.innerHTML = '';

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');
     const totalExecutionTime = document.getElementById('totalExecutionTime');

     const fields = {
          accountSeed: document.getElementById('accountSeedField'),
          xrpBalance: document.getElementById('xrpBalanceField'),
          offerSequence: document.getElementById('offerSequenceField'),
     };

     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim();
          }
     }

     const { accountSeed: accountSeedField, xrpBalance: xrpBalanceField, offerSequence: offerSequenceField } = fields;

     const validations = [
          [!validatInput(accountSeedField.value), 'ERROR: Account seed amount can not be empty'],
          [!validatInput(xrpBalanceField.value), 'ERROR: XRP balance can not be empty'],
          [!validatInput(offerSequenceField.value), 'ERROR: Offer Sequence amount cannot be empty'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.innerHTML = `Connected to ${environment} ${net}\nCancel Offers.\n\n`;

          const offerSequenceArray = offerSequenceField.value.split(',').map(item => item.trim());

          let wallet;
          if (accountSeedField.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(accountSeedField.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (accountSeedField.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(accountSeedField.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

          let tx;

          /* OfferSequence is the Seq value when you getOffers. */
          for (const element of offerSequenceArray) {
               if (isNaN(element)) {
                    return setError(`ERROR: Offer Sequence must be a valid number`, spinner);
               }

               if (parseFloat(element) <= 0) {
                    return setError(`ERROR: Offer Sequence must be greater than zero`, spinner);
               }

               try {
                    const prepared = await client.autofill({
                         TransactionType: 'OfferCancel',
                         Account: wallet.address,
                         OfferSequence: parseInt(element),
                    });

                    const signed = wallet.sign(prepared);
                    tx = await client.submitAndWait(signed.tx_blob);
               } catch (err) {
                    throw new Error(err);
               }

               const resultCode = tx.result.meta?.TransactionResult;
               if (resultCode !== TES_SUCCESS) {
                    renderTransactionDetails(tx);
                    resultField.classList.add('error');
               }

               renderTransactionDetails(tx);
               resultField.classList.add('success');
          }

          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.address);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
     } finally {
          if (spinner) spinner.style.display = 'none';
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving cancelOffer in ${now}ms`);
     }
}

export async function getOrderBook() {
     console.log('Entering getOrderBook');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     if (!resultField) {
          console.error('ERROR: resultField not found');
          return;
     }
     resultField.classList.remove('error', 'success');
     resultField.innerHTML = '';

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
          ownerCount: document.getElementById('ownerCountField'),
          totalXrpReserves: document.getElementById('totalXrpReservesField'),
          totalExecutionTime: document.getElementById('totalExecutionTime'),
     };

     // DOM existence check
     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim();
          }
     }

     const { accountName, accountAddress, accountSeed, xrpBalance, weWantCurrency, weWantIssuer, weWantAmount, weSpendCurrency, weSpendIssuer, weSpendAmount, ownerCount, totalXrpReserves, totalExecutionTime } = fields;

     // Validation checks
     const validations = [
          [!validatInput(accountName.value), 'Account Name cannot be empty'],
          [!validatInput(accountAddress.value), 'Account Address cannot be empty'],
          [!validatInput(accountSeed.value), 'Account seed cannot be empty'],
          [!validatInput(xrpBalance.value), 'XRP balance cannot be empty'],
          [!validatInput(weWantCurrency.value), 'Taker Gets currency cannot be empty'],
          [weWantCurrency.value.length < 3, 'Invalid Taker Gets currency. Length must be greater than 3'],
          [!validatInput(weSpendCurrency.value), 'Taker Pays currency cannot be empty'],
          [weSpendCurrency.value.length < 3, 'Invalid Taker Pays currency. Length must be greater than 3'],
          [!validatInput(weWantAmount.value), 'Taker Gets amount cannot be empty'],
          [isNaN(weWantAmount.value), 'Taker Gets amount must be a valid number'],
          [parseFloat(weWantAmount.value) <= 0, 'Taker Gets amount must be greater than zero'],
          [!validatInput(weSpendAmount.value), 'Taker Pays amount cannot be empty'],
          [isNaN(weSpendAmount.value), 'Taker Pays amount must be a valid number'],
          [parseFloat(weSpendAmount.value) <= 0, 'Taker Pays amount must be greater than zero'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     const buildCurrencyObject = (currency, issuer, value) => (currency === XRP_CURRENCY ? { currency, value } : { currency, issuer, value });

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          // Check server version
          const serverInfo = await client.request({ method: 'server_info' });
          const serverVersion = serverInfo.result.info.build_version;
          console.log('Server Version: ' + serverVersion);

          // Initialize wallet
          let wallet;
          if (accountSeed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(accountSeed.value, {
                    algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION,
               });
          } else if (accountSeed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(accountSeed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, {
                    algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION,
               });
          } else {
               wallet = xrpl.Wallet.fromSeed(accountSeed.value, {
                    algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION,
               });
          }

          // Prepare currency objects
          let we_want, we_spend;
          if (weWantCurrency.value.length <= 3 && weSpendCurrency.value.length <= 3) {
               we_want = buildCurrencyObject(weWantCurrency.value, weWantIssuer.value, weWantAmount.value);
               we_spend = buildCurrencyObject(weSpendCurrency.value, weSpendIssuer.value, weSpendAmount.value);
          } else if (weWantCurrency.value.length > 3) {
               const encodedCurrencyCode = encodeCurrencyCode(weWantCurrency.value);
               we_want = buildCurrencyObject(encodedCurrencyCode, weWantIssuer.value, weWantAmount.value);
               we_spend = buildCurrencyObject(weSpendCurrency.value, weSpendIssuer.value, weSpendAmount.value);
          } else if (weSpendCurrency.value.length > 3) {
               const encodedCurrencyCode = encodeCurrencyCode(weSpendCurrency.value);
               we_spend = buildCurrencyObject(encodedCurrencyCode, weSpendIssuer.value, weSpendAmount.value);
               we_want = buildCurrencyObject(weWantCurrency.value, weWantIssuer.value, weWantAmount.value);
          }

          // Decode currencies for display
          const displayWeWantCurrency = we_want.currency.length > 3 ? decodeCurrencyCode(we_want.currency) : we_want.currency;
          const displayWeSpendCurrency = we_spend.currency.length > 3 ? decodeCurrencyCode(we_spend.currency) : we_spend.currency;

          console.log('we_want:', we_want);
          console.log('we_spend:', we_spend);

          // Determine offer type
          const offerType = we_spend.currency === XRP_CURRENCY ? 'buy' : 'sell';
          console.log(`Offer Type: ${offerType}`);

          // Prepare data for rendering
          const data = {
               sections: [],
          };

          // Fetch order book
          let orderBook, buySideOrderBook, sellSideOrderBook, spread, liquidity;
          if (offerType === 'sell') {
               console.log(`SELLING ${we_spend.currency} BUYING ${we_want.currency}`);
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
               spread = computeBidAskSpread(buySideOrderBook.result.offers, orderBook.result.offers);
               liquidity = computeLiquidityRatio(buySideOrderBook.result.offers, orderBook.result.offers, false);
          } else {
               console.log(`BUYING ${we_want.currency} SELLING ${we_spend.currency}`);
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
               spread = computeBidAskSpread(orderBook.result.offers, sellSideOrderBook.result.offers);
               liquidity = computeLiquidityRatio(orderBook.result.offers, sellSideOrderBook.result.offers);
          }

          // Order Book section
          if (orderBook.result.offers.length <= 0) {
               data.sections.push({
                    title: 'Order Book',
                    openByDefault: true,
                    content: [
                         {
                              key: 'Status',
                              value: `No orders in the order book for ${displayWeSpendCurrency}/${displayWeWantCurrency}`,
                         },
                    ],
               });
          } else {
               data.sections.push({
                    title: `Order Book (${orderBook.result.offers.length})`,
                    openByDefault: true,
                    subItems: orderBook.result.offers.map((offer, index) => {
                         const takerGets = typeof offer.TakerGets === 'string' ? `${offer.TakerGets} DROPS` : `${offer.TakerGets.value} ${offer.TakerGets.currency}${offer.TakerGets.issuer ? ` (Issuer: ${offer.TakerGets.issuer})` : ''}`;
                         const takerPays = typeof offer.TakerPays === 'string' ? `${offer.TakerPays} DROPS` : `${offer.TakerPays.value} ${offer.TakerPays.currency}${offer.TakerPays.issuer ? ` (Issuer: ${offer.TakerPays.issuer})` : ''}`;
                         return {
                              key: `Order ${index + 1} (Sequence: ${offer.Sequence})`,
                              openByDefault: false,
                              content: [{ key: 'Sequence', value: String(offer.Sequence) }, { key: 'Taker Gets', value: takerGets }, { key: 'Taker Pays', value: takerPays }, ...(offer.Expiration ? [{ key: 'Expiration', value: new Date(offer.Expiration * 1000).toISOString() }] : []), ...(offer.Flags ? [{ key: 'Flags', value: String(offer.Flags) }] : []), { key: 'Account', value: `<code>${offer.Account}</code>` }],
                         };
                    }),
               });
          }

          // Statistics section
          if (orderBook.result.offers.length > 0) {
               const stats = computeAverageExchangeRateBothWays(orderBook.result.offers, 15);
               populateStatsFields(stats, we_want, we_spend, spread, liquidity, offerType);

               const pair = `${displayWeWantCurrency}/${displayWeSpendCurrency}`;
               const reversePair = `${displayWeSpendCurrency}/${displayWeWantCurrency}`;
               data.sections.push({
                    title: 'Statistics',
                    openByDefault: true,
                    content: [
                         { key: 'VWAP', value: `${stats.forward.vwap.toFixed(8)} ${pair}` },
                         { key: 'Simple Average', value: `${stats.forward.simpleAvg.toFixed(8)} ${pair}` },
                         { key: 'Best Rate', value: `${stats.forward.bestRate.toFixed(8)} ${pair}` },
                         { key: 'Worst Rate', value: `${stats.forward.worstRate.toFixed(8)} ${pair}` },
                         {
                              key: 'Depth (5% slippage)',
                              value: `${stats.forward.depthDOG.toFixed(2)} ${displayWeWantCurrency} for ${stats.forward.depthXRP.toFixed(2)} ${displayWeSpendCurrency}`,
                         },
                         {
                              key: `Execution (15 ${displayWeSpendCurrency})`,
                              value: stats.forward.insufficientLiquidity ? `Insufficient liquidity: ${stats.forward.executionDOG.toFixed(2)} ${displayWeWantCurrency} for ${stats.forward.executionXRP.toFixed(2)} ${displayWeSpendCurrency}, Avg Rate: ${stats.forward.executionPrice.toFixed(8)} ${pair}` : `Receive ${stats.forward.executionDOG.toFixed(2)} ${displayWeWantCurrency}, Avg Rate: ${stats.forward.executionPrice.toFixed(8)} ${pair}`,
                         },
                         {
                              key: 'Price Volatility',
                              value: `Mean ${stats.forward.simpleAvg.toFixed(8)} ${pair}, StdDev ${stats.forward.volatility.toFixed(8)} (${stats.forward.volatilityPercent.toFixed(2)}%)`,
                         },
                         {
                              key: 'Spread',
                              value: offerType === 'buy' ? `${spread.spread.toFixed(8)} ${pair} (${spread.spreadPercent.toFixed(2)}%)` : `${spread.spread.toFixed(8)} ${reversePair} (${spread.spreadPercent.toFixed(2)}%)`,
                         },
                         {
                              key: 'Liquidity Ratio',
                              value: `${liquidity.ratio.toFixed(2)} (${pair} vs ${reversePair})`,
                         },
                    ],
               });
          }

          // Account Details section
          // data.sections.push({
          //      title: 'Account Details',
          //      openByDefault: true,
          //      content: [
          //           { key: 'Name', value: accountName.value },
          //           { key: 'Address', value: `<code>${wallet.address}</code>` },
          //           { key: 'XRP Balance', value: await client.getXrpBalance(wallet.address) },
          //      ],
          // });

          // Server Info section
          // data.sections.push({
          //      title: 'Server Info',
          //      openByDefault: false,
          //      content: [{ key: 'Environment', value: environment }, { key: 'Network', value: net }, { key: 'Server Version', value: serverVersion }, ...(parseFloat(serverVersion) < 1.9 ? [{ key: 'Warning', value: 'Server version may not fully support order book operations (requires rippled 1.9.0 or higher)' }] : [])],
          // });

          // Render data
          renderOrderBookDetails(data);

          // Update account fields
          await updateOwnerCountAndReserves(client, wallet.address, ownerCount, totalXrpReserves);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`, spinner);
     } finally {
          if (spinner) spinner.style.display = 'none';
          totalExecutionTime.value = Date.now() - startTime;
          console.log(`Leaving getOrderBook in ${totalExecutionTime.value}ms`);
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

export async function getCurrencyBalance(currencyCode) {
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

export async function getXrpBalance() {
     try {
          const client = await getClient();
          const accountAddressField = document.getElementById('accountAddressField');
          return await client.getXrpBalance(accountAddressField.value);
     } catch (error) {
          console.error('Error fetching balance:', error);
          return null;
     }
}

export async function displayOfferDataForAccount1() {
     accountNameField.value = account1name.value;
     accountAddressField.value = account1address.value;

     if (account1seed.value === '') {
          if (account1mnemonic.value === '') {
               accountSeedField.value = account1secretNumbers.value;
          } else {
               accountSeedField.value = account1mnemonic.value;
          }
     } else {
          accountSeedField.value = account1seed.value;
     }
     // accountSeedField.value = account1seed.value;

     const account2addressField = document.getElementById('account2address');
     if (validatInput(account2addressField)) {
          document.getElementById('weWantIssuerField').value = account2addressField.value;
     }

     // Default to DOG
     document.getElementById('weWantCurrencyField').value = 'DOG'; // RLUSD DOGGY
     document.getElementById('weWantAmountField').value = '1';
     document.getElementById('weSpendCurrencyField').value = XRP_CURRENCY;
     document.getElementById('weSpendAmountField').value = '1';

     const client = await getClient();
     // Default to DOG
     document.getElementById('weWantTokenBalanceField').value = await getOnlyTokenBalance(client, accountAddressField.value, 'DOG'); // RLUSD DOGGY
     document.getElementById('weSpendTokenBalanceField').value = (await client.getXrpBalance(accountAddressField.value.trim())) - totalXrpReservesField.value;

     await getXrpBalance();
     await getOffers();
}

window.createOffer = createOffer;
window.getOffers = getOffers;
window.cancelOffer = cancelOffer;
window.getOrderBook = getOrderBook;
window.getCurrencyBalance = getCurrencyBalance;
window.encodeCurrencyCode = encodeCurrencyCode;
window.getXrpBalance = getXrpBalance;
window.getTransaction = getTransaction;
window.getTokenBalance = getTokenBalance;
window.displayOfferDataForAccount1 = displayOfferDataForAccount1;
window.disconnectClient = disconnectClient;
window.gatherAccountInfo = gatherAccountInfo;
window.clearFields = clearFields;
window.distributeAccountInfo = distributeAccountInfo;
