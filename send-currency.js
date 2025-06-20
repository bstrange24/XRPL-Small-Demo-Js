import * as xrpl from 'xrpl';
import {
     getClient,
     getNet,
     disconnectClient,
     validatInput,
     getXrpBalance,
     getCurrentLedger,
     parseXRPLTransaction,
     getTransaction,
     setError,
     gatherAccountInfo,
     clearFields,
     distributeAccountInfo,
     generateNewWallet,
     generateNewWalletFromSecretNumbers,
     generateNewWalletFromMnemonic,
     getAccountFromSeed,
     getAccountFromMnemonic,
     getAccountFromSecretNumbers,
     updateOwnerCountAndReserves,
     prepareTxHashForOutput,
     encodeCurrencyCode,
     decodeCurrencyCode,
     renderTokenBalanceDetails,
     renderTrustLineDetails,
     renderTransactionDetails,
     buildTransactionSections,
     renderIssueCurrencyDetails,
} from './utils.js';
import { getCurrencyBalance } from './create-offer.js';
import { getAccountDetails, getTrustLines } from './account.js';
import { ed25519_ENCRYPTION, secp256k1_ENCRYPTION, MAINNET, TES_SUCCESS, EMPTY_STRING } from './constants.js';
import { derive } from 'xrpl-accountlib';

export async function createTrustLine() {
     console.log('Entering createTrustLine');
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
          address: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          currency: document.getElementById('currencyField'),
          amount: document.getElementById('amountField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
          destinationAddress: document.getElementById('destinationField'),
          ownerCountField: document.getElementById('ownerCountField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
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

     const { address, seed, destinationAddress, currency, amount, xrpBalanceField, ownerCountField, totalXrpReservesField, totalExecutionTime } = fields;

     // Validation checks
     const validations = [
          [!validatInput(address.value), 'Account address cannot be empty'],
          [!validatInput(seed.value), 'Seed cannot be empty'],
          [!validatInput(destinationAddress.value), 'Account Issuer cannot be empty'],
          [!validatInput(currency.value), 'Currency Code cannot be empty'],
          [!validatInput(amount.value), 'Amount cannot be empty'],
          [isNaN(amount.value), 'Amount must be a valid number'],
          [parseFloat(amount.value) <= 0, 'Amount must be greater than zero'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.innerHTML = `Connected to ${environment} ${net}\nCreating trust line\n\n`;

          let wallet;
          if (seed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (seed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(seed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

          const { result: feeResponse } = await client.request({ command: 'fee' });

          let cur;
          if (currency.value.length > 3) {
               cur = encodeCurrencyCode(currency.value);
          } else {
               cur = currency.value;
          }

          const trustSetTx = {
               TransactionType: 'TrustSet',
               Account: wallet.classicAddress,
               LimitAmount: {
                    currency: cur,
                    issuer: destinationAddress.value,
                    value: amount.value,
               },
               Fee: feeResponse.drops.open_ledger_fee,
          };

          console.log(`Submitting TrustSet ${trustSetTx} to create ${currency.value} trust line from ${destinationAddress.value}`);

          const preparedTx = await client.autofill(trustSetTx);
          const signedTx = wallet.sign(preparedTx);
          const tx = await client.submitAndWait(signedTx.tx_blob);

          console.log('Create Trustline tx', tx);

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               renderTransactionDetails(tx);
               resultField.classList.add('error');
          }

          resultField.innerHTML += `Trustline created successfully.\n\n`;

          renderTransactionDetails(tx);
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
     } finally {
          if (spinner) spinner.style.display = 'none';
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving createTrustLine in ${now}ms`);
     }
}

export async function removeTrustLine() {
     console.log('Entering removeTrustLine');
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
          address: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          destinationAddress: document.getElementById('destinationField'),
          currency: document.getElementById('currencyField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
          ownerCountField: document.getElementById('ownerCountField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
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

     const { address, seed, destinationAddress, currency, xrpBalanceField, ownerCountField, totalXrpReservesField, totalExecutionTime } = fields;

     // Validation checks
     const validations = [
          [!validatInput(address.value), 'Account address cannot be empty'],
          [!validatInput(seed.value), 'Seed cannot be empty'],
          [!validatInput(destinationAddress.value), 'Account Issuer cannot be empty'],
          [!validatInput(currency.value), 'Currency Code cannot be empty'],
     ];

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

          resultField.innerHTML = `Connected to ${environment} ${net}\nRemoving trust line\n\n`;

          const trustLines = await getTrustLines(wallet.classicAddress, client);

          // If no trust lines, return early
          if (trustLines.length === 0) {
               console.log(`No trust lines found for ${wallet.classicAddress}`);
               resultField.value += `No trust lines found for ${wallet.classicAddress}`;
               resultField.classList.add('success');
               await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
               xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
               return;
          }

          const targetLine = trustLines.find(line => line.account === destinationAddress.value && line.currency === currency.value);

          if (!targetLine) {
               return setError(`ERROR: No trust line found for ${currency.value} from ${destinationAddress.value}.`, spinner);
          }

          if (parseFloat(targetLine.balance) !== 0) {
               return setError(`ERROR: Cannot remove trust line: Balance is ${targetLine.balance}. Balance must be 0.`, spinner);
          }

          const { result: feeResponse } = await client.request({ command: 'fee' });

          if (currency.value.length > 3) {
               currency.value = encodeCurrencyCode(currency.value);
          }

          const trustSetTx = {
               TransactionType: 'TrustSet',
               Account: wallet.classicAddress,
               LimitAmount: {
                    currency: currency.value,
                    issuer: destinationAddress.value,
                    value: '0',
               },
               Fee: feeResponse.drops.open_ledger_fee,
          };

          console.log(`Submitting TrustSet ${trustSetTx} to remove ${currency.value} trust line from ${destinationAddress.value}`);

          const preparedTx = await client.autofill(trustSetTx);
          const signedTx = wallet.sign(preparedTx);
          const tx = await client.submitAndWait(signedTx.tx_blob);

          console.log('Remove Trustline tx', tx);

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               renderTransactionDetails(tx);
               resultField.classList.add('error');
          }

          resultField.innerHTML += `Trustline removed successfully.\n\n`;

          renderTransactionDetails(tx);
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
     } finally {
          if (spinner) spinner.style.display = 'none';
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving removeTrustLine in ${now}ms`);
     }
}

export async function getTrustLine() {
     console.log('Entering getTrustLine');
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
          seed: document.getElementById('accountSeedField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
          totalExecutionTime: document.getElementById('totalExecutionTime'),
          ownerCountField: document.getElementById('ownerCountField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
     };

     // DOM existence check
     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim();
          }
     }

     const { seed, xrpBalanceField, totalExecutionTime, ownerCountField, totalXrpReservesField } = fields;

     // Validation checks
     const validations = [[!validatInput(seed.value), 'Seed cannot be empty']];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          const serverInfo = await client.request({ method: 'server_info' });
          const serverVersion = serverInfo.result.info.build_version;
          console.log('Server Version: ' + serverVersion);

          // Initialize wallet
          let wallet;
          if (seed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(seed.value, {
                    algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION,
               });
          } else if (seed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(seed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, {
                    algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION,
               });
          } else {
               wallet = xrpl.Wallet.fromSeed(seed.value, {
                    algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION,
               });
          }

          // Fetch trust lines
          const trustLines = await getTrustLines(wallet.classicAddress, client);
          console.log(`Trust lines for ${wallet.classicAddress}:`, trustLines);

          // Prepare data for rendering
          const data = {
               sections: [],
          };

          // Trust Lines section
          const activeTrustLines = trustLines.filter(line => parseFloat(line.limit) > 0);
          if (activeTrustLines.length === 0) {
               data.sections.push({
                    title: 'Trust Lines',
                    openByDefault: true,
                    content: [{ key: 'Status', value: `No active trust lines found for <code>${wallet.classicAddress}</code>` }],
               });
          } else {
               data.sections.push({
                    title: `Trust Lines (${activeTrustLines.length})`,
                    openByDefault: true,
                    subItems: activeTrustLines.map((line, index) => {
                         const displayCurrency = line.currency.length > 3 ? decodeCurrencyCode(line.currency) : line.currency;
                         return {
                              key: `Trust Line ${index + 1} (${displayCurrency})`,
                              openByDefault: false,
                              content: [
                                   { key: 'Currency', value: displayCurrency },
                                   { key: 'Account', value: `<code>${line.account}</code>` },
                                   { key: 'Limit', value: line.limit },
                                   { key: 'Balance', value: line.balance },
                                   { key: 'Limit Peer', value: line.limit_peer },
                                   { key: 'No Ripple', value: String(line.no_ripple) },
                                   { key: 'No Ripple Peer', value: String(line.no_ripple_peer) },
                                   { key: 'Quality In', value: String(line.quality_in) },
                                   { key: 'Quality Out', value: String(line.quality_out) },
                              ],
                         };
                    }),
               });
          }

          // Account Details section
          // data.sections.push({
          //      title: 'Account Details',
          //      openByDefault: true,
          //      content: [
          //           { key: 'Address', value: `<code>${wallet.classicAddress}</code>` },
          //           { key: 'XRP Balance', value: await client.getXrpBalance(wallet.classicAddress) },
          //      ],
          // });

          // Server Info section
          // data.sections.push({
          //      title: 'Server Info',
          //      openByDefault: false,
          //      content: [{ key: 'Environment', value: environment }, { key: 'Network', value: net }, { key: 'Server Version', value: serverVersion }, ...(parseFloat(serverVersion) < 1.9 ? [{ key: 'Warning', value: 'Server version may not fully support trust line operations (requires rippled 1.9.0 or higher)' }] : [])],
          // });

          // Render data
          renderTrustLineDetails(data);

          // Update account fields
          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`, spinner);
     } finally {
          if (spinner) spinner.style.display = 'none';
          totalExecutionTime.value = Date.now() - startTime;
          console.log(`Leaving getTrustLine in ${totalExecutionTime.value}ms`);
     }
}

export async function sendCurrency() {
     console.log('Entering sendCurrency');
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
          accountAddress: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          currency: document.getElementById('currencyField'),
          destinationAddress: document.getElementById('destinationField'),
          amountField: document.getElementById('amountField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
          totalExecutionTime: document.getElementById('totalExecutionTime'),
          ownerCountField: document.getElementById('ownerCountField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
     };

     // DOM existence check
     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim(); // Trim whitespace
          }
     }

     const { accountAddress, seed, currency, destinationAddress, amountField, xrpBalanceField, totalExecutionTime, ownerCountField, totalXrpReservesField } = fields;

     // Validation checks
     const validations = [
          [!validatInput(accountAddress.value), 'Account address cannot be empty'],
          [!validatInput(seed.value), 'Seed cannot be empty'],
          [!validatInput(currency.value), 'Currency Code cannot be empty'],
          [!validatInput(destinationAddress.value), 'Desintation address cannot be empty'],
          [!validatInput(amountField.value), 'Amount cannot be empty'],
          [isNaN(amountField.value), 'Amount must be a valid number'],
          [parseFloat(amountField.value) <= 0, 'Amount must be greater than zero'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.innerHTML = `Connected to ${environment} ${net}\nSending Currency.\n`;

          let wallet;
          if (seed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (seed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(seed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

          // Step 1: Check sender's trust line and balance
          const senderTrustLines = await getTrustLines(accountAddress.value, client);

          // If no trust lines, return early
          if (senderTrustLines.length === 0) {
               console.log(`No trust lines found for ${wallet.classicAddress}`);
               resultField.value += `No trust lines found for ${wallet.classicAddress}`;
               resultField.classList.add('success');
               await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
               xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
               return;
          }

          const senderTrustLine = senderTrustLines.find(line => line.account === destinationAddress.value && line.currency === currency.value);

          if (!senderTrustLine || parseFloat(senderTrustLine.limit) === 0) {
               return setError(`ERROR: No active trust line for ${currency.value} from ${destinationAddress.value}`, spinner);
          }
          if (parseFloat(senderTrustLine.balance) < amountField.value) {
               return setError(`ERROR: Insufficient balance: ${senderTrustLine.balance} ${currency.value}, need ${amountField.value}`, spinner);
          }

          // Step 2: Check destination's trust line
          const destTrustLines = await getTrustLines(destinationAddress.value, client);

          // If no trust lines, return early
          if (destTrustLines.length === 0) {
               console.log(`No trust lines found for ${wallet.classicAddress}`);
               resultField.value += `No trust lines found for ${wallet.classicAddress}`;
               resultField.classList.add('success');
               await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
               xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
               return;
          }

          const destTrustLine = destTrustLines.find(line => line.account === accountAddress.value && line.currency === currency.value);

          if (!destTrustLine || parseFloat(destTrustLine.limit) === 0) {
               return setError(`ERROR: Destination ${destinationAddress.value} has no active trust line for ${currency.value} from ${accountAddress.value}`, spinner);
          }

          if (parseFloat(destTrustLine.limit) < amountField.value) {
               return setError(`ERROR: Destination trust line limit (${destTrustLine.limit}) is less than amount (${amountField.value})`, spinner);
          }

          // Step 3: Get current ledger index
          const currentLedger = await getCurrentLedger(client);
          const { result: feeResponse } = await client.request({ command: 'fee' });

          if (currency.value.length > 3) {
               currency.value = encodeCurrencyCode(currency.value);
          }

          const send_currency_tx = {
               TransactionType: 'Payment',
               Account: accountAddress.value,
               Destination: destinationAddress.value,
               Amount: {
                    currency: currency.value,
                    value: amountField.value,
                    issuer: accountAddress.value,
               },
               Fee: feeResponse.drops.open_ledger_fee,
               LastLedgerSequence: currentLedger + 50,
          };
          console.log('send_currency_tx', send_currency_tx);

          resultField.innerHTML += `\nSending ${amountField.value} ${currency.value} to ${destinationAddress.value}\n`;

          const pay_prepared = await client.autofill(send_currency_tx);
          const pay_signed = wallet.sign(pay_prepared);
          const pay_result = await client.submitAndWait(pay_signed.tx_blob);

          const resultCode = pay_result.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               renderTransactionDetails(pay_result);
               resultField.classList.add('error');
          }

          renderTransactionDetails(pay_result);
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
     } finally {
          if (spinner) spinner.style.display = 'none';
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving removeTrustLine in ${now}ms`);
     }
}

export async function issueCurrency() {
     console.log('Entering issueCurrency');
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
          accountAddressField: document.getElementById('accountAddressField'),
          accountSeed: document.getElementById('accountSeedField'),
          currency: document.getElementById('currencyField'),
          destinationAddress: document.getElementById('destinationField'),
          amountField: document.getElementById('amountField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
          totalExecutionTime: document.getElementById('totalExecutionTime'),
          ownerCountField: document.getElementById('ownerCountField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
     };

     // DOM existence check
     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim();
          }
     }

     const { accountAddressField, accountSeed, currency, destinationAddress, amountField, xrpBalanceField, totalExecutionTime, ownerCountField, totalXrpReservesField } = fields;

     // Validation checks
     const validations = [
          [!validatInput(accountAddressField.value), 'Account address cannot be empty'],
          [!validatInput(accountSeed.value), 'Seed cannot be empty'],
          [!validatInput(currency.value), 'Currency Code cannot be empty'],
          [!validatInput(destinationAddress.value), 'Destination address cannot be empty'],
          [!validatInput(amountField.value), 'Amount cannot be empty'],
          [isNaN(amountField.value), 'Amount must be a valid number'],
          [parseFloat(amountField.value) <= 0, 'Amount must be greater than zero'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.innerHTML = `Connected to ${environment} ${net}\nIssuing currency\n\n`;

          // Check server version
          const serverInfo = await client.request({ command: 'server_info' });
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

          // Prepare data for rendering
          const data = {
               sections: [],
          };

          // Step 1: Verify issuer account
          const accountInfo = await getAccountDetails(client, accountAddressField.value, 'validated');
          if (accountInfo == null) {
               throw new Error(`Issuer account ${accountAddressField.value} is not funded.`);
          }
          console.log('accountInfo', accountInfo);
          data.sections.push({
               title: 'Issuer Setup',
               openByDefault: true,
               content: [
                    { key: 'Issuer Account', value: `<code>${accountAddressField.value}</code>` },
                    { key: 'Status', value: 'Funded successfully' },
               ],
          });

          // Step 2: Check destination's trust line
          const destTrustLines = await getTrustLines(destinationAddress.value, client);
          if (destTrustLines.length === 0) {
               throw new Error(`No trust lines found for ${destinationAddress.value}`);
          }

          const decodedCurrency = currency.value.length > 3 ? encodeCurrencyCode(currency.value) : currency.value;
          const destTrustLine = destTrustLines.find(line => line.account === accountAddressField.value && line.currency === decodedCurrency);

          if (!destTrustLine || parseFloat(destTrustLine.limit) === 0) {
               throw new Error(`Destination needs a trust line for ${currency.value} from ${accountAddressField.value}`);
          }

          if (parseFloat(destTrustLine.limit) < parseFloat(amountField.value)) {
               throw new Error(`Destination trust line limit (${destTrustLine.limit}) is less than amount (${amountField.value})`);
          }

          // Step 3: Set DefaultRipple flag
          let accountSetResult = null;
          const accountFlags = accountInfo.result.account_data.Flags;
          const asfDefaultRipple = 0x00800000;

          if ((accountFlags & asfDefaultRipple) === 0) {
               const currentLedger1 = await getCurrentLedger(client);
               const { result: feeResponse } = await client.request({ command: 'fee' });
               const accountSetTx = {
                    TransactionType: 'AccountSet',
                    Account: accountAddressField.value,
                    SetFlag: 8, // asfDefaultRipple
                    LastLedgerSequence: currentLedger1 + 50,
                    Fee: feeResponse.drops.open_ledger_fee,
               };

               const preparedAccountSet = await client.autofill(accountSetTx);
               const signedAccountSet = wallet.sign(preparedAccountSet);
               accountSetResult = await client.submitAndWait(signedAccountSet.tx_blob);

               const resultCode = accountSetResult.result.meta.TransactionResult;
               if (resultCode !== TES_SUCCESS) {
                    throw new Error(`AccountSet transaction failed: ${resultCode}\n${parseXRPLTransaction(accountSetResult.result)}`);
               }
               console.log('DefaultRipple enabled', JSON.stringify(accountSetResult, null, 2));
               data.sections[0].content.push({
                    key: 'DefaultRipple',
                    value: 'Enabled via AccountSet transaction',
               });
          } else {
               data.sections[0].content.push({
                    key: 'DefaultRipple',
                    value: 'Already enabled',
               });
          }

          // Step 4: Issue currency
          const currentLedger2 = await getCurrentLedger(client);
          const { result: feeResponse2 } = await client.request({ command: 'fee' });

          const curr = currency.value.length > 3 ? decodedCurrency : currency.value;
          const paymentTx = {
               TransactionType: 'Payment',
               Account: accountAddressField.value,
               Destination: destinationAddress.value,
               Amount: {
                    currency: curr,
                    value: amountField.value,
                    issuer: accountAddressField.value,
               },
               Fee: feeResponse2.drops.open_ledger_fee,
               LastLedgerSequence: currentLedger2 + 50,
          };

          const pay_prepared = await client.autofill(paymentTx);
          const pay_signed = wallet.sign(pay_prepared);
          const pay_result = await client.submitAndWait(pay_signed.tx_blob);

          // Step 5: Check transaction result
          const resultCode = pay_result.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               data.sections.push({
                    title: 'Transaction Details',
                    openByDefault: true,
                    content: [
                         { key: 'Status', value: `Transaction failed: ${resultCode}` },
                         { key: 'Details', value: parseXRPLTransaction(pay_result.result) },
                    ],
               });
               throw new Error(`Payment transaction failed: ${resultCode}`);
          }

          // Transaction Details section
          const transactionSections = buildTransactionSections(pay_result); // Reuse logic from renderTransactionDetails
          data.sections.push(...Object.values(transactionSections));

          // New Balance section
          const updatedTrustLines = await getTrustLines(destinationAddress.value, client);
          const newTrustLine = updatedTrustLines.find(line => line.account === accountAddressField.value && line.currency === decodedCurrency);
          data.sections.push({
               title: 'New Balance',
               openByDefault: true,
               content: [
                    {
                         key: 'Destination',
                         value: `<code>${destinationAddress.value}</code>`,
                    },
                    {
                         key: 'Currency',
                         value: currency.value,
                    },
                    {
                         key: 'Balance',
                         value: newTrustLine ? newTrustLine.balance : 'Unknown',
                    },
               ],
          });

          // Issuer Obligations section
          const gatewayBalances = await client.request({
               command: 'gateway_balances',
               account: accountAddressField.value,
               ledger_index: 'validated',
          });
          if (gatewayBalances.result.obligations && Object.keys(gatewayBalances.result.obligations).length > 0) {
               data.sections.push({
                    title: `Issuer Obligations (${Object.keys(gatewayBalances.result.obligations).length})`,
                    openByDefault: true,
                    subItems: Object.entries(gatewayBalances.result.obligations).map(([oblCurrency, amount], index) => ({
                         key: `Obligation ${index + 1} (${oblCurrency})`,
                         openByDefault: false,
                         content: [
                              { key: 'Currency', value: oblCurrency },
                              { key: 'Amount', value: amount },
                         ],
                    })),
               });
          } else {
               data.sections.push({
                    title: 'Issuer Obligations',
                    openByDefault: true,
                    content: [{ key: 'Status', value: 'No obligations issued' }],
               });
          }

          // Account Details section
          data.sections.push({
               title: 'Account Details',
               openByDefault: true,
               content: [
                    { key: 'Issuer Address', value: `<code>${accountAddressField.value}</code>` },
                    { key: 'Destination Address', value: `<code>${destinationAddress.value}</code>` },
                    { key: 'XRP Balance (Issuer)', value: await client.getXrpBalance(accountAddressField.value) },
               ],
          });

          // Server Info section
          // data.sections.push({
          //      title: 'Server Info',
          //      openByDefault: false,
          //      content: [{ key: 'Environment', value: environment }, { key: 'Network', value: net }, { key: 'Server Version', value: serverVersion }, ...(parseFloat(serverVersion) < 1.9 ? [{ key: 'Warning', value: 'Server version may not fully support currency issuance (requires rippled 1.9.0 or higher)' }] : [])],
          // });

          // Render data
          renderIssueCurrencyDetails(data);

          // Update account fields
          await updateOwnerCountAndReserves(client, accountAddressField.value, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(accountAddressField.value);
     } catch (error) {
          console.error('Error setting up issuer or issuing', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`, spinner);
     } finally {
          if (spinner) spinner.style.display = 'none';
          totalExecutionTime.value = Date.now() - startTime;
          console.log(`Leaving issueCurrency in ${totalExecutionTime.value}ms`);
     }
}

// export async function issueCurrency() {
//      console.log('Entering issueCurrency');
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

//      const fields = {
//           accountAddressField: document.getElementById('accountAddressField'),
//           accountSeed: document.getElementById('accountSeedField'),
//           currency: document.getElementById('currencyField'),
//           destinationAddress: document.getElementById('destinationField'),
//           amountField: document.getElementById('amountField'),
//           xrpBalanceField: document.getElementById('xrpBalanceField'),
//           totalExecutionTime: document.getElementById('totalExecutionTime'),
//           ownerCountField: document.getElementById('ownerCountField'),
//           totalXrpReservesField: document.getElementById('totalXrpReservesField'),
//      };

//      // DOM existence check
//      for (const [name, field] of Object.entries(fields)) {
//           if (!field) {
//                return setError(`ERROR: DOM element ${name} not found`, spinner);
//           } else {
//                field.value = field.value.trim(); // Trim whitespace
//           }
//      }

//      const { accountAddressField, accountSeed, currency, destinationAddress, amountField, xrpBalanceField, totalExecutionTime, ownerCountField, totalXrpReservesField } = fields;

//      // Validation checks
//      const validations = [
//           [!validatInput(accountAddressField.value), 'Account address cannot be empty'],
//           [!validatInput(accountSeed.value), 'Seed cannot be empty'],
//           [!validatInput(currency.value), 'Currency Code cannot be empty'],
//           [!validatInput(destinationAddress.value), 'Desintation address cannot be empty'],
//           [!validatInput(amountField.value), 'Amount cannot be empty'],
//           [isNaN(amountField.value), 'Amount must be a valid number'],
//           [parseFloat(amountField.value) <= 0, 'Amount must be greater than zero'],
//      ];

//      for (const [condition, message] of validations) {
//           if (condition) return setError(`ERROR: ${message}`, spinner);
//      }

//      try {
//           const { net, environment } = getNet();
//           const client = await getClient();

//           resultField.innerHTML = `Connected to ${environment} ${net}\nSetting up issuer and issuing ${currency.value}\n\n`;

//           let wallet;
//           if (accountSeed.value.split(' ').length > 1) {
//                wallet = xrpl.Wallet.fromMnemonic(accountSeed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
//           } else if (accountSeed.value.includes(',')) {
//                const derive_account_with_secret_numbers = derive.secretNumbers(accountSeed.value);
//                wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
//           } else {
//                wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
//           }

//           // Step 1: Verify issuer account
//           const accountInfo = await getAccountDetails(client, accountAddressField.value, 'validated');
//           if (accountInfo == null) {
//                return setError(`ERROR: Issuer account ${accountAddressField.value} is not funded.\n`, spinner);
//           }

//           console.log('accountInfo', accountInfo);
//           console.log(`Issuer account ${accountAddressField.value} is funded`);

//           // Step 2: Check destination's trust line
//           const destTrustLines = await getTrustLines(destinationAddress.value, client);

//           // If no trust lines, return early
//           if (destTrustLines.length === 0) {
//                console.log(`No trust lines found for ${wallet.classicAddress}`);

//                await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
//                xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);

//                return setError(`ERROR: Issuer account ${accountAddressField.value} is not funded.\n`, spinner);
//           }

//           const decodedCurrency = currency.value.length > 3 ? encodeCurrencyCode(currency.value) : currency.value;

//           const destTrustLine = destTrustLines.find(line => line.account === accountAddressField.value && line.currency === decodedCurrency);

//           if (!destTrustLine || parseFloat(destTrustLine.limit) === 0) {
//                return setError(`ERROR: Destination needs a trust line for ${currency.value} from ${accountAddressField.value}`, spinner);
//           }

//           if (parseFloat(destTrustLine.limit) < amountField.value) {
//                return setError(`ERROR: Destination trust line limit (${destTrustLine.limit}) is less than amount (${amountField.value})`, spinner);
//           }

//           // Step 3: Set DefaultRipple flag
//           const accountFlags = accountInfo.result.account_data.Flags;
//           const asfDefaultRipple = 0x00800000;

//           const { result: feeResponse } = await client.request({ command: 'fee' });

//           if ((accountFlags && asfDefaultRipple) === 0) {
//                const currentLedger1 = await getCurrentLedger(client);
//                const accountSetTx = {
//                     TransactionType: 'AccountSet',
//                     Account: accountAddressField.value,
//                     SetFlag: 8, // asfDefaultRipple
//                     LastLedgerSequence: currentLedger1 + 50,
//                     Fee: feeResponse.drops.open_ledger_fee,
//                };

//                const preparedAccountSet = await client.autofill(accountSetTx);
//                const signedAccountSet = wallet.sign(preparedAccountSet);
//                console.log(`Submitting AccountSet to enable DefaultRipple`);
//                const accountSetResult = await client.submitAndWait(signedAccountSet.tx_blob);

//                const resultCode = accountSetResult.result.meta.TransactionResult;
//                if (resultCode !== TES_SUCCESS) {
//                     return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(accountSetResult.result)}`, spinner);
//                }
//                console.log('DefaultRipple enabled', JSON.stringify(accountSetResult, null, 2));
//           }

//           // Step 4: Issue TST
//           const currentLedger2 = await getCurrentLedger(client);
//           const { result: feeResponse2 } = await client.request({ command: 'fee' });

//           let curr;
//           if (currency.value.length > 3) {
//                curr = decodedCurrency;
//           } else {
//                curr = currency.value;
//           }

//           const paymentTx = {
//                TransactionType: 'Payment',
//                Account: accountAddressField.value,
//                Destination: destinationAddress.value,
//                Amount: {
//                     currency: curr,
//                     value: amountField.value,
//                     issuer: accountAddressField.value,
//                },
//                Fee: feeResponse2.drops.open_ledger_fee,
//                LastLedgerSequence: currentLedger2 + 50,
//           };

//           const pay_prepared = await client.autofill(paymentTx);
//           const pay_signed = wallet.sign(pay_prepared);

//           resultField.innerHTML += `\nIssuing ${amountField.value} ${currency.value} to ${destinationAddress.value}\n`;
//           const pay_result = await client.submitAndWait(pay_signed.tx_blob);

//           // Step 5: Check transaction result
//           const resultCode = pay_result.result.meta.TransactionResult;
//           if (resultCode !== TES_SUCCESS) {
//                renderTransactionDetails(pay_result);
//                resultField.classList.add('error');
//           }

//           resultField.innerHTML += `Currency ${currency.value} successfully issued.\n\n`;

//           renderTransactionDetails(pay_result);
//           resultField.classList.add('success');

//           const updatedTrustLines = await getTrustLines(destinationAddress.value, client);
//           const newTrustLine = updatedTrustLines.find(line => line.account === accountAddressField.value && line.currency === currency.value);
//           resultField.value += `New Balance: ${newTrustLine ? newTrustLine.balance : 'Unknown'} ${currency.value}\n`;

//           // Step 6: Update issuer's XRP balance
//           await updateOwnerCountAndReserves(client, accountAddressField.value, ownerCountField, totalXrpReservesField);
//           xrpBalanceField.value = await client.getXrpBalance(accountAddressField.value);

//           // Step 7: Check issuer's obligations
//           const gatewayBalances = await client.request({
//                command: 'gateway_balances',
//                account: accountAddressField.value,
//                ledger_index: 'validated',
//           });
//           resultField.value += `\nIssuer Obligations:\n${JSON.stringify(gatewayBalances.result.obligations, null, 2)}`;
//           resultField.classList.add('success');
//      } catch (error) {
//           console.error('Error setting up issuer or issuing', error);
//           setError(`ERROR: ${error.message || 'Unknown error'}`);
//      } finally {
//           if (spinner) spinner.style.display = 'none';
//           const now = Date.now() - startTime;
//           totalExecutionTime.value = now;
//           console.log(`Leaving issueCurrency in ${now}ms`);
//      }
// }

export async function getTokenBalance() {
     console.log('Entering getTokenBalance');
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
          xrpBalanceField: document.getElementById('xrpBalanceField'),
          totalExecutionTime: document.getElementById('totalExecutionTime'),
          ownerCountField: document.getElementById('ownerCountField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
     };

     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim();
          }
     }

     const { seed, xrpBalanceField, ownerCountField, totalXrpReservesField, totalExecutionTime } = fields;

     const validations = [[!validatInput(seed.value), 'Seed cannot be empty']];

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
          if (seed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(seed.value, {
                    algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION,
               });
          } else if (seed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(seed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, {
                    algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION,
               });
          } else {
               wallet = xrpl.Wallet.fromSeed(seed.value, {
                    algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION,
               });
          }

          // Fetch token balances
          const balance = await client.request({
               command: 'gateway_balances',
               account: wallet.classicAddress,
               ledger_index: 'validated',
          });

          console.log('balance', balance);

          // Prepare data for rendering
          const data = {
               sections: [],
          };

          // Obligations section (tokens issued by the account)
          if (balance.result.obligations && Object.keys(balance.result.obligations).length > 0) {
               data.sections.push({
                    title: `Obligations (${Object.keys(balance.result.obligations).length})`,
                    openByDefault: true,
                    subItems: Object.entries(balance.result.obligations).map(([currency, amount], index) => {
                         const displayCurrency = currency.length > 3 ? decodeCurrencyCode(currency) : currency;
                         return {
                              key: `Obligation ${index + 1} (${displayCurrency})`,
                              openByDefault: false,
                              content: [
                                   { key: 'Currency', value: displayCurrency },
                                   { key: 'Amount', value: amount },
                              ],
                         };
                    }),
               });
          } else {
               data.sections.push({
                    title: 'Obligations',
                    openByDefault: true,
                    content: [{ key: 'Status', value: 'No obligations (tokens issued by you)' }],
               });
          }

          // Balances section (tokens held by the account)
          if (balance.result.assets && Object.keys(balance.result.assets).length > 0) {
               const balanceItems = [];
               for (const [issuer, currencies] of Object.entries(balance.result.assets)) {
                    for (const { currency, value } of currencies) {
                         let displayCurrency = currency;
                         if (currency.length > 3) {
                              const tempCurrency = currency;
                              displayCurrency = decodeCurrencyCode(currency);
                              if (displayCurrency.length > 8) {
                                   displayCurrency = tempCurrency;
                              }
                         }
                         balanceItems.push({
                              key: `${displayCurrency} from ${issuer.slice(0, 8)}...`,
                              openByDefault: false,
                              content: [
                                   { key: 'Currency', value: displayCurrency },
                                   { key: 'Issuer', value: `<code>${issuer}</code>` },
                                   { key: 'Amount', value: value },
                              ],
                         });
                    }
               }
               data.sections.push({
                    title: `Balances (${balanceItems.length})`,
                    openByDefault: true,
                    subItems: balanceItems,
               });
          } else {
               data.sections.push({
                    title: 'Balances',
                    openByDefault: true,
                    content: [{ key: 'Status', value: 'No balances (tokens held by you)' }],
               });
          }

          // Account Details section
          // data.sections.push({
          //      title: 'Account Details',
          //      openByDefault: true,
          //      content: [
          //           { key: 'Address', value: `<code>${wallet.classicAddress}</code>` },
          //           { key: 'XRP Balance', value: await client.getXrpBalance(wallet.classicAddress) },
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
          renderTokenBalanceDetails(data);

          // Update account fields
          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`, spinner);
     } finally {
          if (spinner) spinner.style.display = 'none';
          totalExecutionTime.value = Date.now() - startTime;
          console.log(`Leaving getTokenBalance in ${totalExecutionTime.value}ms`);
     }
}

async function displayCurrencyDataForAccount1() {
     console.log('displayCurrencyDataForAccount1');
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
     currencyField.value = EMPTY_STRING;
     amountField.value = EMPTY_STRING;
     destinationField.value = EMPTY_STRING;
     await getXrpBalance();
     await getTokenBalance();
}

async function displayCurrencyDataForAccount2() {
     accountNameField.value = account2name.value;
     accountAddressField.value = account2address.value;
     if (account2seed.value === EMPTY_STRING) {
          if (account2mnemonic.value === EMPTY_STRING) {
               accountSeedField.value = account2secretNumbers.value;
          } else {
               accountSeedField.value = account2mnemonic.value;
          }
     } else {
          accountSeedField.value = account2seed.value;
     }
     currencyField.value = EMPTY_STRING;
     amountField.value = EMPTY_STRING;
     destinationField.value = EMPTY_STRING;
     await getXrpBalance();
     await getTokenBalance();
}

async function displayCurrencyDataForAccount3() {
     accountNameField.value = issuerName.value;
     accountAddressField.value = issuerAddress.value;
     if (issuerSeed.value === EMPTY_STRING) {
          if (issuerMnemonic.value === EMPTY_STRING) {
               accountSeedField.value = issuerSecretNumbers.value;
          } else {
               accountSeedField.value = issuerMnemonic.value;
          }
     } else {
          accountSeedField.value = issuerSeed.value;
     }
     currencyField.value = EMPTY_STRING;
     amountField.value = EMPTY_STRING;
     destinationField.value = EMPTY_STRING;
     await getXrpBalance();
     await getTokenBalance();
}

window.createTrustLine = createTrustLine;
window.removeTrustLine = removeTrustLine;
window.getTrustLine = getTrustLine;
window.sendCurrency = sendCurrency;
window.issueCurrency = issueCurrency;
window.getTokenBalance = getTokenBalance;
window.getTransaction = getTransaction;
window.getCurrencyBalance = getCurrencyBalance;

window.displayCurrencyDataForAccount1 = displayCurrencyDataForAccount1;
window.displayCurrencyDataForAccount2 = displayCurrencyDataForAccount2;
window.displayCurrencyDataForAccount3 = displayCurrencyDataForAccount3;

window.generateNewWallet = generateNewWallet;
window.generateNewWalletFromSecretNumbers = generateNewWalletFromSecretNumbers;
window.generateNewWalletFromMnemonic = generateNewWalletFromMnemonic;

window.getAccountFromSeed = getAccountFromSeed;
window.getAccountFromMnemonic = getAccountFromMnemonic;
window.getAccountFromSecretNumbers = getAccountFromSecretNumbers;

window.disconnectClient = disconnectClient;
window.gatherAccountInfo = gatherAccountInfo;
window.clearFields = clearFields;
window.distributeAccountInfo = distributeAccountInfo;
