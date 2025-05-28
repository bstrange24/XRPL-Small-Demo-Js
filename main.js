import * as xrpl from 'xrpl';
import { clearFields, generateNewWallet, generateNewWalletFromMnemonic, generateNewWalletFromSecretNumbers, getAccountFromSeed, getAccountFromMnemonic, getAccountFromSecretNumbers, populate1, populate2, populate3, gatherAccountInfo, distributeAccountInfo, getClient, disconnectClient, getEnvironment } from './utils.js';

async function closeConnection() {
     const client = await getClient();
     if (client && client.isConnected()) {
          await client.disconnect();
          console.log('Client disconnected');
     } else {
          console.log('Client is not connected');
     }
}

async function createTrustLine() {
     const accountAddressField = document.getElementById('accountAddressField');
     const accountSeedField = document.getElementById('accountSeedField');
     const destinationField = document.getElementById('destinationField');
     const resultField = document.getElementById('resultField');

     if (!accountAddressField || !accountSeedField || !destinationField || !resultField) {
          console.error('DOM elements not found');
          resultField.value = 'Error: Missing input fields';
          return;
     }

     const { environment } = getEnvironment();
     const client = await getClient();

     try {
          const wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'secp256k1' });
          const prepared = await client.autofill({
               TransactionType: 'TrustSet',
               Account: wallet.address,
               LimitAmount: {
                    currency: 'XRP',
                    issuer: destinationField.value,
                    value: '1000000', // Arbitrary large limit
               },
          });

          const signed = wallet.sign(prepared);
          const tx = await client.submitAndWait(signed.tx_blob);

          resultField.value = `Trust line created: ${JSON.stringify(tx.result, null, 2)}`;
          console.log('Trust line created:', tx.result);
     } catch (error) {
          console.error('Error creating trust line:', error);
          resultField.value = `Error: ${error.message || 'Unknown error'}`;
          await disconnectClient();
     } finally {
          console.log('Leaving createTrustLine');
     }
}

export async function getTokenBalance() {
     const resultField = document.getElementById('resultField');
     const accountSeedField = document.getElementById('accountSeedField');
     const xrpBalanceField = document.getElementById('xrpBalanceField');

     resultField.classList.remove('error');
     resultField.classList.remove('success');

     // Null checks for DOM elements
     if (resultField === null || accountSeedField === null || xrpBalanceField === null) {
          console.warn('Missing DOM elements: resultField, accountSeedField, or xrpBalanceField');
          return;
     }

     const { environment } = getEnvironment(); // Assumes getEnvironment is defined
     let client;

     try {
          client = await getClient(); // Assumes getClient is defined
          let results = `Connected to ${environment}.\nGetting Token Balance\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'secp256k1' });
          results += 'Getting account balance\n';
          resultField.value = results;

          const balance = await client.request({
               command: 'gateway_balances',
               account: wallet.address,
               ledger_index: 'validated',
          });

          console.log('balance', balance);

          // Format obligations
          let output = 'Obligations (Issued by You):\n';
          if (balance.result.obligations && Object.keys(balance.result.obligations).length > 0) {
               for (const [currency, amount] of Object.entries(balance.result.obligations)) {
                    output += `- ${currency}: ${amount}\n`;
               }
          } else {
               output += 'None\n';
          }

          // Format assets (held balances)
          output += '\nBalances (Held by You):\n';
          if (balance.result.assets && Object.keys(balance.result.assets).length > 0) {
               for (const [issuer, currencies] of Object.entries(balance.result.assets)) {
                    for (const { currency, value } of currencies) {
                         output += `- ${currency} from ${issuer}: ${value}\n`;
                    }
               }
          } else {
               output += 'None\n';
          }

          results += output;
          resultField.value = results;
          resultField.classList.add('success');
          xrpBalanceField.value = await client.getXrpBalance(wallet.address);
     } catch (error) {
          console.error('Error getting token balance:', error);
          resultField.value = `Error: ${error.message || 'Unknown error'}`;
          resultField.classList.add('error');
     } finally {
          if (client && client.isConnected()) {
               await client.disconnect();
               console.log('Client disconnected in getTokenBalance');
          }
          console.log('Leaving getTokenBalance');
     }
}

// Expose to global scope for button onclick;
window.generateNewWallet = generateNewWallet;
window.generateNewWalletFromMnemonic = generateNewWalletFromMnemonic;
window.generateNewWalletFromSecretNumbers = generateNewWalletFromSecretNumbers;

window.getAccountFromSeed = getAccountFromSeed;
window.getAccountFromMnemonic = getAccountFromMnemonic;

window.getAccountFromSecretNumbers = getAccountFromSecretNumbers;

window.populate1 = populate1;
window.populate2 = populate2;
window.populate3 = populate3;
window.gatherAccountInfo = gatherAccountInfo;
window.distributeAccountInfo = distributeAccountInfo;

window.createTrustLine = createTrustLine;
window.getTokenBalance = getTokenBalance;
window.clearFields = clearFields;

window.closeConnection = closeConnection;
