import * as xrpl from 'xrpl';
import { getClient, disconnectClient, getEnvironment, validatInput, getXrpBalance, getCurrentLedger, parseXRPLTransaction, parseXRPLAccountObjects, getTransaction, autoResize, setError, gatherAccountInfo, clearFields, distributeAccountInfo, generateNewWallet, generateNewWalletFromSecretNumbers, generateNewWalletFromMnemonic, getAccountFromSeed, getAccountFromMnemonic, getAccountFromSecretNumbers, updateOwnerCountAndReserves } from './utils.js';
import { getLedgerAccountInfo, getTrustLines } from './account.js';

async function createTrustLine() {
     console.log('Entering createTrustLine');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');

     const fields = {
          address: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          currency: document.getElementById('currencyField'),
          amount: document.getElementById('amountField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
          destinationAddress: document.getElementById('destinationField'),
     };

     // DOM existence check
     for (const [name, field] of Object.entries(fields)) {
          if (!field) return setError(`ERROR: DOM element ${name} not found`, spinner);
     }

     const { address, seed, destinationAddress, currency, amount, xrpBalanceField } = fields;

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
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\nCreating trust line\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: 'secp256k1' });

          const { result: feeResponse } = await client.request({ command: 'fee' });

          const trustSetTx = {
               TransactionType: 'TrustSet',
               Account: address.value,
               LimitAmount: {
                    currency: currency.value,
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
          if (resultCode !== 'tesSUCCESS') {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          results += `Trustline created successfully.\n\n`;
          results += `Tx Hash: ${tx.result.hash}\n\n`;
          results += parseXRPLTransaction(tx.result);
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
          console.log('Leaving createTrustLine');
     }
}

async function removeTrustLine() {
     console.log('Entering removeTrustLine');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');

     const fields = {
          address: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          destinationAddress: document.getElementById('destinationField'),
          currency: document.getElementById('currencyField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
     };

     // DOM existence check
     for (const [name, field] of Object.entries(fields)) {
          if (!field) return setError(`ERROR: DOM element ${name} not found`, spinner);
     }

     const { address, seed, destinationAddress, currency, xrpBalanceField } = fields;

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
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\nRemoving trust line\n\n`;
          resultField.value = results;

          const trustLines = await getTrustLines(address.value, client);

          // If no trust lines, return early
          if (trustLines.length === 0) {
               console.log(`No trust lines found for ${address.value}`);
               resultField.value += `No trust lines found for ${address.value}`;
               resultField.classList.add('success');
               return;
          }

          const targetLine = trustLines.find(line => line.account === destinationAddress.value && line.currency === currency.value);

          if (!targetLine) {
               return setError(`ERROR: No trust line found for ${currency.value} from ${destinationAddress.value}.`, spinner);
          }

          if (parseFloat(targetLine.balance) !== 0) {
               return setError(`ERROR: Cannot remove trust line: Balance is ${targetLine.balance}. Balance must be 0.`, spinner);
          }

          const wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: 'secp256k1' });

          const { result: feeResponse } = await client.request({ command: 'fee' });

          const trustSetTx = {
               TransactionType: 'TrustSet',
               Account: address.value,
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
          if (resultCode !== 'tesSUCCESS') {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          results += `Trustline removed successfully.\n\n`;
          results += `Tx Hash: ${tx.result.hash}\n\n`;
          results += parseXRPLTransaction(tx.result);
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
          console.log('Leaving removeTrustLine');
     }
}

async function getTrustLine() {
     console.log('Entering getTrustLine');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');

     const fields = {
          seed: document.getElementById('accountSeedField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
     };

     // DOM existence check
     for (const [name, field] of Object.entries(fields)) {
          if (!field) return setError(`ERROR: DOM element ${name} not found`, spinner);
     }

     const { seed, xrpBalanceField } = fields;

     // Validation checks
     const validations = [[!validatInput(seed.value), 'Seed cannot be empty']];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = (resultField.value = `Connected to ${environment}.\nGetting Trust Lines.\n\n`);

          const wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: 'secp256k1' });
          const trustLines = await getTrustLines(wallet.address, client);

          // If no trust lines, return early
          if (trustLines.length === 0) {
               console.log(`No trust lines found for ${wallet.address}`);
               resultField.value += `No trust lines found for ${wallet.address}`;
               resultField.classList.add('success');
               return;
          }

          // Filter out trust lines with Limit: 0
          const activeTrustLines = trustLines.filter(line => parseFloat(line.limit) > 0);
          console.log(`Active trust lines for ${wallet.address}:`, activeTrustLines);

          if (activeTrustLines.length === 0) {
               console.log(`No active trust lines found for ${wallet.address}`);
               resultField.value += `No active trust lines found for ${wallet.address}`;
               resultField.classList.add('success');
               return;
          }

          console.log(`Trust lines for ${wallet.address}:`, trustLines);

          results += `Active Trust Lines for ${wallet.address}:\n`;
          for (const line of activeTrustLines) {
               results += `Currency: ${line.currency}, \n\tIssuer: ${line.account}, \n\tLimit: ${line.limit}, \n\tBalance: ${line.balance}, \n\tLimit Peer: ${line.limit_peer},\n\tNo Ripple: ${line.no_ripple_peer},`;
          }
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
          console.log('Leaving getTrustLine');
     }
}

async function sendCurrency() {
     console.log('Entering sendCurrency');

     const resultField = document.getElementById('resultField');
     resultField.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');

     const fields = {
          accountAddress: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          currency: document.getElementById('currencyField'),
          destinationAddress: document.getElementById('destinationField'),
          amountField: document.getElementById('amountField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
     };

     // DOM existence check
     for (const [name, field] of Object.entries(fields)) {
          if (!field) return setError(`ERROR: DOM element ${name} not found`, spinner);
     }

     const { accountAddress, seed, currency, destinationAddress, amountField, xrpBalanceField } = fields;

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
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\nSending Currency.\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: 'secp256k1' });

          // Step 1: Check sender's trust line and balance
          const senderTrustLines = await getTrustLines(accountAddress.value, client);

          // If no trust lines, return early
          if (senderTrustLines.length === 0) {
               console.log(`No trust lines found for ${wallet.address}`);
               resultField.value += `No trust lines found for ${wallet.address}`;
               resultField.classList.add('success');
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
               console.log(`No trust lines found for ${wallet.address}`);
               resultField.value += `No trust lines found for ${wallet.address}`;
               resultField.classList.add('success');
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
          if (resultCode !== 'tesSUCCESS') {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(pay_result.result)}`, spinner);
          }

          results += `Currency ${currency.value} successfully sent.\n\n`;
          results += `Tx Hash: ${pay_result.result.hash}\n\n`;
          results += parseXRPLTransaction(pay_result.result);
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
          console.log('Leaving sendCurrency');
     }
}

async function issueCurrency() {
     console.log('Entering issueCurrency');

     const resultField = document.getElementById('resultField');
     resultField.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');

     const fields = {
          accountAddressField: document.getElementById('accountAddressField'),
          accountSeed: document.getElementById('accountSeedField'),
          currency: document.getElementById('currencyField'),
          destinationAddress: document.getElementById('destinationField'),
          amountField: document.getElementById('amountField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
     };

     // DOM existence check
     for (const [name, field] of Object.entries(fields)) {
          if (!field) return setError(`ERROR: DOM element ${name} not found`, spinner);
     }

     const { accountAddressField, accountSeed, currency, destinationAddress, amountField, xrpBalanceField } = fields;

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
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\nSetting up issuer and issuing ${currency.value}\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: 'secp256k1' });

          // Step 1: Verify issuer account
          const accountInfo = await getLedgerAccountInfo(client, accountAddressField.value, 'validated');
          if (accountInfo == null) {
               return setError(`ERROR: Issuer account ${accountAddressField.value} is not funded.\n`, spinner);
          }

          console.log('accountInfo', accountInfo);
          results += `Issuer account ${accountAddressField.value} is funded.\n`;
          resultField.value = results;

          // Step 2: Check destination's trust line
          const destTrustLines = await getTrustLines(destinationAddress.value, client);

          // If no trust lines, return early
          if (destTrustLines.length === 0) {
               console.log(`No trust lines found for ${wallet.address}`);
               if (spinner) spinner.style.display = 'none';
               resultField.value += `No trust lines found for ${wallet.address}`;
               resultField.classList.add('success');
               return;
          }

          const destTrustLine = destTrustLines.find(line => line.account === accountAddressField.value && line.currency === currency.value);

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
               results += `Submitting AccountSet to enable DefaultRipple\n`;
               resultField.value = results;
               const accountSetResult = await client.submitAndWait(signedAccountSet.tx_blob);

               const resultCode = accountSetResult.result.meta.TransactionResult;
               if (resultCode !== 'tesSUCCESS') {
                    return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(accountSetResult.result)}`, spinner);
               }

               results += `Tx Hash: ${accountSetResult.hash}\n\n`;
               results += parseXRPLTransaction(accountSetResult.result);
               results += `DefaultRipple enabled.\n`;
               resultField.value = results;
          }

          // Step 4: Issue TST
          const currentLedger2 = await getCurrentLedger(client);
          const { result: feeResponse2 } = await client.request({ command: 'fee' });

          const paymentTx = {
               TransactionType: 'Payment',
               Account: accountAddressField.value,
               Destination: destinationAddress.value,
               Amount: {
                    currency: currency.value,
                    value: amountField.value,
                    issuer: accountAddressField.value,
               },
               Fee: feeResponse2.drops.open_ledger_fee,
               LastLedgerSequence: currentLedger2 + 50,
          };

          const pay_prepared = await client.autofill(paymentTx);
          const pay_signed = wallet.sign(pay_prepared);

          results += `\nIssuing ${amountField.value} ${currency.value} to ${destinationAddress.value}\n`;
          resultField.value = results;
          const pay_result = await client.submitAndWait(pay_signed.tx_blob);

          // Step 5: Check transaction result
          const resultCode = pay_result.result.meta.TransactionResult;
          if (resultCode !== 'tesSUCCESS') {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(pay_result.result)}`, spinner);
          }

          results += `Currency ${currency.value} successfully issued.\n\n`;
          results += `Tx Hash: ${pay_result.result.hash}\n\n`;
          results += parseXRPLTransaction(pay_result.result);

          const updatedTrustLines = await getTrustLines(destinationAddress.value, client);
          const newTrustLine = updatedTrustLines.find(line => line.account === accountAddressField.value && line.currency === currency.value);
          results += `New Balance: ${newTrustLine ? newTrustLine.balance : 'Unknown'} ${currency.value}\n`;

          // Step 6: Update issuer's XRP balance
          await updateOwnerCountAndReserves(client, accountAddressField.value, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(accountAddressField.value);

          // Step 7: Check issuer's obligations
          const gatewayBalances = await client.request({
               command: 'gateway_balances',
               account: accountAddressField.value,
               ledger_index: 'validated',
          });
          results += `\nIssuer Obligations:\n${JSON.stringify(gatewayBalances.result.obligations, null, 2)}`;
          resultField.value = results;
          resultField.classList.add('success');
     } catch (error) {
          console.error('Error setting up issuer or issuing TST:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving setupAndIssueTST');
     }
}

export async function getTokenBalance() {
     console.log('Entering getTokenBalance');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');

     const fields = {
          seed: document.getElementById('accountSeedField'),
          balance: document.getElementById('xrpBalanceField'),
     };

     // Validate DOM elements
     if (!fields.seed || !fields.balance) {
          return setError('ERROR: DOM elements not found', spinner);
     }

     const seed = fields.seed.value.trim();

     // Validate inputs
     if (!validatInput(seed)) return setError('ERROR: Seed cannot be empty', spinner);

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\nGetting Token Balance\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed, { algorithm: 'secp256k1' });
          results += 'Getting account balance\n';
          resultField.value = results;

          const balance = await client.request({
               command: 'gateway_balances',
               account: wallet.address,
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
                    for (const { currency, value } of currencies) {
                         output += `- ${currency} from ${issuer}: ${value}\n`;
                    }
               }
          } else {
               output += 'None\n';
          }

          results += output;
          resultField.value = results;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.address);
     } catch (error) {
          console.error('Error:', error);
          setError('ERROR: ' + (error.message || 'Unknown error'));
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving getTokenBalance');
     }
}

async function populateFieldIssueCurrency1() {
     currencyField.value = '';
     amountField.value = '';
     accountNameField.value = account1name.value;
     accountAddressField.value = account1address.value;
     accountSeedField.value = account1seed.value;
     destinationField.value = '';
     // destinationField.value = account2address.value;
     // issuerField.value = issuerAddress.value;
     await getXrpBalance();
     await getAccountInfo();
}

async function populateFieldIssueCurrency2() {
     currencyField.value = '';
     amountField.value = '';
     accountNameField.value = account2name.value;
     accountAddressField.value = account2address.value;
     accountSeedField.value = account2seed.value;
     destinationField.value = '';
     // destinationField.value = account1address.value;
     // issuerField.value = issuerAddress.value;
     await getXrpBalance();
     await getAccountInfo();
}

async function populateFieldIssueCurrency3() {
     currencyField.value = '';
     amountField.value = '';
     accountNameField.value = issuerName.value;
     accountAddressField.value = issuerAddress.value;
     accountSeedField.value = issuerSeed.value;
     destinationField.value = '';
     // issuerField.value = '';
     await getXrpBalance();
     await getAccountInfo();
}

window.createTrustLine = createTrustLine;
window.removeTrustLine = removeTrustLine;
window.getTrustLine = getTrustLine;
window.sendCurrency = sendCurrency;
window.issueCurrency = issueCurrency;
window.getTokenBalance = getTokenBalance;
window.getTransaction = getTransaction;

window.populateFieldIssueCurrency1 = populateFieldIssueCurrency1;
window.populateFieldIssueCurrency2 = populateFieldIssueCurrency2;
window.populateFieldIssueCurrency3 = populateFieldIssueCurrency3;

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
