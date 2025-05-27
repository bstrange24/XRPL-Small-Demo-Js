import * as xrpl from 'xrpl';
import { getClient, disconnectClient, getEnvironment, parseTransactionDetails, parseBalanceChanges, validatInput, displayTransactions, getXrpBalance } from './utils.js';

async function sendCheck() {
     console.log('Entering sendCheck');

     // Clear previous error styling
     resultField.classList.remove("error");
     resultField.classList.remove("success");

     const { environment } = getEnvironment();
     const client = await getClient();

     if (!validatInput(accountAddressField.value)) {
          resultField.value = 'ERROR: Address can not be empty';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(currencyField.value)) {
          resultField.value = 'ERROR: Currency can not be empty';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(destinationField.value)) {
          resultField.value = 'ERROR: Destination can not be empty';
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

     let results = `Connected to ${environment}.\n`;
     resultField.value = results;

     try {
          const wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'secp256k1' })
          let check_amount = amountField.value
          if (currencyField.value !=  "XRP") {
               check_amount = {
               "currency": currencyField.value,
               "value": amountField.value,
               "issuer": wallet.address  	
               }
          }

          const send_check_tx = {
               "TransactionType": "CheckCreate",
               "Account": wallet.address,
               "SendMax": xrpl.xrpToDrops(check_amount),
               "Destination": destinationField.value
          }

          const check_prepared = await client.autofill(send_check_tx)
          const check_signed = wallet.sign(check_prepared)

          results += '\nSending Check for ' + amountField.value + ' ' + currencyField.value + ' to ' + destinationField.value + '\n'
          resultField.value = results
          const check_result = await client.submitAndWait(check_signed.tx_blob)
          console.log("Response", check_result);

          console.log(parseBalanceChanges(xrpl.getBalanceChanges(check_result.result.meta)));
          console.log('\n\n');
          console.log(parseTransactionDetails(check_result.result));

          if (check_result.result.meta.TransactionResult == "tesSUCCESS") {
               results += 'Transaction succeeded:\n';
               resultField.value = results + parseTransactionDetails(check_result.result);
               resultField.classList.add("success");
          } else {
               results += `Error sending transaction: ${check_result.result.meta.TransactionResult}`;
               resultField.value = results;
               resultField.classList.add("error");
          }

          xrpBalanceField.value = (await client.getXrpBalance(wallet.address))
     } catch (error) {
          console.error('Error:', error);
          resultField.value = "ERROR: " + error.message || 'Unknown error';
          resultField.classList.add("error");
          await disconnectClient();
     } finally {
          console.log('Leaving sendCheck');
     } 
}

async function getChecks() {
     console.log('Entering getChecks');

     // Clear previous error styling
     resultField.classList.remove("error");
     resultField.classList.remove("success");

     const { environment } = getEnvironment();
     const client = await getClient();
     let results = `Connected to ${environment}.\nGetting Checks\n\n`;

     if (!validatInput(accountAddressField.value)) {
          resultField.value = 'ERROR: Address Field can not be empty';
          resultField.classList.add("error");
          return;
     }

     try {
          resultField.value = results;
          const check_objects = await client.request({
               "id": 5,
               "command": "account_objects",
               "account": accountAddressField.value,
               "ledger_index": "validated",
               "type": "check"
          });
          console.log("Response", check_objects);
          const transactionDetails = parseTransactionDetails(check_objects.result);
          resultField.value = displayTransactions(transactionDetails);
          resultField.classList.add("success");
     } catch (error) {
          console.error('Error:', error);
          resultField.value = "ERROR: " + error.message || 'Unknown error';
          resultField.classList.add("error");
          await disconnectClient();
     } finally {
          console.log('Leaving getChecks');
     } 
}

async function cashCheck() {
     console.log('Entering cashCheck');

     // Clear previous error styling
     resultField.classList.remove("error");
     resultField.classList.remove("success");

     const { environment } = getEnvironment();
     const client = await getClient();

     if (!validatInput(accountAddressField.value)) {
          resultField.value = 'ERROR: Address can not be empty';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(currencyField.value)) {
          resultField.value = 'ERROR: Currency can not be empty';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(destinationField.value)) {
          resultField.value = 'ERROR: Desitination can not be empty';
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

     if (!validatInput(checkIdField.value)) {
          resultField.value = 'ERROR: Check Id Field can not be empty';
          resultField.classList.add("error");
          return;
     }

     let results = `Connected to ${environment}.\n`;

     try {
          resultField.value = results;
          
          const wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'secp256k1' });
          let check_amount = amountField.value;
          
          if (currencyField.value !=  "XRP") {
               check_amount = {
               "value": amountField.value,
               "currency": currencyField.value,
               "issuer": issuerField.value  	
               }
          };

          const cash_check_tx = {
               "TransactionType": "CheckCash",
               "Account": wallet.address,
               "Amount": xrpl.xrpToDrops(check_amount),
               "CheckID": checkIdField.value
          };

          const cash_prepared = await client.autofill(cash_check_tx);
          const cash_signed = wallet.sign(cash_prepared);
          results += 'Cashing Check for ' + amountField.value + ' ' + currencyField.value + '.\n';
          resultField.value = results;
          const check_result = await client.submitAndWait(cash_signed.tx_blob);
          console.log("Response", check_result);

          if (check_result.result.meta.TransactionResult == "tesSUCCESS") {
               results += 'Transaction succeeded:\n' + parseTransactionDetails(check_result.result);
               resultField.value = results;
               resultField.classList.add("success");
          } else {
               results += `Error sending transaction: ${check_result.result.meta.TransactionResult}`;
               resultField.value = results;
               resultField.classList.add("error");
          }
          xrpBalanceField.value = (await client.getXrpBalance(wallet.address));
     }  catch (error) {
          console.error('Error:', error);
          resultField.value = "ERROR: " + error.message || 'Unknown error';
          resultField.classList.add("error");
          await disconnectClient();
     } finally {
          console.log('Leaving cashCheck');
     } 
}

async function cancelCheck() {
     console.log('Entering cancelCheck');

     // Clear previous error styling
     resultField.classList.remove("error");
     resultField.classList.remove("success");

     const { environment } = getEnvironment();
     const client = await getClient();

     if (!validatInput(checkIdField.value)) {
          resultField.value = 'ERROR: Check Id Field can not be empty';
          resultField.classList.add("error");
          return;
     }

     if(!validatInput(accountSeedField.value)) {
          resultField.value = 'ERROR: Seed can not be empty'
          resultField.classList.add("error");
          return
     }

     let results = `Connected to ${environment}.\nCancelling Check\n\n`;

     try {
          resultField.value = results;
          const wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'secp256k1' });
                
          const cancel_check_tx = {
               "TransactionType": "CheckCancel",
               "Account": wallet.address,
               "CheckID": checkIdField.value
          };

          const cancel_prepared = await client.autofill(cancel_check_tx);
          const cancel_signed = wallet.sign(cancel_prepared);
          resultField.value = results;
          const check_result = await client.submitAndWait(cancel_signed.tx_blob);
          console.log("Response", check_result);

          if (check_result.result.meta.TransactionResult == "tesSUCCESS") {
               results += 'Transaction succeeded\n' + parseTransactionDetails(check_result.result);
               resultField.value = results;
               resultField.classList.add("success");
          } else {
               results += `Error sending transaction ${check_result.result.meta.TransactionResult}`;
               resultField.value = results;
               resultField.classList.add("error");
          }
          xrpBalanceField.value = (await client.getXrpBalance(wallet.address));
     }  catch (error) {
          console.error('Error:', error);
          resultField.value = "ERROR: " + error.message || 'Unknown error';
          resultField.classList.add("error");
          await disconnectClient();
     } finally {
          console.log('Leaving cashCheck');
     } 
}

async function populateFieldSendCurrency1() {
     accountNameField.value = account1name.value;
     accountAddressField.value = account1address.value;
     accountSeedField.value = account1seed.value;
     destinationField.value = account2address.value;
     issuerField.value = issuerAddress.value;
     currencyField.value = "XRP";
     getXrpBalance();
     await getAccountInfo();
}
   
async function populateFieldSendCurrency2() {
     accountNameField.value = account2name.value;
     accountAddressField.value = account2address.value;
     accountSeedField.value = account2seed.value;
     destinationField.value = account1address.value;
     issuerField.value = issuerAddress.value;
     currencyField.value = "XRP";
     getXrpBalance();
     await getAccountInfo();
}

async function populateFieldSendCurrency3() {
     accountNameField.value = issuerName.value
     accountAddressField.value = issuerAddress.value
     accountSeedField.value = issuerSeed.value
     destinationField.value = "";
     issuerField.value = "";
     currencyField.value = "";
     getXrpBalance();
     await getAccountInfo();
}

window.sendCheck = sendCheck;
window.getChecks = getChecks;
window.cashCheck = cashCheck;
window.cancelCheck = cancelCheck;
window.populateFieldSendCurrency1 = populateFieldSendCurrency1;
window.populateFieldSendCurrency2 = populateFieldSendCurrency2;
window.populateFieldSendCurrency3 = populateFieldSendCurrency3;

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