import * as xrpl from 'xrpl';
import { getClient, getNet, disconnectClient, validatInput, setError, gatherAccountInfo, clearFields, distributeAccountInfo, getTransaction, updateOwnerCountAndReserves, renderPaymentChannelDetails, renderTransactionDetails } from './utils.js';
import { ed25519_ENCRYPTION, secp256k1_ENCRYPTION, MAINNET, TES_SUCCESS, EMPTY_STRING } from './constants.js';
import { sign } from 'ripple-keypairs';
import { derive } from 'xrpl-accountlib';

export async function getPaymentChannels() {
     console.log('Entering getPaymentChannels');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     if (!resultField) {
          console.error('ERROR: resultField not found');
          return;
     }
     resultField.classList.remove('error', 'success');
     resultField.innerHTML = EMPTY_STRING;

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          seed: document.getElementById('accountSeedField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
          ownerCountField: document.getElementById('ownerCountField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
          totalExecutionTime: document.getElementById('totalExecutionTime'),
     };

     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim();
          }
     }

     const { seed, xrpBalanceField, ownerCountField, totalXrpReservesField, totalExecutionTime } = fields;

     const validations = [[!validatInput(seed.value), 'Seed cannot be empty']];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          let wallet;
          if (seed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (seed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(seed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

          const response = await client.request({
               command: 'account_objects',
               account: wallet.classicAddress,
               type: 'payment_channel',
               ledger_index: 'validated',
          });

          const channels = response.result.account_objects;

          const data = {
               sections: [{}],
          };

          if (!channels || channels.length === 0) {
               data.sections.push({
                    title: 'Payment Channels',
                    openByDefault: true,
                    content: [{ key: 'Status', value: `No payment channels found for <code>${wallet.classicAddress}</code>` }],
               });
          } else {
               data.sections.push({
                    title: `Payment Channels (${channels.length})`,
                    openByDefault: true,
                    subItems: channels.map((channel, index) => {
                         const { index: channelId, Destination, Amount, Balance, SettleDelay, PublicKey, Expiration } = channel;
                         const available = xrpl.dropsToXrp(BigInt(Amount) - BigInt(Balance));
                         return {
                              key: `Channel ${index + 1} (ID: ${channelId.slice(0, 8)}...)`,
                              openByDefault: false,
                              content: [
                                   { key: 'Channel ID', value: `<code>${channelId}</code>` },
                                   { key: 'Destination', value: `<code>${Destination}</code>` },
                                   { key: 'Total Amount', value: `${xrpl.dropsToXrp(Amount)} XRP` },
                                   { key: 'Claimed Balance', value: `${xrpl.dropsToXrp(Balance)} XRP` },
                                   { key: 'Remaining', value: `${available} XRP` },
                                   { key: 'Settle Delay', value: `${SettleDelay}s` },
                                   ...(Expiration ? [{ key: 'Expiration', value: new Date(Expiration * 1000).toLocaleString() }] : []),
                                   { key: 'Public Key', value: `<code>${PublicKey}</code>` },
                              ],
                         };
                    }),
               });
          }

          renderPaymentChannelDetails(data);

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = (await client.getXrpBalance(wallet.classicAddress)) - totalXrpReservesField.value;
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
     } finally {
          if (spinner) spinner.style.display = 'none';
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving getPaymentChannels in ${now}ms`);
     }
}

export async function handlePaymentChannelAction() {
     console.log('Entering handlePaymentChannelAction');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');
     resultField.innerHTML = EMPTY_STRING;

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          seed: document.getElementById('accountSeedField'),
          destinationField: document.getElementById('destinationField'),
          amount: document.getElementById('amountField'),
          channelIDField: document.getElementById('channelIDField'),
          // channelClaimSignature: document.getElementById('channelClaimSignature'),
          settleDelayField: document.getElementById('settleDelayField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
          ownerCountField: document.getElementById('ownerCountField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
          totalExecutionTime: document.getElementById('totalExecutionTime'),
     };

     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim();
          }
     }

     const { seed, destinationField, amount, channelIDField, settleDelayField, xrpBalanceField, ownerCountField, totalXrpReservesField, totalExecutionTime } = fields;

     const validations = [[!validatInput(seed.value), 'Seed cannot be empty']];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     const action = document.querySelector('input[name="channelAction"]:checked').value;

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          let wallet;
          if (seed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (seed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(seed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

          if (!validatInput(settleDelayField.value)) {
               settleDelayField.value = 60;
          }

          if (amount.value > (await client.getXrpBalance(wallet.classicAddress)) - totalXrpReservesField.value) {
               return setError('ERROR: Insufficent XRP to complete transaction', spinner);
          }

          resultField.innerHTML = `Connected to ${environment} ${net}\n`;

          if (action === 'create') {
               resultField.innerHTML += `\nCreating Payment Channel\n`;

               const tx = await client.autofill({
                    TransactionType: 'PaymentChannelCreate',
                    Account: wallet.classicAddress,
                    Amount: xrpl.xrpToDrops(amount.value),
                    Destination: destinationField.value,
                    SettleDelay: parseInt(settleDelayField.value),
                    PublicKey: wallet.publicKey,
               });

               const response = await client.submitAndWait(tx, { wallet });
               if (response.result.meta.TransactionResult !== TES_SUCCESS) {
                    return setError(`ERROR: ${response.result.meta.TransactionResult}`, spinner);
               }

               const channelID = response.result.hash;
               resultField.value += `\nPayment channel created successfully.\n\n`;
               resultField.value += `Channel created with ID: ${channelID}\n`;
               // resultField.value += prepareTxHashForOutput(response.result.hash) + '\n';
               // resultField.value += parseXRPLTransaction(response.result);

               renderTransactionDetails(response);
               resultField.classList.add('success');
          } else if (action === 'fund') {
               if (!validatInput(channelIDField.value)) {
                    return setError('Channel ID cannot be empty', spinner);
               }
               if (isNaN(amount.value) || parseFloat(amount.value) <= 0) {
                    return setError('Amount must be a valid number and greater than 0', spinner);
               }

               if (amount.value > (await client.getXrpBalance(wallet.classicAddress)) - totalXrpReservesField.value) {
                    return setError('ERROR: Insufficent XRP to complete transaction', spinner);
               }

               resultField.value += `Funding Payment Channel\n\n`;
               const tx = await client.autofill({
                    TransactionType: 'PaymentChannelFund',
                    Account: wallet.classicAddress,
                    Channel: channelIDField.value,
                    Amount: xrpl.xrpToDrops(amount.value),
               });

               const response = await client.submitAndWait(tx, { wallet });
               if (response.result.meta.TransactionResult !== TES_SUCCESS) {
                    return setError(`ERROR: ${response.result.meta.TransactionResult}`, spinner);
               }

               resultField.innerHTML += `Payment channel ${channelIDField.value} funded successfully.\n\n`;
               // resultField.value += prepareTxHashForOutput(response.result.hash) + '\n';
               // resultField.value += parseXRPLTransaction(response.result);

               renderTransactionDetails(response);
               resultField.classList.add('success');
          } else if (action === 'claim') {
               if (!validatInput(channelIDField.value)) {
                    return setError('Channel ID cannot be empty', spinner);
               }
               if (isNaN(amount.value) || parseFloat(amount.value) <= 0) {
                    return setError('Amount must be a valid number and greater than 0', spinner);
               }
               resultField.innerHTML += `Claiming Payment Channel\n\n`;
               const balanceDrops = xrpl.xrpToDrops(amount.value);

               // let signature;
               // if (validatInput(channelClaimSignature.value)) {
               // signature = channelClaimSignature.value;
               // } else {
               const signature = generateChannelSignature(channelIDField.value, amount.value, wallet);
               // }

               const tx = await client.autofill({
                    TransactionType: 'PaymentChannelClaim',
                    Account: wallet.classicAddress,
                    Channel: channelIDField.value,
                    Balance: balanceDrops,
                    Signature: signature,
                    PublicKey: wallet.publicKey,
               });
               console.log(`tx: ${JSON.stringify(tx, null, 2)}`);

               const response = await client.submitAndWait(tx, { wallet });
               if (response.result.meta.TransactionResult !== TES_SUCCESS) {
                    return setError(`ERROR: ${response.result.meta.TransactionResult}`, spinner);
               }

               resultField.innerHTML += `Payment channel claimed successfully.\n\n`;
               // resultField.value += prepareTxHashForOutput(response.result.hash) + '\n';
               // resultField.value += parseXRPLTransaction(response.result);

               renderTransactionDetails(response);
               resultField.classList.add('success');
          } else if (action === 'close') {
               if (!validatInput(channelIDField.value)) {
                    return setError('Channel ID cannot be empty', spinner);
               }
               resultField.innerHTML += `Closing Payment Channel\n\n`;
               const tx = await client.autofill({
                    TransactionType: 'PaymentChannelClaim',
                    Account: wallet.classicAddress,
                    Channel: channelIDField.value,
                    Flags: xrpl.PaymentChannelClaimFlags.tfClose,
               });

               const response = await client.submitAndWait(tx, { wallet });
               if (response.result.meta.TransactionResult !== TES_SUCCESS) {
                    return setError(`ERROR: ${response.result.meta.TransactionResult}`, spinner);
               }

               resultField.innerHTML += `Payment channel closed successfully.\n\n`;
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
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving handlePaymentChannelAction in ${now}ms`);
     }
}

export function generateChannelSignature(channelID, amountXRP, wallet) {
     try {
          if (!/^[0-9A-Fa-f]{64}$/.test(channelID)) {
               throw new Error('Invalid channelID: must be a 64-character hexadecimal string');
          }
          const amountDrops = xrpl.xrpToDrops(amountXRP);
          if (isNaN(amountDrops)) {
               throw new Error('Invalid amountXRP: must be a valid number or string');
          }

          // Convert the amount to 8-byte big-endian buffer
          const amountBuffer = Buffer.alloc(8);
          amountBuffer.writeBigUInt64BE(BigInt(amountDrops), 0);

          // Create the message buffer: 'CLM\0' + ChannelID (hex) + Amount (8 bytes)
          const message = Buffer.concat([
               Buffer.from('CLM\0'), // Prefix for channel claims
               Buffer.from(channelID, 'hex'), // 32-byte channel ID
               amountBuffer, // 8-byte drop amount
          ]);

          // Sign the message using ripple-keypairs
          const messageHex = message.toString('hex');
          const signature = sign(messageHex, wallet.privateKey);

          return signature.toUpperCase();
     } catch (error) {
          throw new Error(`Failed to generate channel signature: ${error.message}`);
     }
}

export function generateChannelSignatureForUI() {
     console.log('Entering handlePaymentChannelAction');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          seed: document.getElementById('accountSeedField'),
          destinationField: document.getElementById('destinationField'),
          amount: document.getElementById('amountField'),
          channelIDField: document.getElementById('channelIDField'),
          channelClaimSignature: document.getElementById('channelClaimSignature'),
          totalExecutionTime: document.getElementById('totalExecutionTime'),
     };

     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim();
          }
     }

     const { seed, destinationField, amount, channelIDField, channelClaimSignature, xrpBalanceField, ownerCountField, totalXrpReservesField, totalExecutionTime } = fields;

     const validations = [
          [!validatInput(seed.value), 'Seed cannot be empty'],
          [!validatInput(amount.value), 'Amount value cannot be empty'],
          [isNaN(amount.value), 'Amount must be a valid number'],
          [parseFloat(amount.value) <= 0, 'Amount must be a greater than 0'],
          [!/^[0-9A-Fa-f]{64}$/.test(channelIDField.value), 'Invalid channelID: must be a 64-character hexadecimal string'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();

          let wallet;
          if (seed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (seed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(seed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

          const amountDrops = xrpl.xrpToDrops(amount.value);
          if (isNaN(amountDrops)) {
               setError('Invalid amountXRP: must be a valid number or string', spinner);
          }

          // Convert the amount to 8-byte big-endian buffer
          const amountBuffer = Buffer.alloc(8);
          amountBuffer.writeBigUInt64BE(BigInt(amountDrops), 0);

          // Create the message buffer: 'CLM\0' + ChannelID (hex) + Amount (8 bytes)
          const message = Buffer.concat([
               Buffer.from('CLM\0'), // Prefix for channel claims
               Buffer.from(channelIDField.value, 'hex'), // 32-byte channel ID
               amountBuffer, // 8-byte drop amount
          ]);

          // Sign the message using ripple-keypairs
          const messageHex = message.toString('hex');
          const signature = sign(messageHex, wallet.privateKey);
          channelClaimSignature.value = signature.toUpperCase();
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
     } finally {
          if (spinner) spinner.style.display = 'none';
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving handlePaymentChannelAction in ${now}ms`);
     }
}

export async function displayPaymentChannelsForAccount1() {
     accountNameField.value = account1name.value;
     accountAddressField.value = account1address.value;
     if (account1seed.value === EMPTY_STRING) {
          if (account1mnemonic.value === EMPTY_STRING) {
               accountSeedField.value = account1secretNumbers.value;
          } else {
               accountSeedField.value = account1mnemonic.value;
          }
     } else {
          accountSeedField.value = account1seed.value;
     }
     await getPaymentChannels();
}

export async function displayPaymentChannelsForAccount2() {
     accountNameField.value = account2name.value;
     accountAddressField.value = account2address.value;
     if (account2seed.value === EMPTY_STRING) {
          if (account1mnemonic.value === EMPTY_STRING) {
               accountSeedField.value = account2secretNumbers.value;
          } else {
               accountSeedField.value = account2mnemonic.value;
          }
     } else {
          accountSeedField.value = account2seed.value;
     }
     await getPaymentChannels();
}

window.getPaymentChannels = getPaymentChannels;
window.handlePaymentChannelAction = handlePaymentChannelAction;
window.generateChannelSignatureForUI = generateChannelSignatureForUI;
window.displayPaymentChannelsForAccount1 = displayPaymentChannelsForAccount1;
window.displayPaymentChannelsForAccount2 = displayPaymentChannelsForAccount2;
window.disconnectClient = disconnectClient;
window.gatherAccountInfo = gatherAccountInfo;
window.clearFields = clearFields;
window.distributeAccountInfo = distributeAccountInfo;
window.distributeAccountInfo = distributeAccountInfo;
window.getTransaction = getTransaction;
