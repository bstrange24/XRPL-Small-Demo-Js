import * as xrpl from 'xrpl';
import { getClient, disconnectClient, addSeconds, getEnvironment, validatInput, setError, parseXRPLTransaction, parseXRPLAccountObjects, autoResize, getTransaction, gatherAccountInfo, clearFields, distributeAccountInfo } from './utils.js';

async function createTimeBasedEscrow() {
     console.log('Entering createTimeBasedEscrow');

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
     };

     // DOM existence check
     for (const [name, field] of Object.entries(fields)) {
          if (!field) return setError(`ERROR: DOM element ${name} not found`, spinner);
     }

     const { accountSeed, destinationAddress, escrowFinishTime, escrowCancelTime, amountField, xrpBalanceField } = fields;

     // Validation checks
     const validations = [
          [!validatInput(accountSeed.value), 'Seed cannot be empty'],
          [!validatInput(destinationAddress.value), 'Destination cannot be empty'],
          [!validatInput(escrowFinishTime.value), 'Escrow Finish Time cannot be empty'],
          [!validatInput(escrowCancelTime.value), 'Escrow Cancel Time cannot be empty'],
          [!validatInput(amountField.value), 'XRP amount cannot be empty'],
          [isNaN(amountField.value), 'Amount must be a valid number'],
          [parseFloat(amountField.value) <= 0, 'XRP amount must be greater than zero'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\nCreating time-based escrow.\n\n`;

          const wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: 'secp256k1' });

          const escrowTx = await client.autofill({
               TransactionType: 'EscrowCreate',
               Account: wallet.address,
               Amount: xrpl.xrpToDrops(amountField.value),
               Destination: destinationAddress.value,
               FinishAfter: addSeconds(parseInt(escrowFinishTime.value)),
               CancelAfter: addSeconds(parseInt(escrowCancelTime.value)),
          });

          const signed = wallet.sign(escrowTx);
          const tx = await client.submitAndWait(signed.tx_blob);

          console.log('Create Escrow tx', tx);

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== 'tesSUCCESS') {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          results += `Escrow created successfully.\n\n`;
          results += parseXRPLTransaction(tx.result);
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
          console.log('Leaving createTimeBasedEscrow');
     }
}

async function finishTimeBasedEscrow() {
     console.log('Entering finishTimeBasedEscrow');

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
     };

     // DOM element check
     for (const [key, el] of Object.entries(fields)) {
          if (!el) return setError(`ERROR: DOM element "${key}" not found`, spinner);
     }

     const { accountSeed, accountAddress, escrowOwnerAddress, escrowSequenceNumber, xrpBalanceField } = fields;

     // Input validation
     const validations = [
          [!validatInput(accountSeed.value), 'Seed cannot be empty'],
          [!validatInput(accountAddress.value), 'Account Address cannot be empty'],
          [!validatInput(escrowOwnerAddress.value), 'Escrow Owner Address cannot be empty'],
          [!validatInput(escrowSequenceNumber.value), 'Escrow Sequence Number cannot be empty'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\nFinishing escrow.\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: 'secp256k1' });

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
          if (resultCode !== 'tesSUCCESS') {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          results += `Escrow finsihed successfully.\n\n`;
          results += parseXRPLTransaction(tx.result);
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
          console.log('Leaving finishTimeBasedEscrow');
     }
}

async function getEscrows() {
     console.log('Entering getEscrows');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const accountAddress = document.getElementById('accountAddressField');
     if (!accountAddress) return setError('ERROR: DOM element "accountAddressField" not found', spinner);

     if (!validatInput(accountAddress.value)) return setError('ERROR: Address field cannot be empty', spinner);

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\nGetting account escrows.\n\n`;
          resultField.value = results;

          const tx = await client.request({
               id: 5,
               command: 'account_objects',
               account: accountAddress.value,
               ledger_index: 'validated',
               type: 'escrow',
          });

          console.log('Escrow objects:', tx);

          results += parseXRPLAccountObjects(tx.result);
          resultField.value = results;
          resultField.classList.add('success');
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving getEscrows');
     }
}

async function cancelEscrow() {
     console.log('Entering cancelEscrow');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const accountSeed = document.getElementById('accountSeedField');
     const escrowOwnerAddress = document.getElementById('escrowOwnerField');
     const escrowSequenceNumber = document.getElementById('escrowSequenceNumberField');
     const xrpBalanceField = document.getElementById('xrpBalanceField');

     if (!accountSeed || !escrowOwnerAddress || !escrowSequenceNumber || !xrpBalanceField) return setError('ERROR: Required DOM elements not found', spinner);

     const fields = [
          { value: accountSeed.value, label: 'Seed' },
          { value: escrowOwnerAddress.value, label: 'Escrow owner account' },
          { value: escrowSequenceNumber.value, label: 'Sequence Number' },
          { value: xrpBalanceField.value, label: 'XRP amount' },
     ];

     for (const field of fields) {
          if (!validatInput(field.value)) return setError(`ERROR: ${field.label} cannot be empty`, spinner);
     }

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\nCancelling escrow.\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: 'secp256k1' });

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
          if (resultCode !== 'tesSUCCESS') {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          results += `Escrow cancelled successfully.\n\n`;
          results += parseXRPLTransaction(tx.result);
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
          console.log('Leaving cancelEscrow');
     }
}

window.createTimeBasedEscrow = createTimeBasedEscrow;
window.getEscrows = getEscrows;
window.finishTimeBasedEscrow = finishTimeBasedEscrow;
window.cancelEscrow = cancelEscrow;
window.getTransaction = getTransaction;
window.autoResize = autoResize;
window.disconnectClient = disconnectClient;
window.gatherAccountInfo = gatherAccountInfo;
window.clearFields = clearFields;
window.distributeAccountInfo = distributeAccountInfo;
