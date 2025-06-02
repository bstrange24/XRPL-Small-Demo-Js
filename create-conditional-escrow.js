import * as xrpl from 'xrpl';
import { getClient, disconnectClient, addSeconds, getEnvironment, parseXRPLTransaction, validatInput, setError, autoResize, gatherAccountInfo, clearFields, distributeAccountInfo, updateOwnerCountAndReserves } from './utils.js';
import { generateCondition } from './five-bells.js';

async function createConditionalEscrow() {
     console.log('Entering createConditionalEscrow');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          accountSeed: document.getElementById('accountSeedField'),
          destinationAddress: document.getElementById('destinationField'),
          escrowCancelTime: document.getElementById('escrowCancelDateField'),
          escrowCondition: document.getElementById('escrowConditionField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
          amountField: document.getElementById('amountField'),
          ownerCountField: document.getElementById('ownerCountField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
     };

     // Check if any required DOM elements are missing
     for (const [name, field] of Object.entries(fields)) {
          if (!field) return setError(`ERROR: DOM element ${name} not found`, spinner);
     }

     const { accountSeed, destinationAddress, escrowCancelTime, escrowCondition, amountField, xrpBalanceField, ownerCountField, totalXrpReservesField } = fields;

     // Validate input values
     const validations = [
          [!validatInput(amountField.value), 'Amount cannot be empty'],
          [isNaN(amountField.value), 'Amount must be a valid number'],
          [parseFloat(amountField.value) <= 0, 'Amount must be greater than zero'],
          [!validatInput(escrowCancelTime.value), 'Escrow Cancel time cannot be empty'],
          [!validatInput(accountSeed.value), 'Seed cannot be empty'],
          [!validatInput(destinationAddress.value), 'Destination cannot be empty'],
          [!validatInput(escrowCondition.value), 'Condition cannot be empty'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\nCreating conditional escrow.\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: 'secp256k1' });
          console.log('Wallet', wallet);

          const escrowCancelDate = addSeconds(parseInt(escrowCancelTime.value));

          const escrowTx = await client.autofill({
               TransactionType: 'EscrowCreate',
               Account: wallet.address,
               Amount: xrpl.xrpToDrops(amountField.value),
               Destination: destinationAddress.value,
               CancelAfter: escrowCancelDate,
               Condition: escrowCondition.value,
          });

          const signed = wallet.sign(escrowTx);
          const tx = await client.submitAndWait(signed.tx_blob);

          console.log('Create Escrow tx', tx);

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== 'tesSUCCESS') {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          results += `Escrow created successfully.\n\n`;
          resultField.value += `Tx Hash: ${tx.result.hash}\n\n`;
          results += parseXRPLTransaction(tx.result);
          resultField.value = results;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = (await client.getXrpBalance(wallet.address)) - totalXrpReservesField.value;
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving createConditionalEscrow');
     }
}

async function finishConditionalEscrow() {
     console.log('Entering finishConditionalEscrow');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          accountAddress: document.getElementById('accountAddressField'),
          escrowOwner: document.getElementById('escrowOwnerField'),
          accountSeed: document.getElementById('accountSeedField'),
          escrowCondition: document.getElementById('escrowConditionField'),
          escrowFulfillment: document.getElementById('escrowFulfillmentField'),
          escrowSequenceNumber: document.getElementById('escrowSequenceNumberField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
          ownerCountField: document.getElementById('ownerCountField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
     };

     // Check for missing DOM elements
     for (const [name, field] of Object.entries(fields)) {
          if (!field) return setError(`ERROR: DOM element ${name} not found`, spinner);
     }

     const { accountAddress, escrowOwner, accountSeed, escrowCondition, escrowFulfillment, escrowSequenceNumber, xrpBalanceField, ownerCountField, totalXrpReservesField } = fields;

     // Input validation
     const validations = [
          [!validatInput(accountAddress.value), 'Address cannot be empty'],
          [!validatInput(escrowOwner.value), 'Escrow Owner cannot be empty'],
          [!validatInput(escrowSequenceNumber.value), 'Escrow Sequence Number cannot be empty'],
          [!validatInput(escrowCondition.value), 'Condition cannot be empty'],
          [!validatInput(escrowFulfillment.value), 'Fulfillment cannot be empty'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\nFulfilling conditional escrow.\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: 'secp256k1' });

          const prepared = await client.autofill({
               TransactionType: 'EscrowFinish',
               Account: accountAddress.value,
               Owner: escrowOwner.value,
               OfferSequence: parseInt(escrowSequenceNumber.value),
               Condition: escrowCondition.value,
               Fulfillment: escrowFulfillment.value,
          });

          const signed = wallet.sign(prepared);
          const tx = await client.submitAndWait(signed.tx_blob);

          console.log('Create Escrow tx', tx);

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== 'tesSUCCESS') {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          results += `Escrow finished successfully.\n\n`;
          results += `Tx Hash: ${tx.result.hash}\n\n`;
          results += parseXRPLTransaction(tx.result);
          resultField.value = results;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = (await client.getXrpBalance(wallet.address)) - totalXrpReservesField.value;
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving finishConditionalEscrow');
     }
}

async function getCondition() {
     const { conditionHex, fulfillmentHex } = generateCondition();
     escrowConditionField.value = conditionHex;
     escrowFulfillmentField.value = fulfillmentHex;
}

window.createConditionalEscrow = createConditionalEscrow;
window.finishConditionalEscrow = finishConditionalEscrow;
window.getCondition = getCondition;
window.autoResize = autoResize;
window.disconnectClient = disconnectClient;
window.gatherAccountInfo = gatherAccountInfo;
window.clearFields = clearFields;
window.distributeAccountInfo = distributeAccountInfo;
