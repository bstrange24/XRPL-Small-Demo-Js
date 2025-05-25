import * as xrpl from 'xrpl';
import { getClient, disconnectClient, addSeconds, getEnvironment, parseTransactionDetails, parseBalanceChanges, validatInput } from './utils.js';
import { generateCondition } from './five-bells.js';

async function createConditionalEscrow() {
     console.log('Entering createConditionalEscrow');

     // Clear previous error styling
     resultField.classList.remove("error");
     resultField.classList.remove("success");

     const accountSeed = document.getElementById('accountSeedField');
     const destinationAddress = document.getElementById('destinationField');
     const escrowCancelTime = document.getElementById('escrowCancelDateField');
     const escrowCondition = document.getElementById('escrowConditionField');
     const xrpBalanceField = document.getElementById('xrpBalanceField');
     const amountField = document.getElementById('amountField');

     if (!accountSeed || !destinationAddress || !escrowCancelTime || !escrowCondition || !xrpBalanceField || !amountField) {
          resultField.value = 'ERROR: DOM elements not found';
          resultField.classList.add("error");
          return;
     }

     // Validate inputs
     if (!validatInput(amountField.value)) {
          resultField.value = 'ERROR: Amount can not be empty'
          resultField.classList.add("error");
          return
     }

     if (isNaN(amountField.value)) {
          resultField.value = 'ERROR: Amount must be a valid number';
          resultField.classList.add("error");
          return;
     }

     if (parseFloat(amountField.value) <= 0) {
          resultField.value = 'ERROR: Amount must be greater than zero';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(escrowCancelTime.value)) {
          resultField.value = 'ERROR: Escrow Cancel time can not be empty'
          resultField.classList.add("error");
          return
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

     if (!validatInput(escrowCondition.value)) {
           resultField.value = 'ERROR: Condition can not be empty'
           resultField.classList.add("error");
          return
     }

     try {
          const { environment } = getEnvironment()
          const client = await getClient();
     
          let results = `Connected to ${environment}.\nCreating conditional escrow.\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: 'secp256k1' });
          console.log('Wallet', wallet);
     
          const escrow_cancel_date = addSeconds(parseInt(escrowCancelTime.value));
          
          const escrowTx = await client.autofill({
               "TransactionType": "EscrowCreate",
               "Account": wallet.address,
               "Amount": xrpl.xrpToDrops(amountField.value),
               "Destination": destinationAddress.value,
               "CancelAfter": escrow_cancel_date,
               "Condition": escrowCondition.value
          });

          const signed = wallet.sign(escrowTx);
          const tx = await client.submitAndWait(signed.tx_blob);

          console.log("Create Escrow tx", tx);

          results = results + parseBalanceChanges(xrpl.getBalanceChanges(tx.result.meta));
          results = results + '\n\n';
          results = results + parseTransactionDetails(tx.result);
          xrpBalanceField.value = (await client.getXrpBalance(wallet.address));
          resultField.value = results;
     } catch (error) {
          console.error('Error:', error);
          resultField.value = error.message || 'Unknown error';
          resultField.classList.add("error");
          await disconnectClient();
     } finally {
          console.log('Leaving createConditionalEscrow');
     } 
}

async function finishConditionalEscrow() {
     console.log('Entering finishConditionalEscrow');

     // Clear previous error styling
     resultField.classList.remove("error");
     resultField.classList.remove("success");

     const accountAddress = document.getElementById('accountAddressField');
     const escrowOwner = document.getElementById('escrowOwnerField');
     const accountSeed = document.getElementById('accountSeedField');
     const escrowCondition = document.getElementById('escrowConditionField');
     const escrowFulfillment = document.getElementById('escrowFulfillmentField');
     const escrowSequenceNumber = document.getElementById('escrowSequenceNumberField');
     const xrpBalanceField = document.getElementById('xrpBalanceField');

     if (!accountSeed || !accountAddress || !escrowOwner || !accountSeed || !escrowFulfillment || !escrowSequenceNumber || !xrpBalanceField) {
          resultField.value = 'ERROR: DOM elements not found';
          resultField.classList.add("error");
          return;
     }

     // Validate inputs
     if (!validatInput(accountAddress.value)) {
          alert('Address can not be empty');
          return
     }

     if (!validatInput(escrowOwner.value)) {
          alert('Escrow Owner can not be empty');
          return
     }

     if (!validatInput(escrowSequenceNumber.value)) {
          alert('Escrow sequence number can not be empty');
          return
     }

     if (!validatInput(escrowCondition.value)) {
          alert('Condition can not be empty');
          return
     }

     if (!validatInput(escrowFulfillment.value)) {
          alert('Fulfillment can not be empty');
          return
     }

     try {
          const { environment } = getEnvironment()
          const client = await getClient();
          
          let results = `Connected to ${environment}.\nFulfilling conditional escrow.\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: 'secp256k1' });

          const prepared = await client.autofill({
               "TransactionType": "EscrowFinish",
               "Account": accountAddress.value,
               "Owner": escrowOwner.value,
               "OfferSequence": parseInt(escrowSequenceNumber.value),
               "Condition": escrowCondition.value,
               "Fulfillment": escrowFulfillment.value
          });

          const signed = wallet.sign(prepared);
          const tx = await client.submitAndWait(signed.tx_blob);
          results = results + parseBalanceChanges(xrpl.getBalanceChanges(tx.result.meta));
          results = results + '\n\n';
          results = results + parseTransactionDetails(tx.result);
          resultField.value = results;
          xrpBalanceField.value = (await client.getXrpBalance(wallet.address));
     } catch (error) {
          console.error('Error:', error);
          resultField.value = error.message || 'Unknown error';
          resultField.classList.add("error");
          await disconnectClient();
     } finally {
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
