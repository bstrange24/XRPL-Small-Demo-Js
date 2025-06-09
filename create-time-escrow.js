import * as xrpl from 'xrpl';
import { getClient, getNet, disconnectClient, addSeconds, getEnvironment, validatInput, setError, parseXRPLTransaction, parseXRPLAccountObjects, autoResize, getTransaction, gatherAccountInfo, clearFields, distributeAccountInfo, updateOwnerCountAndReserves, addTime, convertXRPLTime, prepareTxHashForOutput, convertToEstTime } from './utils.js';

async function createTimeBasedEscrow() {
     console.log('Entering createTimeBasedEscrow');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const finishUnit = document.getElementById('escrowFinishTimeUnit').value;
     const cancelUnit = document.getElementById('escrowCancelTimeUnit').value;

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
     };

     // DOM existence check
     for (const [name, field] of Object.entries(fields)) {
          if (!field) return setError(`ERROR: DOM element ${name} not found`, spinner);
     }

     const { accountSeed, destinationAddress, escrowFinishTime, escrowCancelTime, amountField, xrpBalanceField, ownerCountField, totalXrpReservesField, memo, destinationTag } = fields;

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
          const { net, environment } = getNet();
          const client = await getClient();

          let results = `Connected to ${environment} ${net}\nCreating time-based escrow.\n\n`;

          const wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: environment === 'Mainnet' ? 'ed25519' : 'secp256k1' });

          // let wallet;
          // if (environment === 'Mainnet') {
          //      wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'ed25519' });
          // } else {
          //      wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'secp256k1' });
          // }

          const finishAfterTime = addTime(escrowFinishTime.value, finishUnit);
          const cancelAfterTime = addTime(escrowCancelTime.value, cancelUnit);
          console.log(`finishUnit: ${finishUnit} cancelUnit: ${cancelUnit}`);
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
          if (resultCode !== 'tesSUCCESS') {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          results += `Escrow created successfully.\n\n`;
          results += prepareTxHashForOutput(tx.result.hash) + '\n';
          results += parseXRPLTransaction(tx.result);
          resultField.value = results;
          resultField.classList.add('success');

          document.getElementById('currentTimeField').value = convertToEstTime(new Date().toISOString());
          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = (await client.getXrpBalance(wallet.address)) - totalXrpReservesField.value;
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
          ownerCountField: document.getElementById('ownerCountField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
     };

     // DOM element check
     for (const [key, el] of Object.entries(fields)) {
          if (!el) return setError(`ERROR: DOM element "${key}" not found`, spinner);
     }

     const { accountSeed, accountAddress, escrowOwnerAddress, escrowSequenceNumber, xrpBalanceField, ownerCountField, totalXrpReservesField } = fields;

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
          const { net, environment } = getNet();
          const client = await getClient();

          let results = `Connected to ${environment} ${net}\nFinishing escrow.\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: environment === 'Mainnet' ? 'ed25519' : 'secp256k1' });

          // let wallet;
          // if (environment === 'Mainnet') {
          //      wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'ed25519' });
          // } else {
          //      wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'secp256k1' });
          // }

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
          results += prepareTxHashForOutput(tx.result.hash) + '\n';
          results += parseXRPLTransaction(tx.result);
          resultField.value = results;
          resultField.classList.add('success');

          document.getElementById('currentTimeField').value = convertToEstTime(new Date().toISOString());
          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = (await client.getXrpBalance(wallet.address)) - totalXrpReservesField.value;
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

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');

     const accountAddress = document.getElementById('accountAddressField');
     if (!accountAddress) return setError('ERROR: DOM element "accountAddressField" not found', spinner);

     if (!validatInput(accountAddress.value)) return setError('ERROR: Address field cannot be empty', spinner);

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

          document.getElementById('currentTimeField').value = convertToEstTime(new Date().toISOString());
          await updateOwnerCountAndReserves(client, accountAddress.value, ownerCountField, totalXrpReservesField);
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
     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');

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
          const { net, environment } = getNet();
          const client = await getClient();

          let results = `Connected to ${environment} ${net}\nCancelling escrow.\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: environment === 'Mainnet' ? 'ed25519' : 'secp256k1' });

          // let wallet;
          // if (environment === 'Mainnet') {
          //      wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'ed25519' });
          // } else {
          //      wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'secp256k1' });
          // }

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
          results += prepareTxHashForOutput(tx.result.hash) + '\n';
          results += parseXRPLTransaction(tx.result);
          resultField.value = results;
          resultField.classList.add('success');

          document.getElementById('currentTimeField').value = convertToEstTime(new Date().toISOString());
          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = (await client.getXrpBalance(wallet.address)) - totalXrpReservesField.value;
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
window.convertToEstTime = convertToEstTime;
