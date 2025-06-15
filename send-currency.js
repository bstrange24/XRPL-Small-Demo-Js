import * as xrpl from 'xrpl';
import { getClient, getNet, disconnectClient, validatInput, getXrpBalance, getCurrentLedger, parseXRPLTransaction, getTransaction, autoResize, setError, gatherAccountInfo, clearFields, distributeAccountInfo, generateNewWallet, generateNewWalletFromSecretNumbers, generateNewWalletFromMnemonic, getAccountFromSeed, getAccountFromMnemonic, getAccountFromSecretNumbers, updateOwnerCountAndReserves, prepareTxHashForOutput, encodeCurrencyCode, decodeCurrencyCode } from './utils.js';
import { getCurrencyBalance } from './create-offer.js';
import { getLedgerAccountInfo, getTrustLines } from './account.js';
import { ed25519_ENCRYPTION, secp256k1_ENCRYPTION, MAINNET, TES_SUCCESS } from './constants.js';

async function createTrustLine() {
     console.log('Entering createTrustLine');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

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

          resultField.value = `Connected to ${environment} ${net}\nCreating trust line\n\n`;

          const wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

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
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          resultField.value += `Trustline created successfully.\n\n`;
          resultField.value += prepareTxHashForOutput(tx.result.hash) + '\n';
          resultField.value += parseXRPLTransaction(tx.result);
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving createTrustLine in ${now}ms`);
     }
}

async function removeTrustLine() {
     console.log('Entering removeTrustLine');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

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

          const wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          resultField.value = `Connected to ${environment} ${net}\nRemoving trust line\n\n`;

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
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          resultField.value += `Trustline removed successfully.\n\n`;
          resultField.value += prepareTxHashForOutput(tx.result.hash) + '\n';
          resultField.value += parseXRPLTransaction(tx.result);
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving removeTrustLine in ${now}ms`);
     }
}

async function getTrustLine() {
     console.log('Entering getTrustLine');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

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
               field.value = field.value.trim(); // Trim whitespace
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

          let results = (resultField.value = `Connected to ${environment} ${net}\nGetting Trust Lines.\n\n`);

          const wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

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

          // Filter out trust lines with Limit: 0
          const activeTrustLines = trustLines.filter(line => parseFloat(line.limit) > 0);
          console.log(`Active trust lines for ${wallet.classicAddress}:`, activeTrustLines);

          if (activeTrustLines.length === 0) {
               console.log(`No active trust lines found for ${wallet.classicAddress}`);
               resultField.value += `No active trust lines found for ${wallet.classicAddress}`;
               resultField.classList.add('success');
               await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
               xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
               return;
          }

          console.log(`Trust lines for ${wallet.classicAddress}:`, trustLines);

          results += `Active Trust Lines for ${wallet.classicAddress}:\n`;
          for (const line of activeTrustLines) {
               if (line.currency.length > 3) {
                    line.currency = decodeCurrencyCode(line.currency);
               }
               results += `\nAccount: ${line.account}\n\tCurrency: ${line.currency}\n\tLimit: ${line.limit}\n\tBalance: ${line.balance}\n\tLimit Peer: ${line.limit_peer}\tNo Ripple Peer: ${line.no_ripple_peer}\tNo Ripple: ${line.no_ripple}\n\tQuality In: ${line.quality_in}\tQuality Out: ${line.quality_out}`;
          }
          resultField.value = results;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving getTrustLine in ${now}ms`);
     }
}

async function sendCurrency() {
     console.log('Entering sendCurrency');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField.classList.remove('error', 'success');

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

          let results = `Connected to ${environment} ${net}\nSending Currency.\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

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

          results += `\nSending ${amountField.value} ${currency.value} to ${destinationAddress.value}\n`;
          resultField.value = results;

          const pay_prepared = await client.autofill(send_currency_tx);
          const pay_signed = wallet.sign(pay_prepared);
          const pay_result = await client.submitAndWait(pay_signed.tx_blob);

          const resultCode = pay_result.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(pay_result.result)}`, spinner);
          }

          results += `Currency ${currency.value} successfully sent.\n\n`;
          results += prepareTxHashForOutput(pay_result.result.hash) + '\n';
          results += parseXRPLTransaction(pay_result.result);
          resultField.value = results;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving removeTrustLine in ${now}ms`);
     }
}

async function issueCurrency() {
     console.log('Entering issueCurrency');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField.classList.remove('error', 'success');

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
               field.value = field.value.trim(); // Trim whitespace
          }
     }

     const { accountAddressField, accountSeed, currency, destinationAddress, amountField, xrpBalanceField, totalExecutionTime, ownerCountField, totalXrpReservesField } = fields;

     // Validation checks
     const validations = [
          [!validatInput(accountAddressField.value), 'Account address cannot be empty'],
          [!validatInput(accountSeed.value), 'Seed cannot be empty'],
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

          resultField.value = `Connected to ${environment} ${net}\nSetting up issuer and issuing ${currency.value}\n\n`;

          const wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          // Step 1: Verify issuer account
          const accountInfo = await getLedgerAccountInfo(client, accountAddressField.value, 'validated');
          if (accountInfo == null) {
               return setError(`ERROR: Issuer account ${accountAddressField.value} is not funded.\n`, spinner);
          }

          console.log('accountInfo', accountInfo);
          resultField.value += `Issuer account ${accountAddressField.value} is funded.\n`;

          // Step 2: Check destination's trust line
          const destTrustLines = await getTrustLines(destinationAddress.value, client);

          // If no trust lines, return early
          if (destTrustLines.length === 0) {
               console.log(`No trust lines found for ${wallet.classicAddress}`);
               if (spinner) spinner.style.display = 'none';
               resultField.value += `No trust lines found for ${wallet.classicAddress}`;
               resultField.classList.add('success');
               await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
               xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
               return;
          }

          // const destTrustLine = destTrustLines.find(line => line.account === accountAddressField.value && line.currency === currency.value);

          // Decode only if needed (e.g., if it's 40 characters)
          const decodedCurrency = currency.value.length > 3 ? encodeCurrencyCode(currency.value) : currency.value;

          const destTrustLine = destTrustLines.find(
               line => line.account === accountAddressField.value && line.currency === decodedCurrency
          );

          if (!destTrustLine || parseFloat(destTrustLine.limit) === 0) {
               return setError(`ERROR: Destination needs a trust line for ${currency.value} from ${accountAddressField.value}`, spinner);
          }

          if (parseFloat(destTrustLine.limit) < amountField.value) {
               return setError(`ERROR: Destination trust line limit (${destTrustLine.limit}) is less than amount (${amountField.value})`, spinner);
          }

          // Step 3: Set DefaultRipple flag
          const accountFlags = accountInfo.result.account_data.Flags;
          const asfDefaultRipple = 0x00800000;

          const { result: feeResponse } = await client.request({ command: 'fee' });

          if ((accountFlags && asfDefaultRipple) === 0) {
               const currentLedger1 = await getCurrentLedger(client);
               const accountSetTx = {
                    TransactionType: 'AccountSet',
                    Account: accountAddressField.value,
                    SetFlag: 8, // asfDefaultRipple
                    LastLedgerSequence: currentLedger1 + 50,
                    Fee: feeResponse.drops.open_ledger_fee,
               };

               const preparedAccountSet = await client.autofill(accountSetTx);
               const signedAccountSet = wallet.sign(preparedAccountSet);
               resultField.value += `Submitting AccountSet to enable DefaultRipple\n`;
               const accountSetResult = await client.submitAndWait(signedAccountSet.tx_blob);

               const resultCode = accountSetResult.result.meta.TransactionResult;
               if (resultCode !== TES_SUCCESS) {
                    return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(accountSetResult.result)}`, spinner);
               }

               resultField.value += prepareTxHashForOutput(accountSetResult.result.hash) + '\n';
               resultField.value += parseXRPLTransaction(accountSetResult.result);
               resultField.value += `DefaultRipple enabled.\n`;
          }

          // Step 4: Issue TST
          const currentLedger2 = await getCurrentLedger(client);
          const { result: feeResponse2 } = await client.request({ command: 'fee' });

          let curr;
          if (currency.value.length > 3) {
               curr = decodedCurrency;
          } else {
               curr = currency.value;
          }

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

          resultField.value += `\nIssuing ${amountField.value} ${currency.value} to ${destinationAddress.value}\n`;
          const pay_result = await client.submitAndWait(pay_signed.tx_blob);

          // Step 5: Check transaction result
          const resultCode = pay_result.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(pay_result.result)}`, spinner);
          }

          resultField.value += `Currency ${currency.value} successfully issued.\n\n`;
          resultField.value += prepareTxHashForOutput(pay_result.result.hash) + '\n';
          resultField.value += parseXRPLTransaction(pay_result.result);

          const updatedTrustLines = await getTrustLines(destinationAddress.value, client);
          const newTrustLine = updatedTrustLines.find(line => line.account === accountAddressField.value && line.currency === currency.value);
          resultField.value += `New Balance: ${newTrustLine ? newTrustLine.balance : 'Unknown'} ${currency.value}\n`;

          // Step 6: Update issuer's XRP balance
          await updateOwnerCountAndReserves(client, accountAddressField.value, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(accountAddressField.value);

          // Step 7: Check issuer's obligations
          const gatewayBalances = await client.request({
               command: 'gateway_balances',
               account: accountAddressField.value,
               ledger_index: 'validated',
          });
          resultField.value += `\nIssuer Obligations:\n${JSON.stringify(gatewayBalances.result.obligations, null, 2)}`;
          resultField.classList.add('success');
     } catch (error) {
          console.error('Error setting up issuer or issuing', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving issueCurrency in ${now}ms`);
     }
}

export async function getTokenBalance() {
     console.log('Entering getTokenBalance');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

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
               field.value = field.value.trim(); // Trim whitespace
          }
     }
     const { seed, xrpBalanceField, ownerCountField, totalXrpReservesField, totalExecutionTime } = fields;

     // Validation checks
     const validations = [[!validatInput(seed.value), 'Seed cannot be empty']];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          let results = `Connected to ${environment} ${net}\nGetting Token Balance\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          results += 'Getting account balance\n';
          resultField.value = results;

          const balance = await client.request({
               command: 'gateway_balances',
               account: wallet.classicAddress,
               ledger_index: 'validated',
          });

          console.log('balance', balance);

          // Format obligations
          let output = 'Obligations (Issued by You):\n';
          if (balance.result.obligations && Object.keys(balance.result.obligations).length > 0) {
               for (const [currency, amount] of Object.entries(balance.result.obligations)) {
                    output += `- ${currency}: ${amount}\n`;
               }
          } else {
               output += 'None\n';
          }

          // Format assets (held balances)
          output += '\nBalances (Held by You):\n';
          if (balance.result.assets && Object.keys(balance.result.assets).length > 0) {
               for (const [issuer, currencies] of Object.entries(balance.result.assets)) {
                    for (let { currency, value } of currencies) {
                         console.log(`Currency ${currency} issuer ${issuer} Amount: ${value}`);
                         if (currency.length > 3) {
                              const tempCurrency = currency;
                              currency = decodeCurrencyCode(currency);
                              if(currency.length > 8) {
                                   currency = tempCurrency
                              }
                         }
                         output += `- ${currency} from ${issuer} Amount: ${value}\n`;
                    }
               }
          } else {
               output += 'None\n';
          }

          results += output;
          resultField.value = results;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError('ERROR: ' + (error.message || 'Unknown error'));
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving getTokenBalance in ${now}ms`);
     }
}

async function displayCurrencyDataForAccount1() {
     console.log('displayCurrencyDataForAccount1');
     accountNameField.value = account1name.value;
     accountAddressField.value = account1address.value;
     accountSeedField.value = account1seed.value;
     currencyField.value = '';
     amountField.value = '';
     destinationField.value = '';
     await getXrpBalance();
     await getTokenBalance();
}

async function displayCurrencyDataForAccount2() {
     console.log('displayCurrencyDataForAccount2');
     accountNameField.value = account2name.value;
     accountAddressField.value = account2address.value;
     accountSeedField.value = account2seed.value;
     currencyField.value = '';
     amountField.value = '';
     destinationField.value = '';
     await getXrpBalance();
     await getTokenBalance();
}

async function displayCurrencyDataForAccount3() {
     console.log('displayCurrencyDataForAccount3');
     accountNameField.value = issuerName.value;
     accountAddressField.value = issuerAddress.value;
     accountSeedField.value = issuerSeed.value;
     currencyField.value = '';
     amountField.value = '';
     destinationField.value = '';
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

window.autoResize = autoResize;
window.disconnectClient = disconnectClient;
window.gatherAccountInfo = gatherAccountInfo;
window.clearFields = clearFields;
window.distributeAccountInfo = distributeAccountInfo;
