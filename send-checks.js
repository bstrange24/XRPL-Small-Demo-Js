import * as xrpl from 'xrpl';
import { getClient, getNet, disconnectClient, validatInput, getXrpBalance, setError, parseXRPLAccountObjects, parseXRPLTransaction, gatherAccountInfo, clearFields, distributeAccountInfo, getTransaction, updateOwnerCountAndReserves, addTime, convertXRPLTime, prepareTxHashForOutput, decodeCurrencyCode, renderAccountDetails, renderCheckDetails, renderTransactionDetails } from './utils.js';
import { XRP_CURRENCY, ed25519_ENCRYPTION, secp256k1_ENCRYPTION, MAINNET, TES_SUCCESS, EMPTY_STRING } from './constants.js';
import { derive } from 'xrpl-accountlib';

export async function getChecks() {
     console.log('Entering getChecks');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     if (!resultField) {
          console.error('ERROR: resultField not found');
          return;
     }
     resultField.classList.remove('error', 'success');
     resultField.innerHTML = EMPTY_STRING;

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          address: document.getElementById('accountAddressField'),
          ownerCount: document.getElementById('ownerCountField'),
          totalXrpReserves: document.getElementById('totalXrpReservesField'),
          totalExecutionTime: document.getElementById('totalExecutionTime'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
     };

     // DOM existence check
     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim();
          }
     }

     const { address, ownerCount, totalXrpReserves, totalExecutionTime, xrpBalanceField } = fields;

     // Validate input values
     const validations = [[!validatInput(address.value), 'Address cannot be empty']];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          const check_objects = await client.request({
               id: 5,
               command: 'account_objects',
               account: address.value,
               type: 'check',
               ledger_index: 'validated',
          });

          console.log('Response', check_objects);

          // Prepare data for renderAccountDetails
          const data = {
               sections: [{}],
          };

          if (check_objects.result.account_objects.length <= 0) {
               data.sections.push({
                    title: 'Checks',
                    openByDefault: true,
                    content: [{ key: 'Status', value: `No checks found for <code>${address.value}</code>` }],
               });
          } else {
               data.sections.push({
                    title: `Checks (${check_objects.result.account_objects.length})`,
                    openByDefault: true,
                    subItems: check_objects.result.account_objects.map((check, counter) => {
                         const { Destination, Amount, SendMax, Expiration, InvoiceID, DestinationTag, SourceTag, LedgerEntryType, PreviousTxnID, index } = check;
                         // Use Amount if available, otherwise fall back to SendMax
                         const amountValue = Amount || SendMax;
                         const amountDisplay = amountValue ? (typeof amountValue === 'string' ? `${xrpl.dropsToXrp(amountValue)} XRP` : `${amountValue.value} ${amountValue.currency} (<code>${amountValue.issuer}</code>)`) : 'N/A';
                         return {
                              key: `Check ${counter + 1} (ID: ${PreviousTxnID.slice(0, 8)}...)`,
                              openByDefault: false,
                              content: [
                                   { key: 'Check ID / Ledger Index', value: `<code>${index}</code>` },
                                   { key: 'Previous Txn ID', value: `<code>${PreviousTxnID}</code>` },
                                   { key: 'Ledger Entry Type', value: LedgerEntryType },
                                   { key: 'Destination', value: `<code>${Destination}</code>` },
                                   { key: Amount ? 'Amount' : 'SendMax', value: amountDisplay },
                                   ...(Expiration ? [{ key: 'Expiration', value: new Date(Expiration * 1000).toLocaleString() }] : []),
                                   ...(InvoiceID ? [{ key: 'Invoice ID', value: `<code>${InvoiceID}</code>` }] : []),
                                   ...(DestinationTag ? [{ key: 'Destination Tag', value: String(DestinationTag) }] : []),
                                   ...(SourceTag ? [{ key: 'Source Tag', value: String(SourceTag) }] : []),
                              ],
                         };
                    }),
               });
          }

          // Render data
          renderCheckDetails(data);

          await updateOwnerCountAndReserves(client, address.value, ownerCount, totalXrpReserves);
          xrpBalanceField.value = (await client.getXrpBalance(address.value)) - totalXrpReserves.value;
     } catch (error) {
          console.error('Error:', error);
          setError('ERROR: ' + (error.message || 'Unknown error'));
     } finally {
          if (spinner) spinner.style.display = 'none';
          totalExecutionTime.value = Date.now() - startTime;
          console.log(`Leaving getChecks in ${totalExecutionTime.value}ms`);
     }
}

export async function sendCheck() {
     console.log('Entering sendCheck');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     if (!resultField) {
          console.error('ERROR: resultField not found');
          return;
     }
     resultField.classList.remove('error', 'success');
     resultField.innerHTML = EMPTY_STRING;

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          address: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          currency: document.getElementById('currencyField'),
          amount: document.getElementById('amountField'),
          destination: document.getElementById('destinationField'),
          balance: document.getElementById('xrpBalanceField'),
          memo: document.getElementById('memoField'),
          expirationTime: document.getElementById('expirationTimeField'),
          finishUnit: document.getElementById('checkExpirationTime'),
          ownerCount: document.getElementById('ownerCountField'),
          totalXrpReserves: document.getElementById('totalXrpReservesField'),
          tokenBalance: document.getElementById('tokenBalance'),
          issuerField: document.getElementById('issuerField'),
          totalExecutionTime: document.getElementById('totalExecutionTime'),
     };

     // DOM existence check
     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim(); // Trim whitespace
          }
     }

     const { address, seed, currency, amount, destination, balance, memo, expirationTime, finishUnit, ownerCount, totalXrpReserves, tokenBalance, issuerField, totalExecutionTime } = fields;

     // Validate input values
     const validations = [
          [!validatInput(address.value), 'Address cannot be empty'],
          [!validatInput(seed.value), 'Seed cannot be empty'],
          [!validatInput(currency.value), 'Currency cannot be empty'],
          [!validatInput(amount.value), currencyField.value === XRP_CURRENCY ? 'XRP Amount cannot be empty' : 'Token Amount cannot be empty'],
          [isNaN(amount.value), currencyField.value === XRP_CURRENCY ? 'XRP Amount must be a valid number' : 'Token Amount must be a valid number'],
          [parseFloat(amount.value) <= 0, currencyField.value === XRP_CURRENCY ? 'XRP Amount must be greater than zero' : 'Token Amount must be greater than zero'],
          [!validatInput(destination.value), 'Destination cannot be empty'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     let checkExpirationTime = EMPTY_STRING;
     if (expirationTime.value != EMPTY_STRING) {
          if (isNaN(parseFloat(expirationTime.value)) || expirationTime.value <= 0) {
               return setError('ERROR: Expiration time must be a valid number greater than zero', spinner);
          }
          const expirationTimeValue = expirationTime.value;
          checkExpirationTime = addTime(parseInt(expirationTimeValue), finishUnit.value);
          console.log(`Raw expirationTime: ${expirationTimeValue} finishUnit: ${finishUnit.value} checkExpirationTime: ${convertXRPLTime(parseInt(checkExpirationTime))}`);
     }

     // Check for positive number (greater than 0)
     if (tokenBalance && tokenBalance.value !== EMPTY_STRING) {
          const balance = Number(tokenBalance.value);

          if (isNaN(balance)) {
               return setError('ERROR: Token balance must be a number', spinner);
          }

          if (balance <= 0) {
               return setError('ERROR: Token balance must be greater than 0', spinner);
          }
     }

     if (issuerField && tokenBalance.value != EMPTY_STRING && Number(tokenBalance.value) > 0 && issuerField.value === EMPTY_STRING) {
          return setError('ERROR: Issuer can not be empty when sending a token for a check', spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.innerHTML = `Connected to ${environment} ${net}\n\n`;

          let wallet;
          if (seed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (seed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(seed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

          if (currency.value === XRP_CURRENCY) {
               if (amount.value > (await client.getXrpBalance(wallet.address)) - totalXrpReserves.value) {
                    return setError('ERROR: Insufficent XRP to send check', spinner);
               }
          }

          // Build SendMax amount
          let sendMax;
          if (currency.value === XRP_CURRENCY) {
               sendMax = xrpl.xrpToDrops(amount.value);
          } else {
               sendMax = {
                    currency: currency.value,
                    value: amount.value,
                    issuer: wallet.address,
               };
          }

          const tx = await client.autofill({
               TransactionType: 'CheckCreate',
               Account: wallet.classicAddress,
               SendMax: sendMax,
               Destination: destination.value,
          });

          if (memo && memo.value != EMPTY_STRING) {
               tx.Memos = [
                    {
                         Memo: {
                              MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                              MemoData: Buffer.from(memo.value, 'utf8').toString('hex'),
                         },
                    },
               ];
          }

          if (expirationTime && checkExpirationTime != EMPTY_STRING) {
               tx.Expiration = checkExpirationTime;
          }

          const signed = wallet.sign(tx);

          resultField.value += `Sending Check for ${amount.value} ${currency.value} to ${destination.value}\n`;

          const response = await client.submitAndWait(signed.tx_blob);
          console.log('Response', response);

          const resultCode = response.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               renderTransactionDetails(response);
               resultField.classList.add('error');
          }

          resultField.innerHTML += `Check sent successfully.\n\n`;

          renderTransactionDetails(response);
          resultField.classList.add('success');

          if (currency.value !== XRP_CURRENCY) {
               getTokenBalance();
          }

          await updateOwnerCountAndReserves(client, wallet.address, ownerCount, totalXrpReserves);
          balance.value = (await client.getXrpBalance(wallet.address)) - totalXrpReserves.value;
     } catch (error) {
          console.error('Error:', error);
          setError('ERROR: ' + (error.message || 'Unknown error'));
     } finally {
          if (spinner) spinner.style.display = 'none';
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving sendCheck in ${now}ms`);
     }
}

export async function cashCheck() {
     console.log('Entering cashCheck');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     if (!resultField) {
          console.error('ERROR: resultField not found');
          return;
     }
     resultField.classList.remove('error', 'success');
     resultField.innerHTML = EMPTY_STRING;

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          address: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          currency: document.getElementById('currencyField'),
          amount: document.getElementById('amountField'),
          destination: document.getElementById('destinationField'),
          issuer: document.getElementById('issuerField'),
          checkId: document.getElementById('checkIdField'),
          balance: document.getElementById('xrpBalanceField'),
          ownerCount: document.getElementById('ownerCountField'),
          totalXrpReserves: document.getElementById('totalXrpReservesField'),
          tokenBalance: document.getElementById('tokenBalance'),
          issuerField: document.getElementById('issuerField'),
          totalExecutionTime: document.getElementById('totalExecutionTime'),
     };

     // DOM existence check
     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim(); // Trim whitespace
          }
     }

     const { address, seed, currency, amount, destination, issuer, checkId, balance, ownerCount, totalXrpReserves, tokenBalance, issuerField, totalExecutionTime } = fields;

     // Validate input values
     const validations = [
          [!validatInput(address.value), 'Address cannot be empty'],
          [!validatInput(seed.value), 'Seed cannot be empty'],
          [!validatInput(currency.value), 'Currency cannot be empty'],
          [!validatInput(amount.value), 'XRP Amount cannot be empty'],
          [isNaN(amount.value), 'XRP Amount must be a valid number'],
          [parseFloat(amount.value) <= 0, 'XRP Amount must be greater than zero'],
          [!validatInput(destination.value), 'Destination cannot be empty'],
          [!validatInput(checkId.value), 'Check Id cannot be empty'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     // Check for positive number (greater than 0)
     if (tokenBalance && tokenBalance.value !== EMPTY_STRING) {
          const balance = Number(tokenBalance.value);

          if (isNaN(balance)) {
               return setError('ERROR: Token balance must be a number', spinner);
          }

          if (balance <= 0) {
               return setError('ERROR: Token balance must be greater than 0', spinner);
          }
     }

     if (issuerField && tokenBalance.value != EMPTY_STRING && Number(tokenBalance.value) > 0 && issuerField.value === EMPTY_STRING) {
          return setError('ERROR: Issuer can not be empty when sending a token for a check', spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.value = `Connected to ${environment} ${net}\n\n`;

          let wallet;
          if (seed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (seed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(seed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

          // Build amount object depending on currency
          const amountToCash =
               currency.value === XRP_CURRENCY
                    ? xrpl.xrpToDrops(amount.value)
                    : {
                           value: amount.value,
                           currency: currency.value,
                           issuer: issuer.value,
                      };

          const tx = await client.autofill({
               TransactionType: 'CheckCash',
               Account: wallet.classicAddress,
               Amount: amountToCash,
               CheckID: checkId.value,
          });

          const signed = wallet.sign(tx);
          resultField.value += `Cashing check for ${amount.value} ${currency.value}\n`;

          const response = await client.submitAndWait(signed.tx_blob);
          console.log('Response:', response);

          const resultCode = response.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               renderTransactionDetails(response);
               resultField.classList.add('error');
          }

          resultField.innerHTML += `Check cashed successfully.\n\n`;

          renderTransactionDetails(response);
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.address, ownerCount, totalXrpReserves);
          balance.value = (await client.getXrpBalance(wallet.address)) - totalXrpReserves.value;
     } catch (error) {
          console.error('Error:', error);
          setError('ERROR: ' + (error.message || 'Unknown error'));
     } finally {
          if (spinner) spinner.style.display = 'none';
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving cashCheck in ${now}ms`);
     }
}

export async function cancelCheck() {
     console.log('Entering cancelCheck');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     if (!resultField) {
          console.error('ERROR: resultField not found');
          return;
     }
     resultField.classList.remove('error', 'success');
     resultField.innerHTML = EMPTY_STRING;

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          seed: document.getElementById('accountSeedField'),
          checkId: document.getElementById('checkIdField'),
          balance: document.getElementById('xrpBalanceField'),
          ownerCount: document.getElementById('ownerCountField'),
          totalXrpReserves: document.getElementById('totalXrpReservesField'),
          totalExecutionTime: document.getElementById('totalExecutionTime'),
     };

     // DOM existence check
     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim(); // Trim whitespace
          }
     }

     const { seed, checkId, balance, ownerCount, totalXrpReserves, totalExecutionTime } = fields;

     // Validate input values
     const validations = [
          [!validatInput(seed.value), 'Seed cannot be empty'],
          [!validatInput(checkId.value), 'Check Id cannot be empty'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.value = `Connected to ${environment} ${net}\nCancelling Check\n\n`;

          let wallet;
          if (seed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (seed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(seed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

          const tx = await client.autofill({
               TransactionType: 'CheckCancel',
               Account: wallet.classicAddress,
               CheckID: checkId.value,
          });

          const signed = wallet.sign(tx);
          const response = await client.submitAndWait(signed.tx_blob);
          console.log('Response:', response);

          const resultCode = response.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               renderTransactionDetails(response);
               resultField.classList.add('error');
          }

          resultField.innerHTML += `Check cancelled successfully.\n\n`;

          renderTransactionDetails(response);
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.address, ownerCount, totalXrpReserves);
          balance.value = (await client.getXrpBalance(wallet.address)) - totalXrpReserves.value;
     } catch (error) {
          console.error('Error:', error);
          setError('ERROR: ' + (error.message || 'Unknown error'));
     } finally {
          if (spinner) spinner.style.display = 'none';
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving cancelCheck in ${now}ms`);
     }
}

export async function getTokenBalance() {
     console.log('Entering getTokenBalance');
     const startTime = Date.now();

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          seed: document.getElementById('accountSeedField'),
          currency: document.getElementById('currencyField'),
          balance: document.getElementById('xrpBalanceField'),
          tokenBalance: document.getElementById('tokenBalance'),
          totalXrpReserves: document.getElementById('totalXrpReservesField'),
          ownerCount: document.getElementById('ownerCountField'),
          issuerField: document.getElementById('issuerField'),
          totalExecutionTime: document.getElementById('totalExecutionTime'),
     };

     // DOM existence check
     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim(); // Trim whitespace
          }
     }

     const { seed, currency, balance, tokenBalance, totalXrpReserves, ownerCount, issuerField, totalExecutionTime } = fields;

     // Validate input values
     const validations = [[!validatInput(seed.value), 'Seed cannot be empty']];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          let wallet;
          if (seed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (seed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(seed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

          // const wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          const gatewayBalances = await client.request({
               command: 'gateway_balances',
               account: wallet.classicAddress,
               ledger_index: 'validated',
          });

          console.log('gatewayBalances', gatewayBalances);

          let tokenTotal = 0;
          issuerField.innerHTML = EMPTY_STRING;

          Object.entries(gatewayBalances.result.assets).forEach(([issuer, assets]) => {
               console.log(`Issuer: ${issuer}`);

               assets.forEach(asset => {
                    console.log(`  Currency: ${asset.currency}, Value: ${asset.value}`);
                    let assetCurrency = asset.currency.length > 3 ? decodeCurrencyCode(asset.currency) : asset.currency;

                    if (currency.value === assetCurrency) {
                         console.log(`  Match: ${currency.value} = ${assetCurrency}`);
                         const value = parseFloat(asset.value);
                         if (!isNaN(value)) tokenTotal += value;

                         // Add the issuer to dropdown
                         const option = document.createElement('option');
                         option.value = issuer;
                         option.textContent = issuer;
                         issuerField.appendChild(option);
                    }
               });
          });

          const roundedTotal = Math.round(tokenTotal * 100) / 100; // or .toFixed(2) for a string
          tokenBalance.value = roundedTotal;

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCount, totalXrpReserves);
          balance.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError('ERROR: ' + (error.message || 'Unknown error'));
     } finally {
          if (spinner) spinner.style.display = 'none';
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving getTokenBalance in ${now}ms`);
     }
}

async function displayCheckDataForAccount1() {
     accountNameField.value = account1name.value;
     accountAddressField.value = account1address.value;
     if (account1seed.value === EMPTY_STRING) {
          if (account1mnemonic.value === EMPTY_STRING) {
               accountSeedField.value = account1secretNumbers.value;
          } else {
               accountSeedField.value = account1mnemonic.value;
          }
     } else {
          accountSeedField.value = account1seed.value;
     }
     destinationField.value = account2address.value;
     amountField.value = EMPTY_STRING;
     memoField.value = EMPTY_STRING;
     expirationTimeField.value = EMPTY_STRING;
     checkIdField.value = EMPTY_STRING;
     currencyField.value = XRP_CURRENCY;
     await getXrpBalance();
     await getChecks();
}

async function displayCheckDataForAccount2() {
     accountNameField.value = account2name.value;
     accountAddressField.value = account2address.value;
     if (account2seed.value === EMPTY_STRING) {
          if (account1mnemonic.value === EMPTY_STRING) {
               accountSeedField.value = account2secretNumbers.value;
          } else {
               accountSeedField.value = account2mnemonic.value;
          }
     } else {
          accountSeedField.value = account2seed.value;
     }
     destinationField.value = account1address.value;
     amountField.value = EMPTY_STRING;
     memoField.value = EMPTY_STRING;
     expirationTimeField.value = EMPTY_STRING;
     checkIdField.value = EMPTY_STRING;
     currencyField.value = XRP_CURRENCY;
     await getXrpBalance();
     await getChecks();
}

window.sendCheck = sendCheck;
window.getChecks = getChecks;
window.cashCheck = cashCheck;
window.cancelCheck = cancelCheck;
window.getTransaction = getTransaction;
window.getTokenBalance = getTokenBalance;
window.displayCheckDataForAccount1 = displayCheckDataForAccount1;
window.displayCheckDataForAccount2 = displayCheckDataForAccount2;
window.disconnectClient = disconnectClient;
window.gatherAccountInfo = gatherAccountInfo;
window.clearFields = clearFields;
window.distributeAccountInfo = distributeAccountInfo;
