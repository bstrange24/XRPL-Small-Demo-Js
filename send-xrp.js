import * as xrpl from 'xrpl';
import { getClient, disconnectClient, validatInput, getEnvironment, parseTransactionDetails, parseBalanceChanges, populate1, populate2, populate3} from './utils.js';

async function sendXRP() {
    console.log('Entering sendXRP');

    // Clear previous error styling
     resultField.classList.remove("error");
     resultField.classList.remove("success");

     const accountAddressField = document.getElementById('accountAddressField');
     const accountSeedField = document.getElementById('accountSeedField');
     const xrpBalanceField = document.getElementById('xrpBalanceField');
     const amountField = document.getElementById('amountField');
     const destinationField = document.getElementById('destinationField');

     if (!accountAddressField || !accountSeedField || !xrpBalanceField || !amountField || !destinationField) {
          resultField.value = 'ERROR: DOM elements not found';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(accountSeedField.value)) {
          resultField.value = 'ERROR: Seed can not be empty';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(amountField.value)) {
          resultField.value = 'ERROR: Amount can not be empty';
          resultField.classList.add("error");
          return;
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

     if (!validatInput(destinationField.value)) {
          resultField.value = 'ERROR: Desitination can not be empty';
          resultField.classList.add("error");
          return;
     }

     const { environment } = getEnvironment()
     const client = await getClient();

     try {
          let results = `Connected to ${environment}.\nSending XRP.\n\n`;
          resultField.value = results;
          console.log("Seed: " + accountSeedField.value);
          const wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'secp256k1' })
          console.log("wallet: " + wallet.classicAddress + " seed: " + wallet.seed);
          const sendAmount = amountField.value;

          const prepared_tx = await client.autofill({
               "TransactionType": "Payment",
               "Account": wallet.address,
               "Amount": xrpl.xrpToDrops(sendAmount),
               "Destination": destinationField.value
          })

          const signed = wallet.sign(prepared_tx);
          const tx = await client.submitAndWait(signed.tx_blob);
          console.log("tx", tx);
          
          if (tx.result.meta.TransactionResult != "tesSUCCESS") {
               results += `Error sending xrp: ${tx.result.meta.TransactionResult}`
               resultField.value = results;
               resultField.classList.add("error");
               return;
          } else {
               results = results + parseBalanceChanges(xrpl.getBalanceChanges(tx.result.meta));
               results = results + '\n\n';
               results = results + parseTransactionDetails(tx.result);
               resultField.value = results;
               resultField.classList.add("success");
          }
          
          xrpBalanceField.value =  (await client.getXrpBalance(wallet.address));
     } catch (error) {
          console.error('Error:', error);
          resultField.value = "ERROR: " + error.message || 'Unknown error';
          resultField.classList.add("error");
          await disconnectClient();
     } finally {
          console.log('Leaving sendXRP');
     } 
}

window.sendXRP = sendXRP;
window.populate1 = populate1;
window.populate2 = populate2;
window.populate3 = populate3;