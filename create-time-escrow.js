import * as xrpl from 'xrpl';
import { getClient, disconnectClient, addSeconds, getEnvironment, parseTransactionDetails, parseBalanceChanges, validatInput, displayTransactions } from './utils.js';

async function createTimeBasedEscrow() {
     // Clear previous error styling
     resultField.classList.remove("error");
     resultField.classList.remove("success");
     
     const accountSeed = document.getElementById('accountSeedField');
     const destinationAddress = document.getElementById('destinationField');
     const escrowFinishTime = document.getElementById('escrowFinishTimeField');
     const escrowCancelTime = document.getElementById('escrowCancelTimeField');
     const amountField = document.getElementById('amountField');
     const xrpBalanceField = document.getElementById('xrpBalanceField');

     if (!accountSeed || !destinationAddress || !escrowFinishTime || !escrowCancelTime || !amountField || !xrpBalanceField) {
          resultField.value = 'ERROR: DOM elements not found';
          resultField.classList.add("error");
          return;
     }

     // Validate inputs
     if (!validatInput(accountSeed.value)) {
          resultField.value = 'ERROR: Seed can not be empty';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(escrowFinishTime.value)) {
          resultField.value = 'ERROR: Escrow Finish Time can not be empty'
          resultField.classList.add("error");
          return
     }

     if (!validatInput(escrowCancelTime.value)) {
          resultField.value = 'ERROR: Escrow Cancel time can not be empty'
          resultField.classList.add("error");
          return
     }

     if (!validatInput(amountField.value)) {
          resultField.value = 'ERROR: XRP amount can not be empty'
          resultField.classList.add("error");
          return
     }

     if (isNaN(amountField.value)) {
          resultField.value = 'ERROR: Amount must be a valid number';
          resultField.classList.add("error");
          return;
     }

     if (parseFloat(amountField.value) <= 0) {
          resultField.value = 'ERROR: XRP amount must be greater than zero';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(accountSeed.value)) {
          resultField.value = 'ERROR: Seed can not be empty'
          resultField.classList.add("error");
          return
     }

     if (!validatInput(destinationAddress.value)) {
          resultField.value = 'ERROR: Destination can not be empty'
          resultField.classList.add("error");
          return
     }

     const escrow_finish_date = addSeconds(parseInt(escrowFinishTime.value));
     const escrow_cancel_date = addSeconds(parseInt(escrowCancelTime.value));
     
     try {
          const { environment } = getEnvironment()
          const client = await getClient();

          let results  = `Connected to ${environment}.\nCreating time-based escrow.\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: 'secp256k1' });
          resultField.value = results;
          const escrowTx = await client.autofill({
               "TransactionType": "EscrowCreate",
               "Account": wallet.address,
               "Amount": xrpl.xrpToDrops(amountField.value),
               "Destination": destinationAddress.value,
               "FinishAfter": escrow_finish_date,
               "CancelAfter": escrow_cancel_date
          });
          const signed = wallet.sign(escrowTx);
          const tx = await client.submitAndWait(signed.tx_blob);
          
          console.log("Create Escrow tx", tx);

          if(tx.result.meta.TransactionResult != "tesSUCCESS") {
               resultField.value = "ERROR: " + tx.result.meta.TransactionResult + '\n' + parseTransactionDetails(tx.result);
               resultField.classList.add("error");
          } else {
               results = results + parseBalanceChanges(xrpl.getBalanceChanges(tx.result.meta));
               results = results + '\n\n';
               results = results + parseTransactionDetails(tx.result);
               resultField.value = results;
               resultField.classList.add("success");
          }

          xrpBalanceField.value = (await client.getXrpBalance(wallet.address));
     } catch (error) {
          console.error('Error:', error);
          resultField.value = "ERROR: " + error.message || 'Unknown error';
          await disconnectClient();
     } finally {
          console.log('Leaving createTimeBasedEscrow');
     } 
}

async function finishTimeBasedEscrow() {
     // Clear previous error styling
     resultField.classList.remove("error");
     resultField.classList.remove("success");

     const accountSeed = document.getElementById('accountSeedField');
     const accountAddress = document.getElementById('accountAddressField');
     const escrowOwnerAddress = document.getElementById('escrowOwnerField');
     const escrowSequenceNumber = document.getElementById('escrowSequenceNumberField');
     const xrpBalanceField = document.getElementById('xrpBalanceField');

     if (!accountSeed || !accountAddress || !escrowOwnerAddress || !escrowSequenceNumber || !xrpBalanceField) {
          resultField.value = 'ERROR: DOM elements not found';
          resultField.classList.add("error");
          return;
     }

     // Validate inputs
     if (!validatInput(accountSeed.value)) {
          resultField.value = 'ERROR: Seed can not be empty';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(accountAddress.value)) {
          resultField.value = 'ERROR: Address Field can not be empty';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(escrowOwnerAddress.value)) {
          resultField.value = 'ERROR: Escrow Owner field can not be empty'
          resultField.classList.add("error");
          return
     }

     if (!validatInput(escrowSequenceNumber.value)) {
          resultField.value = 'ERROR: Sequence Number can not be empty'
          resultField.classList.add("error");
          return
     }
     
     try {
          const { environment } = getEnvironment()
          const client = await getClient();

          let results = `Connected to ${environment}.\nFinishing escrow.\n\n`;
          resultField.value = results;
          
          const wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: 'secp256k1' });
          resultField.value = results;
          const prepared = await client.autofill({
               "TransactionType": "EscrowFinish",
               "Account": accountAddress.value,
               "Owner": escrowOwnerAddress.value,
               "OfferSequence": parseInt(escrowSequenceNumber.value)
          });
          const signed = wallet.sign(prepared);
          const tx = await client.submitAndWait(signed.tx_blob);

          console.log("Finish Escrow tx", tx);

          if(tx.result.meta.TransactionResult != "tesSUCCESS") {
               resultField.value = "ERROR: " + tx.result.meta.TransactionResult + '\n' + parseTransactionDetails(tx.result);
               resultField.classList.add("error");
          } else {
               results = results + parseBalanceChanges(xrpl.getBalanceChanges(tx.result.meta));
               results = results + '\n\n';
               results = results + parseTransactionDetails(tx.result);
               resultField.value = results;
               resultField.classList.add("success");
          }

          xrpBalanceField.value = (await client.getXrpBalance(wallet.address));
     }  catch (error) {
          console.error('Error:', error);
          resultField.value = "ERROR: " + error.message || 'Unknown error';
          resultField.classList.add("error");
          await disconnectClient();
     } finally {
          console.log('Leaving createTimeBasedEscrow');
     } 
}

async function getEscrows() {
     // Clear previous error styling
     resultField.classList.remove("error");
     resultField.classList.remove("success");

     const accountAddress = document.getElementById('accountAddressField');

     if (!accountAddress) {
          resultField.value = 'ERROR: DOM elements not found';
          resultField.classList.add("error");
          return;
     }

     // Validate inputs
     if (!validatInput(accountAddress.value)) {
          resultField.value = 'ERROR: Address Field can not be empty';
          resultField.classList.add("error");
          return;
     }
     
     try {
          const { environment } = getEnvironment()
          const client = await getClient();

          let results = `Connected to ${environment}.\nGetting account escrows.\n\n`;
          resultField.value = results;

          const escrow_objects = await client.request({
               "id": 5,
               "command": "account_objects",
               "account": accountAddress.value,
               "ledger_index": "validated",
               "type": "escrow"
          });
          console.log("escrow_objects", escrow_objects);
          const transactionDetails = parseTransactionDetails(escrow_objects.result);
          resultField.value = displayTransactions(transactionDetails);
          resultField.classList.add("success");
     }  catch (error) {
          console.error('Error:', error);
          resultField.value = "ERROR: " + error.message || 'Unknown error';
          resultField.classList.add("error");
          await disconnectClient();
     } finally {
          console.log('Leaving createTimeBasedEscrow');
     } 
}

async function getTransaction() {
     // Clear previous error styling
     resultField.classList.remove("error");
     resultField.classList.remove("success");

     const transactionHash = document.getElementById('transactionField');

     if (!transactionHash) {
          resultField.value = 'ERROR: DOM elements not found';
          resultField.classList.add("error");
          return;
     }

     // Validate inputs
     if (!validatInput(transactionHash.value)) {
          alert('Transaction Field can not be empty');
          return;
     }
     
     try {
          const { environment } = getEnvironment()
          const client = await getClient();
          
          let results = `Connected to ${environment}.\nGetting transaction information.\n\n`;
          resultField.value = results;

          const tx_info = await client.request({
               "id": 1,
               "command": "tx",
               "transaction": transactionHash.value,
          });

          console.log("Get transaction tx", tx_info);
          results += JSON.stringify(tx_info.result, null, 2);
          resultField.value = results;
     }   catch (error) {
          console.error('Error:', error);
          resultField.value = "ERROR: " + error.message || 'Unknown error';
          resultField.classList.add("error");
          await disconnectClient();
     } finally {
          console.log('Leaving createTimeBasedEscrow');
     } 
}

async function cancelEscrow() {
     // Clear previous error styling
     resultField.classList.remove("error");
     resultField.classList.remove("success");

     const accountSeed = document.getElementById('accountSeedField');
     const escrowOwnerAddress = document.getElementById('escrowOwnerField');
     const escrowSequenceNumber = document.getElementById('escrowSequenceNumberField');
     const xrpBalanceField = document.getElementById('xrpBalanceField');

     if (!accountSeed || !escrowOwnerAddress || !escrowSequenceNumber || !xrpBalanceField) {
          resultField.value = 'ERROR: DOM elements not found';
          resultField.classList.add("error");
          return;
     }

     // Validate inputs
     if (!validatInput(accountSeed.value)) {
          resultField.value = 'ERROR: Seed can not be empty'
          resultField.classList.add("error");
          return
     }

     if (!validatInput(escrowOwnerAddress.value)) {
          resultField.value = 'ERROR: Escrow owner account can not be empty'
          resultField.classList.add("error");
          return
     }

     if (!validatInput(escrowSequenceNumber.value)) {
          resultField.value = 'ERROR: Sequence Number can not be empty'
          resultField.classList.add("error");
          return
     }

     if (!validatInput(xrpBalanceField.value)) {
          resultField.value = 'ERROR: XRP amount can not be empty'
          resultField.classList.add("error");
          return
     }
     
     try {
          const { environment } = getEnvironment()
          const client = await getClient();
     
          let results = `Connected to ${environment}.\nCancelling escrow.\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: 'secp256k1' });
          const prepared = await client.autofill({
               "TransactionType": "EscrowCancel",
               "Account": wallet.address,
               "Owner": escrowOwnerAddress.value,
               "OfferSequence": parseInt(escrowSequenceNumber.value)
          });
          const signed = wallet.sign(prepared);
          const tx = await client.submitAndWait(signed.tx_blob);

          console.log("Cancel Escrow tx", tx);

          if(tx.result.meta.TransactionResult != "tesSUCCESS") {
               resultField.value = "ERROR: " + tx.result.meta.TransactionResult + '\n' + parseTransactionDetails(tx.result);
               resultField.classList.add("error");
          } else {
               results = results + parseBalanceChanges(xrpl.getBalanceChanges(tx.result.meta));
               results = results + '\n\n';
               results = results + parseTransactionDetails(tx.result);
               resultField.value = results;
               resultField.classList.add("success");
          }
          
          xrpBalanceField.value = (await client.getXrpBalance(wallet.address));
     }  catch (error) {
          console.error('Error:', error);
          resultField.value = "ERROR: " + error.message || 'Unknown error';
          resultField.classList.add("error");
          await disconnectClient();
     } finally {
          console.log('Leaving cancelEscrow');
     } 
}

window.createTimeBasedEscrow = createTimeBasedEscrow;
window.getEscrows = getEscrows;
window.finishTimeBasedEscrow = finishTimeBasedEscrow;
window.cancelEscrow = cancelEscrow;
window.getTransaction = getTransaction;

const pageTitles = {
     "index.html": "Send XRP",
     "send-checks.html": "Send Checks",
     "send-currency.html": "Send Currency",
     "create-time-escrow.html": "Create Time Escrow",
     "create-conditional-escrow.html": "Create Conditional Escrow",
     "account.html": "Account Info",
     "create-offers.html": "Create Offers",
};
 
// Extract filename from URL
const page = window.location.pathname.split("/").pop();
 
// Set navbar title if there's a match
const titleElement = document.querySelector(".navbar-title");

if (titleElement && pageTitles[page]) {
     titleElement.textContent = pageTitles[page];
}
