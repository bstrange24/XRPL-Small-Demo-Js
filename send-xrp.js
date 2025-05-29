import * as xrpl from 'xrpl';
import { getClient, disconnectClient, validatInput, getEnvironment, populate1, populate2, populate3, setError, parseXRPLTransaction, displayTransaction, autoResize } from './utils.js';

async function sendXRP() {
     console.log('Entering sendXRP');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const fields = {
          address: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          balance: document.getElementById('xrpBalanceField'),
          amount: document.getElementById('amountField'),
          destination: document.getElementById('destinationField'),
     };

     // Validate DOM elements
     if (Object.values(fields).some(el => !el)) {
          return setError(`ERROR: DOM element not found`);
     }

     const seed = fields.seed.value.trim();
     const amount = fields.amount.value.trim();
     const destination = fields.destination.value.trim();

     // Validate user inputs
     if (!validatInput(seed)) return setError('ERROR: Seed cannot be empty');
     if (!validatInput(amount)) return setError('ERROR: Amount cannot be empty');
     if (isNaN(amount)) return setError('ERROR: Amount must be a valid number');
     if (parseFloat(amount) <= 0) return setError('ERROR: Amount must be greater than zero');
     if (!validatInput(destination)) return setError('ERROR: Destination cannot be empty');

     const { environment } = getEnvironment();
     const client = await getClient();

     try {
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
               return setError(`ERROR: Transaction failed: ${resultCode}\n${displayTransaction({ txDetails, accountChanges })}`);
          }

          results += `XRP payment finished successfully.\n\n`;
          const { txDetails, accountChanges } = parseXRPLTransaction(response.result);
          results += displayTransaction({ txDetails, accountChanges });

          resultField.value = results;
          resultField.classList.add('success');
          autoResize();

          // Update balance
          fields.balance.value = await client.getXrpBalance(wallet.address);
     } catch (error) {
          console.error('Error:', error);
          setError(error.message || 'Unknown error');
          await disconnectClient();
     } finally {
          console.log('Leaving sendXRP');
     }
}

window.sendXRP = sendXRP;
window.populate1 = populate1;
window.populate2 = populate2;
window.populate3 = populate3;
window.autoResize = autoResize;
