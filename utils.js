import * as xrpl from 'xrpl';
import { generate, derive } from 'xrpl-accountlib';
import { saveInputValues } from './local-storage';
import { getAccountInfo } from './account';

const EMPTY_STRING = '';
let clientInstance = null;
let isConnecting = false;

export function getEnvironment() {
     let environment;
     if (document.getElementById('tn').checked) {
          environment = 'Testnet';
     }

     if (document.getElementById('dn').checked) {
          environment = 'Devnet';
     }

     if (document.getElementById('mn').checked) {
          environment = 'Mainnet';
     }
     return { environment };
}

export function getNet() {
     let net;
     let environment;
     if (document.getElementById('tn').checked) {
          net = 'wss://s.altnet.rippletest.net:51233/';
          environment = 'Testnet';
     }

     if (document.getElementById('dn').checked) {
          net = 'wss://s.devnet.rippletest.net:51233/';
          environment = 'Devnet';
     }

     if (document.getElementById('mn').checked) {
          net = 'wss://s1.ripple.com_not';
          environment = 'Mainnet';
     }
     return { net, environment };
}

export async function getClient() {
     const { net, environment } = getNet();

     if (clientInstance?.isConnected()) {
          return clientInstance;
     }

     if (isConnecting) {
          // Wait for existing connection attempt to complete
          while (isConnecting) {
               await new Promise(resolve => setTimeout(resolve, 100));
          }
          return clientInstance;
     }

     try {
          isConnecting = true;
          clientInstance = new xrpl.Client(net);
          console.log('Connecting to XRP Ledger ' + environment);
          await clientInstance.connect();
          console.log('Connected to XRP Ledger ' + environment);
          return clientInstance;
     } catch (error) {
          console.error('Failed to connect to XRP Ledger:', error);
          clientInstance = null;
          throw error;
     } finally {
          isConnecting = false;
     }
}

export async function disconnectClient() {
     if (clientInstance?.isConnected()) {
          try {
               await clientInstance.disconnect();
               console.log('Disconnected from XRP Ledger');
          } catch (error) {
               console.error('Error disconnecting from XRP Ledger:', error);
          } finally {
               clientInstance = null;
          }
     }
}

// Helper to convert an XRPL amount to a string for display
export function amt_str(amt) {
     if (typeof amt == 'string') {
          return `${xrpl.dropsToXrp(amt)} XRP`;
     } else {
          return `${amt.value} ${amt.currency}.${amt.issuer}`;
     }
}

if (typeof window !== 'undefined') {
     window.addEventListener('beforeunload', async () => {
          await disconnectClient();
     });
}

export function addSeconds(numOfSeconds, date = new Date()) {
     date.setSeconds(date.getSeconds() + numOfSeconds);
     date = Math.floor(date / 1000);
     date = date - 946684800;

     return date;
}

export function convertToEstTime(UtcDataTime) {
     const utcDate = new Date(UtcDataTime);
     const formattedEDT = utcDate.toLocaleString('en-US', {
          timeZone: 'America/New_York',
          timeZoneName: 'short',
     });

     console.log(formattedEDT); // Should output: "5/19/2025, 11:11:21 PM EDT"
     return formattedEDT;
}

export async function getOnlyTokenBalance(client, wallet, currency) {
     try {
          const lines = await client.request({
               command: 'account_lines',
               account: wallet,
          });
          const tstLines = lines.result.lines.filter(line => line.currency === currency);
          const tstBalance = tstLines.reduce((sum, line) => sum + parseFloat(line.balance), 0);
          return tstBalance;
     } catch (error) {
          log.error('Error fetching token balance:', error);
          return 0;
     }
}

export async function getXrpBalance(accountField, balanceField) {
     let accountAddressField = document.getElementById('accountAddressField');
     if (accountAddressField == null) {
          accountAddressField = document.getElementById(accountField);
     }

     let xrpBalanceField = document.getElementById('xrpBalanceField');
     if (xrpBalanceField == null) {
          xrpBalanceField = document.getElementById(balanceField);
     }

     if (!accountAddressField || !xrpBalanceField) {
          console.error('DOM elements not found');
          return;
     }

     const client = await getClient();
     const retries = 10;
     const delayMs = 2000;

     try {
          for (let i = 0; i < retries; i++) {
               try {
                    const balance = await client.getXrpBalance(accountAddressField.value);
                    console.log(`Account ${accountAddressField.value} is funded. Balance: ${balance} XRP`);
                    xrpBalanceField.value = balance;
                    break;
               } catch (err) {
                    if (err.message.includes('Account not found')) {
                         console.log(`Waiting for account ${accountAddressField.value} to be activated`);
                         await new Promise(res => setTimeout(res, delayMs));
                    } else {
                         throw err;
                    }
               }
          }
     } catch (error) {
          console.error('Error:', error);
          xrpBalanceField.value = error.message || 'Unknown error';
          await disconnectClient();
     } finally {
          console.log('Leaving getXrpBalance');
     }
}

export async function getCurrentLedger(client) {
     // Get the current ledger index from the client
     const ledger_info = await client.request({
          command: 'ledger',
          ledger_index: 'current',
     });
     return ledger_info.result.ledger_current_index;
}

export function clearFields() {
     localStorage.removeItem('account1name');
     localStorage.removeItem('account2name');
     localStorage.removeItem('issuerName');

     localStorage.removeItem('account1address');
     localStorage.removeItem('account2address');
     localStorage.removeItem('issuerAddress');

     localStorage.removeItem('account1seed');
     localStorage.removeItem('account2seed');
     localStorage.removeItem('issuerSeed');

     localStorage.removeItem('account1mnemonic');
     localStorage.removeItem('account2mnemonic');
     localStorage.removeItem('issuerMnemonic');

     localStorage.removeItem('account1secretNumbers');
     localStorage.removeItem('account2secretNumbers');
     localStorage.removeItem('issuerSecretNumbers');

     document.getElementById('theForm').reset();

     const account1addressField = document.getElementById('account1address');
     const seed1Field = document.getElementById('account1seed');

     const account2addressField = document.getElementById('account2address');
     const seed2Field = document.getElementById('account2seed');

     const mnemonic1Field = document.getElementById('account1mnemonic');
     const mnemonic2Field = document.getElementById('account2mnemonic');

     const secretNumbers1Field = document.getElementById('account1secretNumbers');
     const secretNumbers2Field = document.getElementById('account2secretNumbers');

     if (document.getElementById('issuerName')) {
          const issuerNameField = document.getElementById('issuerName');
          const issuerAddressField = document.getElementById('issuerAddress');
          const issuerSeedField = document.getElementById('issuerSeed');

          issuerNameField.value = '';
          issuerAddressField.value = '';
          issuerSeedField.value = '';
     }

     account1addressField.value = '';
     seed1Field.value = '';
     account2addressField.value = '';
     seed2Field.value = '';
     mnemonic1Field.value = '';
     mnemonic2Field.value = '';
     secretNumbers1Field.value = '';
     secretNumbers2Field.value = '';
}

export function clearSecretNumberFields() {
     const secretNumbers1Field = document.getElementById('account1secretNumbers');
     const secretNumbers2Field = document.getElementById('account2secretNumbers');
     secretNumbers1Field.value = '';
     secretNumbers2Field.value = '';
}

export function clearMnemonicFields() {
     const mnemonic1Field = document.getElementById('account1mnemonic');
     const mnemonic2Field = document.getElementById('account2mnemonic');
     mnemonic1Field.value = '';
     mnemonic2Field.value = '';
}

async function fundNewWallet(wallet) {
     const { environment } = getEnvironment();

     if (environment === 'Mainnet') {
          console.warn('Not funding mainnet account');
          return;
     }

     try {
          const client = await getClient();
          let faucetHost = null;
          const fundingWallet = (await client.fundWallet(null, { faucetHost })).wallet;
          const newAccount = [fundingWallet.address, fundingWallet.seed];
          // const fundingWallet = await fundWallet();
          // const newAccount = [fundingWallet.account, fundingWallet.seed]
          console.log('New account', newAccount);
          sendXRPtoNewWallet(fundingWallet, wallet);
     } catch (error) {
          console.error('Error:', error);
          addressInput.value = 'Error';
          seedInput.value = error.message || 'Unknown error';
     } finally {
          console.log('Leaving fundNewWallet');
     }
}

async function sendXRPtoNewWallet(fundingWallet, wallet) {
     const { environment } = getEnvironment();

     if (environment === 'Mainnet') {
          console.warn('Not funding mainnet account');
          return;
     }

     try {
          const client = await getClient();
          const sendAmount = 90;
          const prepared_tx = await client.autofill({
               TransactionType: 'Payment',
               Account: fundingWallet.classicAddress,
               Amount: xrpl.xrpToDrops(sendAmount),
               Destination: wallet.address,
          });
          const signed = fundingWallet.sign(prepared_tx);
          const tx = await client.submitAndWait(signed.tx_blob);
          console.log('tx', tx.result);
     } catch (error) {
          console.error('Error:', error);
          addressInput.value = 'Error';
          seedInput.value = error.message || 'Unknown error';
     } finally {
          console.log('Leaving sendXRPtoNewWallet');
     }
}

export async function generateNewWallet(walletNumber) {
     let addrField = '';
     let seedField = '';
     if (walletNumber == 3) {
          addrField = 'issuerAddress';
          seedField = 'issuerSeed';
     } else {
          addrField = 'account' + walletNumber + 'address';
          seedField = 'account' + walletNumber + 'seed';
     }
     const addressInput = document.getElementById(addrField);
     const seedInput = document.getElementById(seedField);

     if (!addressInput || !seedInput) {
          console.error('DOM elements not found');
          return;
     }

     addressInput.value = 'Generating';
     seedInput.value = '';

     try {
          const account = generate.familySeed();
          console.log('Generated account:', account);

          addressInput.value = account.address || 'No address generated';
          seedInput.value = account.secret?.familySeed || '';

          await fundNewWallet(account);
          console.log('Funded wallet complete');
     } catch (error) {
          console.error('Error:', error);
          addressInput.value = 'Error';
          seedInput.value = error.message || 'Unknown error';
     } finally {
          console.log('Leaving generateNewWallet');
     }
}

export const fundWallet = async () => {
     try {
          const res = await fetch('http://localhost:3001/api/fund-wallet', {
               method: 'POST',
               headers: {
                    'Content-Type': 'application/json',
               },
          });

          if (!res.ok) throw new Error('Failed to fetch wallet');

          const data = await res.json();
          console.log('New funded wallet:', data);
          return data;
          // You can use data.account.address and data.account.secret
     } catch (err) {
          console.error('Error funding wallet:', err);
     }
};

export async function generateNewWalletFromMnemonic(walletNumber) {
     let addrField = 'account' + walletNumber + 'address';
     let seedField = 'account' + walletNumber + 'seed';
     let mnemonicField = 'account' + walletNumber + 'mnemonic';
     const addressInput = document.getElementById(addrField);
     const seedInput = document.getElementById(seedField);
     const mnemonic = document.getElementById(mnemonicField);

     if (!addressInput || !seedInput || !mnemonic) {
          console.error('DOM elements not found');
          return;
     }

     addressInput.value = 'Generating';
     seedInput.value = '';

     try {
          const account_with_mnemonic = generate.mnemonic();
          console.log('Generated wallet:', account_with_mnemonic);
          addressInput.value = account_with_mnemonic.address || 'No address generated';
          mnemonic.value = account_with_mnemonic.secret?.mnemonic || '';

          await fundNewWallet(account_with_mnemonic);
          console.log('Funded wallet complete');

          clearSecretNumberFields();
     } catch (error) {
          console.error('Error:', error);
          addressInput.value = 'Error';
          seedInput.value = error.message || 'Unknown error';
     } finally {
          console.log('Leaving generateNewWalletFromMnemonic');
     }
}

export async function generateNewWalletFromSecretNumbers(walletNumber) {
     let addrField = 'account' + walletNumber + 'address';
     let seedField = 'account' + walletNumber + 'seed';
     let secretNumbersField = 'account' + walletNumber + 'secretNumbers';
     const addressInput = document.getElementById(addrField);
     const seedInput = document.getElementById(seedField);
     const secretNumbers = document.getElementById(secretNumbersField);

     if (!addressInput || !seedInput || !secretNumbers) {
          console.error('DOM elements not found');
          return;
     }

     addressInput.value = 'Generating';
     seedInput.value = '';

     try {
          const account_with_secret_numbers = generate.secretNumbers();
          console.log('Generated wallet:', account_with_secret_numbers);
          addressInput.value = account_with_secret_numbers.address || 'No address generated';
          secretNumbers.value = account_with_secret_numbers.secret?.secretNumbers || 'No secret numbers generated';
          seedInput.value = account_with_secret_numbers.secret?.familySeed || 'No seed generated';

          await fundNewWallet(account_with_secret_numbers);
          console.log('Funded wallet complete');

          clearMnemonicFields();
     } catch (error) {
          console.error('Error:', error);
          addressInput.value = 'Error';
          seedInput.value = error.message || 'Unknown error';
     } finally {
          console.log('Leaving generateNewWalletFromSecretNumbers');
     }
}

export async function getAccountFromSeed(walletNumber) {
     let addrField = 'account' + walletNumber + 'address';
     let seedField = 'account' + walletNumber + 'seed';
     const addressInput = document.getElementById(addrField);
     const seedInput = document.getElementById(seedField);

     if (!addressInput || !seedInput) {
          console.error('DOM elements not found');
          return;
     }

     addressInput.value = 'Generating';

     try {
          const derive_account_with_family_seed = derive.familySeed(seedInput.value);
          console.log('derive_account_with_family_seed:', derive_account_with_family_seed);
          addressInput.value = derive_account_with_family_seed.address || 'No address generated';
          seedInput.value = derive_account_with_family_seed.secret?.familySeed || '';
     } catch (error) {
          console.error('Error:', error);
          addressInput.value = 'Error';
          seedInput.value = error.message || 'Unknown error';
     } finally {
          console.log('Leaving getAccountFromSeed');
     }
}

export async function getAccountFromMnemonic(walletNumber) {
     let addrField = 'account' + walletNumber + 'address';
     let seedField = 'account' + walletNumber + 'seed';
     let mnemonicField = 'account' + walletNumber + 'mnemonic';
     const addressInput = document.getElementById(addrField);
     const seedInput = document.getElementById(seedField);
     const mnemonic = document.getElementById(mnemonicField);

     if (!addressInput || !seedInput || !mnemonic) {
          console.error('DOM elements not found');
          return;
     }

     addressInput.value = 'Generating';

     try {
          const derive_account_with_mnemonic = derive.mnemonic(mnemonic.value);
          console.log('derive_account_with_mnemonic:', derive_account_with_mnemonic);

          addressInput.value = derive_account_with_mnemonic.address || 'No address generated';
          seedInput.value = derive_account_with_mnemonic.secret?.familySeed || '';
          mnemonic.value = derive_account_with_mnemonic.secret?.mnemonic;
     } catch (error) {
          console.error('Error:', error);
          addressInput.value = 'Error';
          seedInput.value = error.message || 'Unknown error';
     } finally {
          console.log('Leaving getAccountFromMnemonic');
     }
}

export async function getAccountFromSecretNumbers(walletNumber) {
     let addrField = 'account' + walletNumber + 'address';
     let seedField = 'account' + walletNumber + 'seed';
     let secretNumbersField = 'account' + walletNumber + 'secretNumbers';
     const addressInput = document.getElementById(addrField);
     const seedInput = document.getElementById(seedField);
     const secretNumbers = document.getElementById(secretNumbersField);

     if (!addressInput || !seedInput || !secretNumbers) {
          console.error('DOM elements not found');
          return;
     }

     addressInput.value = 'Generating';

     try {
          const derive_account_with_secret_numbers = derive.secretNumbers(secretNumbers.value);
          console.log('derive_account_with_secret_numbers:', derive_account_with_secret_numbers);

          addressInput.value = derive_account_with_secret_numbers.address || 'No address generated';
          seedInput.value = derive_account_with_secret_numbers.secret?.familySeed || '';
          secretNumbers.value = derive_account_with_secret_numbers.secret?.secretNumbers;
     } catch (error) {
          console.error('Error:', error);
          addressInput.value = 'Error';
          seedInput.value = error.message || 'Unknown error';
     } finally {
          console.log('Leaving getAccountFromSecretNumbers');
     }
}

export function gatherAccountInfo() {
     let accountData = account1name.value + '\n' + account1address.value + '\n' + account1seed.value + '\n';
     accountData += account2name.value + '\n' + account2address.value + '\n' + account2seed.value + '\n';
     if (document.getElementById('issuerName')) {
          accountData += issuerName.value + '\n' + issuerAddress.value + '\n' + issuerSeed.value + '\n';
     }
     resultField.value = accountData;
}

export function distributeAccountInfo() {
     let accountInfo = resultField.value.split('\n');
     account1name.value = accountInfo[0];
     account1address.value = accountInfo[1];
     account1seed.value = accountInfo[2];
     account2name.value = accountInfo[3];
     account2address.value = accountInfo[4];
     account2seed.value = accountInfo[5];
     if (accountInfo.length >= 9) {
          issuerName.value = accountInfo[6];
          issuerAddress.value = accountInfo[7];
          issuerSeed.value = accountInfo[8];
     }
     saveInputValues();
}

export function parseOffersTransactionDetails(response) {
     if (response) {
          // Map the response to extract transaction details for each offer
          const transactionDetails = response.map(item => ({
               flags: item.Flags || 'N/A',
               quality: item.quality || 'N/A',
               takerGets: item.taker_gets || 'N/A',
               takerPays: item.taker_pays || 'N/A',
               sequence: item.seq || 'N/A', // No date field in account_objects
          }));

          // Format each offer's details into a string
          const formattedOffers = transactionDetails.map((offer, index) =>
               `
               Offer ${index + 1}:
               Flags: ${offer.flags}
               Quality: ${offer.quality}
               Taker Gets: ${typeof offer.takerGets === 'object' ? JSON.stringify(offer.takerGets) : offer.takerGets}
               Taker Pays: ${typeof offer.takerPays === 'object' ? JSON.stringify(offer.takerPays) : offer.takerPays}
               Sequence: ${offer.sequence}
          `.trim()
          );

          // Combine all formatted offers into a single string
          console.log('formattedOffers', formattedOffers);
          if (formattedOffers.length == 0) {
               return 'No offers';
          } else {
               return `\nTransaction Details:\n${formattedOffers.join('\n\n')}`.trim();
          }
     }
}

export function parseAccountFlagsDetails(response) {
     if (response) {
          // Extract specific fields from the response
          const transactionDetails = {
               allowTrustLineClawback: response.allowTrustLineClawback || 'false',
               defaultRipple: response.defaultRipple || 'false',
               depositAuth: response.depositAuth || 'false',
               disableMasterKey: response.disableMasterKey || 'false',
               disallowIncomingCheck: response.disallowIncomingCheck || 'false',
               disallowIncomingNFTokenOffer: response.disallowIncomingNFTokenOffer || 'false',
               disallowIncomingPayChan: response.disallowIncomingPayChan || 'false',
               disallowIncomingTrustline: response.disallowIncomingTrustline || 'false',
               disallowIncomingXRP: response.disallowIncomingXRP || 'false',
               globalFreeze: response.globalFreeze || 'false',
               noFreeze: response.noFreeze || 'false',
               passwordSpent: response.passwordSpent || 'false',
               requireAuthorization: response.requireAuthorization || 'false',
               requireDestinationTag: response.requireDestinationTag || 'false',
          };

          // Format the details into a string
          return (
               `Flag Details: 
    Allow Trust Line Clawback: ${transactionDetails.allowTrustLineClawback}
    Default Ripple: ${transactionDetails.defaultRipple}
    Deposit Authorization: ${transactionDetails.depositAuth}
    Disable Master Key: ${transactionDetails.disableMasterKey}
    Disallow Incoming Check: ${transactionDetails.disallowIncomingCheck}
    Disallow Incoming NFToken Offer: ${transactionDetails.disallowIncomingNFTokenOffer}
    Disallow Incoming Payment Channel: ${transactionDetails.disallowIncomingPayChan}
    Disallow Incoming Trust Line: ${transactionDetails.disallowIncomingTrustline}
    Disallow Incoming XRP: ${transactionDetails.disallowIncomingXRP}
    Global Freeze: ${transactionDetails.globalFreeze}
    No Freeze: ${transactionDetails.noFreeze}
    Password Spent: ${transactionDetails.passwordSpent}
    Require Authorization: ${transactionDetails.requireAuthorization}
    Require Destination Tag: ${transactionDetails.requireDestinationTag}`.trim() + '\n'
          );
     }
}

export function parseTransactionDetails(response) {
     if (response.account_objects) {
          return response.account_objects.map(item => ({
               account: item.Account || 'N/A',
               receiver: item.Destination || 'N/A',
               flags: item.Flags || 'N/A',
               LedgerEntryType: item.LedgerEntryType || 'N/A',
               amountXRP: item.SendMax ? parseFloat(item.SendMax) : item.Amount ? parseInt(item.Amount) / 1000000 : 'N/A',
               PreviousTxnID: item.PreviousTxnID || 'N/A', // No result field in account_objects
               // PreviousTxnLgrSeq: item.PreviousTxnLgrSeq ||  "N/A", // No fee field in account_objects
               Sequence: item.Sequence || 'N/A', // No date field in account_objects
               index: item.index || 'N/A',
          }));
     } else {
          // Extract specific fields from the response
          const transactionDetails = {
               hash: response.hash || 'N/A', // Fallback if field is missing
               sender: response.tx_json.Account || 'N/A',
               receiver: response.tx_json.Destination || 'N/A',
               amountXRP: response.meta.delivered_amount ? parseInt(response.meta.delivered_amount) / 1000000 : response.tx_json.SendMax ? parseInt(response.tx_json.SendMax) / 1000000 : 'N/A', // Convert drops to XRP
               result: response.meta.TransactionResult || 'N/A',
               transactionType: response.tx_json.TransactionType || 'N/A',
               fee: response.tx_json.Fee ? parseInt(response.tx_json.Fee) / 1000000 : 'N/A', // Convert drops to XRP
               date: convertToEstTime(response.close_time_iso) || 'N/A',
               ledgerIndex: response.ledger_index || 'N/A',
               Sequence: response.tx_json.Sequence || 'N/A',
          };

          // Format the details into a string
          return `Transaction Details: 
          Hash: ${transactionDetails.hash}
          Sender: ${transactionDetails.sender}
          Receiver: ${transactionDetails.receiver}
          Amount: ${transactionDetails.amountXRP} XRP
          Result: ${transactionDetails.result}
          Fee: ${transactionDetails.fee} XRP
          Transaction Type: ${transactionDetails.transactionType}
          Sequence: ${transactionDetails.Sequence}
          Date: ${transactionDetails.date}
          Ledger Index: ${transactionDetails.ledgerIndex}`.trim(); // .trim() removes leading/trailing whitespace
     }
}

export function displayTransactions(transactions) {
     if (transactions.length == 0) {
          return 'No transactions';
     }

     let formattedArray = [];
     let formatted = '';

     transactions.forEach((item, index) => {
          // Construct the formatted string for each transaction
          formatted = `Check Details:
          Account: ${item.account},
          Destination: ${item.receiver},
          Flags: ${item.flags},
          LedgerEntryType: ${item.LedgerEntryType},
          PreviousTxnID: ${item.PreviousTxnID},
          Send Max: ${formatXRPAmount(item.amountXRP)},
          Ledger Index: ${item.index},
          Sequence: ${item.Sequence}`.trim();

          formattedArray.push(formatted);
          formattedArray.push('\n');
     });
     return formattedArray;
}

function formatXRPAmount(amountXRP) {
     // Check for null, undefined, or non-numeric values
     if (amountXRP == null || isNaN(amountXRP)) {
          console.warn(`Invalid amountXRP: ${amountXRP}`);
          return 'Invalid amount';
     }

     return `${amountXRP} XRP`;
     // return `${xrpl.dropsToXrp(amountXRP)} XRP`;
}

export function parseBalanceChanges(response) {
     // Ensure response is an array and has at least one entry
     if (!Array.isArray(response) || response.length === 0) {
          return 'Balance Changes: No data available';
     }

     // Initialize the result string
     let result = 'Balance Changes:\n';

     // Loop through each account's balance changes
     response.forEach((entry, index) => {
          const account = entry.account || 'N/A';
          const balances = Array.isArray(entry.balances) && entry.balances.length > 0 ? entry.balances[0] : { currency: 'N/A', value: 'N/A' };

          const currency = balances.currency || 'N/A';
          const value = balances.value !== undefined ? parseFloat(balances.value).toFixed(6) : 'N/A';

          // Add the account's balance change to the result string
          result += `Account ${index + 1}:\n`;
          result += `  Address: ${account}\n`;
          result += `  Currency: ${currency}\n`;
          result += `  Balance Change: ${value} ${currency}\n`;
     });

     return result.trim(); // Remove leading/trailing whitespace
}

export async function populateAccount1Only() {
     accountName1Field.value = account1name.value;
     accountAddress1Field.value = account1address.value;
     accountSeed1Field.value = account1seed.value;
     getXrpBalance('accountAddress1Field', 'xrpBalance1Field');
     await getAccountInfo();
}

export async function populateAccount2Only() {
     accountName2Field.value = account2name.value;
     accountAddress2Field.value = account2address.value;
     accountSeed2Field.value = account2seed.value;
     getXrpBalance('accountAddress2Field', 'xrpBalance2Field');
     await getAccountInfo();
}

export async function populateTakerGetsTakerPayFields() {
     accountNameField.value = account1name.value;
     accountAddressField.value = account1address.value;
     accountSeedField.value = account1seed.value;

     const account2addressField = document.getElementById('account2address');
     if (validatInput(account2addressField)) {
          document.getElementById('weWantIssuerField').value = account2addressField.value;
     }

     document.getElementById('weWantAmountField').value = '1';
     document.getElementById('weSpendCurrencyField').value = 'XRP';
     document.getElementById('weSpendAmountField').value = '1';

     getXrpBalance();
     await getAccountInfo();
}

export async function populate1() {
     accountNameField.value = account1name.value;
     accountAddressField.value = account1address.value;
     accountSeedField.value = account1seed.value;

     const destinationField = document.getElementById('destinationField');
     if (validatInput(destinationField)) {
          destinationField.value = account2address.value;
     }

     const escrowOwnerField = document.getElementById('escrowOwnerField');
     if (validatInput(escrowOwnerField)) {
          escrowOwnerField.value = account1address.value;
     }

     const issuerField = document.getElementById('issuerField');
     if (validatInput(issuerField)) {
          issuerField.value = account2address.value;
          destinationField.value = '';
     }
     getXrpBalance();
     await getAccountInfo();
}

export async function populate2() {
     accountNameField.value = account2name.value;
     accountAddressField.value = account2address.value;
     accountSeedField.value = account2seed.value;

     const destinationField = document.getElementById('destinationField');
     if (validatInput(destinationField)) {
          destinationField.value = account1address.value;
     }

     const escrowOwnerField = document.getElementById('escrowOwnerField');
     if (validatInput(escrowOwnerField)) {
          escrowOwnerField.value = account2address.value;
     }

     const issuerField = document.getElementById('issuerField');
     if (validatInput(issuerField)) {
          issuerField.value = account1address.value;
          destinationField.value = '';
     }

     getXrpBalance();
     await getAccountInfo();
}

export async function populate3() {
     accountNameField.value = issuerName.value;
     accountAddressField.value = issuerAddress.value;
     accountSeedField.value = issuerSeed.value;
     // destinationField.value = account1address.value

     const escrowOwnerField = document.getElementById('escrowOwnerField');
     if (validatInput(escrowOwnerField)) {
          escrowOwnerField.value = issuerAddress.value;
     }

     const issuerField = document.getElementById('issuerField');
     if (validatInput(issuerField)) {
          issuerField.value = account1address.value;
     }

     const destinationField = document.getElementById('destinationField');
     if (validatInput(destinationField)) {
          destinationField.value = '';
     }

     getXrpBalance();
     await getAccountInfo();
}

export function validatInput(value) {
     return !!(value !== null && value !== undefined && value !== '');
}

export function setError(message) {
     resultField.value = message;
     resultField.classList.add('error');
}

export function convertXRPLTime(rippleTime) {
     // Convert Ripple time (seconds since Jan 1, 2000) to UTC datetime
     const rippleEpoch = 946684800; // Jan 1, 2000 in Unix time
     const date = new Date((rippleTime + rippleEpoch) * 1000);
     // Format the date in EST (America/New_York handles EST/EDT automatically)
     const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York', // EST/EDT
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true, // Use 24-hour format; set to true for 12-hour with AM/PM
          timeZoneName: 'short', // Includes EST or EDT
     });

     return formatter.format(date);
}

export function formatXRPLAmount(drops) {
     // Convert XRP drops to XRP (1 XRP = 1,000,000 drops)
     return `${(parseInt(drops) / 1_000_000).toFixed(6)} XRP`;
}

export function parseXRPLTransaction(tx) {
     // Extract key transaction details
     const txJson = tx.tx_json || {};
     const meta = tx.meta || {};

     const txDetails = {
          'Transaction Type': txJson.TransactionType || 'N/A',
          'Transaction Hash': tx.hash || 'N/A',
          'Ledger Index': tx.ledger_index || 'N/A',
          'Close Time': tx.close_time_iso || 'N/A',
          Account: txJson.Account || 'N/A',
          Destination: txJson.Destination || 'N/A',
          Amount: formatXRPLAmount(txJson.Amount || '0'),
          Fee: formatXRPLAmount(txJson.Fee || '0'),
          Sequence: txJson.Sequence || 'N/A',
          'Transaction Result': meta.TransactionResult || 'N/A',
          Validated: tx.validated || false,
          'Finish After': txJson.FinishAfter ? convertXRPLTime(txJson.FinishAfter) : 'N/A',
          'Cancel After': txJson.CancelAfter ? convertXRPLTime(txJson.CancelAfter) : 'N/A',
     };

     // Extract affected nodes (e.g., account changes)
     const affectedNodes = meta.AffectedNodes || [];
     const accountChanges = [];
     for (const node of affectedNodes) {
          if (node.ModifiedNode && node.ModifiedNode.LedgerEntryType === 'AccountRoot') {
               const modNode = node.ModifiedNode;
               const finalFields = modNode.FinalFields || {};
               const prevFields = modNode.PreviousFields || {};
               accountChanges.push({
                    Account: finalFields.Account || 'N/A',
                    BalanceChange: formatXRPLAmount((parseInt(finalFields.Balance || 0) - parseInt(prevFields.Balance || 0)).toString()),
                    OwnerCountChange: (finalFields.OwnerCount || 0) - (prevFields.OwnerCount || 0),
                    SequenceChange: (finalFields.Sequence || 0) - (prevFields.Sequence || 0),
               });
          } else if (node.CreatedNode && node.CreatedNode.LedgerEntryType === 'Escrow') {
               const escrowNode = node.CreatedNode.NewFields || {};
               txDetails['Escrow Details'] = {
                    'Escrow Amount': formatXRPLAmount(escrowNode.Amount || '0'),
                    Destination: escrowNode.Destination || 'N/A',
                    'Finish After': convertXRPLTime(escrowNode.FinishAfter || 0),
                    'Cancel After': convertXRPLTime(escrowNode.CancelAfter || 0),
               };
          }
     }

     return { txDetails, accountChanges };
}

export function displayTransaction({ txDetails, accountChanges }) {
     // Initialize an array to build the output string
     let output = ['=== XRPL Transaction Details ==='];

     // Format transaction details
     for (const [key, value] of Object.entries(txDetails)) {
          if (key === 'Escrow Details') {
               output.push(`\n${key}:`);
               for (const [subKey, subValue] of Object.entries(value)) {
                    output.push(`    ${subKey}: ${subValue}`);
               }
          } else {
               output.push(`    ${key}: ${value}`);
          }
     }

     // Format affected accounts
     output.push('\n=== Affected Accounts ===');
     for (const change of accountChanges) {
          output.push(`    Account: ${change.Account}`);
          output.push(`    Balance Change: ${change.BalanceChange}`);
          output.push(`    OwnerCount Change: ${change.OwnerCountChange}`);
          output.push(`    Sequence Change: ${change.SequenceChange}`);
          output.push(''); // Empty line for readability
     }

     // Join the array into a single string with newlines
     return output.join('\n');
}

// Mapping of LedgerEntryType to relevant fields and their formatting
const ledgerEntryTypeFields = {
     Escrow: {
          fields: [
               { key: 'Account', format: v => v || 'N/A' },
               { key: 'Amount', format: v => formatXRPLAmount(v || '0') },
               { key: 'Destination', format: v => v || 'N/A' },
               { key: 'CancelAfter', format: v => (v ? convertXRPLTime(v) : 'N/A') },
               { key: 'FinishAfter', format: v => (v ? convertXRPLTime(v) : 'N/A') },
               { key: 'Condition', format: v => v || 'N/A' },
               { key: 'PreviousTxnID', format: v => v || 'N/A' },
               { key: 'PreviousTxnLgrSeq', format: v => v || 'N/A' },
               { key: 'Index', format: v => v || 'N/A' },
          ],
          label: 'Escrow',
     },
     Offer: {
          fields: [
               { key: 'Account', format: v => v || 'N/A' },
               { key: 'TakerPays', format: v => (typeof v === 'object' ? `${v.value} ${v.currency}` : formatXRPLAmount(v || '0')) },
               { key: 'TakerGets', format: v => (typeof v === 'object' ? `${v.value} ${v.currency}` : formatXRPLAmount(v || '0')) },
               { key: 'Expiration', format: v => (v ? convertXRPLTime(v) : 'N/A') },
               { key: 'OfferSequence', format: v => v || 'N/A' },
               { key: 'PreviousTxnID', format: v => v || 'N/A' },
               { key: 'PreviousTxnLgrSeq', format: v => v || 'N/A' },
               { key: 'Index', format: v => v || 'N/A' },
          ],
          label: 'Offer',
     },
     RippleState: {
          fields: [
               { key: 'HighLimit', format: v => `${v.value} ${v.currency} (Issuer: ${v.issuer || 'N/A'})` },
               { key: 'LowLimit', format: v => `${v.value} ${v.currency} (Issuer: ${v.issuer || 'N/A'})` },
               { key: 'Balance', format: v => `${v.value} ${v.currency}` },
               { key: 'PreviousTxnID', format: v => v || 'N/A' },
               { key: 'PreviousTxnLgrSeq', format: v => v || 'N/A' },
               { key: 'Index', format: v => v || 'N/A' },
          ],
          label: 'Trustline',
     },
     PayChannel: {
          fields: [
               { key: 'Account', format: v => v || 'N/A' },
               { key: 'Destination', format: v => v || 'N/A' },
               { key: 'Amount', format: v => formatXRPLAmount(v || '0') },
               { key: 'Balance', format: v => formatXRPLAmount(v || '0') },
               { key: 'SettleDelay', format: v => v || 'N/A' },
               { key: 'Expiration', format: v => (v ? convertXRPLTime(v) : 'N/A') },
               { key: 'CancelAfter', format: v => (v ? convertXRPLTime(v) : 'N/A') },
               { key: 'PreviousTxnID', format: v => v || 'N/A' },
               { key: 'PreviousTxnLgrSeq', format: v => v || 'N/A' },
               { key: 'Index', format: v => v || 'N/A' },
          ],
          label: 'Payment Channel',
     },
     Check: {
          fields: [
               { key: 'Account', format: v => v || 'N/A' },
               { key: 'Destination', format: v => v || 'N/A' },
               { key: 'PreviousTxnID', format: v => v || 'N/A' },
               { key: 'PreviousTxnLgrSeq', format: v => v || 'N/A' },
               { key: 'SendMax', format: v => (typeof v === 'object' ? `${v.value} ${v.currency}` : formatXRPLAmount(v || '0')) },
               { key: 'Sequence', format: v => v || 'N/A' },
               { key: 'index', format: v => v || 'N/A' },
          ],
          label: 'Check',
     },
     DepositPreauth: {
          fields: [
               { key: 'Account', format: v => v || 'N/A' },
               { key: 'Authorize', format: v => v || 'N/A' },
               { key: 'PreviousTxnID', format: v => v || 'N/A' },
               { key: 'PreviousTxnLgrSeq', format: v => v || 'N/A' },
               { key: 'Index', format: v => v || 'N/A' },
          ],
          label: 'Deposit Preauthorization',
     },
     Ticket: {
          fields: [
               { key: 'Account', format: v => v || 'N/A' },
               { key: 'TicketSequence', format: v => v || 'N/A' },
               { key: 'PreviousTxnID', format: v => v || 'N/A' },
               { key: 'PreviousTxnLgrSeq', format: v => v || 'N/A' },
               { key: 'Index', format: v => v || 'N/A' },
          ],
          label: 'Ticket',
     },
};

// Parse the account objects response
export function parseXRPLAccountObjects(response) {
     const account = response.account || 'N/A';
     const ledgerIndex = response.ledger_index || 'N/A';
     const ledgerHash = response.ledger_hash || 'N/A';
     const validated = response.validated || false;

     // Identify all array fields in the response (e.g., account_objects, account_offers)
     const arrayFields = Object.keys(response).filter(key => Array.isArray(response[key]));
     console.log(`Array Fields Found: ${arrayFields.join(', ')}`);

     // Process each array field
     const formattedObjects = {};
     arrayFields.forEach(field => {
          const objects = response[field] || [];
          console.log(`Processing ${field}:`, objects);

          formattedObjects[field] = objects.map(obj => {
               // Use LedgerEntryType for account_objects, or assume Offer for account_offers
               const entryType = field === 'account_objects' ? obj.LedgerEntryType : field === 'account_offers' ? 'Offer' : obj.LedgerEntryType || 'Unknown';
               console.log('entryType' + entryType, ' field' + field);
               const typeConfig = ledgerEntryTypeFields[entryType] || {
                    fields: Object.keys(obj).map(key => {
                         console.log(`Key: ${key}, Value: ${obj[key] || 'N/A'}`);
                         return {
                              key,
                              format: v => (typeof v === 'object' ? JSON.stringify(v) : v || 'N/A'),
                         };
                    }),
                    label: entryType || 'Unknown',
               };

               const formattedDetails = {};
               typeConfig.fields.forEach(field => {
                    const value = obj[field.key];
                    console.log(`Key: ${field.key}, Value: ${value || 'N/A'}`);
                    formattedDetails[field.key] = field.format(value);
               });

               return {
                    type: typeConfig.label,
                    details: formattedDetails,
               };
          });
     });

     // General details for the response
     const details = {
          Account: account,
          'Ledger Index': ledgerIndex,
          'Ledger Hash': ledgerHash,
          Validated: validated,
          ...Object.fromEntries(arrayFields.map(field => [field, formattedObjects[field].length > 0 ? formattedObjects[field] : 'None'])),
     };

     return details;
}
// export function parseXRPLAccountObjects(response) {
//      const account = response.account || 'N/A';
//      const ledgerIndex = response.ledger_index || 'N/A';
//      const ledgerHash = response.ledger_hash || 'N/A';
//      const validated = response.validated || false;

//      // Extract and format account objects
//      const accountObjects = response.account_objects || [];
//      console.log(`accountObjects ${accountObjects}`);
//      const formattedObjects = accountObjects.map(obj => {
//           const typeConfig = ledgerEntryTypeFields[obj.LedgerEntryType] || {
//                fields: Object.keys(obj).map(key => {
//                     console.log(`Key: ${key}, Value: ${obj[key] || 'N/A'}`);
//                     return {
//                          key,
//                          format: v => v || 'N/A',
//                     };
//                }),
//                label: obj.LedgerEntryType || 'Unknown',
//           };

//           const formattedDetails = {};
//           typeConfig.fields.forEach(field => {
//                const value = obj[field.key];
//                console.log(`Key: ${field.key}, Value: ${value || 'N/A'}`); // Log for all types
//                formattedDetails[field.key] = field.format(value);
//           });

//           return {
//                type: typeConfig.label,
//                details: formattedDetails,
//           };
//      });
//      // const formattedObjects = accountObjects.map(obj => {
//      //      const typeConfig = ledgerEntryTypeFields[obj.LedgerEntryType] || {
//      //           fields: Object.keys(obj).map(key => ({
//      //                key,
//      //                format: v => v || 'N/A',
//      //           })),
//      //           label: obj.LedgerEntryType || 'Unknown',
//      //      };

//      //      const formattedDetails = {};
//      //      typeConfig.fields.forEach(field => {
//      //           formattedDetails[field.key] = field.format(obj[field.key]);
//      //      });

//      //      return {
//      //           type: typeConfig.label,
//      //           details: formattedDetails,
//      //      };
//      // });

//      // General details for the response
//      const details = {
//           Account: account,
//           'Ledger Index': ledgerIndex,
//           'Ledger Hash': ledgerHash,
//           Validated: validated,
//           'Account Objects': formattedObjects.length > 0 ? formattedObjects : 'None',
//      };

//      return details;
// }

// Display the parsed details in a formatted string
export function displayAccountObjects(details) {
     let output = ['=== XRPL Account Details ==='];

     for (const [key, value] of Object.entries(details)) {
          if (Array.isArray(value)) {
               output.push(`\n${key.replace('_', ' ')}:`);
               value.forEach((obj, index) => {
                    output.push(`  ${obj.type} ${index + 1}:`);
                    for (const [subKey, subValue] of Object.entries(obj.details)) {
                         output.push(`    ${subKey}: ${subValue}`);
                    }
               });
          } else {
               output.push(`${key}: ${value}`);
          }
     }

     return output.join('\n');
}
// export function displayAccountObjects(details) {
//      let output = ['=== XRPL Account Objects Details ==='];

//      for (const [key, value] of Object.entries(details)) {
//           if (key === 'Account Objects' && Array.isArray(value)) {
//                value.forEach((obj, index) => {
//                     output.push(`\n${obj.type} ${index + 1}:`);
//                     for (const [subKey, subValue] of Object.entries(obj.details)) {
//                          output.push(`    ${subKey}: ${subValue}`);
//                     }
//                });
//           } else {
//                output.push(`${key}: ${value}`);
//           }
//      }

//      return output.join('\n');
// }
