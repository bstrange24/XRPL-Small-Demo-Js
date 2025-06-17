import * as xrpl from 'xrpl';
import { getClient, getNet, disconnectClient, validatInput, setError, parseXRPLTransaction, autoResize, gatherAccountInfo, clearFields, distributeAccountInfo, getTransaction, updateOwnerCountAndReserves, prepareTxHashForOutput } from './utils.js';
import { ed25519_ENCRYPTION, secp256k1_ENCRYPTION, MAINNET, TES_SUCCESS } from './constants.js';
import { sign } from 'ripple-keypairs';

export async function getPaymentChannels() {
     console.log('Entering getPaymentChannels');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          seed: document.getElementById('accountSeedField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
          ownerCountField: document.getElementById('ownerCountField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
          totalExecutionTime: document.getElementById('totalExecutionTime'),
     };

     // DOM existence check
     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim(); // Trim whitespace
          }
     }

     const { seed, xrpBalanceField, ownerCountField, totalXrpReservesField, totalExecutionTime } = fields;

     // Validate user inputs
     const validations = [[!validatInput(seed.value), 'Seed cannot be empty']];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          const wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          resultField.value = `Connected to ${environment} ${net}\n`;
          resultField.value += `\nGetting Payment Channels\n`;

          const response = await client.request({
               command: 'account_objects',
               account: wallet.classicAddress,
               type: 'payment_channel',
               ledger_index: 'validated',
          });

          const channels = response.result.account_objects;

          if (!channels || channels.length === 0) {
               resultField.value += `\nNo payment channels found for ${wallet.classicAddress}`;
               resultField.classList.add('success');
               return;
          }

          let output = `Payment Channels for ${wallet.classicAddress}:\n\n`;
          for (const channel of channels) {
               const { index, Destination, Amount, Balance, SettleDelay, PublicKey, Expiration } = channel;

               const available = xrpl.dropsToXrp(BigInt(Amount) - BigInt(Balance));

               output += `Channel ID: ${index}\n`;
               output += `Destination: ${Destination}\n`;
               output += `Total Amount: ${xrpl.dropsToXrp(Amount)} XRP\n`;
               output += `Claimed Balance: ${xrpl.dropsToXrp(Balance)} XRP\n`;
               output += `Remaining: ${available} XRP\n`;
               output += `Settle Delay: ${SettleDelay}s\n`;
               if (Expiration) {
                    const expirationDate = new Date(Expiration * 1000).toLocaleString();
                    output += `Expiration: ${expirationDate}\n`;
               }
               output += '\n';
          }

          resultField.value += output;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = (await client.getXrpBalance(wallet.classicAddress)) - totalXrpReservesField.value;
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
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

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          seed: document.getElementById('accountSeedField'),
          destinationField: document.getElementById('destinationField'),
          amount: document.getElementById('amountField'),
          channelIDField: document.getElementById('channelIDField'),
          // channelClaimSignature: document.getElementById('channelClaimSignature'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
          ownerCountField: document.getElementById('ownerCountField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
          totalExecutionTime: document.getElementById('totalExecutionTime'),
     };

     // DOM existence check
     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim(); // Trim whitespace
          }
     }

     const { seed, destinationField, amount, channelIDField, xrpBalanceField, ownerCountField, totalXrpReservesField, totalExecutionTime } = fields;

     // Validate user inputs
     const validations = [[!validatInput(seed.value), 'Seed cannot be empty']];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     const action = document.querySelector('input[name="channelAction"]:checked').value;

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          const wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          resultField.value = `Connected to ${environment} ${net}\n`;

          if (action === 'create') {
               resultField.value += `\nCreating Payment Channel\n`;
               const tx = await client.autofill({
                    TransactionType: 'PaymentChannelCreate',
                    Account: wallet.classicAddress,
                    Amount: xrpl.xrpToDrops(amount.value),
                    Destination: destinationField.value,
                    SettleDelay: 60,
                    PublicKey: wallet.publicKey,
               });

               const response = await client.submitAndWait(tx, { wallet });
               if (response.result.meta.TransactionResult !== TES_SUCCESS) {
                    return setError(`ERROR: ${response.result.meta.TransactionResult}`, spinner);
               }

               const channelID = response.result.hash;
               resultField.value += `\nPayment channel created successfully.\n\n`;
               resultField.value += `Channel created with ID: ${channelID}\n`;
               resultField.value += prepareTxHashForOutput(response.result.hash) + '\n';
               resultField.value += parseXRPLTransaction(response.result);

               resultField.classList.add('success');
          } else if (action === 'fund') {
               if (!validatInput(channelIDField.value)) {
                    return setError('Channel ID cannot be empty', spinner);
               }
               if (isNaN(amount.value) || parseFloat(amount.value) <= 0) {
                    return setError('Amount must be a valid number and greater than 0', spinner);
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

               resultField.value += `Payment channel ${channelIDField.value} funded successfully.\n\n`;
               resultField.value += prepareTxHashForOutput(response.result.hash) + '\n';
               resultField.value += parseXRPLTransaction(response.result);

               resultField.classList.add('success');
          } else if (action === 'claim') {
               if (!validatInput(channelIDField.value)) {
                    return setError('Channel ID cannot be empty', spinner);
               }
               if (isNaN(amount.value) || parseFloat(amount.value) <= 0) {
                    return setError('Amount must be a valid number and greater than 0', spinner);
               }
               resultField.value += `Claiming Payment Channel\n\n`;
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

               resultField.value += `Payment channel claimed successfully.\n\n`;
               resultField.value += prepareTxHashForOutput(response.result.hash) + '\n';
               resultField.value += parseXRPLTransaction(response.result);

               resultField.classList.add('success');
          } else if (action === 'close') {
               if (!validatInput(channelIDField.value)) {
                    return setError('Channel ID cannot be empty', spinner);
               }
               resultField.value += `Closing Payment Channel\n\n`;
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

               resultField.value += `Payment channel closed successfully.\n\n`;
               resultField.value += prepareTxHashForOutput(response.result.hash) + '\n';
               resultField.value += parseXRPLTransaction(response.result);
               resultField.classList.add('success');
          }

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = (await client.getXrpBalance(wallet.classicAddress)) - totalXrpReservesField.value;
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
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

     // DOM existence check
     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim(); // Trim whitespace
          }
     }

     const { seed, destinationField, amount, channelIDField, channelClaimSignature, xrpBalanceField, ownerCountField, totalXrpReservesField, totalExecutionTime } = fields;

     // Validate user inputs
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
          const wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

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
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving handlePaymentChannelAction in ${now}ms`);
     }
}

export async function displayPaymentChannelsForAccount1() {
     accountNameField.value = account1name.value;
     accountAddressField.value = account1address.value;
     accountSeedField.value = account1seed.value;
     await getPaymentChannels();
}

export async function displayPaymentChannelsForAccount2() {
     accountNameField.value = account2name.value;
     accountAddressField.value = account2address.value;
     accountSeedField.value = account2seed.value;
     await getPaymentChannels();
}

window.getPaymentChannels = getPaymentChannels;
window.handlePaymentChannelAction = handlePaymentChannelAction;
window.generateChannelSignatureForUI = generateChannelSignatureForUI;
window.displayPaymentChannelsForAccount1 = displayPaymentChannelsForAccount1;
window.displayPaymentChannelsForAccount2 = displayPaymentChannelsForAccount2;
window.autoResize = autoResize;
window.disconnectClient = disconnectClient;
window.gatherAccountInfo = gatherAccountInfo;
window.clearFields = clearFields;
window.distributeAccountInfo = distributeAccountInfo;
window.distributeAccountInfo = distributeAccountInfo;
window.getTransaction = getTransaction;
