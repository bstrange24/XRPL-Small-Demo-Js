import * as xrpl from 'xrpl';
import { getClient, getNet, disconnectClient, parseXRPLTransaction, validatInput, setError, autoResize, gatherAccountInfo, clearFields, distributeAccountInfo, updateOwnerCountAndReserves, addTime, convertXRPLTime, prepareTxHashForOutput, renderTransactionDetails } from './utils.js';
import { generateCondition } from './five-bells.js';
import { ed25519_ENCRYPTION, secp256k1_ENCRYPTION, MAINNET, TES_SUCCESS, EMPTY_STRING } from './constants.js';
import { derive } from 'xrpl-accountlib';

async function createConditionalEscrow() {
     console.log('Entering createConditionalEscrow');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     if (!resultField) {
          console.error('ERROR: resultField not found');
          return;
     }
     resultField?.classList.remove('error', 'success');
     resultField.innerHTML = EMPTY_STRING;

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          accountSeed: document.getElementById('accountSeedField'),
          destinationAddress: document.getElementById('destinationField'),
          escrowCancelTime: document.getElementById('escrowCancelDateField'),
          escrowCondition: document.getElementById('escrowConditionField'),
          escrowFulfillment: document.getElementById('escrowFulfillmentField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
          memo: document.getElementById('memoField'),
          amountField: document.getElementById('amountField'),
          ownerCountField: document.getElementById('ownerCountField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
          cancelUnit: document.getElementById('escrowCancelTimeUnit'),
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

     const { accountSeed, destinationAddress, escrowCancelTime, escrowCondition, escrowFulfillment, amountField, xrpBalanceField, ownerCountField, memo, totalXrpReservesField, cancelUnit, totalExecutionTime } = fields;

     // Validate input values
     const validations = [
          [!validatInput(amountField.value), 'XRP Amount cannot be empty'],
          [isNaN(amountField.value), 'XRP Amount must be a valid number'],
          [parseFloat(amountField.value) <= 0, 'XRP Amount must be greater than zero'],
          [!validatInput(escrowCondition.value), 'Condition cannot be empty'],
          [!validatInput(escrowFulfillment.value), 'Escrow Fulfillment cannot be empty'],
          [!validatInput(escrowCancelTime.value), 'Escrow Cancel time cannot be empty'],
          [isNaN(escrowCancelTime.value), 'Escrow Cancel time must be a valid number'],
          [parseFloat(escrowCancelTime.value) <= 0, 'Escrow Cancel time must be greater than zero'],
          [!validatInput(accountSeed.value), 'Seed cannot be empty'],
          [!validatInput(destinationAddress.value), 'Destination cannot be empty'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     const newEscrowCancelTime = addTime(escrowCancelTime.value, cancelUnit.value);
     console.log(`newEscrowCancelTime: ${newEscrowCancelTime}`);

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.innerHTML = `Connected to ${environment} ${net}\nCreating conditional escrow.\n\n`;

          let wallet;
          if (accountSeed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(accountSeed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (accountSeed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(accountSeed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

          if (amountField.value > (await client.getXrpBalance(wallet.classicAddress)) - totalXrpReservesField.value) {
               return setError('ERROR: Insufficent XRP to complete transaction', spinner);
          }

          const cancelAfterTime = addTime(escrowCancelTime.value, cancelUnit.value);
          console.log(`cancelUnit: ${cancelUnit.value}`);
          console.log(`cancelTime: ${convertXRPLTime(cancelAfterTime)}`);

          const escrowTx = await client.autofill({
               TransactionType: 'EscrowCreate',
               Account: wallet.address,
               Amount: xrpl.xrpToDrops(amountField.value),
               Destination: destinationAddress.value,
               CancelAfter: cancelAfterTime,
               Condition: escrowCondition.value,
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

          const signed = wallet.sign(escrowTx);
          const tx = await client.submitAndWait(signed.tx_blob);

          console.log('Create Escrow tx', tx);

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               renderTransactionDetails(tx);
               resultField.classList.add('error');
          }

          resultField.innerHTML += `Escrow created successfully.\n\n`;

          renderTransactionDetails(tx);
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = (await client.getXrpBalance(wallet.address)) - totalXrpReservesField.value;
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving createConditionalEscrow in ${now}ms`);
     }
}

async function finishConditionalEscrow() {
     console.log('Entering finishConditionalEscrow');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     if (!resultField) {
          console.error('ERROR: resultField not found');
          return;
     }
     resultField?.classList.remove('error', 'success');
     resultField.innerHTML = EMPTY_STRING;

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

     const { accountAddress, escrowOwner, accountSeed, escrowCondition, escrowFulfillment, escrowSequenceNumber, xrpBalanceField, ownerCountField, totalXrpReservesField, totalExecutionTime } = fields;

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
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.value = `Connected to ${environment} ${net}\nFulfilling conditional escrow.\n\n`;

          let wallet;
          if (accountSeed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(accountSeed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (accountSeed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(accountSeed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

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
          if (resultCode !== TES_SUCCESS) {
               renderTransactionDetails(tx);
               resultField.classList.add('error');
          }

          resultField.innerHTML += `Escrow finished successfully.\n\n`;

          renderTransactionDetails(tx);
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = (await client.getXrpBalance(wallet.address)) - totalXrpReservesField.value;
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving finishConditionalEscrow in ${now}ms`);
     }
}

async function getCondition() {
     const { conditionHex, fulfillmentHex } = generateCondition();
     escrowConditionField.value = conditionHex;
     escrowFulfillmentField.value = fulfillmentHex;
}

export async function displayDataForAccount1() {
     accountNameField.value = account1name.value;
     accountAddressField.value = account1address.value;
     if (account1seed.value === EMPTY_STRING) {
          if (account1mnemonic.value === EMPTY_STRING) {
               accountSeedField.value = account1secretNumbers.value;
          } else {
               accountSeedField.value = account1mnemonic.value;
          }
     } else {
          accountSeedField.value = account2seed.value;
     }
     destinationField.value = account2address.value;
     escrowOwnerField.value = account1address.value;
     await getEscrows();
}

export async function displayDataForAccount2() {
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
     destinationField.value = account1address.value;
     escrowOwnerField.value = account2address.value;
     await getEscrows();
}

window.createConditionalEscrow = createConditionalEscrow;
window.finishConditionalEscrow = finishConditionalEscrow;
window.getCondition = getCondition;
window.displayDataForAccount1 = displayDataForAccount1;
window.displayDataForAccount2 = displayDataForAccount2;
window.autoResize = autoResize;
window.disconnectClient = disconnectClient;
window.gatherAccountInfo = gatherAccountInfo;
window.clearFields = clearFields;
window.distributeAccountInfo = distributeAccountInfo;
