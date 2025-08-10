import * as xrpl from 'xrpl';
import { getClient, getNet, disconnectClient, validatInput, getXrpBalance, setError, parseXRPLAccountObjects, parseXRPLTransaction, gatherAccountInfo, clearFields, distributeAccountInfo, getTransaction, updateOwnerCountAndReserves, convertXRPLTime, prepareTxHashForOutput, decodeCurrencyCode, addTime, renderAccountDetails, renderTicketDetails, renderTransactionDetails } from './utils.js';
import { XRP_CURRENCY, ed25519_ENCRYPTION, secp256k1_ENCRYPTION, MAINNET, TES_SUCCESS, EMPTY_STRING } from './constants.js';
import { derive } from 'xrpl-accountlib';

export async function getTickets() {
     console.log('Entering getTickets');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     if (!resultField) {
          console.error('ERROR: resultField not found');
          return;
     }
     resultField.classList.remove('error', 'success');
     resultField.innerHTML = '';

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          address: document.getElementById('accountAddressField'),
          ownerCount: document.getElementById('ownerCountField'),
          totalXrpReserves: document.getElementById('totalXrpReservesField'),
          totalExecutionTime: document.getElementById('totalExecutionTime'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
     };

     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim();
          }
     }

     const { address, ownerCount, totalXrpReserves, totalExecutionTime, xrpBalanceField } = fields;

     const validations = [[!validatInput(address.value), 'Address cannot be empty']];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          const ticket_objects = await client.request({
               command: 'account_objects',
               account: address.value,
               type: 'ticket',
               ledger_index: 'validated',
          });

          console.log('Response', ticket_objects);

          // Prepare data for renderAccountDetails
          const data = {
               sections: [{}],
          };

          if (ticket_objects.result.account_objects.length <= 0) {
               data.sections.push({
                    title: 'Tickets',
                    openByDefault: true,
                    content: [{ key: 'Status', value: `No tickets found for <code>${address.value}</code>` }],
               });
          } else {
               data.sections.push({
                    title: `Tickets (${ticket_objects.result.account_objects.length})`,
                    openByDefault: true,
                    subItems: ticket_objects.result.account_objects.map((ticket, counter) => {
                         const { TicketSequence, LedgerEntryType, PreviousTxnID, OwnerNode, Flags, index } = ticket;
                         return {
                              key: `Ticket ${counter + 1} (ID: ${index.slice(0, 8)}...)`,
                              openByDefault: false,
                              content: [{ key: 'Ticket ID', value: `<code>${index}</code>` }, { key: 'Ledger Entry Type', value: LedgerEntryType }, { key: 'Previous Txn ID', value: `<code>${PreviousTxnID}</code>` }, ...(TicketSequence ? [{ key: 'Ticket Sequence', value: String(TicketSequence) }] : []), ...(OwnerNode ? [{ key: 'Owner Node', value: `<code>${OwnerNode}</code>` }] : []), { key: 'Flags', value: String(Flags) }],
                         };
                    }),
               });
          }

          // Render data
          renderTicketDetails(data);

          await updateOwnerCountAndReserves(client, address.value, ownerCount, totalXrpReserves);
          xrpBalanceField.value = (await client.getXrpBalance(address.value)) - totalXrpReserves.value;
     } catch (error) {
          console.error('Error:', error);
          setError('ERROR: ' + (error.message || 'Unknown error'));
     } finally {
          if (spinner) spinner.style.display = 'none';
          totalExecutionTime.value = Date.now() - startTime;
          console.log(`Leaving getTickets in ${totalExecutionTime.value}ms`);
     }
}

export async function createTicket() {
     console.log('Entering createTicket');
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
          address: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          ticketCount: document.getElementById('ticketCountField'),
          // finishUnit: document.getElementById('checkExpirationTime'), // Reused for Ticket expiration
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

     const { address, seed, ticketCount, balance, ownerCount, totalXrpReserves, totalExecutionTime } = fields;

     // Validate input values
     const validations = [
          [!validatInput(address.value), 'Address cannot be empty'],
          [!validatInput(seed.value), 'Seed cannot be empty'],
          [!validatInput(ticketCount.value), 'Ticket count cannot be empty'],
          [isNaN(ticketCount.value), 'Ticket count must be a valid number'],
          [parseInt(ticketCount.value) <= 0, 'Ticket count must be a positive number'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.innerHTML = `Connected to ${environment} ${net}\nCreating Ticket\n\n`;

          let wallet;
          if (seed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (seed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(seed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

          const tx = await client.autofill({
               TransactionType: 'TicketCreate',
               Account: wallet.classicAddress,
               TicketCount: parseInt(ticketCount.value),
          });

          console.log(`tx ${JSON.stringify(tx, null, 2)}`);
          const response = await client.submitAndWait(tx, { wallet });
          console.log('Response', response);

          const resultCode = response.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               renderTransactionDetails(response);
               resultField.classList.add('error');
          }

          resultField.innerHTML += `Ticket(s) created successfully.\n\n`;

          renderTransactionDetails(response);
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.address, ownerCount, totalXrpReserves);
          balance.value = (await client.getXrpBalance(wallet.address)) - totalXrpReserves.value;
     } catch (error) {
          console.error('Error:', error);
          setError('ERROR: ' + (error.message || 'Unknown error'));
     } finally {
          if (spinner) spinner.style.display = 'none';
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving createTicket in ${now}ms`);
     }
}

export async function useTicket() {
     console.log('Entering useTicket');
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

     if (tokenBalance && tokenBalance.value !== EMPTY_STRING) {
          const balance = Number(tokenBalance.value);
          if (isNaN(balance)) {
               return setError('ERROR: Token balance must be a number', spinner);
          }
          if (balance <= 0) {
               return setError('ERROR: Token balance must be greater than 0', spinner);
          }
     }

     if (issuerField && tokenBalance.value !== EMPTY_STRING && Number(tokenBalance.value) > 0 && issuerField.value === EMPTY_STRING) {
          return setError('ERROR: Issuer cannot be empty when sending a token', spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.innerHTML = `Connected to ${environment} ${net}\nUsing Ticket\n\n`;

          let wallet;
          if (seed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (seed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(seed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

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

          resultField.innerHTML += `Sending ${amount.value} ${currency.value} using Ticket Sequence ${ticketSequence.value}\n`;

          const response = await client.submitAndWait(tx, { wallet });
          console.log('Response:', response);

          const resultCode = response.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               renderTransactionDetails(response);
               resultField.classList.add('error');
          }

          resultField.innerHTML += `Payment sent successfully using Ticket.\n\n`;
          resultField.innerHTML += `Ticket(s) created successfully.\n\n`;

          renderTransactionDetails(response);
          resultField.classList.add('success');

          if (currency.value !== XRP_CURRENCY) {
               await getTokenBalance();
          }

          await updateOwnerCountAndReserves(client, wallet.address, ownerCount, totalXrpReserves);
          balance.value = (await client.getXrpBalance(wallet.address)) - totalXrpReserves.value;
     } catch (error) {
          console.error('Error:', error);
          setError('ERROR: ' + (error.message || 'Unknown error'));
     } finally {
          if (spinner) spinner.style.display = 'none';
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving useTicket in ${now}ms`);
     }
}

export async function cancelTicket() {
     console.log('Entering cancelTicket');
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

          resultField.innerHTML = `Connected to ${environment} ${net}\nCancelling Ticket\n\n`;

          let wallet;
          if (seed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (seed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(seed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

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
          resultField.innerHTML += `Ticket Sequence ${ticketSequence.value} exists. It will be released upon expiration or use in a transaction.\n`;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.address, ownerCount, totalXrpReserves);
          balance.value = (await client.getXrpBalance(wallet.address)) - totalXrpReserves.value;
     } catch (error) {
          console.error('Error:', error);
          setError('ERROR: ' + (error.message || 'Unknown error'));
     } finally {
          if (spinner) spinner.style.display = 'none';
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

          let wallet;
          if (seed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (seed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(seed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

          const gatewayBalances = await client.request({
               command: 'gateway_balances',
               account: wallet.classicAddress,
               ledger_index: 'validated',
          });

          console.log('gatewayBalances', gatewayBalances);

          let tokenTotal = 0;
          issuerField.innerHTML = EMPTY_STRING;

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
     } finally {
          if (spinner) spinner.style.display = 'none';
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving getTokenBalance in ${now}ms`);
     }
}

async function displayTicketDataForAccount1() {
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
     destinationField.value = account2address.value;
     amountField.value = EMPTY_STRING;
     await getXrpBalance();
     await getTickets();
}

async function displayTicketDataForAccount2() {
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
     destinationField.value = account1address.value;
     amountField.value = EMPTY_STRING;
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
window.disconnectClient = disconnectClient;
window.gatherAccountInfo = gatherAccountInfo;
window.clearFields = clearFields;
window.distributeAccountInfo = distributeAccountInfo;
