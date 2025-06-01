import * as xrpl from 'xrpl';
import { getClient, disconnectClient, getEnvironment, validatInput, getXrpBalance, setError, parseXRPLAccountObjects, parseXRPLTransaction, autoResize, gatherAccountInfo, clearFields, distributeAccountInfo, getTransaction } from './utils.js';

async function sendCheck() {
     console.log('Entering sendCheck');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          address: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          amount: document.getElementById('amountField'),
          currency: document.getElementById('currencyField'),
          destination: document.getElementById('destinationField'),
          balance: document.getElementById('xrpBalanceField'),
     };

     // Validate input fields
     const required = [
          { key: 'address', name: 'Address' },
          { key: 'seed', name: 'Seed' },
          { key: 'amount', name: 'Amount' },
          { key: 'currency', name: 'Currency' },
          { key: 'destination', name: 'Destination' },
     ];

     for (const { key, name } of required) {
          if (!fields[key] || !validatInput(fields[key].value)) {
               return setError(`ERROR: ${name} cannot be empty`, spinner);
          }
     }

     const amount = parseFloat(fields.amount.value);
     if (isNaN(amount) || amount <= 0) {
          return setError('ERROR: Amount must be a valid number greater than zero', spinner);
     }

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(fields.seed.value, { algorithm: 'secp256k1' });

          // Build SendMax amount
          let sendMax;
          if (fields.currency.value === 'XRP') {
               sendMax = xrpl.xrpToDrops(fields.amount.value);
          } else {
               sendMax = {
                    currency: fields.currency.value,
                    value: fields.amount.value,
                    issuer: wallet.address,
               };
          }

          const tx = await client.autofill({
               TransactionType: 'CheckCreate',
               Account: wallet.address,
               SendMax: sendMax,
               Destination: fields.destination.value,
          });

          const signed = wallet.sign(tx);

          results += `\nSending Check for ${fields.amount.value} ${fields.currency.value} to ${fields.destination.value}\n`;
          resultField.value = results;

          const response = await client.submitAndWait(signed.tx_blob);
          console.log('Response', response);

          const resultCode = response.result.meta.TransactionResult;
          if (resultCode !== 'tesSUCCESS') {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(response.result)}`, spinner);
          }

          results += `Check sent successfully.\n\n`;
          results += parseXRPLTransaction(response.result);
          resultField.value = results;
          resultField.classList.add('success');

          fields.balance.value = await client.getXrpBalance(wallet.address);
     } catch (error) {
          console.error('Error:', error);
          setError('ERROR: ' + (error.message || 'Unknown error'));
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving sendCheck');
     }
}

async function getChecks() {
     console.log('Entering getChecks');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const accountAddressField = document.getElementById('accountAddressField');
     if (!validatInput(accountAddressField.value)) {
          resultField.value = 'ERROR: Address Field can not be empty';
          resultField.classList.add('error');
          return;
     }

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\nGetting Checks\n\n`;
          resultField.value = results;

          const check_objects = await client.request({
               id: 5,
               command: 'account_objects',
               account: accountAddressField.value,
               ledger_index: 'validated',
               type: 'check',
          });

          console.log('Response', check_objects);

          results += parseXRPLAccountObjects(check_objects.result);
          resultField.value = results;
          resultField.classList.add('success');
     } catch (error) {
          console.error('Error:', error);
          setError('ERROR: ' + (error.message || 'Unknown error'));
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving getChecks');
     }
}

async function cashCheck() {
     console.log('Entering cashCheck');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     // Field references
     const fields = {
          address: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          amount: document.getElementById('amountField'),
          currency: document.getElementById('currencyField'),
          issuer: document.getElementById('issuerField'),
          destination: document.getElementById('destinationField'),
          checkId: document.getElementById('checkIdField'),
          balance: document.getElementById('xrpBalanceField'),
     };

     // Validate required fields
     const requiredFields = [
          { key: 'address', name: 'Address' },
          { key: 'seed', name: 'Seed' },
          { key: 'amount', name: 'Amount' },
          { key: 'currency', name: 'Currency' },
          { key: 'destination', name: 'Destination' },
          { key: 'checkId', name: 'Check ID' },
     ];

     for (const { key, name } of requiredFields) {
          if (!fields[key] || !validatInput(fields[key].value)) {
               return setError(`ERROR: ${name} cannot be empty`, spinner);
          }
     }

     const amount = parseFloat(fields.amount.value);
     if (isNaN(amount) || amount <= 0) {
          return setError('ERROR: Amount must be a valid number greater than zero', spinner);
     }

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(fields.seed.value, { algorithm: 'secp256k1' });

          // Build amount object depending on currency
          const amountToCash =
               fields.currency.value === 'XRP'
                    ? xrpl.xrpToDrops(fields.amount.value)
                    : {
                           value: fields.amount.value,
                           currency: fields.currency.value,
                           issuer: fields.issuer.value,
                      };

          const tx = await client.autofill({
               TransactionType: 'CheckCash',
               Account: wallet.address,
               Amount: amountToCash,
               CheckID: fields.checkId.value,
          });

          const signed = wallet.sign(tx);
          results += `Cashing check for ${fields.amount.value} ${fields.currency.value}\n`;
          resultField.value = results;

          const response = await client.submitAndWait(signed.tx_blob);
          console.log('Response:', response);

          const resultCode = response.result.meta.TransactionResult;
          if (resultCode !== 'tesSUCCESS') {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(response.result)}`, spinner);
          }

          results += `Check cashed successfully.\n\n`;
          results += parseXRPLTransaction(response.result);
          resultField.value = results;
          resultField.classList.add('success');

          fields.balance.value = await client.getXrpBalance(wallet.address);
     } catch (error) {
          console.error('Error:', error);
          setError('ERROR: ' + (error.message || 'Unknown error'));
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving cashCheck');
     }
}

async function cancelCheck() {
     console.log('Entering cancelCheck');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          checkId: document.getElementById('checkIdField'),
          seed: document.getElementById('accountSeedField'),
          balance: document.getElementById('xrpBalanceField'),
     };

     // Validate DOM elements
     if (!fields.checkId || !fields.seed || !fields.balance) {
          return setError('ERROR: DOM elements not found', spinner);
     }

     const checkId = fields.checkId.value.trim();
     const seed = fields.seed.value.trim();

     // Validate inputs
     if (!validatInput(checkId)) return setError('ERROR: Check ID cannot be empty', spinner);
     if (!validatInput(seed)) return setError('ERROR: Seed cannot be empty', spinner);

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\nCancelling Check\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed, { algorithm: 'secp256k1' });

          const tx = await client.autofill({
               TransactionType: 'CheckCancel',
               Account: wallet.address,
               CheckID: checkId,
          });

          const signed = wallet.sign(tx);
          const response = await client.submitAndWait(signed.tx_blob);
          console.log('Response:', response);

          const resultCode = response.result.meta.TransactionResult;
          if (resultCode !== 'tesSUCCESS') {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(response.result)}`, spinner);
          }

          results += `Check cancelled successfully.\n\n`;
          results += parseXRPLTransaction(response.result);
          resultField.value = results;
          resultField.classList.add('success');

          fields.balance.value = await client.getXrpBalance(wallet.address);
     } catch (error) {
          console.error('Error:', error);
          setError('ERROR: ' + (error.message || 'Unknown error'));
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving cancelCheck');
     }
}

async function populateFieldSendCurrency1() {
     accountNameField.value = account1name.value;
     accountAddressField.value = account1address.value;
     accountSeedField.value = account1seed.value;
     destinationField.value = account2address.value;
     amountField.value = '';
     currencyField.value = 'XRP';
     await getXrpBalance();
     await getAccountInfo();
}

async function populateFieldSendCurrency2() {
     accountNameField.value = account2name.value;
     accountAddressField.value = account2address.value;
     accountSeedField.value = account2seed.value;
     destinationField.value = account1address.value;
     amountField.value = '';
     currencyField.value = 'XRP';
     await getXrpBalance();
     await getAccountInfo();
}

async function populateFieldSendCurrency3() {
     accountNameField.value = issuerName.value;
     accountSeedField.value = issuerSeed.value;
     amountField.value = '';
     destinationField.value = '';
     issuerField.value = '';
     currencyField.value = '';
     await getXrpBalance();
     await getAccountInfo();
}

window.sendCheck = sendCheck;
window.getChecks = getChecks;
window.cashCheck = cashCheck;
window.cancelCheck = cancelCheck;
window.getTransaction = getTransaction;
window.populateFieldSendCurrency1 = populateFieldSendCurrency1;
window.populateFieldSendCurrency2 = populateFieldSendCurrency2;
window.populateFieldSendCurrency3 = populateFieldSendCurrency3;
window.autoResize = autoResize;
window.disconnectClient = disconnectClient;
window.gatherAccountInfo = gatherAccountInfo;
window.clearFields = clearFields;
window.distributeAccountInfo = distributeAccountInfo;
