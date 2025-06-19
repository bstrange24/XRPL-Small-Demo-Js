import * as xrpl from 'xrpl';
import { getClient, getNet, disconnectClient, validatInput, setError, parseXRPLTransaction, autoResize, gatherAccountInfo, clearFields, distributeAccountInfo, getTransaction, updateOwnerCountAndReserves, prepareTxHashForOutput, renderTransactionDetails } from './utils.js';
import { ed25519_ENCRYPTION, secp256k1_ENCRYPTION, MAINNET, TES_SUCCESS } from './constants.js';
import { getAccountDetails, fetchAccountObjects } from './account.js';
import { derive } from 'xrpl-accountlib';

async function sendXRP() {
     console.log('Entering sendXRP');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');
     resultField.innerHTML = ''; // Clear content

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          address: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
          amount: document.getElementById('amountField'),
          destination: document.getElementById('destinationField'),
          memo: document.getElementById('memoField'),
          destinationTag: document.getElementById('destinationTagField'),
          ownerCountField: document.getElementById('ownerCountField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
          totalExecutionTime: document.getElementById('totalExecutionTime'),
          isMultiSignTransaction: document.getElementById('isMultiSignTransaction'),
          multiSignAddress: document.getElementById('multiSignAddress'),
     };

     // DOM existence check
     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim(); // Trim whitespace
          }
     }

     const { address, seed, xrpBalanceField, amount, destination, memo, destinationTag, ownerCountField, totalXrpReservesField, totalExecutionTime, isMultiSignTransaction, multiSignAddress } = fields;

     // Validate user inputs
     const validations = [
          [!validatInput(seed.value), 'Seed cannot be empty'],
          [!validatInput(amount.value), 'ERROR: Amount cannot be empty'],
          [isNaN(amount.value), 'ERROR: Amount must be a valid number'],
          [parseFloat(amount.value) <= 0, 'ERROR: Amount must be greater than zero'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.innerHTML = `Connected to ${environment} ${net}\nSending XRP\n\n`;

          let wallet;
          if (seed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (seed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(seed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

          if (amount.value > (await client.getXrpBalance(wallet.address)) - totalXrpReservesField.value) {
               return setError('ERROR: Insufficent XRP to complete transaction', spinner);
          }

          let preparedTx;
          if (isMultiSignTransaction.checked) {
               const multiSignAddress = document.getElementById('multiSignAddress').value;
               const addressesArray = multiSignAddress.split(',').map(address => address.trim());

               const signerWallets = [];
               for (const seed of addressesArray) {
                    signerWallets.push(xrpl.Wallet.fromSeed(seed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION }));
               }

               // const signerWallet1 = xrpl.Wallet.fromSeed('ss17VgF7xf6qt3JSPodNZwBhL8i8N', { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION }); // Signer 1
               // const signerWallet2 = xrpl.Wallet.fromSeed('ssBUTCsCNhpknBjTGaWPrjBsvU1TJ', { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION }); // Signer 2

               const accountObjects = await fetchAccountObjects(address);
               if (accountObjects == null) {
                    return setError(`ERROR: No account objects for ${wallet.classicAddress}.\n`, spinner);
               }

               // Find the SignerList (returns `undefined` if not found)
               const signerList = accountObjects.result.account_objects.find(obj => obj.LedgerEntryType === 'SignerList');

               if (signerList && isMultiSignTransaction.checked) {
                    console.log('SignerList found:', signerList);
                    console.log('Signer Quorum:', signerList.SignerQuorum);
                    console.log('Signer Entries:', signerList.SignerEntries);

                    const account_data = await getAccountDetails(client, wallet.classicAddress, 'validated');

                    preparedTx = {
                         TransactionType: 'Payment',
                         Account: wallet.classicAddress,
                         Destination: destination.value,
                         Amount: xrpl.xrpToDrops(amount.value),
                         SigningPubKey: '', // required for multisign
                         Sequence: account_data.result.account_data.Sequence,
                    };

                    const memoText = memo.value;
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

                    const destinationTagText = destinationTag.value;
                    if (destinationTagText) {
                         if (isNaN(destinationTagText) || parseInt(destinationTagText) <= 0) {
                              return setError('ERROR: Destination Tag must be a valid number and greater than zero', spinner);
                         }
                         preparedTx.DestinationTag = parseInt(destinationTagText, 10);
                    }

                    // Step 2: Autofill with correct fee/LastLedgerSequence
                    const autofilledTx = await client.autofill(preparedTx);
                    console.log('Base fee (drops):', autofilledTx.Fee);
                    const signerCount = signerList.SignerEntries.length;
                    autofilledTx.Fee = (parseInt(autofilledTx.Fee, 10) * signerCount + 10).toString();
                    console.log('Adjusted fee (drops):', autofilledTx.Fee);

                    // Step 3: Each signer signs the same baseTx
                    const signedTxBlobs = [];
                    for (const signerWallet of signerWallets) {
                         const signed = signerWallet.sign(autofilledTx, signerWallet, { multisign: true });
                         signedTxBlobs.push(signed.tx_blob);
                    }

                    const combined = xrpl.multisign(signedTxBlobs);
                    // const signed1 = signerWallet1.sign(autofilledTx, signerWallet1, { multisign: true });
                    // const signed2 = signerWallet2.sign(autofilledTx, signerWallet2, { multisign: true });

                    // Step 4: Combine the signed transactions
                    // const combined = xrpl.multisign([signed1.tx_blob, signed2.tx_blob]);

                    console.log('combined: ', combined);
                    // Step 5: Submit the multisigned transaction
                    const response = await client.submitAndWait(combined);
                    console.log('Transaction response:', response);

                    const resultCode = response.result.meta.TransactionResult;
                    if (resultCode !== TES_SUCCESS) {
                         return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(response.result)}`, spinner);
                    }

                    resultField.innerHTML += `XRP payment finished successfully.\n\n`;
                    // resultField.value += prepareTxHashForOutput(response.result.hash) + '\n';
                    // resultField.value += parseXRPLTransaction(response.result);
                    renderTransactionDetails(response);
                    resultField.classList.add('success');
               } else {
                    return setError(`No Multi Sign accounts setup for ${wallet.classicAddress}`, spinner);
               }
          } else {
               console.log('No SignerList found for this account.');
               preparedTx = await client.autofill({
                    TransactionType: 'Payment',
                    Account: wallet.classicAddress,
                    Amount: xrpl.xrpToDrops(amount.value),
                    Destination: destination.value,
               });

               const memoText = memo.value;
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

               const destinationTagText = destinationTag.value;
               if (destinationTagText) {
                    if (isNaN(destinationTagText) || parseInt(destinationTagText) <= 0) {
                         return setError('ERROR: Destination Tag must be a valid number and greater than zero', spinner);
                    }
                    preparedTx.DestinationTag = parseInt(destinationTagText, 10);
               }

               const signed = wallet.sign(preparedTx);
               const response = await client.submitAndWait(signed.tx_blob);
               console.log('Transaction response:', response);

               const resultCode = response.result.meta.TransactionResult;
               if (resultCode !== TES_SUCCESS) {
                    return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(response.result)}`, spinner);
               }

               resultField.innerHTML += `XRP payment finished successfully.\n\n`;
               // resultField.value += prepareTxHashForOutput(response.result.hash) + '\n';
               // resultField.value += parseXRPLTransaction(response.result);
               renderTransactionDetails(response);
               resultField.classList.add('success');
          }

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = (await client.getXrpBalance(wallet.classicAddress)) - totalXrpReservesField.value;
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
     } finally {
          if (spinner) spinner.style.display = 'none';
          // autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving sendXRP in ${now}ms`);
     }
}

export async function displayDataForAccount1() {
     accountNameField.value = account1name.value;
     accountAddressField.value = account1address.value;
     if (account1seed.value === '') {
          if (account1mnemonic.value === '') {
               accountSeedField.value = account1secretNumbers.value;
          } else {
               accountSeedField.value = account1mnemonic.value;
          }
     } else {
          accountSeedField.value = account1seed.value;
     }
     await getAccountInfo();
}

export async function displayDataForAccount2() {
     accountNameField.value = account2name.value;
     accountAddressField.value = account2address.value;
     if (account2seed.value === '') {
          if (account1mnemonic.value === '') {
               accountSeedField.value = account2secretNumbers.value;
          } else {
               accountSeedField.value = account2mnemonic.value;
          }
     } else {
          accountSeedField.value = account2seed.value;
     }
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
