import * as xrpl from 'xrpl';
import { getClient, disconnectClient, getEnvironment, validatInput, getXrpBalance } from './utils.js';

async function createTrustLine() {
     // Clear previous error styling
     resultField.classList.remove("error");
     resultField.classList.remove("success");

     const accountAddress = document.getElementById('accountAddressField');
     const accountSeed = document.getElementById('accountSeedField');
     const issuerAddress = document.getElementById('issuerField');
     const currency = document.getElementById('currencyField');
     const amountValue = document.getElementById('amountField');
     const xrpBalanceField = document.getElementById('xrpBalanceField');

     if (!accountAddress || !accountSeed || !issuerAddress || !currency || !amountValue || !xrpBalanceField) {
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

     if (!validatInput(accountSeed.value)) {
          resultField.value = 'ERROR: Seed Field can not be empty';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(currency.value)) {
          resultField.value = 'ERROR: Currency Field can not be empty';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(issuerAddress.value)) {
          resultField.value = 'ERROR: Issuer Field can not be empty';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(amountValue.value)) {
          resultField.value = 'ERROR: Amount Field can not be empty';
          resultField.classList.add("error");
          return;
     }

     // if(accountAddress.value == issuerAddress.value) {
     //      resultField.value = 'ERROR: Account can not be the issuer';
     //      resultField.classList.add("error");
     //      return;
     // }

     const { environment } = getEnvironment();
     const client = await getClient();

     let results = `Connected to ${environment}.\nCreating trust line.\n\n`;
     resultField.value = results;

     try {
          const wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: 'secp256k1' })
          
          // Get the current ledger index from the client
          const ledger_info = await client.request({
               "command": "ledger",
               "ledger_index": "current"
          });
          const current_ledger = ledger_info.result.ledger_current_index;
          
          const trustSet_tx = {
               "TransactionType": "TrustSet",
               "Account": accountAddress.value,
               "LimitAmount": {
                    "currency": currency.value,
                    "issuer": issuerAddress.value,
                    "value": amountValue.value
               },
               "LastLedgerSequence": current_ledger + 50 // Add buffer for transaction processing
          };

          console.log('trustSet_tx', trustSet_tx);
          const ts_prepared = await client.autofill(trustSet_tx);
          console.log('ts_prepared', ts_prepared);
          const ts_signed = wallet.sign(ts_prepared);
          console.log('ts_signed', ts_signed);
          const ts_result = await client.submitAndWait(ts_signed.tx_blob);
          console.log('ts_result', ts_result);

          if (ts_result.result.meta.TransactionResult == "tesSUCCESS") {
               results += 'Trustline established between account ' + accountAddress.value + ' and issuer ' + issuerAddress.value + ' for ' + currency.value + ' with amount ' + amountValue.value;
               resultField.value = results;
          } else {
               results += `\nTransaction failed: ${ts_result.result.meta.TransactionResult}`;
               resultField.value = results;   
          }
     }  catch (error) {
          console.error('Error:', error);
          resultField.value = error.message || 'Unknown error';
          resultField.classList.add("error");
          await disconnectClient();
     } finally {
          console.log('Leaving createTrustLine');
     } 
}

async function removeTrustLine() {
     // Clear previous error styling
     resultField.classList.remove("error");
     resultField.classList.remove("success");

     // Gather and validate inputs
     const accountAddress = document.getElementById('accountAddressField');
     const accountSeed = document.getElementById('accountSeedField');
     const issuerAddress = document.getElementById('issuerField');
     const currency = document.getElementById('currencyField');

     if (!accountAddress || !accountSeed || !issuerAddress || !currency) {
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

     if (!validatInput(accountSeed.value)) {
          resultField.value = 'ERROR: Seed Field can not be empty';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(currency.value)) {
          resultField.value = 'ERROR: Currency Field can not be empty';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(issuerAddress.value)) {
          resultField.value = 'ERROR: Issuer Field can not be empty';
          resultField.classList.add("error");
          return;
     }

     // if(accountAddress.value == issuerAddress.value) {
     //      resultField.value = 'ERROR: Account can not be the issuer';
     //      resultField.classList.add("error");
     //      return;
     // }

     const { environment } = getEnvironment();
     const client = await getClient();

     let results = `Connected to ${environment}.\nRemoving trust line.\n\n`;
     resultField.value = results;

     try {
          const trustLines = await getTrustLines(accountAddress.value, client);
          const targetTrustLine = trustLines.find(
               (line) => line.account === issuerAddress.value && line.currency === currency.value
          );
      
          if (!targetTrustLine) {
               throw new Error(`No trust line found for ${currency.value} from ${issuerAddress.value}.`);
          }
          
          if (parseFloat(targetTrustLine.balance) !== 0) {
               throw new Error(`Cannot remove trust line: Balance is ${targetTrustLine.balance}. Balance must be 0.`);
          }
          
          const wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: 'secp256k1' })
          
          // Get the current ledger index from the client
          const ledger_info = await client.request({
               "command": "ledger",
               "ledger_index": "current"
          });
          const current_ledger = ledger_info.result.ledger_current_index;
          
          const trustSet_tx = {
               "TransactionType": "TrustSet",
               "Account": accountAddress.value,
               "LimitAmount": {
                    "currency": currency.value,
                    "issuer": issuerAddress.value,
                    "value": "0"
               },
               "LastLedgerSequence": current_ledger + 50 // Add buffer for transaction processing
          };

          console.log('trustSet_tx', trustSet_tx);
          const ts_prepared = await client.autofill(trustSet_tx);
          const ts_signed = wallet.sign(ts_prepared);
          console.log(`Submitting TrustSet to remove ${currency.value} trust line from ${issuerAddress.value}...`);
          resultField.value += `Submitting TrustSet to remove ${currency.value} trust line\n`;
          const ts_result = await client.submitAndWait(ts_signed.tx_blob);

          if (ts_result.result.meta.TransactionResult == "tesSUCCESS") {
               resultField.value += 'Trustline removed between account ' + accountAddress.value + ' and issuer ' + issuerAddress.value + ' for ' + currency.value;
          } else {
               results += `\nTransaction failed: ${ts_result.result.meta.TransactionResult}`;
               resultField.value = results;   
          }
     }  catch (error) {
          console.error('Error:', error);
          resultField.value = error.message || 'Unknown error';
          resultField.classList.add("error");
          await disconnectClient();
     } finally {
          console.log('Leaving removeTrustLine');
     } 
}

async function sendCurrency() {
     // Clear previous error styling
     resultField.classList.remove("error");
     resultField.classList.remove("success");

     const xrpBalanceField = document.getElementById('xrpBalanceField');
     const issuerSeed = document.getElementById('accountSeedField');
     const issuerAddress = document.getElementById('issuerField');
     const currency = document.getElementById('currencyField');
     const destinationAddress = document.getElementById('destinationField');
     const amountField = document.getElementById('amountField');

     if (!xrpBalanceField || !issuerSeed || !issuerAddress || !currency || !destinationAddress || !xrpBalanceField) {
          resultField.value = 'ERROR: DOM elements not found';
          resultField.classList.add("error");
          return;
     }

     // Validate inputs
     if (!validatInput(issuerSeed.value)) {
          resultField.value = 'ERROR: Seed can not be empty';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(currency.value)) {
          resultField.value = 'ERROR: Currency can not be empty';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(issuerAddress.value)) {
          resultField.value = 'ERROR: Issuer can not be empty';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(destinationAddress.value)) {
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

     const { environment } = getEnvironment();
     const client = await getClient();

     let results = `Connected to ${environment}.\nSending Currency.\n\n`;
     resultField.value = results;

     try {
          const wallet = xrpl.Wallet.fromSeed(issuerSeed.value, { algorithm: 'secp256k1' });
          
          // Step 1: Check sender's trust line and balance
          const senderTrustLines = await getTrustLines(wallet.address, client);
          const senderTrustLine = senderTrustLines.find(
               (line) => line.account === issuerAddress.value && line.currency === currency.value
          );

          if (!senderTrustLine || parseFloat(senderTrustLine.limit) === 0) {
               throw new Error(`No active trust line for ${currency.value} from ${issuerAddress.value}`);
          }
          if (parseFloat(senderTrustLine.balance) < amountField.value) {
               throw new Error(`Insufficient balance: ${senderTrustLine.balance} ${currency.value}, need ${amountField.value}`);
          }

          // Step 2: Check destination's trust line
          const destTrustLines = await getTrustLines(destinationAddress, client);
          const destTrustLine = destTrustLines.find(
               (line) => line.account === issuerAddress.value && line.currency === currency.value
          );

          if (!destTrustLine || parseFloat(destTrustLine.limit) === 0) {
               throw new Error(`Destination ${destinationAddress.value} has no active trust line for ${currency.value} from ${issuerAddress.value}`);
          }
          
          if (parseFloat(destTrustLine.limit) < amountField.value) {
               throw new Error(`Destination trust line limit (${destTrustLine.limit}) is less than amount (${amountField.value})`);
          }

          // Step 3: Get current ledger index
          const ledgerInfo = await client.request({
               command: "ledger",
               ledger_index: "current",
          });
          const currentLedger = ledgerInfo.result.ledger_current_index;

          const send_currency_tx = {
               TransactionType: "Payment",
               Account: wallet.address,
               Amount: {
                    currency: currency.value,
                    value: amountField.value,
                    issuer: issuerAddress.value,
               },
               Destination: destinationAddress,
               LastLedgerSequence: currentLedger + 50, // Explicit buffer
          };
          console.log('send_currency_tx', send_currency_tx);
          
          const pay_prepared = await client.autofill(send_currency_tx);
          console.log('pay_prepared', pay_prepared);

          const pay_signed = wallet.sign(pay_prepared);
          console.log('pay_signed', pay_signed);

          results += `\n\nSending ${amountField.value} ${currency.value} to ${destinationAddress.value} ...`;
          resultField.value = results;
          const pay_result = await client.submitAndWait(pay_signed.tx_blob);
          console.log('pay_result', pay_result);

          if (pay_result.result.meta.TransactionResult == "tesSUCCESS") {
               results += 'Transaction succeeded.';
               resultField.value = results;
          } else {
               results += `\nTransaction failed: ${pay_result.result.meta.TransactionResult}`;
               resultField.value = results;
          }

          xrpBalanceField.value = (await client.getXrpBalance(wallet.address));
     } catch (error) {
          console.error('Error:', error);
          resultField.value = error.message || 'Unknown error';
          resultField.classList.add("error");
          await disconnectClient();
     } finally {
          console.log('Leaving sendCurrency');
     } 
}

async function getTrustLine() {
     // Clear previous error styling
     resultField.classList.remove("error");
     resultField.classList.remove("success");

     // Gather and validate inputs
     const accountSeed = document.getElementById('accountSeedField');
     const xrpBalanceField = document.getElementById('xrpBalanceField');

     if (!accountSeed || !xrpBalanceField) {
          resultField.value = 'ERROR: DOM elements not found';
          resultField.classList.add("error");
          return;
     }

     // Validate inputs
     if (!validatInput(accountSeed.value)) {
          resultField.value = 'ERROR: Seed Field can not be empty';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(xrpBalanceField.value)) {
          resultField.value = 'ERROR: XRP balance can not be empty';
          resultField.classList.add("error");
          return;
     }

     const { environment } = getEnvironment();
     const client = await getClient();

     let results = `Connected to ${environment}.\nGetting Trust Lines.\n\n`;
     resultField.value = results;

     try {
          const wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: 'secp256k1' });
          const response = await client.request({
               "command": "account_lines",
               "account": wallet.address,
               "ledger_index": "validated" // Use validated ledger for confirmed trust lines
          });
          const trustLines = response.result.lines;

           // If no trust lines, return early
          if (trustLines.length === 0) {
               console.log(`No trust lines found for ${wallet.address}`);
               resultField.value = `No trust lines found for ${wallet.address}`;
          }

          // Filter out trust lines with Limit: 0
          const activeTrustLines = trustLines.filter(line => parseFloat(line.limit) > 0);
          console.log(`Active trust lines for ${wallet.address}:`, activeTrustLines);

          if (activeTrustLines.length === 0) {
               console.log(`No active trust lines found for ${wallet.address}`);
               resultField.value = `No active trust lines found for ${wallet.address}`;
               return activeTrustLines;
          }

          console.log(`Trust lines for ${wallet.address}:`, trustLines);

          let output = `Active Trust Lines for ${wallet.address}:\n`;
          for (const line of activeTrustLines) {
               output += `Currency: ${line.currency}, \n\tIssuer: ${line.account}, \n\tLimit: ${line.limit}, \n\tBalance: ${line.balance}\n`;
             }
             resultField.value = output;

          xrpBalanceField.value = (await client.getXrpBalance(wallet.address));
     } catch (error) {
          console.error('Error:', error);
          resultField.value = error.message || 'Unknown error';
          resultField.classList.add("error");
          await disconnectClient();
     } finally {
          console.log('Leaving getTrustLine');
     } 
}

async function getTrustLines(account, client) {
     try {
          const response = await client.request({
          "command": "account_lines",
          "account": account,
          "ledger_index": "validated"
          });
          const trustLines = response.result.lines;

          // Filter out trust lines with Limit: 0
          const activeTrustLines = trustLines.filter(line => parseFloat(line.limit) > 0);
          console.log(`Active trust lines for ${account}:`, activeTrustLines);

          if (activeTrustLines.length === 0) {
               console.log(`No active trust lines found for ${account}`);
               return [];
          }

          console.log(`Trust lines for ${account}:`, activeTrustLines);
          return trustLines;
     } catch (error) {
          console.error("Error fetching trust lines:", error);
          return [];
     }
}

async function issueCurrency() {
     resultField.classList.remove("error");
     resultField.classList.remove("success");
     
     // Gather and validate inputs
     const xrpBalanceField = document.getElementById('xrpBalanceField');
     const issuerSeed = document.getElementById('accountSeedField');
     const issuerAddress = document.getElementById('issuerField');
     const currency = document.getElementById('currencyField');
     const destinationAddress = document.getElementById('destinationField');
     const amountField = document.getElementById('amountField');

     if (!xrpBalanceField || !issuerSeed || !issuerAddress || !currency || !destinationAddress || !xrpBalanceField || !amountField) {
          resultField.value = 'ERROR: DOM elements not found';
          resultField.classList.add("error");
          return;
     }

     // Validate inputs
     if (!validatInput(issuerSeed.value)) { // Issuer
          resultField.value = 'ERROR: Issuer Seed cannot be empty';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(destinationAddress.value)) {
          resultField.value = 'ERROR: Destination Address cannot be empty';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(currency.value)) {
          resultField.value = 'ERROR: Currency cannot be empty';
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
   
     const { environment } = getEnvironment();
     const client = await getClient();
   
     let results = `Connected to ${environment}.\nSetting up issuer and issuing ${currency.value}...\n\n`;
     resultField.value = results;
   
     try {
          // Create issuer wallet
          const wallet = xrpl.Wallet.fromSeed(issuerSeed.value, { algorithm: 'secp256k1' });
          const issuerAddress = wallet.address;

          // Step 1: Verify issuer account
          const accountInfo = await client.request({
               command: "account_info",
               account: issuerAddress,
               ledger_index: "validated",
          });
          console.log("accountInfo", accountInfo);
          results += `Issuer account ${issuerAddress} is funded.\n`;
          resultField.value = results;
   
          // Step 2: Set DefaultRipple flag
          const accountFlags = (await client.request({
               command: "account_info",
               account: issuerAddress,
               ledger_index: "validated",
          })).result.account_data.Flags;

          const asfDefaultRipple = 0x00800000;
          
          if ((accountFlags && asfDefaultRipple) === 0) {
               const currentLedger1 = (await client.request({
                    command: "ledger",
                    ledger_index: "current",
               })).result.ledger_current_index;
     
               const accountSetTx = {
                    TransactionType: "AccountSet",
                    Account: issuerAddress,
                    SetFlag: 8, // asfDefaultRipple
                    LastLedgerSequence: currentLedger1 + 50,
               };
   
               const preparedAccountSet = await client.autofill(accountSetTx);
               const signedAccountSet = wallet.sign(preparedAccountSet);
               results += `Submitting AccountSet to enable DefaultRipple...\n`;
               resultField.value = results;
               const accountSetResult = await client.submitAndWait(signedAccountSet.tx_blob);
     
               if (accountSetResult.result.meta.TransactionResult !== "tesSUCCESS") {
               throw new Error(`AccountSet failed: ${accountSetResult.result.meta.TransactionResult}`);
               }
               results += `DefaultRipple enabled.\n`;
               resultField.value = results;
          }
   
          // Step 3: Check destination's trust line
          const destTrustLines = await getTrustLines(destinationAddress.value, client);
          const destTrustLine = destTrustLines.find(
               (line) => line.account === issuerAddress && line.currency === currency.value
          );

          if (!destTrustLine || parseFloat(destTrustLine.limit) === 0) {
               throw new Error(`Destination needs a trust line for ${currency.value} from ${issuerAddress}`);
          }

          if (parseFloat(destTrustLine.limit) < amountField.value) {
               throw new Error(`Destination trust line limit (${destTrustLine.limit}) is less than amount (${amountField.value})`);
          }
   
          // Step 4: Issue TST
          const currentLedger2 = (await client.request({
               command: "ledger",
               ledger_index: "current",
          })).result.ledger_current_index;

          const paymentTx = {
               TransactionType: "Payment",
               Account: issuerAddress,
               Amount: {
                    currency: currency.value,
                    value: amountField.value,
                    issuer: issuerAddress,
               },
               Destination: destinationAddress.value,
               LastLedgerSequence: currentLedger2 + 50,
          };
   
          const pay_prepared = await client.autofill(paymentTx);
          const pay_signed = wallet.sign(pay_prepared);
     
          results += `\nIssuing ${amountField.value} ${currency.value} to ${destinationAddress.value}...\n`;
          resultField.value = results;
          const pay_result = await client.submitAndWait(pay_signed.tx_blob);
   
          // Step 5: Check transaction result
          if (pay_result.result.meta.TransactionResult === "tesSUCCESS") {
               results += 'Transaction succeeded.\n';
               // Verify new balance
               const updatedTrustLines = await getTrustLines(destinationAddress.value, client);
               const newTrustLine = updatedTrustLines.find(
                    (line) => line.account === issuerAddress && line.currency === currency.value
               );
               results += `New Balance: ${newTrustLine ? newTrustLine.balance : 'Unknown'} ${currency.value}\n`;
          } else {
               throw new Error(`Transaction failed: ${pay_result.result.meta.TransactionResult}`);
          }
          resultField.value = results;
   
          // Step 6: Update issuer's XRP balance
          xrpBalanceField.value = await client.getXrpBalance(issuerAddress);
   
          // Step 7: Check issuer's obligations
          const gatewayBalances = await client.request({
               command: "gateway_balances",
               account: issuerAddress,
               ledger_index: "validated",
          });
          results += `\nIssuer Obligations:\n${JSON.stringify(gatewayBalances.result.obligations, null, 2)}`;
          resultField.value = results;
   
          console.log('pay_result', pay_result);
     } catch (error) {
          console.error('Error setting up issuer or issuing TST:', error);
          resultField.value = `Error: ${error.message || 'Unknown error'}`;
          resultField.classList.add("error");
          await disconnectClient();
     } finally {
          console.log('Leaving setupAndIssueTST');
     }
}

async function populateFieldIssueCurrency1() {
     currencyField.value = "";
     amountField.value = "";
     accountNameField.value = account1name.value
     accountAddressField.value = account1address.value
     accountSeedField.value = account1seed.value
     destinationField.value = account2address.value
     issuerField.value = issuerAddress.value;
     getXrpBalance();
     await getAccountInfo();
}
   
async function populateFieldIssueCurrency2() {
     currencyField.value = "";
     amountField.value = "";
     accountNameField.value = account2name.value
     accountAddressField.value = account2address.value
     accountSeedField.value = account2seed.value
     destinationField.value = account1address.value
     issuerField.value = issuerAddress.value;
     getXrpBalance();
     await getAccountInfo();
}

async function populateFieldIssueCurrency3() {
     currencyField.value = "";
     amountField.value = "";
     accountNameField.value = issuerName.value
     accountAddressField.value = issuerAddress.value
     accountSeedField.value = issuerSeed.value
     destinationField.value = "";
     issuerField.value = "";
     getXrpBalance();
     await getAccountInfo();
}

window.createTrustLine = createTrustLine;
window.removeTrustLine = removeTrustLine;
window.sendCurrency = sendCurrency;
window.getTrustLine = getTrustLine;
window.issueCurrency = issueCurrency;
window.populateFieldIssueCurrency1 = populateFieldIssueCurrency1;
window.populateFieldIssueCurrency2 = populateFieldIssueCurrency2;
window.populateFieldIssueCurrency3 = populateFieldIssueCurrency3;

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