import * as xrpl from 'xrpl';
import { getClient, getNet, disconnectClient, validatInput, setError, parseXRPLTransaction, autoResize, gatherAccountInfo, clearFields, distributeAccountInfo, getTransaction, updateOwnerCountAndReserves, prepareTxHashForOutput } from './utils.js';
import { XRP_CURRENCY, ed25519_ENCRYPTION, secp256k1_ENCRYPTION, MAINNET, TES_SUCCESS } from './constants.js';

async function sendXRP() {
     console.log('Entering sendXRP');
     const startTime = Date.now();

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
          memo: document.getElementById('memoField'),
          destinationTag: document.getElementById('destinationTagField'),
          ownerCountField: document.getElementById('ownerCountField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
          totalExecutionTime: document.getElementById('totalExecutionTime'),
     };

     // Validate DOM elements
     if (Object.values(fields).some(el => !el)) {
          return setError(`ERROR: DOM element not found`, spinner);
     }

     const seed = fields.seed.value.trim();
     const amount = fields.amount.value.trim();
     const destination = fields.destination.value.trim();
     const memo = fields.memo.value.trim();
     const destinationTag = fields.destinationTag.value.trim();

     // Validate user inputs
     if (!validatInput(seed)) return setError('ERROR: Seed cannot be empty', spinner);
     if (!validatInput(amount)) return setError('ERROR: Amount cannot be empty', spinner);
     if (isNaN(amount)) return setError('ERROR: Amount must be a valid number', spinner);
     if (parseFloat(amount) <= 0) return setError('ERROR: Amount must be greater than zero', spinner);
     if (isNaN(destinationTag)) return setError('ERROR: Destination Tag must be a valid number', spinner);
     if (parseFloat(destinationTag) <= 0) return setError('ERROR: Destination Tag must be greater than zero', spinner);
     if (!validatInput(destination)) return setError('ERROR: Destination cannot be empty', spinner);

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          let results = `Connected to ${environment} ${net}\nSending XRP\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          const preparedTx = await client.autofill({
               TransactionType: 'Payment',
               Account: wallet.classicAddress,
               Amount: xrpl.xrpToDrops(amount),
               Destination: destination,
          });

          const memoText = memo;
          if (memoText) {
               preparedTx.Memos = [
                    {
                         Memo: {
                              MemoType: Buffer.from('text/plain', 'utf8').toString('hex'),
                              MemoData: Buffer.from(memoText, 'utf8').toString('hex'),
                         },
                    },
               ];
          }

          const destinationTagText = destinationTag;
          if (destinationTagText) {
               preparedTx.DestinationTag = parseInt(destinationTagText, 10);
          }

          const signed = wallet.sign(preparedTx);
          const response = await client.submitAndWait(signed.tx_blob);
          console.log('Transaction response:', response);

          const resultCode = response.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(response.result)}`, spinner);
          }

          results += `XRP payment finished successfully.\n\n`;
          results += prepareTxHashForOutput(response.result.hash) + '\n';
          results += parseXRPLTransaction(response.result);

          resultField.value = results;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.address, fields.ownerCountField, fields.totalXrpReservesField);
          fields.balance.value = (await client.getXrpBalance(wallet.address)) - fields.totalXrpReservesField.value;
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving sendXRP in ${now}ms`);
     }
}

export async function displayDataForAccount1() {
     accountNameField.value = account1name.value;
     accountAddressField.value = account1address.value;
     accountSeedField.value = account1seed.value;
     await getAccountInfo();
}

export async function displayDataForAccount2() {
     accountNameField.value = account2name.value;
     accountAddressField.value = account2address.value;
     accountSeedField.value = account2seed.value;
     await getAccountInfo();
}

window.sendXRP = sendXRP;
window.displayDataForAccount1 = displayDataForAccount1;
window.displayDataForAccount2 = displayDataForAccount2;
window.autoResize = autoResize;
window.disconnectClient = disconnectClient;
window.gatherAccountInfo = gatherAccountInfo;
window.clearFields = clearFields;
window.distributeAccountInfo = distributeAccountInfo;
window.distributeAccountInfo = distributeAccountInfo;
window.getTransaction = getTransaction;
