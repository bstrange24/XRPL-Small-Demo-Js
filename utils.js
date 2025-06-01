import * as xrpl from 'xrpl';
import { generate, derive } from 'xrpl-accountlib';
import { saveInputValues } from './local-storage';
import { getAccountInfo } from './account';

let clientInstance = null;
let isConnecting = false;

export function getEnvironment() {
     let environment;
     const network = localStorage.getItem('selectedNetwork');
     if (network === 'testnet') {
          environment = 'Testnet';
     }

     if (network === 'devnet') {
          environment = 'Devnet';
     }

     if (network === 'mainet') {
          environment = 'Mainnet';
     }
     return { environment };
}

export function getNet() {
     let net;
     let environment;
     const network = localStorage.getItem('selectedNetwork');
     if (network === 'testnet') {
          net = 'wss://s.altnet.rippletest.net:51233/';
          environment = 'Testnet';
     }

     if (network === 'devnet') {
          net = 'wss://s.devnet.rippletest.net:51233/';
          environment = 'Devnet';
     }

     if (network === 'mainet') {
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

if (typeof window !== 'undefined') {
     window.addEventListener('beforeunload', async () => {
          await disconnectClient();
     });
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

     const amountField = document.getElementById('amountField');
     if (validatInput(amountField)) {
          amountField.value = '';
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

     const amountField = document.getElementById('amountField');
     if (validatInput(amountField)) {
          amountField.value = '';
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

     const amountField = document.getElementById('amountField');
     if (validatInput(amountField)) {
          amountField.value = '';
     }

     getXrpBalance();
     await getAccountInfo();
}

export function validatInput(value) {
     return !!(value !== null && value !== undefined && value !== '');
}

export function setError(message, spinner) {
     if (spinner) spinner.style.display = 'none';
     resultField.value = message;
     resultField.classList.add('error');
     autoResize();
}

export function gatherAccountInfo() {
     const resultField = document.getElementById('resultField');
     resultField.classList.remove('error', 'success');
     let accountData = account1name.value + '\n' + account1address.value + '\n' + account1seed.value + '\n';
     accountData += account2name.value + '\n' + account2address.value + '\n' + account2seed.value + '\n';
     if (document.getElementById('issuerName')) {
          accountData += issuerName.value + '\n' + issuerAddress.value + '\n' + issuerSeed.value + '\n';
     }
     resultField.value = accountData;
     autoResize();
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

export function addSeconds(numOfSeconds, date = new Date()) {
     date.setSeconds(date.getSeconds() + numOfSeconds);
     date = Math.floor(date / 1000);
     date = date - 946684800;

     return date;
}

function dateFormatter() {
     // Format the date in EST (America/New_York handles EST/EDT automatically)
     return new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York', // EST/EDT
          timeZoneName: 'short', // Includes EST or EDT
          year: 'numeric',
          month: 'numeric',
          day: 'numeric', // day: '2-digit',
          hour: 'numeric', // hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true, // Use 24-hour format; set to true for 12-hour with AM/PM
          // fractionalSecondDigits: 3, // Include milliseconds (3 digits)
     });
}

export function convertToEstTime(UtcDataTime) {
     const utcDate = new Date(UtcDataTime);
     const formatter = dateFormatter();
     console.log(utcDate);
     return formatter.format(utcDate);
}

export function convertXRPLTime(rippleTime) {
     // Convert Ripple time (seconds since Jan 1, 2000) to UTC datetime
     const rippleEpoch = 946684800; // Jan 1, 2000 in Unix time
     const date = new Date((rippleTime + rippleEpoch) * 1000);
     const formatter = dateFormatter();
     console.log(date);
     return formatter.format(date);
}

const formatXRPLAmount = value => {
     if (value == null || isNaN(value)) {
          console.warn(`Invalid value: ${value}`);
          return 'Invalid amount';
     }

     if (typeof value === 'object' && value.currency && value.value) {
          return `${value.value} ${value.currency}${value.issuer ? ` (Issuer: ${value.issuer})` : ''}`;
     }
     return `${(parseInt(value) / 1000000).toFixed(6)} XRP`;
};

export function amt_str(amt) {
     if (typeof amt == 'string') {
          return `${xrpl.dropsToXrp(amt)} XRP`;
     } else {
          return `${amt.value} ${amt.currency}.${amt.issuer}`;
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

export function parseXRPLTransaction(response) {
     try {
          // Initialize output array
          const output = [];

          // Extract root-level fields
          const result = response || {};
          const closeTimeIso = result.close_time_iso || null;
          const ctid = result.ctid || null;
          const hash = result.hash || null;
          const ledgerHash = result.ledger_hash || null;
          const ledgerIndex = result.ledger_index || null;
          const validated = result.validated !== undefined ? result.validated : null;

          // Extract transaction details (tx_json)
          const txJson = result.tx_json || {};
          output.push('Transaction Details:');
          Object.entries(txJson).forEach(([key, value]) => {
               if (value !== null && value !== undefined) {
                    let formattedValue;
                    if (key === 'date') {
                         formattedValue = convertXRPLTime(value);
                    } else if (key === 'Fee' || key === 'Amount') {
                         formattedValue = formatXRPLAmount(value || '0');
                    } else if (key === 'CancelAfter' || key === 'FinishAfter') {
                         formattedValue = value ? convertXRPLTime(value) : null;
                    } else {
                         formattedValue = value;
                    }
                    if (formattedValue !== null && formattedValue !== undefined) {
                         if (typeof value === 'object' && value !== null) {
                              output.push(`    ${key}:`);
                              Object.entries(value).forEach(([subKey, subValue]) => {
                                   if (subValue !== null && subValue !== undefined) {
                                        output.push(`        ${subKey}: ${subValue}`);
                                   }
                              });
                         } else {
                              output.push(`    ${key}: ${formattedValue}`);
                         }
                    }
               }
          });

          // Extract metadata
          const meta = result.meta || {};
          output.push('\nMetadata:');
          if (meta.TransactionResult) output.push(`    TransactionResult: ${meta.TransactionResult}`);
          if (meta.TransactionIndex !== undefined) output.push(`    TransactionIndex: ${meta.TransactionIndex}`);
          if (meta.nftoken_id) output.push(`    nftoken_id: ${meta.nftoken_id}`);

          // Process AffectedNodes
          const affectedNodes = meta.AffectedNodes || [];
          if (affectedNodes.length > 0) {
               output.push('\nAffected Nodes:');
               affectedNodes.forEach((node, nodeIndex) => {
                    output.push(`    Node ${nodeIndex + 1}:`);

                    // Handle ModifiedNode, CreatedNode, or DeletedNode
                    ['ModifiedNode', 'CreatedNode', 'DeletedNode'].forEach(nodeType => {
                         if (node[nodeType]) {
                              const nodeData = node[nodeType];
                              const entryType = nodeData.LedgerEntryType || 'Unknown';
                              const typeConfig = ledgerEntryTypeFields[entryType] || {
                                   fields: Object.keys(nodeData.FinalFields || nodeData.NewFields || {}).map(key => ({
                                        key,
                                        format: v => (typeof v === 'object' && v !== null ? JSON.stringify(v) : v || null),
                                   })),
                                   label: entryType,
                              };

                              output.push(`        ${nodeType}:`);
                              output.push(`            LedgerEntryType: ${entryType}`);
                              if (nodeData.LedgerIndex) output.push(`            LedgerIndex: ${nodeData.LedgerIndex}`);

                              // Process FinalFields or NewFields based on node type
                              let fields;
                              let fieldsLabel = 'FinalFields';
                              if (nodeType === 'CreatedNode' && nodeData.NewFields) {
                                   fields = nodeData.NewFields;
                                   fieldsLabel = 'NewFields';
                              } else if (nodeData.FinalFields) {
                                   fields = nodeData.FinalFields;
                              }
                              if (fields) {
                                   output.push(`            ${fieldsLabel}:`);
                                   typeConfig.fields.forEach(field => {
                                        const value = fields[field.key];
                                        const formattedValue = field.format(value);
                                        if (formattedValue !== null && formattedValue !== undefined) {
                                             console.log(`Key: ${field.key}, Value: ${value || 'N/A'}`);
                                             if (field.key === 'NFTokens' && Array.isArray(value)) {
                                                  output.push(`                ${field.key}:`);
                                                  value.forEach(nft => {
                                                       output.push(`                    NFToken`);
                                                       Object.entries(nft.NFToken).forEach(([subKey, subValue]) => {
                                                            if (subValue !== null && subValue !== undefined) {
                                                                 output.push(`                        ${subKey}: ${subValue}`);
                                                            }
                                                       });
                                                  });
                                             } else if (typeof value === 'object' && value !== null) {
                                                  output.push(`                ${field.key}:`);
                                                  Object.entries(value).forEach(([subKey, subValue]) => {
                                                       if (subValue !== null && subValue !== undefined) {
                                                            output.push(`                    ${subKey}: ${subValue}`);
                                                       }
                                                  });
                                             } else {
                                                  output.push(`                ${field.key}: ${formattedValue}`);
                                             }
                                        }
                                   });
                              }

                              // Process PreviousFields (for ModifiedNode)
                              if (nodeData.PreviousFields) {
                                   const hasPreviousFields = Object.entries(nodeData.PreviousFields).some(([, value]) => value !== null && value !== undefined);
                                   if (hasPreviousFields) {
                                        output.push(`            PreviousFields:`);
                                        Object.entries(nodeData.PreviousFields).forEach(([key, value]) => {
                                             if (value !== null && value !== undefined) {
                                                  if (key === 'NFTokens' && Array.isArray(value)) {
                                                       output.push(`                ${key}:`);
                                                       value.forEach(nft => {
                                                            output.push(`                    NFToken`);
                                                            Object.entries(nft.NFToken).forEach(([subKey, subValue]) => {
                                                                 if (subValue !== null && subValue !== undefined) {
                                                                      output.push(`                        ${subKey}: ${subValue}`);
                                                                 }
                                                            });
                                                       });
                                                  } else if (typeof value === 'object' && value !== null) {
                                                       output.push(`                ${key}:`);
                                                       Object.entries(value).forEach(([subKey, subValue]) => {
                                                            if (subValue !== null && subValue !== undefined) {
                                                                 output.push(`                    ${subKey}: ${subValue}`);
                                                            }
                                                       });
                                                  } else {
                                                       output.push(`                ${key}: ${value}`);
                                                  }
                                             }
                                        });
                                   }
                              }

                              // PreviousTxnID and PreviousTxnLgrSeq
                              if (nodeData.PreviousTxnID) output.push(`            PreviousTxnID: ${nodeData.PreviousTxnID}`);
                              if (nodeData.PreviousTxnLgrSeq) output.push(`            PreviousTxnLgrSeq: ${nodeData.PreviousTxnLgrSeq}`);
                         }
                    });
               });
          }

          // Append general metadata
          output.push('\nGeneral Metadata:');
          if (closeTimeIso) output.push(`    close_time_iso: ${convertToEstTime(closeTimeIso)}`);
          if (ctid) output.push(`    ctid: ${ctid}`);
          if (hash) output.push(`    hash: ${hash}`);
          if (ledgerHash) output.push(`    ledger_hash: ${ledgerHash}`);
          if (ledgerIndex) output.push(`    ledger_index: ${ledgerIndex}`);
          if (validated !== null) output.push(`    validated: ${validated}`);

          return output.join('\n');
     } catch (error) {
          console.error('Error parsing XRPL transaction:', error);
          return `Error: Failed to parse XRPL transaction\nDetails: ${error.message}`;
     }
}

// export function parseXRPLTransaction_PrintNA(response) {
//      try {
//           // Initialize output array
//           const output = [];

//           // Extract root-level fields
//           const result = response || {};
//           const closeTimeIso = result.close_time_iso || 'N/A';
//           const ctid = result.ctid || 'N/A';
//           const hash = result.hash || 'N/A';
//           const ledgerHash = result.ledger_hash || 'N/A';
//           const ledgerIndex = result.ledger_index || 'N/A';
//           const validated = result.validated || false;

//           // Extract transaction details (tx_json)
//           const txJson = result.tx_json || {};
//           output.push('Transaction Details:');
//           Object.entries(txJson).forEach(([key, value]) => {
//                if (key === 'date') {
//                     output.push(`    ${key}: ${convertXRPLTime(value)}`);
//                } else if (key === 'Fee' || key === 'SendMax') {
//                     output.push(`    ${key}: ${formatXRPLAmount(value || '0')}`);
//                } else if (typeof value === 'object' && value !== null) {
//                     output.push(`    ${key}:`);
//                     Object.entries(value).forEach(([subKey, subValue]) => {
//                          output.push(`        ${subKey}: ${subValue || 'N/A'}`);
//                     });
//                } else {
//                     output.push(`    ${key}: ${value || 'N/A'}`);
//                }
//           });

//           // Extract metadata
//           const meta = result.meta || {};
//           output.push('\nMetadata:');
//           output.push(`    TransactionResult: ${meta.TransactionResult || 'N/A'}`);
//           output.push(`    TransactionIndex: ${meta.TransactionIndex || 'N/A'}`);
//           if (meta.nftoken_id) {
//                output.push(`    nftoken_id: ${meta.nftoken_id}`);
//           }

//           // Process AffectedNodes
//           const affectedNodes = meta.AffectedNodes || [];
//           output.push('\nAffected Nodes:');
//           affectedNodes.forEach((node, nodeIndex) => {
//                output.push(`    Node ${nodeIndex + 1}:`);

//                // Handle ModifiedNode, CreatedNode, or DeletedNode
//                ['ModifiedNode', 'CreatedNode', 'DeletedNode'].forEach(nodeType => {
//                     if (node[nodeType]) {
//                          const nodeData = node[nodeType];
//                          const entryType = nodeData.LedgerEntryType || 'Unknown';
//                          const typeConfig = ledgerEntryTypeFields[entryType] || {
//                               fields: Object.keys(nodeData.FinalFields || nodeData.NewFields || {}).map(key => ({
//                                    key,
//                                    format: v => (typeof v === 'object' && v !== null ? JSON.stringify(v) : v || 'N/A'),
//                               })),
//                               label: entryType,
//                          };

//                          output.push(`        ${nodeType}:`);
//                          output.push(`            LedgerEntryType: ${entryType}`);
//                          output.push(`            LedgerIndex: ${nodeData.LedgerIndex || 'N/A'}`);

//                          // Process FinalFields or NewFields
//                          const fields = nodeData.FinalFields || nodeData.NewFields || {};
//                          output.push(`            FinalFields:`);
//                          typeConfig.fields.forEach(field => {
//                               const value = fields[field.key];
//                               console.log(`Key: ${field.key}, Value: ${value || 'N/A'}`);
//                               if (field.key === 'NFTokens' && Array.isArray(value)) {
//                                    output.push(`                ${field.key}:`);
//                                    value.forEach(nft => {
//                                         output.push(`                    NFToken`);
//                                         Object.entries(nft.NFToken).forEach(([subKey, subValue]) => {
//                                              output.push(`                        ${subKey}: ${subValue || 'N/A'}`);
//                                         });
//                                    });
//                               } else if (typeof value === 'object' && value !== null) {
//                                    output.push(`                ${field.key}:`);
//                                    Object.entries(value).forEach(([subKey, subValue]) => {
//                                         output.push(`                    ${subKey}: ${subValue || 'N/A'}`);
//                                    });
//                               } else {
//                                    output.push(`                ${field.key}: ${field.format ? field.format(value) : value || 'N/A'}`);
//                               }
//                          });

//                          // Process PreviousFields (for ModifiedNode)
//                          if (nodeData.PreviousFields) {
//                               output.push(`            PreviousFields:`);
//                               Object.entries(nodeData.PreviousFields).forEach(([key, value]) => {
//                                    if (key === 'NFTokens' && Array.isArray(value)) {
//                                         output.push(`                ${key}:`);
//                                         value.forEach(nft => {
//                                              output.push(`                    NFToken`);
//                                              Object.entries(nft.NFToken).forEach(([subKey, subValue]) => {
//                                                   output.push(`                        ${subKey}: ${subValue || 'N/A'}`);
//                                              });
//                                         });
//                                    } else if (key === 'Balance' && value !== null) {
//                                         output.push(`                Balance: ${formatXRPLAmount(value)}`);
//                                    } else if (typeof value === 'object' && value !== null) {
//                                         output.push(`                ${key}:`);
//                                         Object.entries(value).forEach(([subKey, subValue]) => {
//                                              output.push(`                    ${subKey}: ${subValue || 'N/A'}`);
//                                         });
//                                    } else {
//                                         output.push(`                ${key}: ${value || 'N/A'}`);
//                                    }
//                               });
//                          }

//                          // PreviousTxnID and PreviousTxnLgrSeq
//                          output.push(`            PreviousTxnID: ${nodeData.PreviousTxnID || 'N/A'}`);
//                          output.push(`            PreviousTxnLgrSeq: ${nodeData.PreviousTxnLgrSeq || 'N/A'}`);
//                     }
//                });
//           });

//           // Append general metadata
//           output.push('\nGeneral Metadata:');
//           output.push(`    close_time_iso: ${convertToEstTime(closeTimeIso)}`);
//           output.push(`    ctid: ${ctid}`);
//           output.push(`    hash: ${hash}`);
//           output.push(`    ledger_hash: ${ledgerHash}`);
//           output.push(`    ledger_index: ${ledgerIndex}`);
//           output.push(`    validated: ${validated}`);

//           return output.join('\n');
//      } catch (error) {
//           console.error('Error parsing XRPL transaction:', error);
//           return `Error: Failed to parse XRPL transaction\nDetails: ${error.message}`;
//      }
// }

const ledgerEntryTypeFields = {
     AccountRoot: {
          fields: [
               { key: 'Account', format: v => v || null },
               { key: 'Balance', format: v => formatXRPLAmount(v || '0') },
               { key: 'Sequence', format: v => v || null },
               { key: 'OwnerCount', format: v => v || '0' },
               { key: 'PreviousTxnID', format: v => v || null },
               { key: 'PreviousTxnLgrSeq', format: v => v || null },
               { key: 'Domain', format: v => v || null },
               { key: 'EmailHash', format: v => v || null },
               { key: 'index', format: v => v || null },
               { key: 'FirstNFTokenSequence', format: v => v || null },
               { key: 'MintedNFTokens', format: v => v || '0' },
               { key: 'Flags', format: v => v || '0' },
          ],
          label: 'Account',
          pluralLabel: 'Accounts',
     },
     Escrow: {
          fields: [
               { key: 'Account', format: v => v || null },
               { key: 'Amount', format: v => formatXRPLAmount(v || '0') },
               { key: 'Destination', format: v => v || null },
               { key: 'CancelAfter', format: v => (v ? convertXRPLTime(v) : null) },
               { key: 'FinishAfter', format: v => (v ? convertXRPLTime(v) : null) },
               { key: 'Condition', format: v => v || null },
               { key: 'PreviousTxnID', format: v => v || null },
               { key: 'PreviousTxnLgrSeq', format: v => v || null },
               { key: 'index', format: v => v || null },
          ],
          label: 'Escrow',
          pluralLabel: 'Escrows',
     },
     Offer: {
          fields: [
               { key: 'Account', format: v => v || null },
               { key: 'TakerPays', format: v => (typeof v === 'object' ? `${v.value} ${v.currency}` : formatXRPLAmount(v || '0')) },
               { key: 'TakerGets', format: v => (typeof v === 'object' ? `${v.value} ${v.currency}` : formatXRPLAmount(v || '0')) },
               { key: 'Expiration', format: v => (v ? convertXRPLTime(v) : null) },
               { key: 'OfferSequence', format: v => v || null },
               { key: 'PreviousTxnID', format: v => v || null },
               { key: 'PreviousTxnLgrSeq', format: v => v || null },
               { key: 'index', format: v => v || null },
          ],
          label: 'Offer',
          pluralLabel: 'Offers',
     },
     RippleState: {
          fields: [
               { key: 'Balance', format: v => (typeof v === 'object' ? formatXRPLAmount(v) : v || null) },
               { key: 'Flags', format: v => v || '0' },
               { key: 'HighLimit', format: v => (typeof v === 'object' ? formatXRPLAmount(v) : v || null) },
               { key: 'HighNode', format: v => v || null },
               { key: 'LedgerEntryType', format: v => v || null },
               { key: 'LowLimit', format: v => (typeof v === 'object' ? formatXRPLAmount(v) : v || null) },
               { key: 'LowNode', format: v => v || null },
               { key: 'PreviousTxnID', format: v => v || null },
               { key: 'PreviousTxnLgrSeq', format: v => v || null },
               { key: 'index', format: v => v || null },
          ],
          label: 'RippleState',
          pluralLabel: 'RippleStates',
     },
     PayChannel: {
          fields: [
               { key: 'Account', format: v => v || null },
               { key: 'Destination', format: v => v || null },
               { key: 'Amount', format: v => formatXRPLAmount(v || '0') },
               { key: 'Balance', format: v => formatXRPLAmount(v || '0') },
               { key: 'SettleDelay', format: v => v || null },
               { key: 'Expiration', format: v => (v ? convertXRPLTime(v) : null) },
               { key: 'CancelAfter', format: v => (v ? convertXRPLTime(v) : null) },
               { key: 'PreviousTxnID', format: v => v || null },
               { key: 'PreviousTxnLgrSeq', format: v => v || null },
               { key: 'index', format: v => v || null },
          ],
          label: 'Payment Channel',
          pluralLabel: 'Payment Channels',
     },
     Check: {
          fields: [
               { key: 'Account', format: v => v || null },
               { key: 'Destination', format: v => v || null },
               { key: 'SendMax', format: v => (typeof v === 'object' ? `${v.value} ${v.currency}` : formatXRPLAmount(v || '0')) },
               { key: 'Sequence', format: v => v || null },
               { key: 'PreviousTxnID', format: v => v || null },
               { key: 'PreviousTxnLgrSeq', format: v => v || null },
               { key: 'index', format: v => v || null },
          ],
          label: 'Check',
          pluralLabel: 'Checks',
     },
     DepositPreauth: {
          fields: [
               { key: 'Account', format: v => v || null },
               { key: 'Authorize', format: v => v || null },
               { key: 'PreviousTxnID', format: v => v || null },
               { key: 'PreviousTxnLgrSeq', format: v => v || null },
               { key: 'index', format: v => v || null },
          ],
          label: 'Deposit Preauthorization',
          pluralLabel: 'Deposit Preauthorizations',
     },
     Ticket: {
          fields: [
               { key: 'Account', format: v => v || null },
               { key: 'TicketSequence', format: v => v || null },
               { key: 'PreviousTxnID', format: v => v || null },
               { key: 'PreviousTxnLgrSeq', format: v => v || null },
               { key: 'index', format: v => v || null },
          ],
          label: 'Ticket',
          pluralLabel: 'Tickets',
     },
     DirectoryNode: {
          fields: [
               { key: 'Flags', format: v => v || '0' },
               { key: 'Owner', format: v => v || null },
               { key: 'Indexes', format: v => (Array.isArray(v) ? v.join(', ') : v || null) },
               { key: 'PreviousTxnID', format: v => v || null },
               { key: 'PreviousTxnLgrSeq', format: v => v || null },
               { key: 'index', format: v => v || null },
               { key: 'RootIndex', format: v => v || null },
          ],
          label: 'Directory',
          pluralLabel: 'Directories',
     },
     AMM: {
          fields: [
               { key: 'Asset1', format: v => `${v.currency} (Issuer: ${v.issuer || null})` },
               { key: 'Asset2', format: v => `${v.currency} (Issuer: ${v.issuer || null})` },
               { key: 'LPTokenBalance', format: v => `${v.value} ${v.currency}` },
               { key: 'TradingFee', format: v => v || null },
               { key: 'PreviousTxnID', format: v => v || null },
               { key: 'PreviousTxnLgrSeq', format: v => v || null },
               { key: 'index', format: v => v || null },
          ],
          label: 'Automated Market Maker',
          pluralLabel: 'Automated Market Makers',
     },
     NFTokenPage: {
          fields: [
               { key: 'Flags', format: v => v || '0' },
               { key: 'LedgerEntryType', format: v => v || null },
               { key: 'NFTokens', format: v => (Array.isArray(v) ? v : null) },
               { key: 'index', format: v => v || null },
               { key: 'PreviousTxnID', format: v => v || null },
               { key: 'PreviousTxnLgrSeq', format: v => v || null },
          ],
          label: 'NFTokenPage',
          pluralLabel: 'NFTokenPages',
     },
     SignerList: {
          fields: [
               { key: 'SignerQuorum', format: v => v || null },
               { key: 'SignerEntries', format: v => (Array.isArray(v) ? v.map(e => e.SignerEntry.Account).join(', ') : null) },
               { key: 'PreviousTxnID', format: v => v || null },
               { key: 'PreviousTxnLgrSeq', format: v => v || null },
               { key: 'index', format: v => v || null },
          ],
          label: 'Signer List',
          pluralLabel: 'Signer Lists',
     },
     NFT: {
          fields: [
               { key: 'Flags', format: v => v || '0' },
               { key: 'Issuer', format: v => v || null },
               { key: 'NFTokenID', format: v => v || null },
               { key: 'NFTokenTaxon', format: v => (v === 0 ? null : v || null) },
               { key: 'URI', format: v => v || null },
               { key: 'nft_serial', format: v => v || null },
          ],
          label: 'NFT',
          pluralLabel: 'NFTs',
     },
};

// const ledgerEntryTypeFields_PRINT_NA = {
//      AccountRoot: {
//           fields: [
//                { key: 'Account', format: v => v || 'N/A' },
//                { key: 'Balance', format: v => formatXRPLAmount(v || '0') },
//                { key: 'Sequence', format: v => v || 'N/A' },
//                { key: 'OwnerCount', format: v => v || '0' },
//                { key: 'PreviousTxnID', format: v => v || 'N/A' },
//                { key: 'PreviousTxnLgrSeq', format: v => v || 'N/A' },
//                { key: 'FirstNFTokenSequence', format: v => v || 'N/A' },
//                { key: 'Flags', format: v => v || 'N/A' },
//                { key: 'MintedNFTokens', format: v => v || 'N/A' },
//                { key: 'Domain', format: v => v || 'N/A' },
//                { key: 'EmailHash', format: v => v || 'N/A' },
//                { key: 'index', format: v => v || 'N/A' },
//           ],
//           label: 'Account',
//           pluralLabel: 'Accounts',
//      },
//      Escrow: {
//           fields: [
//                { key: 'Account', format: v => v || 'N/A' },
//                { key: 'Amount', format: v => formatXRPLAmount(v || '0') },
//                { key: 'Destination', format: v => v || 'N/A' },
//                { key: 'CancelAfter', format: v => (v ? convertXRPLTime(v) : 'N/A') },
//                { key: 'FinishAfter', format: v => (v ? convertXRPLTime(v) : 'N/A') },
//                { key: 'Condition', format: v => v || 'N/A' },
//                { key: 'PreviousTxnID', format: v => v || 'N/A' },
//                { key: 'PreviousTxnLgrSeq', format: v => v || 'N/A' },
//                { key: 'index', format: v => v || 'N/A' },
//           ],
//           label: 'Escrow',
//           pluralLabel: 'Escrows',
//      },
//      Offer: {
//           fields: [
//                { key: 'Account', format: v => v || 'N/A' },
//                { key: 'TakerPays', format: v => (typeof v === 'object' ? `${v.value} ${v.currency}` : formatXRPLAmount(v || '0')) },
//                { key: 'TakerGets', format: v => (typeof v === 'object' ? `${v.value} ${v.currency}` : formatXRPLAmount(v || '0')) },
//                { key: 'Expiration', format: v => (v ? convertXRPLTime(v) : 'N/A') },
//                { key: 'OfferSequence', format: v => v || 'N/A' },
//                { key: 'PreviousTxnID', format: v => v || 'N/A' },
//                { key: 'PreviousTxnLgrSeq', format: v => v || 'N/A' },
//                { key: 'index', format: v => v || 'N/A' },
//           ],
//           label: 'Offer',
//           pluralLabel: 'Offers',
//      },
//      RippleState: {
//           fields: [
//                { key: 'Balance', format: v => (typeof v === 'object' ? formatXRPLAmount(v) : v || 'N/A') },
//                { key: 'Flags', format: v => v || '0' },
//                { key: 'HighLimit', format: v => (typeof v === 'object' ? formatXRPLAmount(v) : v || 'N/A') },
//                { key: 'HighNode', format: v => v || 'N/A' },
//                { key: 'LedgerEntryType', format: v => v || 'N/A' },
//                { key: 'LowLimit', format: v => (typeof v === 'object' ? formatXRPLAmount(v) : v || 'N/A') },
//                { key: 'LowNode', format: v => v || 'N/A' },
//                { key: 'PreviousTxnID', format: v => v || 'N/A' },
//                { key: 'PreviousTxnLgrSeq', format: v => v || 'N/A' },
//                { key: 'index', format: v => v || 'N/A' },
//           ],
//           label: 'RippleState',
//           pluralLabel: 'RippleStates',
//      },
//      PayChannel: {
//           fields: [
//                { key: 'Account', format: v => v || 'N/A' },
//                { key: 'Destination', format: v => v || 'N/A' },
//                { key: 'Amount', format: v => formatXRPLAmount(v || '0') },
//                { key: 'Balance', format: v => formatXRPLAmount(v || '0') },
//                { key: 'SettleDelay', format: v => v || 'N/A' },
//                { key: 'Expiration', format: v => (v ? convertXRPLTime(v) : 'N/A') },
//                { key: 'CancelAfter', format: v => (v ? convertXRPLTime(v) : 'N/A') },
//                { key: 'PreviousTxnID', format: v => v || 'N/A' },
//                { key: 'PreviousTxnLgrSeq', format: v => v || 'N/A' },
//                { key: 'index', format: v => v || 'N/A' },
//           ],
//           label: 'Payment Channel',
//           pluralLabel: 'Payment Channels',
//      },
//      Check: {
//           fields: [
//                { key: 'Account', format: v => v || 'N/A' },
//                { key: 'Destination', format: v => v || 'N/A' },
//                { key: 'SendMax', format: v => (typeof v === 'object' ? `${v.value} ${v.currency}` : formatXRPLAmount(v || '0')) },
//                { key: 'Sequence', format: v => v || 'N/A' },
//                { key: 'PreviousTxnID', format: v => v || 'N/A' },
//                { key: 'PreviousTxnLgrSeq', format: v => v || 'N/A' },
//                { key: 'index', format: v => v || 'N/A' },
//           ],
//           label: 'Check',
//           pluralLabel: 'Checks',
//      },
//      DepositPreauth: {
//           fields: [
//                { key: 'Account', format: v => v || 'N/A' },
//                { key: 'Authorize', format: v => v || 'N/A' },
//                { key: 'PreviousTxnID', format: v => v || 'N/A' },
//                { key: 'PreviousTxnLgrSeq', format: v => v || 'N/A' },
//                { key: 'index', format: v => v || 'N/A' },
//           ],
//           label: 'Deposit Preauthorization',
//           pluralLabel: 'Deposit Preauthorizations',
//      },
//      Ticket: {
//           fields: [
//                { key: 'Account', format: v => v || 'N/A' },
//                { key: 'TicketSequence', format: v => v || 'N/A' },
//                { key: 'PreviousTxnID', format: v => v || 'N/A' },
//                { key: 'PreviousTxnLgrSeq', format: v => v || 'N/A' },
//                { key: 'index', format: v => v || 'N/A' },
//           ],
//           label: 'Ticket',
//           pluralLabel: 'Tickets',
//      },
//      DirectoryNode: {
//           fields: [
//                { key: 'Owner', format: v => v || 'N/A' },
//                { key: 'Indexes', format: v => (Array.isArray(v) ? v.join(', ') : v || 'N/A') },
//                { key: 'PreviousTxnID', format: v => v || 'N/A' },
//                { key: 'PreviousTxnLgrSeq', format: v => v || 'N/A' },
//                { key: 'index', format: v => v || 'N/A' },
//           ],
//           label: 'Directory',
//           pluralLabel: 'Directories',
//      },
//      AMM: {
//           fields: [
//                { key: 'Asset1', format: v => `${v.currency} (Issuer: ${v.issuer || 'N/A'})` },
//                { key: 'Asset2', format: v => `${v.currency} (Issuer: ${v.issuer || 'N/A'})` },
//                { key: 'LPTokenBalance', format: v => `${v.value} ${v.currency}` },
//                { key: 'TradingFee', format: v => v || 'N/A' },
//                { key: 'PreviousTxnID', format: v => v || 'N/A' },
//                { key: 'PreviousTxnLgrSeq', format: v => v || 'N/A' },
//                { key: 'index', format: v => v || 'N/A' },
//           ],
//           label: 'Automated Market Maker',
//           pluralLabel: 'Automated Market Makers',
//      },
//      NFTokenPage: {
//           fields: [
//                { key: 'Flags', format: v => v || '0' },
//                { key: 'LedgerEntryType', format: v => v || 'N/A' },
//                { key: 'NFTokens', format: v => (Array.isArray(v) ? v : 'N/A') },
//                { key: 'index', format: v => v || 'N/A' },
//           ],
//           label: 'NFTokenPage',
//           pluralLabel: 'NFTokenPages',
//      },
//      SignerList: {
//           fields: [
//                { key: 'SignerQuorum', format: v => v || 'N/A' },
//                { key: 'SignerEntries', format: v => (Array.isArray(v) ? v.map(e => e.SignerEntry.Account).join(', ') : 'N/A') },
//                { key: 'PreviousTxnID', format: v => v || 'N/A' },
//                { key: 'PreviousTxnLgrSeq', format: v => v || 'N/A' },
//                { key: 'index', format: v => v || 'N/A' },
//           ],
//           label: 'Signer List',
//           pluralLabel: 'Signer Lists',
//      },
//      NFT: {
//           fields: [
//                { key: 'Flags', format: v => v || '0' },
//                { key: 'Issuer', format: v => v || 'N/A' },
//                { key: 'NFTokenID', format: v => v || 'N/A' },
//                { key: 'NFTokenTaxon', format: v => (v === 0 ? '0' : v || 'N/A') },
//                { key: 'URI', format: v => v || 'N/A' },
//                { key: 'nft_serial', format: v => v || 'N/A' },
//           ],
//           label: 'NFT',
//           pluralLabel: 'NFTs',
//      },
// };

export function parseXRPLAccountObjects(response) {
     try {
          // Initialize output array
          const output = [];

          // Extract general metadata
          const ledgerIndex = response.ledger_index || response.ledger_current_index || 'N/A';
          const ledgerHash = response.ledger_hash || 'N/A';
          const validated = response.validated || false;

          // Identify all array fields (e.g., account_objects, account_nfts)
          const arrayFields = Object.keys(response).filter(key => Array.isArray(response[key]));
          console.log(`Array Fields Found: ${arrayFields.join(', ')}`);

          // Process each array field
          arrayFields.forEach(field => {
               const objects = response[field] || [];
               console.log(`Processing ${field}:`, objects);

               // Use appropriate header based on field
               const header = field === 'account_nfts' ? 'Account NFTs' : 'Account Objects';
               output.push(header);

               // Group objects by LedgerEntryType
               const groupedObjects = {};
               objects.forEach(obj => {
                    let entryType = obj.LedgerEntryType || (field === 'account_nfts' ? 'NFT' : 'Unknown');
                    if (!groupedObjects[entryType]) {
                         groupedObjects[entryType] = [];
                    }
                    groupedObjects[entryType].push(obj);
               });

               // Process grouped objects
               let groupIndex = 1;
               Object.entries(groupedObjects).forEach(([entryType, group]) => {
                    const typeConfig = ledgerEntryTypeFields[entryType] || {
                         fields: Object.keys(group[0]).map(key => ({
                              key,
                              format: v => (typeof v === 'object' && v !== null ? JSON.stringify(v) : v || null),
                         })),
                         label: entryType || 'Unknown',
                         pluralLabel: `${entryType}s` || 'Unknowns',
                    };

                    // Use singular or plural label based on count
                    const label = group.length > 1 ? typeConfig.pluralLabel : typeConfig.label;
                    output.push(`${label} ${groupIndex}`);

                    if (group.length > 1) {
                         // For multiple objects, add LedgerEntryType and pluralized container
                         output.push(`    LedgerEntryType: ${entryType === 'NFT' ? 'NFTs' : typeConfig.pluralLabel}`);
                         output.push(`    ${typeConfig.pluralLabel}:`);
                         group.forEach(obj => {
                              output.push(`        ${typeConfig.label}`);
                              typeConfig.fields.forEach(field => {
                                   const value = obj[field.key];
                                   const formattedValue = field.format(value);
                                   if (formattedValue !== null && formattedValue !== undefined) {
                                        console.log(`Key: ${field.key}, Value: ${value || 'N/A'}`);
                                        if (typeof value === 'object' && value !== null) {
                                             output.push(`            ${field.key}:`);
                                             Object.entries(value).forEach(([subKey, subValue]) => {
                                                  if (subValue !== null && subValue !== undefined) {
                                                       output.push(`                ${subKey}: ${subValue}`);
                                                  }
                                             });
                                        } else {
                                             output.push(`            ${field.key}: ${formattedValue}`);
                                        }
                                   }
                              });
                         });
                    } else {
                         // For single object, list fields directly
                         group.forEach(obj => {
                              typeConfig.fields.forEach(field => {
                                   const value = obj[field.key];
                                   const formattedValue = field.format(value);
                                   if (formattedValue !== null && formattedValue !== undefined) {
                                        console.log(`Key: ${field.key}, Value: ${value || 'N/A'}`);
                                        if (field.key === 'NFTokens' && Array.isArray(value)) {
                                             output.push(`    ${field.key}:`);
                                             value.forEach(nft => {
                                                  output.push(`        NFToken`);
                                                  Object.entries(nft.NFToken).forEach(([subKey, subValue]) => {
                                                       if (subValue !== null && subValue !== undefined) {
                                                            output.push(`            ${subKey}: ${subValue}`);
                                                       }
                                                  });
                                             });
                                        } else if (typeof value === 'object' && value !== null) {
                                             output.push(`    ${field.key}:`);
                                             Object.entries(value).forEach(([subKey, subValue]) => {
                                                  if (subValue !== null && subValue !== undefined) {
                                                       output.push(`        ${subKey}: ${subValue}`);
                                                  }
                                             });
                                        } else {
                                             output.push(`    ${field.key}: ${formattedValue}`);
                                        }
                                   }
                              });
                         });
                    }
                    groupIndex += 1;
               });
          });

          // Append general metadata
          if (ledgerHash !== 'N/A') output.push(`ledger_hash: ${ledgerHash}`);
          output.push(`ledger_${response.ledger_index ? 'index' : 'current_index'}: ${ledgerIndex}`);
          output.push(`validated: ${validated}`);

          return output.join('\n');
     } catch (error) {
          console.error('Error parsing XRPL response:', error);
          return `Error: Failed to parse XRPL response\nDetails: ${error.message}`;
     }
}

// export function parseXRPLAccountObjects_PRINT_NA(response) {
//      try {
//           // Initialize output array
//           const output = [];

//           // Extract general metadata
//           const ledgerIndex = response.ledger_index || response.ledger_current_index || 'N/A';
//           const ledgerHash = response.ledger_hash || 'N/A';
//           const validated = response.validated || false;

//           // Identify all array fields (e.g., account_objects, account_nfts, affected_nodes)
//           const arrayFields = Object.keys(response).filter(key => Array.isArray(response[key]));
//           console.log(`Array Fields Found: ${arrayFields.join(', ')}`);

//           // Process each array field
//           arrayFields.forEach(field => {
//                const objects = response[field] || [];
//                console.log(`Processing ${field}:`, objects);

//                // Use appropriate header based on field
//                const header = field === 'account_nfts' ? 'Account NFTs' : 'Account Objects';
//                output.push(header);

//                // Group objects by LedgerEntryType
//                const groupedObjects = {};
//                objects.forEach(obj => {
//                     let entryType = obj.LedgerEntryType || (field === 'account_nfts' ? 'NFT' : 'Unknown');
//                     if (field === 'AffectedNodes' && obj.ModifiedNode) {
//                          entryType = obj.ModifiedNode.LedgerEntryType || obj.CreatedNode?.LedgerEntryType || 'Unknown';
//                          obj = { ...obj.ModifiedNode?.FinalFields, ...obj.CreatedNode?.NewFields } || obj;
//                     }
//                     if (!groupedObjects[entryType]) {
//                          groupedObjects[entryType] = [];
//                     }
//                     groupedObjects[entryType].push(obj);
//                });

//                // Process grouped objects
//                let groupIndex = 1;
//                Object.entries(groupedObjects).forEach(([entryType, group], groupIdx) => {
//                     const typeConfig = ledgerEntryTypeFields[entryType] || {
//                          fields: Object.keys(group[0]).map(key => ({
//                               key,
//                               format: v => (typeof v === 'object' && v !== null ? JSON.stringify(v) : v || 'N/A'),
//                          })),
//                          label: entryType || 'Unknown',
//                          pluralLabel: `${entryType}s` || 'Unknowns',
//                     };

//                     // Use singular or plural label based on count
//                     const label = group.length > 1 ? typeConfig.pluralLabel : typeConfig.label;
//                     output.push(`${label} ${groupIndex}`);

//                     if (group.length > 1) {
//                          // For multiple objects, add LedgerEntryType and pluralized container
//                          output.push(`    LedgerEntryType: ${entryType === 'NFT' ? 'NFTs' : typeConfig.pluralLabel}`);
//                          output.push(`    ${typeConfig.pluralLabel}:`);
//                          group.forEach((obj, objIndex) => {
//                               output.push(`        ${typeConfig.label}`);
//                               typeConfig.fields.forEach(field => {
//                                    const value = obj[field.key];
//                                    console.log(`Key: ${field.key}, Value: ${value || 'N/A'}`);
//                                    if (typeof value === 'object' && value !== null) {
//                                         output.push(`            ${field.key}:`);
//                                         Object.entries(value).forEach(([subKey, subValue]) => {
//                                              output.push(`                ${subKey}: ${subValue || 'N/A'}`);
//                                         });
//                                    } else {
//                                         output.push(`            ${field.key}: ${field.format(value)}`);
//                                    }
//                               });
//                          });
//                     } else {
//                          // For single object, list fields directly
//                          group.forEach(obj => {
//                               typeConfig.fields.forEach(field => {
//                                    const value = obj[field.key];
//                                    console.log(`Key: ${field.key}, Value: ${value || 'N/A'}`);
//                                    if (field.key === 'NFTokens' && Array.isArray(value)) {
//                                         output.push(`    ${field.key}:`);
//                                         value.forEach((nft, nftIndex) => {
//                                              output.push(`        NFToken`);
//                                              Object.entries(nft.NFToken).forEach(([subKey, subValue]) => {
//                                                   output.push(`            ${subKey}: ${subValue || 'N/A'}`);
//                                              });
//                                         });
//                                    } else if (typeof value === 'object' && value !== null) {
//                                         output.push(`    ${field.key}:`);
//                                         Object.entries(value).forEach(([subKey, subValue]) => {
//                                              output.push(`        ${subKey}: ${subValue || 'N/A'}`);
//                                         });
//                                    } else {
//                                         output.push(`    ${field.key}: ${field.format(value)}`);
//                                    }
//                               });
//                          });
//                     }
//                     groupIndex += 1;
//                });
//           });

//           // Append general metadata
//           if (ledgerHash !== 'N/A') output.push(`ledger_hash: ${ledgerHash}`);
//           output.push(`ledger_${response.ledger_index ? 'index' : 'current_index'}: ${ledgerIndex}`);
//           output.push(`validated: ${validated}`);

//           return output.join('\n');
//      } catch (error) {
//           console.error('Error parsing XRPL response:', error);
//           return `Error: Failed to parse XRPL response\nDetails: ${error.message}`;
//      }
// }

export async function getTransaction() {
     console.log('Entering getTransaction');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const transactionHash = document.getElementById('transactionField');

     if (!transactionHash) return setError('ERROR: DOM element "transactionField" not found', spinner);

     if (!validatInput(transactionHash.value)) return setError('ERROR: Transaction field cannot be empty', spinner);

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\nGetting transaction information.\n\n`;
          resultField.value = results;

          const tx = await client.request({
               id: 1,
               command: 'tx',
               transaction: transactionHash.value,
          });

          console.log('Get transaction tx', tx);

          results += parseXRPLTransaction(tx.result);
          resultField.value = results;
          resultField.classList.add('success');
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await disconnectClient();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving getTransaction');
     }
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

const textarea = document.getElementById('resultField');

export function autoResize() {
     if (textarea) {
          textarea.style.height = 'auto';
          textarea.style.height = textarea.scrollHeight + 'px';
     }
}

textarea.addEventListener('input', autoResize);
window.addEventListener('load', autoResize);
