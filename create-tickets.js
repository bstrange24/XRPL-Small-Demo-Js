import * as xrpl from 'xrpl';
import { getClient, getNet, disconnectClient, validatInput, getXrpBalance, setError, parseXRPLAccountObjects, parseXRPLTransaction, autoResize, gatherAccountInfo, clearFields, distributeAccountInfo, getTransaction, updateOwnerCountAndReserves, addTime, convertXRPLTime, prepareTxHashForOutput, decodeCurrencyCode } from './utils.js';
import { XRP_CURRENCY, ed25519_ENCRYPTION, secp256k1_ENCRYPTION, MAINNET, TES_SUCCESS } from './constants.js';

async function getTickets() {
     console.log('Entering getTickets');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          address: document.getElementById('accountAddressField'),
          ownerCount: document.getElementById('ownerCountField'),
          totalXrpReserves: document.getElementById('totalXrpReservesField'),
          totalExecutionTime: document.getElementById('totalExecutionTime'),
     };

     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim();
          }
     }

     const { address, ownerCount, totalXrpReserves } = fields;

     const validations = [[!validatInput(address.value), 'Address cannot be empty']];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.value = `Connected to ${environment} ${net}\nGetting Tickets\n\n`;

          const ticket_objects = await client.request({
               command: 'account_objects',
               account: address.value,
               ledger_index: 'validated',
               type: 'ticket',
          });

          console.log('Response', ticket_objects);

          if (ticket_objects.result.account_objects.length <= 0) {
               resultField.value += `No tickets found for ${address.value}`;
               await updateOwnerCountAndReserves(client, address.value, ownerCount, totalXrpReserves);
               xrpBalanceField.value = (await client.getXrpBalance(address.value)) - totalXrpReserves.value;
               resultField.classList.add('success');
               return;
          }

          resultField.value += parseXRPLAccountObjects(ticket_objects.result);
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, address.value, ownerCount, totalXrpReserves);
          xrpBalanceField.value = (await client.getXrpBalance(address.value)) - totalXrpReserves.value;
     } catch (error) {
          console.error('Error:', error);
          setError('ERROR: ' + (error.message || 'Unknown error'));
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving getTickets in ${now}ms`);
     }
}

async function createTicket() {
     console.log('Entering createTicket');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          address: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          ticketCount: document.getElementById('ticketCountField'),
          expirationTime: document.getElementById('expirationTimeField'),
          finishUnit: document.getElementById('checkExpirationTime'), // Reused for Ticket expiration
          balance: document.getElementById('xrpBalanceField'),
          ownerCount: document.getElementById('ownerCountField'),
          totalXrpReserves: document.getElementById('totalXrpReservesField'),
          totalExecutionTime: document.getElementById('totalExecutionTime'),
     };

     // DOM existence check
     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim();
          }
     }

     const { address, seed, ticketCount, expirationTime, finishUnit, balance, ownerCount, totalXrpReserves, totalExecutionTime } = fields;

     // Validate input values
     const validations = [
          [!validatInput(address.value), 'Address cannot be empty'],
          [!validatInput(seed.value), 'Seed cannot be empty'],
          [!validatInput(ticketCount.value), 'Ticket count cannot be empty'],
          [isNaN(ticketCount.value) || parseInt(ticketCount.value) <= 0, 'Ticket count must be a positive number'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     let ticketExpirationTime = '';
     if (expirationTime.value !== '') {
          if (isNaN(parseFloat(expirationTime.value)) || expirationTime.value <= 0) {
               return setError('ERROR: Expiration time must be a valid number greater than zero', spinner);
          }
          ticketExpirationTime = addTime(parseInt(expirationTime.value), finishUnit.value);
          console.log(`Raw expirationTime: ${expirationTime.value} finishUnit: ${finishUnit.value} ticketExpirationTime: ${convertXRPLTime(parseInt(ticketExpirationTime))}`);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          let results = `Connected to ${environment} ${net}\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          const tx = await client.autofill({
               TransactionType: 'TicketCreate',
               Account: wallet.classicAddress,
               TicketCount: parseInt(ticketCount.value),
          });

          if (ticketExpirationTime !== '') {
               tx.Expiration = ticketExpirationTime;
          }

          const signed = wallet.sign(tx);

          results += `Creating ${ticketCount.value} Ticket(s)\n`;
          resultField.value = results;

          const response = await client.submitAndWait(signed.tx_blob);
          console.log('Response', response);

          const resultCode = response.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(response.result)}`, spinner);
          }

          results += `Ticket(s) created successfully.\n\n`;
          results += prepareTxHashForOutput(response.result.hash) + '\n';
          results += parseXRPLTransaction(response.result);
          resultField.value = results;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.address, ownerCount, totalXrpReserves);
          balance.value = (await client.getXrpBalance(wallet.address)) - totalXrpReserves.value;
     } catch (error) {
          console.error('Error:', error);
          setError('ERROR: ' + (error.message || 'Unknown error'));
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving createTicket in ${now}ms`);
     }
}

async function useTicket() {
     console.log('Entering useTicket');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          address: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          currency: document.getElementById('currencyField'),
          amount: document.getElementById('amountField'),
          destination: document.getElementById('destinationField'),
          issuer: document.getElementById('issuerField'),
          ticketSequence: document.getElementById('ticketSequenceField'), // New field for TicketSequence
          balance: document.getElementById('xrpBalanceField'),
          ownerCount: document.getElementById('ownerCountField'),
          totalXrpReserves: document.getElementById('totalXrpReservesField'),
          tokenBalance: document.getElementById('tokenBalance'),
          issuerField: document.getElementById('issuerField'),
          totalExecutionTime: document.getElementById('totalExecutionTime'),
     };

     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim();
          }
     }

     const { address, seed, currency, amount, destination, issuer, ticketSequence, balance, ownerCount, totalXrpReserves, tokenBalance, issuerField, totalExecutionTime } = fields;

     const validations = [
          [!validatInput(address.value), 'Address cannot be empty'],
          [!validatInput(seed.value), 'Seed cannot be empty'],
          [!validatInput(currency.value), 'Currency cannot be empty'],
          [!validatInput(amount.value), 'Amount cannot be empty'],
          [isNaN(amount.value), 'Amount must be a valid number'],
          [parseFloat(amount.value) <= 0, 'Amount must be greater than zero'],
          [!validatInput(destination.value), 'Destination cannot be empty'],
          [!validatInput(ticketSequence.value), 'Ticket Sequence cannot be empty'],
          [isNaN(ticketSequence.value) || parseInt(ticketSequence.value) <= 0, 'Ticket Sequence must be a positive number'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     if (tokenBalance && tokenBalance.value !== '') {
          const balance = Number(tokenBalance.value);
          if (isNaN(balance)) {
               return setError('ERROR: Token balance must be a number', spinner);
          }
          if (balance <= 0) {
               return setError('ERROR: Token balance must be greater than 0', spinner);
          }
     }

     if (issuerField && tokenBalance.value !== '' && Number(tokenBalance.value) > 0 && issuerField.value === '') {
          return setError('ERROR: Issuer cannot be empty when sending a token', spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          let results = `Connected to ${environment} ${net}\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          const amountToSend =
               currency.value === XRP_CURRENCY
                    ? xrpl.xrpToDrops(amount.value)
                    : {
                           value: amount.value,
                           currency: currency.value,
                           issuer: issuer.value,
                      };

          const tx = await client.autofill({
               TransactionType: 'Payment',
               Account: wallet.classicAddress,
               Amount: amountToSend,
               Destination: destination.value,
               TicketSequence: parseInt(ticketSequence.value),
               Sequence: 0, // Must be 0 when using TicketSequence
          });

          const signed = wallet.sign(tx);
          results += `Sending ${amount.value} ${currency.value} using Ticket Sequence ${ticketSequence.value}\n`;
          resultField.value = results;

          const response = await client.submitAndWait(signed.tx_blob);
          console.log('Response:', response);

          const resultCode = response.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(response.result)}`, spinner);
          }

          results += `Payment sent successfully using Ticket.\n\n`;
          results += prepareTxHashForOutput(response.result.hash) + '\n';
          results += parseXRPLTransaction(response.result);
          resultField.value = results;
          resultField.classList.add('success');

          if (currency.value !== XRP_CURRENCY) {
               await getTokenBalance();
          }

          await updateOwnerCountAndReserves(client, wallet.address, ownerCount, totalXrpReserves);
          balance.value = (await client.getXrpBalance(wallet.address)) - totalXrpReserves.value;
     } catch (error) {
          console.error('Error:', error);
          setError('ERROR: ' + (error.message || 'Unknown error'));
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving useTicket in ${now}ms`);
     }
}

async function cancelTicket() {
     console.log('Entering cancelTicket');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          seed: document.getElementById('accountSeedField'),
          ticketSequence: document.getElementById('ticketSequenceField'),
          balance: document.getElementById('xrpBalanceField'),
          ownerCount: document.getElementById('ownerCountField'),
          totalXrpReserves: document.getElementById('totalXrpReservesField'),
          totalExecutionTime: document.getElementById('totalExecutionTime'),
     };

     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim();
          }
     }

     const { seed, ticketSequence, balance, ownerCount, totalXrpReserves, totalExecutionTime } = fields;

     const validations = [
          [!validatInput(seed.value), 'Seed cannot be empty'],
          [!validatInput(ticketSequence.value), 'Ticket Sequence cannot be empty'],
          [isNaN(ticketSequence.value) || parseInt(ticketSequence.value) <= 0, 'Ticket Sequence must be a positive number'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          let results = `Connected to ${environment} ${net}\nReleasing Ticket\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          // Check if the Ticket exists and is not expired
          const ticket_objects = await client.request({
               command: 'account_objects',
               account: wallet.classicAddress,
               ledger_index: 'validated',
               type: 'ticket',
          });

          const ticket = ticket_objects.result.account_objects.find(t => t.TicketSequence === parseInt(ticketSequence.value));
          if (!ticket) {
               return setError(`ERROR: Ticket Sequence ${ticketSequence.value} not found or already used/expired`, spinner);
          }

          // Note: Tickets are not explicitly canceled; they are consumed or expire.
          // This function could be extended to submit a no-op transaction to consume the Ticket,
          // or simply inform the user to wait for expiration.
          results += `Ticket Sequence ${ticketSequence.value} exists. It will be released upon expiration or use in a transaction.\n`;
          resultField.value = results;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.address, ownerCount, totalXrpReserves);
          balance.value = (await client.getXrpBalance(wallet.address)) - totalXrpReserves.value;
     } catch (error) {
          console.error('Error:', error);
          setError('ERROR: ' + (error.message || 'Unknown error'));
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving cancelTicket in ${now}ms`);
     }
}

export async function getTokenBalance() {
     console.log('Entering getTokenBalance');
     const startTime = Date.now();

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          seed: document.getElementById('accountSeedField'),
          currency: document.getElementById('currencyField'),
          balance: document.getElementById('xrpBalanceField'),
          tokenBalance: document.getElementById('tokenBalance'),
          totalXrpReserves: document.getElementById('totalXrpReservesField'),
          ownerCount: document.getElementById('ownerCountField'),
          issuerField: document.getElementById('issuerField'),
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

     const { seed, currency, balance, tokenBalance, totalXrpReserves, ownerCount, issuerField, totalExecutionTime } = fields;

     // Validate input values
     const validations = [[!validatInput(seed.value), 'Seed cannot be empty']];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          const wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          const gatewayBalances = await client.request({
               command: 'gateway_balances',
               account: wallet.classicAddress,
               ledger_index: 'validated',
          });

          console.log('gatewayBalances', gatewayBalances);

          let tokenTotal = 0;
          issuerField.innerHTML = '';

          Object.entries(gatewayBalances.result.assets).forEach(([issuer, assets]) => {
               console.log(`Issuer: ${issuer}`);

               assets.forEach(asset => {
                    console.log(`  Currency: ${asset.currency}, Value: ${asset.value}`);
                    let assetCurrency = asset.currency.length > 3 ? decodeCurrencyCode(asset.currency) : asset.currency;

                    if (currency.value === assetCurrency) {
                         console.log(`  Match: ${currency.value} = ${assetCurrency}`);
                         const value = parseFloat(asset.value);
                         if (!isNaN(value)) tokenTotal += value;

                         // Add the issuer to dropdown
                         const option = document.createElement('option');
                         option.value = issuer;
                         option.textContent = issuer;
                         issuerField.appendChild(option);
                    }
               });
          });

          const roundedTotal = Math.round(tokenTotal * 100) / 100; // or .toFixed(2) for a string
          tokenBalance.value = roundedTotal;

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCount, totalXrpReserves);
          balance.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError('ERROR: ' + (error.message || 'Unknown error'));
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving getTokenBalance in ${now}ms`);
     }
}

async function displayTicketDataForAccount1() {
     accountNameField.value = account1name.value;
     accountAddressField.value = account1address.value;
     accountSeedField.value = account1seed.value;
     destinationField.value = account2address.value;
     expirationTimeField.value = '';
     amountField.value = '';
     await getXrpBalance();
     await getTickets();
}

async function displayTicketDataForAccount2() {
     accountNameField.value = account2name.value;
     accountAddressField.value = account2address.value;
     accountSeedField.value = account2seed.value;
     destinationField.value = account1address.value;
     amountField.value = '';
     expirationTimeField.value = '';
     await getXrpBalance();
     await getTickets();
}

window.createTicket = createTicket;
window.getTickets = getTickets;
window.useTicket = useTicket;
window.cancelTicket = cancelTicket;
window.getTransaction = getTransaction;
window.getTokenBalance = getTokenBalance;
window.displayTicketDataForAccount1 = displayTicketDataForAccount1;
window.displayTicketDataForAccount2 = displayTicketDataForAccount2;
window.autoResize = autoResize;
window.disconnectClient = disconnectClient;
window.gatherAccountInfo = gatherAccountInfo;
window.clearFields = clearFields;
window.distributeAccountInfo = distributeAccountInfo;
