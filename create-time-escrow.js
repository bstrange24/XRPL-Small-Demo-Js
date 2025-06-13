import * as xrpl from 'xrpl';
import { getClient, getNet, disconnectClient, validatInput, setError, parseXRPLTransaction, parseXRPLAccountObjects, autoResize, getTransaction, gatherAccountInfo, clearFields, distributeAccountInfo, updateOwnerCountAndReserves, addTime, convertXRPLTime, prepareTxHashForOutput, convertToEstTime } from './utils.js';
import { XRP_CURRENCY, ed25519_ENCRYPTION, secp256k1_ENCRYPTION, MAINNET, TES_SUCCESS } from './constants.js';

async function createTimeBasedEscrow() {
     console.log('Entering createTimeBasedEscrow');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          accountSeed: document.getElementById('accountSeedField'),
          destinationAddress: document.getElementById('destinationField'),
          escrowFinishTime: document.getElementById('escrowFinishTimeField'),
          escrowCancelTime: document.getElementById('escrowCancelTimeField'),
          amountField: document.getElementById('amountField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
          memo: document.getElementById('memoField'),
          destinationTag: document.getElementById('destinationTagField'),
          ownerCountField: document.getElementById('ownerCountField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
          finishUnit: document.getElementById('escrowFinishTimeUnit'),
          cancelUnit: document.getElementById('escrowCancelTimeUnit'),
          currentTimeField: document.getElementById('currentTimeField'),
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

     const { accountSeed, destinationAddress, escrowFinishTime, escrowCancelTime, amountField, xrpBalanceField, ownerCountField, totalXrpReservesField, memo, destinationTag, finishUnit, cancelUnit, currentTimeField, totalExecutionTime } = fields;

     // Validation checks
     const validations = [
          [!validatInput(accountSeed.value), 'Seed cannot be empty'],
          [!validatInput(destinationAddress.value), 'Destination cannot be empty'],
          [!validatInput(escrowFinishTime.value), 'Escrow Finish Time cannot be empty'],
          [isNaN(escrowFinishTime.value), 'Escrow Finish Time must be a valid number'],
          [parseFloat(escrowFinishTime.value) <= 0, 'Escrow Finish Time must be greater than zero'],
          [!validatInput(escrowCancelTime.value), 'Escrow Cancel Time cannot be empty'],
          [isNaN(escrowCancelTime.value), 'Escrow Cancel Time must be a valid number'],
          [parseFloat(escrowCancelTime.value) <= 0, 'Escrow Cancel Time must be greater than zero'],
          [!validatInput(amountField.value), 'XRP amount cannot be empty'],
          [isNaN(amountField.value), 'Amount must be a valid number'],
          [parseFloat(amountField.value) <= 0, 'XRP amount must be greater than zero'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          let results = `Connected to ${environment} ${net}\nCreating time-based escrow.\n\n`;

          const wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: environment === 'Mainnet' ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          const finishAfterTime = addTime(escrowFinishTime.value, finishUnit.value);
          const cancelAfterTime = addTime(escrowCancelTime.value, cancelUnit.value);
          console.log(`finishUnit: ${finishUnit.value} cancelUnit: ${cancelUnit.value}`);
          console.log(`finishTime: ${convertXRPLTime(finishAfterTime)} cancelTime: ${convertXRPLTime(cancelAfterTime)}`);

          const escrowTx = await client.autofill({
               TransactionType: 'EscrowCreate',
               Account: wallet.address,
               Amount: xrpl.xrpToDrops(amountField.value),
               Destination: destinationAddress.value,
               FinishAfter: finishAfterTime,
               CancelAfter: cancelAfterTime,
          });

          const memoText = memo.value;
          if (memoText) {
               escrowTx.Memos = [
                    {
                         Memo: {
                              MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                              MemoData: Buffer.from(memoText, 'utf8').toString('hex'),
                         },
                    },
               ];
          }

          const destinationTagText = destinationTag.value;
          if (destinationTagText) {
               escrowTx.DestinationTag = parseInt(destinationTagText, 10);
          }

          const signed = wallet.sign(escrowTx);
          const tx = await client.submitAndWait(signed.tx_blob);

          console.log('Create Escrow tx', tx);

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          results += `Escrow created successfully.\n\n`;
          results += prepareTxHashForOutput(tx.result.hash) + '\n';
          results += parseXRPLTransaction(tx.result);
          resultField.value = results;
          resultField.classList.add('success');

          if (currentTimeField) {
               document.getElementById('currentTimeField').value = convertToEstTime(new Date().toISOString());
          }

          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = (await client.getXrpBalance(wallet.address)) - totalXrpReservesField.value;
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving createTimeBasedEscrow in ${now}ms`);
     }
}

async function finishTimeBasedEscrow() {
     console.log('Entering finishTimeBasedEscrow');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          accountSeed: document.getElementById('accountSeedField'),
          accountAddress: document.getElementById('accountAddressField'),
          escrowOwnerAddress: document.getElementById('escrowOwnerField'),
          escrowSequenceNumber: document.getElementById('escrowSequenceNumberField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
          ownerCountField: document.getElementById('ownerCountField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
          currentTimeField: document.getElementById('currentTimeField'),
          totalExecutionTime: document.getElementById('totalExecutionTime'),
     };

     // DOM element check
     for (const [key, el] of Object.entries(fields)) {
          if (!el) return setError(`ERROR: DOM element "${key}" not found`, spinner);
     }

     const { accountSeed, accountAddress, escrowOwnerAddress, escrowSequenceNumber, xrpBalanceField, ownerCountField, totalXrpReservesField, currentTimeField, totalExecutionTime } = fields;

     // Input validation
     const validations = [
          [!validatInput(accountSeed.value), 'Seed cannot be empty'],
          [!validatInput(accountAddress.value), 'Account Address cannot be empty'],
          [!validatInput(escrowOwnerAddress.value), 'Escrow Owner Address cannot be empty'],
          [!validatInput(escrowSequenceNumber.value), 'Escrow Sequence Number cannot be empty'],
          [isNaN(escrowSequenceNumber.value), 'Escrow Sequence Number must be a valid number'],
          [parseFloat(escrowSequenceNumber.value) <= 0, 'Escrow Sequence Number must be greater than zero'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          let results = `Connected to ${environment} ${net}\nFinishing escrow.\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: environment === 'Mainnet' ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          const prepared = await client.autofill({
               TransactionType: 'EscrowFinish',
               Account: accountAddress.value,
               Owner: escrowOwnerAddress.value,
               OfferSequence: parseInt(escrowSequenceNumber.value),
          });

          const signed = wallet.sign(prepared);
          const tx = await client.submitAndWait(signed.tx_blob);

          console.log('Finish Escrow tx', tx);

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          results += `Escrow finsihed successfully.\n\n`;
          results += prepareTxHashForOutput(tx.result.hash) + '\n';
          results += parseXRPLTransaction(tx.result);
          resultField.value = results;
          resultField.classList.add('success');

          if (currentTimeField) {
               document.getElementById('currentTimeField').value = convertToEstTime(new Date().toISOString());
          }

          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = (await client.getXrpBalance(wallet.address)) - totalXrpReservesField.value;
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving finishTimeBasedEscrow in ${now}ms`);
     }
}

export async function getEscrows() {
     console.log('Entering getEscrows');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          accountAddress: document.getElementById('accountAddressField'),
          ownerCountField: document.getElementById('ownerCountField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
          currentTimeField: document.getElementById('currentTimeField'),
          totalExecutionTime: document.getElementById('totalExecutionTime'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
     };

     // DOM existence check
     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim(); // Trim whitespace
          }
     }

     const { accountAddress, ownerCountField, totalXrpReservesField, currentTimeField, totalExecutionTime, xrpBalanceField } = fields;

     // Input validation
     const validations = [[!validatInput(accountAddress.value), 'Account Address cannot be empty']];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          let results = `Connected to ${environment} ${net}\nGetting account escrows.\n\n`;
          resultField.value = results;

          const tx = await client.request({
               id: 5,
               command: 'account_objects',
               account: accountAddress.value,
               ledger_index: 'validated',
               type: 'escrow',
          });

          console.log('Escrow objects:', tx);

          if (tx.result.account_objects.length <= 0) {
               resultField.value += `No escrow found for ${accountAddress.value}`;
               resultField.classList.add('success');
               await updateOwnerCountAndReserves(client, accountAddress.value, ownerCountField, totalXrpReservesField);
               xrpBalanceField.value = (await client.getXrpBalance(accountAddress.value)) - totalXrpReservesField.value;
               return;
          }

          const previousTxnIDs = tx.result.account_objects.map(obj => obj.PreviousTxnID);
          console.log(previousTxnIDs);

          // Get Sequence and add it to the response
          for (const previousTxnID of previousTxnIDs) {
               const sequenceTx = await client.request({
                    command: 'tx',
                    transaction: previousTxnID,
               });
               const offerSequence = sequenceTx.result.tx_json.Sequence;
               console.log(`\nEscrow OfferSequence: ${offerSequence} Hash: ${sequenceTx.result.hash}\n`);
               for (const transaction of tx.result.account_objects) {
                    if (transaction.PreviousTxnID === previousTxnID) {
                         transaction.Sequence = offerSequence;
                    }
               }
          }

          results += '\n' + parseXRPLAccountObjects(tx.result);
          resultField.value = results;
          resultField.classList.add('success');

          if (currentTimeField) {
               document.getElementById('currentTimeField').value = convertToEstTime(new Date().toISOString());
          }
          await updateOwnerCountAndReserves(client, accountAddress.value, ownerCountField, totalXrpReservesField);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving getEscrows in ${now}ms`);
     }
}

async function cancelEscrow() {
     console.log('Entering cancelEscrow');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          accountSeed: document.getElementById('accountSeedField'),
          escrowOwnerAddress: document.getElementById('escrowOwnerField'),
          escrowSequenceNumber: document.getElementById('escrowSequenceNumberField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
          ownerCountField: document.getElementById('ownerCountField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
          currentTimeField: document.getElementById('currentTimeField'),
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

     const { accountSeed, escrowOwnerAddress, escrowSequenceNumber, xrpBalanceField, ownerCountField, totalXrpReservesField, currentTimeField, totalExecutionTime } = fields;

     // Validation checks
     const validations = [
          [!validatInput(accountSeed.value), 'Seed cannot be empty'],
          [!validatInput(escrowOwnerAddress.value), 'Escrow Owner Address cannot be empty'],
          [!validatInput(escrowSequenceNumber.value), 'Escrow Sequence Number cannot be empty'],
          [isNaN(escrowSequenceNumber.value), 'Escrow Sequence Number must be a valid number'],
          [parseFloat(escrowSequenceNumber.value) <= 0, 'Escrow Sequence Number must be greater than zero'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          let results = `Connected to ${environment} ${net}\nCancelling escrow.\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: environment === 'Mainnet' ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          const prepared = await client.autofill({
               TransactionType: 'EscrowCancel',
               Account: wallet.address,
               Owner: escrowOwnerAddress.value,
               OfferSequence: parseInt(escrowSequenceNumber.value),
          });

          const signed = wallet.sign(prepared);
          const tx = await client.submitAndWait(signed.tx_blob);

          console.log('Cancel Escrow tx', tx);

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          results += `Escrow cancelled successfully.\n\n`;
          results += prepareTxHashForOutput(tx.result.hash) + '\n';
          results += parseXRPLTransaction(tx.result);
          resultField.value = results;
          resultField.classList.add('success');

          if (currentTimeField) {
               document.getElementById('currentTimeField').value = convertToEstTime(new Date().toISOString());
          }

          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = (await client.getXrpBalance(wallet.address)) - totalXrpReservesField.value;
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving cancelEscrow in ${now}ms`);
     }
}

export async function displayDataForAccount1() {
     accountNameField.value = account1name.value;
     accountAddressField.value = account1address.value;
     accountSeedField.value = account1seed.value;
     destinationField.value = account2address.value;
     escrowOwnerField.value = account1address.value;
     await getEscrows();
}

export async function displayDataForAccount2() {
     accountNameField.value = account2name.value;
     accountAddressField.value = account2address.value;
     accountSeedField.value = account2seed.value;
     destinationField.value = account1address.value;
     escrowOwnerField.value = account2address.value;
     await getEscrows();
}

window.createTimeBasedEscrow = createTimeBasedEscrow;
window.getEscrows = getEscrows;
window.finishTimeBasedEscrow = finishTimeBasedEscrow;
window.cancelEscrow = cancelEscrow;
window.getTransaction = getTransaction;
window.displayDataForAccount1 = displayDataForAccount1;
window.displayDataForAccount2 = displayDataForAccount2;
window.autoResize = autoResize;
window.disconnectClient = disconnectClient;
window.gatherAccountInfo = gatherAccountInfo;
window.clearFields = clearFields;
window.distributeAccountInfo = distributeAccountInfo;
window.convertToEstTime = convertToEstTime;
