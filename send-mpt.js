import * as xrpl from 'xrpl';
import { getClient, getNet, disconnectClient, validatInput, getEnvironment, populate1, populate2, populate3, setError, parseXRPLTransaction, parseXRPLAccountObjects, autoResize, getTransaction, gatherAccountInfo, clearFields, distributeAccountInfo, updateOwnerCountAndReserves } from './utils.js';

async function getMPTs() {
     console.log('Entering getMPTs');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');

     const fields = {
          accountAddress: document.getElementById('accountAddressField'),
          accountSeed: document.getElementById('accountSeedField'),
          balance: document.getElementById('xrpBalanceField'),
     };

     if (Object.values(fields).some(el => !el)) return setError(`ERROR: DOM element not found`, spinner);

     const seed = fields.accountSeed.value.trim();

     if (!validatInput(seed)) return setError('ERROR: Seed cannot be empty', spinner);

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          let results = `Connected to ${environment} ${net}\nGetting MPT\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed, { algorithm: environment === 'Mainnet' ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          resultField.value = results;
          const mpts = await client.request({
               command: 'account_objects',
               account: wallet.address,
               ledger_index: 'validated',
               type: 'mptoken',
          });
          console.log('mpts', mpts);

          if (mpts.result.account_objects.length <= 0) {
               resultField.value += `No MPTS found for account ${wallet.address}`;
               resultField.classList.add('success');
               return;
          }

          let JSONString = JSON.stringify(mpts.result, null, 2);
          let JSONParse = JSON.parse(JSONString);
          let numberOfMPTs = JSONParse.account_objects.length;
          let x = 0;
          while (x < numberOfMPTs) {
               results += '\n\nMPT Issuance ID: ' + JSONParse.account_objects[x].MPTokenIssuanceID + '\nMPT Amount: ' + JSONParse.account_objects[x].MPTAmount;
               x++;
          }
          results += '\n\n' + JSONString;
          resultField.value = results;

          results += parseXRPLAccountObjects(nftInfo.result);
          resultField.value = results;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
          fields.balance.value = await client.getXrpBalance(wallet.address);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving getMPTs');
     }
}

async function sendMPT() {
     console.log('Entering sendMPT');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');

     const fields = {
          address: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          balance: document.getElementById('xrpBalanceField'),
          amountField: document.getElementById('amountField'),
          destinationAddressField: document.getElementById('destinationAddressField'),
          mptIssuanceIdField: document.getElementById('mptIssuanceIdField'),
     };

     if (Object.values(fields).some(el => !el)) return setError(`ERROR: DOM element ${el} not found`, spinner);

     const seed = fields.seed.value.trim();
     const amountField = fields.amountField.value.trim();
     const mptIssuanceIdField = fields.mptIssuanceIdField.value.trim();
     const destinationAddressField = fields.destinationAddressField.value.trim();

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          let results = `Connected to ${environment} ${net}\nGetting NFT\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed, { algorithm: environment === 'Mainnet' ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          const mpt_issuance_id = mptIssuanceIdField;
          const mpt_quantity = amountField;
          const send_mpt_tx = {
               TransactionType: 'Payment',
               Account: wallet.address,
               Amount: {
                    mpt_issuance_id: mpt_issuance_id,
                    value: mpt_quantity,
               },
               Destination: destinationAddressField,
          };

          const pay_prepared = await client.autofill(send_mpt_tx);
          const pay_signed = wallet.sign(pay_prepared);
          results += `\n\nSending ${mpt_quantity} ${mpt_issuance_id} to ${destinationField.value}`;
          resultField.value = results;
          const pay_result = await client.submitAndWait(pay_signed.tx_blob);

          const resultCode = pay_result.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(pay_result.result)}`, spinner);
          }

          results += `MPT sent successfully.\n\n`;
          results += `Tx Hash: ${pay_result.result.hash}\n\n`;
          results += parseXRPLTransaction(pay_result.result);

          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
          fields.balance.value = await client.getXrpBalance(wallet.address);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving sendMPT');
     }
}

async function authorizeMPT() {
     let net = getNet();
     const client = new xrpl.Client(net);
     await client.connect();
     let results = `Connected to ${net}`;
     resultField.value = results;
     const wallet = xrpl.Wallet.fromSeed(accountSeedField.value);
     const mpt_issuance_id = mptIdField.value;
     const auth_mpt_tx = {
          TransactionType: 'MPTokenAuthorize',
          Account: wallet.address,
          MPTokenIssuanceID: mpt_issuance_id,
     };
     const auth_prepared = await client.autofill(auth_mpt_tx);
     const auth_signed = wallet.sign(auth_prepared);
     results += `\n\nSending authorization`;
     resultField.value = results;
     const auth_result = await client.submitAndWait(auth_signed.tx_blob);
     if (auth_result.result.meta.TransactionResult == TES_SUCCESS) {
          results += `\nTransaction succeeded`;
          resultField.value = results;
     } else {
          results += `\nTransaction failed: ${auth_result.result.meta.TransactionResult}`;
          resultField.value = results;
     }
     client.disconnect();
}

window.sendMPT = sendMPT;
window.getMPTs = getMPTs;
window.authorizeMPT = authorizeMPT;

window.getTransaction = getTransaction;
window.populate1 = populate1;
window.populate2 = populate2;
window.populate3 = populate3;
window.autoResize = autoResize;
window.disconnectClient = disconnectClient;
window.gatherAccountInfo = gatherAccountInfo;
window.clearFields = clearFields;
window.distributeAccountInfo = distributeAccountInfo;
