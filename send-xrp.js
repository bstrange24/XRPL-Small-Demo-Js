import * as xrpl from 'xrpl';
import { getClient, disconnectClient, validatInput, getEnvironment, populate1, populate2, populate3, setError, parseXRPLTransaction, displayTransaction, autoResize, gatherAccountInfo, clearFields, distributeAccountInfo } from './utils.js';

async function sendXRP() {
     console.log('Entering sendXRP');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          address: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          balance: document.getElementById('xrpBalanceField'),
          amount: document.getElementById('amountField'),
          destination: document.getElementById('destinationField'),
     };

     // Validate DOM elements
     if (Object.values(fields).some(el => !el)) {
          return setError(`ERROR: DOM element not found`, spinner);
     }

     const seed = fields.seed.value.trim();
     const amount = fields.amount.value.trim();
     const destination = fields.destination.value.trim();

     // Validate user inputs
     if (!validatInput(seed)) return setError('ERROR: Seed cannot be empty', spinner);
     if (!validatInput(amount)) return setError('ERROR: Amount cannot be empty', spinner);
     if (isNaN(amount)) return setError('ERROR: Amount must be a valid number', spinner);
     if (parseFloat(amount) <= 0) return setError('ERROR: Amount must be greater than zero', spinner);
     if (!validatInput(destination)) return setError('ERROR: Destination cannot be empty', spinner);

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\nSending XRP\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed, { algorithm: 'secp256k1' });

          const preparedTx = await client.autofill({
               TransactionType: 'Payment',
               Account: wallet.address,
               Amount: xrpl.xrpToDrops(amount),
               Destination: destination,
          });

          const signed = wallet.sign(preparedTx);
          const response = await client.submitAndWait(signed.tx_blob);
          console.log('Transaction response:', response);

          const resultCode = response.result.meta.TransactionResult;
          if (resultCode !== 'tesSUCCESS') {
               const { txDetails, accountChanges } = parseXRPLTransaction(response.result);
               return setError(`ERROR: Transaction failed: ${resultCode}\n${displayTransaction({ txDetails, accountChanges })}`, spinner);
          }

          results += `XRP payment finished successfully.\n\n`;
          const { txDetails, accountChanges } = parseXRPLTransaction(response.result);
          results += displayTransaction({ txDetails, accountChanges });

          resultField.value = results;
          resultField.classList.add('success');

          fields.balance.value = await client.getXrpBalance(wallet.address);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving sendXRP');
     }
}

window.sendXRP = sendXRP;
window.populate1 = populate1;
window.populate2 = populate2;
window.populate3 = populate3;
window.autoResize = autoResize;
window.disconnectClient = disconnectClient;
window.gatherAccountInfo = gatherAccountInfo;
window.clearFields = clearFields;
window.distributeAccountInfo = distributeAccountInfo;
window.distributeAccountInfo = distributeAccountInfo;
