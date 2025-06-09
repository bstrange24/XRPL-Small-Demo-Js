import * as xrpl from 'xrpl';
import { getClient, getNet, disconnectClient, getEnvironment, validatInput, getXrpBalance, setError, parseXRPLAccountObjects, parseXRPLTransaction, autoResize, gatherAccountInfo, clearFields, distributeAccountInfo, getTransaction, updateOwnerCountAndReserves, addSeconds, addTime, convertXRPLTime, prepareTxHashForOutput } from './utils.js';

async function sendCheck() {
     console.log('Entering sendCheck');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');

     const finishUnit = document.getElementById('checkExpirationTime').value;

     const fields = {
          address: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          amount: document.getElementById('amountField'),
          currency: document.getElementById('currencyField'),
          destination: document.getElementById('destinationField'),
          balance: document.getElementById('xrpBalanceField'),
          memo: document.getElementById('memoField'),
          expirationTime: document.getElementById('expirationTimeField'),
          destinationTag: document.getElementById('destinationTagField'),
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

     const memo = fields.memo.value.trim();
     const destinationTag = fields.destinationTag.value.trim();

     const expirationTimeText = fields.expirationTime.value.trim();
     let expirationTime = '';
     let checkExpirationTime = '';
     if (expirationTimeText != '') {
          if (isNaN(parseFloat(expirationTimeText)) || expirationTimeText <= 0) {
               return setError('ERROR: Expiration time must be a valid number greater than zero', spinner);
          }
          expirationTime = fields.expirationTime.value.trim();
          checkExpirationTime = addTime(parseInt(expirationTime), finishUnit);
          console.log(`Raw expirationTime: ${expirationTime} finishUnit: ${finishUnit} checkExpirationTime: ${convertXRPLTime(parseInt(checkExpirationTime))}`);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          let results = `Connected to ${environment} ${net}\\nSending Check\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === 'Mainnet' ? 'ed25519' : 'secp256k1' });

          // let wallet;
          // if (environment === 'Mainnet') {
          //      wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'ed25519' });
          // } else {
          //      wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'secp256k1' });
          // }

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

          const memoText = memo;
          if (memoText) {
               tx.Memos = [
                    {
                         Memo: {
                              MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                              MemoData: Buffer.from(memoText, 'utf8').toString('hex'),
                         },
                    },
               ];
          }

          if (destinationTag) {
               tx.DestinationTag = destinationTag;
          }

          if (expirationTime) {
               tx.Expiration = checkExpirationTime;
          }

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
          results += prepareTxHashForOutput(response.result.hash) + '\n';
          results += parseXRPLTransaction(response.result);
          resultField.value = results;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
          fields.balance.value = (await client.getXrpBalance(wallet.address)) - totalXrpReservesField.value;
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

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');

     const accountAddressField = document.getElementById('accountAddressField');
     if (!validatInput(accountAddressField.value)) {
          resultField.value = 'ERROR: Address Field can not be empty';
          resultField.classList.add('error');
          return;
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          let results = `Connected to ${environment} ${net}\nGetting Checks\n\n`;
          resultField.value = results;

          const check_objects = await client.request({
               id: 5,
               command: 'account_objects',
               account: accountAddressField.value,
               ledger_index: 'validated',
               type: 'check',
          });

          console.log('Response', check_objects);

          if (check_objects.result.account_objects.length <= 0) {
               results += `No checks found for ${accountAddressField.value}`;
               resultField.value = results;
               resultField.classList.add('success');
               return;
          }

          results += parseXRPLAccountObjects(check_objects.result);
          resultField.value = results;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, accountAddressField.value, ownerCountField, totalXrpReservesField);
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

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');

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
          const { net, environment } = getNet();
          const client = await getClient();

          let results = `Connected to ${environment} ${net}\nCashing Check\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === 'Mainnet' ? 'ed25519' : 'secp256k1' });

          // let wallet;
          // if (environment === 'Mainnet') {
          // wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'ed25519' });
          // } else {
          // wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'secp256k1' });
          // }

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
          results += prepareTxHashForOutput(response.result.hash) + '\n';
          results += parseXRPLTransaction(response.result);
          resultField.value = results;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
          fields.balance.value = (await client.getXrpBalance(wallet.address)) - totalXrpReservesField.value;
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

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');

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
          const { net, environment } = getNet();
          const client = await getClient();

          let results = `Connected to ${environment} ${net}\nCancelling Check\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === 'Mainnet' ? 'ed25519' : 'secp256k1' });

          // let wallet;
          // if (environment === 'Mainnet') {
          //      wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'ed25519' });
          // } else {
          //      wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'secp256k1' });
          // }

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
          results += prepareTxHashForOutput(response.result.hash) + '\n';
          results += parseXRPLTransaction(response.result);
          resultField.value = results;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
          fields.balance.value = (await client.getXrpBalance(wallet.address)) - totalXrpReservesField.value;
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
     memoField.value = '';
     expirationTimeField.value = '';
     checkIdField.value = '';
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
     memoField.value = '';
     expirationTimeField.value = '';
     checkIdField.value = '';
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
