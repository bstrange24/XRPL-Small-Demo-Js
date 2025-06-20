import * as xrpl from 'xrpl';
import { generate, derive } from 'xrpl-accountlib';
import { saveInputValues } from './local-storage';
import { getAccountInfo } from './account';
import { getAMMPoolInfo } from './create-amm.js';
import { getEscrows } from './create-time-escrow.js';
import { EMPTY_STRING } from './constants.js';

let clientInstance = null;
let isConnecting = false;

export function getEnvironment() {
     let environment;
     const network = localStorage.getItem('selectedNetwork');
     if (network === 'devnet') {
          environment = 'Devnet';
     }

     if (network === 'testnet') {
          environment = 'Testnet';
     }

     if (network === 'mainnet') {
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

     if (network === 'mainnet') {
          net = 'wss://s1.ripple.com';
          environment = 'Mainnet';
     }
     return { net, environment };
}

export function prepareTxHashForOutput(hash) {
     if (getEnvironment().environment === 'Devnet') {
          return `https://devnet.xrpl.org/transactions/${hash}\n`;
     } else if (getEnvironment().environment === 'Testnet') {
          return `https://testnet.xrpl.org/transactions/${hash}\n`;
     } else {
          return `https://livenet.xrpl.org/transactions/${hash}\n`;
     }
}

export async function getClient() {
     const { net, environment } = getNet();

     if (clientInstance?.isConnected()) {
          console.debug('Reusing connection');
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
          const client = await getClient();
          await client.disconnect();
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

          issuerNameField.value = EMPTY_STRING;
          issuerAddressField.value = EMPTY_STRING;
          issuerSeedField.value = EMPTY_STRING;
     }

     account1addressField.value = EMPTY_STRING;
     seed1Field.value = EMPTY_STRING;
     account2addressField.value = EMPTY_STRING;
     seed2Field.value = EMPTY_STRING;
     mnemonic1Field.value = EMPTY_STRING;
     mnemonic2Field.value = EMPTY_STRING;
     secretNumbers1Field.value = EMPTY_STRING;
     secretNumbers2Field.value = EMPTY_STRING;
}

export function clearSecretNumberFields() {
     document.getElementById('account1secretNumbers').value = EMPTY_STRING;
     document.getElementById('account2secretNumbers').value = EMPTY_STRING;
     document.getElementById('issuerSecretNumbers').value = EMPTY_STRING;
}

export function clearMnemonicFields() {
     document.getElementById('account1mnemonic').value = EMPTY_STRING;
     document.getElementById('account2mnemonic').value = EMPTY_STRING;
     document.getElementById('issuerMnemonic').value = EMPTY_STRING;
}

export function clearSeedFields() {
     document.getElementById('account1seed').value = EMPTY_STRING;
     document.getElementById('account2seed').value = EMPTY_STRING;
     document.getElementById('issuerSeed').value = EMPTY_STRING;
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
     let addrField = EMPTY_STRING;
     let seedField = EMPTY_STRING;
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
     seedInput.value = EMPTY_STRING;

     try {
          const account = generate.familySeed();
          console.log('Generated account:', account);

          addressInput.value = account.address || 'No address generated';
          seedInput.value = account.secret?.familySeed || EMPTY_STRING;

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
     } catch (err) {
          console.error('Error funding wallet:', err);
     }
};

export async function generateNewWalletFromMnemonic(walletNumber) {
     let addrField = 'account' + walletNumber + 'address';
     let seedField = 'account' + walletNumber + 'seed';
     let mnemonicField = 'account' + walletNumber + 'mnemonic';

     if (walletNumber == 3) {
          addrField = 'issuerAddress';
          seedField = 'issuerSeed';
          mnemonicField = 'issuerMnemonic';
     }

     const addressInput = document.getElementById(addrField);
     const seedInput = document.getElementById(seedField);
     const mnemonic = document.getElementById(mnemonicField);

     if (!addressInput || !seedInput || !mnemonic) {
          console.error('DOM elements not found');
          return;
     }

     addressInput.value = 'Generating';
     seedInput.value = EMPTY_STRING;

     try {
          const account_with_mnemonic = generate.mnemonic();
          console.log('Generated wallet:', account_with_mnemonic);
          addressInput.value = account_with_mnemonic.address || 'No address generated';
          mnemonic.value = account_with_mnemonic.secret?.mnemonic || EMPTY_STRING;

          await fundNewWallet(account_with_mnemonic);
          console.log('Funded wallet complete');

          clearSecretNumberFields();
          clearSeedFields();
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

     if (walletNumber == 3) {
          addrField = 'issuerAddress';
          seedField = 'issuerSeed';
          secretNumbersField = 'issuerSecretNumbers';
     }

     const addressInput = document.getElementById(addrField);
     const seedInput = document.getElementById(seedField);
     const secretNumbers = document.getElementById(secretNumbersField);

     if (!addressInput || !seedInput || !secretNumbers) {
          console.error('DOM elements not found');
          return;
     }

     addressInput.value = 'Generating';
     seedInput.value = EMPTY_STRING;

     try {
          const account_with_secret_numbers = generate.secretNumbers();
          console.log('Generated wallet:', account_with_secret_numbers);
          addressInput.value = account_with_secret_numbers.address || 'No address generated';
          secretNumbers.value = account_with_secret_numbers.secret?.secretNumbers || 'No secret numbers generated';
          seedInput.value = account_with_secret_numbers.secret?.familySeed || 'No seed generated';

          await fundNewWallet(account_with_secret_numbers);
          console.log('Funded wallet complete');

          clearMnemonicFields();
          clearSeedFields();
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
          seedInput.value = derive_account_with_family_seed.secret?.familySeed || EMPTY_STRING;
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
          seedInput.value = derive_account_with_mnemonic.secret?.familySeed || EMPTY_STRING;
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
          seedInput.value = derive_account_with_secret_numbers.secret?.familySeed || EMPTY_STRING;
          secretNumbers.value = derive_account_with_secret_numbers.secret?.secretNumbers;
     } catch (error) {
          console.error('Error:', error);
          addressInput.value = 'Error';
          seedInput.value = error.message || 'Unknown error';
     } finally {
          console.log('Leaving getAccountFromSecretNumbers');
     }
}

export async function populateTakerGetsTakerPayFields() {
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

     const account2addressField = document.getElementById('account2address');
     if (validatInput(account2addressField)) {
          document.getElementById('weWantIssuerField').value = account2addressField.value;
     }

     document.getElementById('weWantCurrencyField').value = 'DOG'; // RLUSD DOGGY
     document.getElementById('weWantAmountField').value = '1';
     document.getElementById('weSpendCurrencyField').value = 'XRP';
     document.getElementById('weSpendAmountField').value = '1';

     const client = await getClient();
     document.getElementById('weWantTokenBalanceField').value = await getOnlyTokenBalance(client, accountAddressField.value, 'DOG'); // RLUSD DOGGY

     await getXrpBalance();

     const withdrawlLpTokenFromPool = document.getElementById('withdrawlLpTokenFromPoolField');
     if (withdrawlLpTokenFromPool) {
          await getAccountInfo();
          await getAMMPoolInfo();
     } else {
          await getAccountInfo();
     }

     document.getElementById('weSpendTokenBalanceField').value = (await client.getXrpBalance(accountAddressField.value.trim())) - totalXrpReservesField.value;
}

export async function populate1() {
     accountNameField.value = account1name.value;
     accountAddressField.value = account1address.value;
     accountSeedField.value = account1seed.value;

     const destinationField = document.getElementById('destinationField');
     if (validatInput(destinationField)) {
          destinationField.value = account2address.value;
     }

     const issuerField = document.getElementById('issuerField');
     if (validatInput(issuerField)) {
          issuerField.value = account2address.value;
          destinationField.value = EMPTY_STRING;
     }

     const amountField = document.getElementById('amountField');
     if (validatInput(amountField)) {
          amountField.value = EMPTY_STRING;
     }

     const memoField = document.getElementById('memoField');
     if (validatInput(memoField)) {
          memoField.value = EMPTY_STRING;
     }

     const escrowOwnerField = document.getElementById('escrowOwnerField');
     if (validatInput(escrowOwnerField)) {
          escrowOwnerField.value = account1address.value;
          await getEscrows();
          getXrpBalance();
     } else {
          getXrpBalance();
          await getAccountInfo();
     }
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
          destinationField.value = EMPTY_STRING;
     }

     const amountField = document.getElementById('amountField');
     if (validatInput(amountField)) {
          amountField.value = EMPTY_STRING;
     }

     const memoField = document.getElementById('memoField');
     if (validatInput(memoField)) {
          memoField.value = EMPTY_STRING;
     }

     getXrpBalance();
     await getAccountInfo();
}

export async function populate3() {
     accountNameField.value = issuerName.value;
     accountAddressField.value = issuerAddress.value;
     accountSeedField.value = issuerSeed.value;

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
          destinationField.value = EMPTY_STRING;
     }

     const amountField = document.getElementById('amountField');
     if (validatInput(amountField)) {
          amountField.value = EMPTY_STRING;
     }

     const memoField = document.getElementById('memoField');
     if (validatInput(memoField)) {
          memoField.value = EMPTY_STRING;
     }

     getXrpBalance();
     await getAccountInfo();
}

export function safeDrops(input) {
     return BigInt(xrpl.xrpToDrops(input.toString().trim()));
}

export function validatInput(value) {
     return !!(value !== null && value !== undefined && value !== EMPTY_STRING);
}

export function setError(message, spinner) {
     if (spinner) spinner.style.display = 'none';

     const resultField = document.getElementById('resultField');
     resultField.innerHTML = message;

     // resultField.value = message;
     resultField.classList.add('error');
}

export function gatherAccountInfo() {
     const resultField = document.getElementById('resultField');
     resultField.classList.remove('error', 'success');
     let seedOrMnemonicOrSecret1 = account1seed.value?.trim() || account1mnemonic.value?.trim() || account1secretNumbers.value?.trim();
     let accountData = account1name.value + '\n' + account1address.value + '\n' + seedOrMnemonicOrSecret1 + '\n';
     let seedOrMnemonicOrSecret2 = account2seed.value?.trim() || account2mnemonic.value?.trim() || account2secretNumbers.value?.trim();
     accountData += account2name.value + '\n' + account2address.value + '\n' + seedOrMnemonicOrSecret2 + '\n';
     if (document.getElementById('issuerName')) {
          let seedOrMnemonicOrSecret3 = issuerSeed.value?.trim() || issuerMnemonic.value?.trim() || issuerSecretNumbers.value?.trim();
          accountData += issuerName.value + '\n' + issuerAddress.value + '\n' + seedOrMnemonicOrSecret3 + '\n';
     }
     resultField.value = accountData;
}

export function distributeAccountInfo() {
     let accountInfo = resultField.value.split('\n');
     account1name.value = accountInfo[0];
     account1address.value = accountInfo[1];

     if (accountInfo[2].split(' ').length > 1) {
          account1mnemonic.value = accountInfo[2];
          account1seed.value = EMPTY_STRING;
          account1secretNumbers.value = EMPTY_STRING;
     } else if (accountInfo[2].includes(',')) {
          account1secretNumbers.value = accountInfo[2];
          account1seed.value = EMPTY_STRING;
          account1mnemonic.value = EMPTY_STRING;
     } else {
          account1seed.value = accountInfo[2];
          account1secretNumbers.value = EMPTY_STRING;
          account1mnemonic.value = EMPTY_STRING;
     }

     account2name.value = accountInfo[3];
     account2address.value = accountInfo[4];

     if (accountInfo[5].split(' ').length > 1) {
          account2mnemonic.value = accountInfo[5];
          account2seed.value = EMPTY_STRING;
          account2secretNumbers.value = EMPTY_STRING;
     } else if (accountInfo[5].includes(',')) {
          account2secretNumbers.value = accountInfo[5];
          account2seed.value = EMPTY_STRING;
          account2mnemonic.value = EMPTY_STRING;
     } else {
          account2seed.value = accountInfo[5];
          account2secretNumbers.value = EMPTY_STRING;
          account2mnemonic.value = EMPTY_STRING;
     }

     if (accountInfo[8].length >= 9) {
          issuerName.value = accountInfo[6];
          issuerAddress.value = accountInfo[7];

          if (accountInfo[8].split(' ').length > 1) {
               issuerMnemonic.value = accountInfo[8];
               issuerSeed.value = EMPTY_STRING;
               issuerSecretNumbers.value = EMPTY_STRING;
          } else if (accountInfo[8].includes(',')) {
               issuerSecretNumbers.value = accountInfo[8];
               issuerSeed.value = EMPTY_STRING;
               issuerMnemonic.value = EMPTY_STRING;
          } else {
               issuerSeed.value = accountInfo[8];
               issuerSecretNumbers.value = EMPTY_STRING;
               issuerMnemonic.value = EMPTY_STRING;
          }
     }
     saveInputValues();
}

export function addSeconds(numOfSeconds, date = new Date()) {
     date.setSeconds(date.getSeconds() + numOfSeconds);
     date = Math.floor(date / 1000);
     date = date - 946684800;

     return date;
}

export function addTime(amount, unit = 'seconds', date = new Date()) {
     const multiplierMap = {
          seconds: 1,
          minutes: 60,
          hours: 3600,
          days: 86400,
     };

     const multiplier = multiplierMap[unit.toLowerCase()];
     if (!multiplier) {
          throw new Error(`Invalid unit: ${unit}. Use 'seconds', 'minutes', 'hours', or 'days'.`);
     }

     const addedSeconds = amount * multiplier;
     const unixTimestamp = Math.floor(date.getTime() / 1000) + addedSeconds;

     // Convert from Unix Epoch (1970) to Ripple Epoch (2000)
     const rippleEpoch = unixTimestamp - 946684800;
     return rippleEpoch;
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

function stripHTML(text) {
     const div = document.createElement('div');
     div.innerHTML = text;
     return div.textContent || div.innerText || EMPTY_STRING;
}

function decodeNFTFlags(flags) {
     if (typeof flags !== 'number') return EMPTY_STRING;

     const flagMap = {
          1: 'Burnable',
          2: 'Only XRP',
          8: 'Transferable',
          16: 'Mutable',
     };

     const result = [];
     for (const [bit, name] of Object.entries(flagMap)) {
          if (flags & bit) result.push(name);
     }

     return result.length ? result.join(', ') : 'None';
}

export function convertToEstTime(UtcDataTime) {
     const utcDate = new Date(UtcDataTime);
     const formatter = dateFormatter();
     return formatter.format(utcDate);
}

export function convertXRPLTime(rippleTime) {
     // Convert Ripple time (seconds since Jan 1, 2000) to UTC datetime
     const rippleEpoch = 946684800; // Jan 1, 2000 in Unix time
     const date = new Date((rippleTime + rippleEpoch) * 1000);
     const formatter = dateFormatter();
     return formatter.format(date);
}

function isValidCTID(input) {
     return /^C[0-9A-Fa-f]+$/.test(input);
}

function isValidTransactionHash(hash) {
     return /^[A-Fa-f0-9]{64}$/.test(hash);
}

export function labelCurrencyCode(code) {
     if (code.length === 40) {
          return `LP-${code.slice(0, 40).toUpperCase()}`;
     } else {
          return code;
     }
}

export function encodeCurrencyCode(code) {
     const encoder = new TextEncoder();
     const codeBytes = encoder.encode(code);

     if (codeBytes.length > 20) throw new Error('Currency code too long');

     // Pad to 20 bytes
     const padded = new Uint8Array(20);
     padded.set(codeBytes);

     return Buffer.from(padded).toString('hex').toUpperCase(); // 40-char hex string
}

// Decode a 40-character hex currency code to its 3-character representation
export function decodeCurrencyCode(hexCode) {
     const buffer = Buffer.from(hexCode, 'hex');
     const trimmed = buffer.subarray(0, buffer.findIndex(byte => byte === 0) === -1 ? 20 : buffer.findIndex(byte => byte === 0));
     return new TextDecoder().decode(trimmed);
}

// Decode hex string to ASCII
export const decodeHex = hex => {
     try {
          if (!validatInput(hex)) {
               return EMPTY_STRING;
          }
          return Buffer.from(hex, 'hex').toString('ascii');
     } catch (error) {
          console.error(`Error decoding hex: ${hex}`, error);
          return hex; // Return raw hex if decoding fails
     }
};

const formatXRPLAmount = value => {
     if (value == null || isNaN(value)) {
          return 'Invalid amount';
     }

     if (typeof value === 'object' && value.currency && value.value) {
          return `${value.value} ${value.currency}${value.issuer ? ` (Issuer: ${value.issuer})` : EMPTY_STRING}`;
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
               allowTrustLineClawback: response.account_flags.allowTrustLineClawback || 'false',
               defaultRipple: response.account_flags.defaultRipple || 'false',
               depositAuth: response.account_flags.depositAuth || 'false',
               disableMasterKey: response.account_flags.disableMasterKey || 'false',
               disallowIncomingCheck: response.account_flags.disallowIncomingCheck || 'false',
               disallowIncomingNFTokenOffer: response.account_flags.disallowIncomingNFTokenOffer || 'false',
               disallowIncomingPayChan: response.account_flags.disallowIncomingPayChan || 'false',
               disallowIncomingTrustline: response.account_flags.disallowIncomingTrustline || 'false',
               disallowIncomingXRP: response.account_flags.disallowIncomingXRP || 'false',
               globalFreeze: response.account_flags.globalFreeze || 'false',
               noFreeze: response.account_flags.noFreeze || 'false',
               passwordSpent: response.account_flags.passwordSpent || 'false',
               requireAuthorization: response.account_flags.requireAuthorization || 'false',
               requireDestinationTag: response.account_flags.requireDestinationTag || 'false',
               burnedNFTokens: response.account_data.BurnedNFTokens || '0',
               domain: decodeHex(response.account_data.Domain) || EMPTY_STRING,
               mintedNFTokens: response.account_data.MintedNFTokens || '0',
               tickSize: response.account_data.TickSize || '0',
               transferRate: parseTransferRateToPercentage(response.account_data.TransferRate) || '0',
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
    Require Destination Tag: ${transactionDetails.requireDestinationTag}
               \nAccount Meta Data:
     BurnedNFTokens: ${transactionDetails.burnedNFTokens}
     Domain: ${transactionDetails.domain}
     MintedNFTokens: ${transactionDetails.mintedNFTokens}
     TickSize: ${transactionDetails.tickSize}
     TransferRate: ${transactionDetails.transferRate}`.trim() + '\n'
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
                    } else if (key === 'Fee' || key === 'Amount' || key === 'DeliverMax' || key === 'SendMax') {
                         formattedValue = formatXRPLAmount(value || '0');
                    } else if (key === 'CancelAfter' || key === 'FinishAfter' || key === 'Expiration') {
                         formattedValue = value ? convertXRPLTime(value) : null;
                    } else if (key === 'Memos' && Array.isArray(value)) {
                         output.push(`    ${key}:`);
                         value.forEach((memoObj, index) => {
                              if (memoObj.Memo) {
                                   const memoType = memoObj.Memo.MemoType ? decodeHex(memoObj.Memo.MemoType) : 'N/A';
                                   const memoData = memoObj.Memo.MemoData ? decodeHex(memoObj.Memo.MemoData) : 'N/A';
                                   output.push(`        Memo ${index + 1}:`);
                                   output.push(`            Type: ${memoType}`);
                                   output.push(`            Data: ${memoData}`);
                              }
                         });
                         return; // Skip adding formattedValue for Memos
                    } else {
                         formattedValue = value;
                    }

                    if (formattedValue !== null && formattedValue !== undefined) {
                         if (typeof value === 'object' && value !== null) {
                              output.push(`    ${key}:`);
                              Object.entries(value).forEach(([subKey, subValue]) => {
                                   if (subValue !== null && subValue !== undefined) {
                                        if (subValue.length == 40) {
                                             let subValueTemp = decodeCurrencyCode(subValue);
                                             if (subValueTemp.length > 10) {
                                                  subValue = labelCurrencyCode(subValue);
                                             } else {
                                                  subValue = subValueTemp;
                                             }
                                        } else if (subValue.Signer != undefined) {
                                             subValue = `Account: ${subValue.Signer.Account} Txn Signature: ${subValue.Signer.TxnSignature}`;
                                        }
                                        output.push(`        ${subKey}: ${subValue}`);
                                   }
                              });
                         } else {
                              output.push(`    ${key}: ${formattedValue}`);
                         }
                    }
               }
          });

          // output.push('\nGeneral Metadata:');
          if (closeTimeIso) output.push(`    close_time_iso: ${convertToEstTime(closeTimeIso)}`);
          if (hash) output.push(`    hash: ${hash}`);
          if (ledgerHash) output.push(`    ledger_hash: ${ledgerHash}`);
          if (validated !== null) output.push(`    validated: ${validated}`);

          // Extract metadata
          const meta = result.meta || {};
          output.push('\nMetadata:');
          if (meta.TransactionResult) output.push(`    TransactionResult: ${meta.TransactionResult}`);
          if (meta.TransactionIndex !== undefined) output.push(`    TransactionIndex: ${meta.TransactionIndex}`);
          if (meta.delivered_amount) output.push(`    Delivered Amout: ${formatXRPLAmount(meta.delivered_amount || '0')}`);
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
                                             // console.log(`Key: ${field.key}, Value: ${value || 'N/A'}`);
                                             if (field.key === 'NFTokens' && Array.isArray(value)) {
                                                  output.push(`                ${field.key}:`);
                                                  value.forEach(nft => {
                                                       output.push(`                    NFToken`);
                                                       Object.entries(nft.NFToken).forEach(([subKey, subValue]) => {
                                                            if (subValue !== null && subValue !== undefined) {
                                                                 if (subValue.length == 40) {
                                                                      let subValueTemp = decodeCurrencyCode(subValue);
                                                                      if (subValueTemp.length > 10) {
                                                                           subValue = labelCurrencyCode(subValue);
                                                                      } else {
                                                                           subValue = subValueTemp;
                                                                      }
                                                                 } else if (subValue.SignerEntry != undefined) {
                                                                      subValue = `Account: ${subValue.SignerEntry.Account} Signer Weight: ${subValue.SignerEntry.SignerWeight}`;
                                                                 }
                                                                 output.push(`                        ${subKey}: ${subValue}`);
                                                            }
                                                       });
                                                  });
                                             } else if (typeof value === 'object' && value !== null) {
                                                  output.push(`                ${field.key}:`);
                                                  Object.entries(value).forEach(([subKey, subValue]) => {
                                                       if (subValue !== null && subValue !== undefined) {
                                                            if (subValue.length == 40) {
                                                                 let subValueTemp = decodeCurrencyCode(subValue);
                                                                 if (subValueTemp.length > 10) {
                                                                      subValue = labelCurrencyCode(subValue);
                                                                 } else {
                                                                      subValue = subValueTemp;
                                                                 }
                                                            } else if (subValue.SignerEntry != undefined) {
                                                                 subValue = `Account: ${subValue.SignerEntry.Account} Signer Weight: ${subValue.SignerEntry.SignerWeight}`;
                                                            }
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
                                                                      if (subValue.length == 40) {
                                                                           let subValueTemp = decodeCurrencyCode(subValue);
                                                                           if (subValueTemp.length > 10) {
                                                                                subValue = labelCurrencyCode(subValue);
                                                                           } else {
                                                                                subValue = subValueTemp;
                                                                           }
                                                                      }
                                                                      output.push(`                        ${subKey}: ${subValue}`);
                                                                 }
                                                            });
                                                       });
                                                  } else if (typeof value === 'object' && value !== null) {
                                                       output.push(`                ${key}:`);
                                                       Object.entries(value).forEach(([subKey, subValue]) => {
                                                            if (subValue !== null && subValue !== undefined) {
                                                                 if (subValue.length == 40) {
                                                                      let subValueTemp = decodeCurrencyCode(subValue);
                                                                      if (subValueTemp.length > 10) {
                                                                           subValue = labelCurrencyCode(subValue);
                                                                      } else {
                                                                           subValue = subValueTemp;
                                                                      }
                                                                 } else if (subValue.SignerEntry != undefined) {
                                                                      subValue = `Account: ${subValue.SignerEntry.Account} Signer Weight: ${subValue.SignerEntry.SignerWeight}`;
                                                                 }
                                                                 output.push(`                    ${subKey}: ${subValue}`);
                                                            }
                                                       });
                                                  } else {
                                                       if (key === 'Balance') {
                                                            output.push(`                ${key}: ${formatXRPLAmount(value || '0')}`);
                                                       } else {
                                                            output.push(`                ${key}: ${value}`);
                                                       }
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
          return output.join('\n');
     } catch (error) {
          console.error('Error parsing XRPL transaction:', error);
          return `Error: Failed to parse XRPL transaction\nDetails: ${error.message}`;
     }
}

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
               { key: 'DestinationTag', format: v => v || null },
               { key: 'Sequence', format: v => v || null },
               { key: 'CancelAfter', format: v => (v ? convertXRPLTime(v) : null) },
               { key: 'FinishAfter', format: v => (v ? convertXRPLTime(v) : null) },
               { key: 'Condition', format: v => v || null },
               { key: 'memo', format: v => v || null },
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
               { key: 'Expiration', format: v => (v ? convertXRPLTime(v) : null) },
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
               { key: 'Flags', format: v => v || null },
               { key: 'OwnerNode', format: v => v || null },
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
               { key: 'Flags', format: v => decodeNFTFlags(Number(v)) },
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
               // { key: 'Asset1', format: v => `${v.currency} (Issuer: ${v.issuer || null})` },
               // { key: 'Asset2', format: v => `${v.currency} (Issuer: ${v.issuer || null})` },
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
               { key: 'Flags', format: v => v || null },
               { key: 'SignerQuorum', format: v => v || null },
               { key: 'SignerEntries', format: v => (Array.isArray(v) ? v.map(e => e.SignerEntry.Account).join(', ') : null) },
               { key: 'SignerListID', format: v => v || null },
               { key: 'PreviousTxnID', format: v => v || null },
               { key: 'PreviousTxnLgrSeq', format: v => v || null },
               { key: 'index', format: v => v || null },
          ],
          label: 'Signer List',
          pluralLabel: 'Signer Lists',
     },
     NFT: {
          fields: [
               // { key: 'Flags', format: v => v || '0' },
               { key: 'Flags', format: v => decodeNFTFlags(Number(v)) },
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
                    if (entryType === 'Unknown' && obj.taker_pays != undefined && obj.taker_pays != EMPTY_STRING) {
                         entryType = 'Offers';
                    }
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
                    let label = group.length > 1 ? typeConfig.pluralLabel : typeConfig.label;
                    if (label.endsWith('s')) {
                         label = label.slice(0, -1); // removes last character
                    }
                    output.push(`${label} ${groupIndex}`);

                    if (group.length > 1) {
                         // For multiple objects, add LedgerEntryType and pluralized container
                         // output.push(`    LedgerEntryType: ${entryType === 'NFT' ? 'NFTs' : typeConfig.pluralLabel}`);
                         // output.push(`    ${typeConfig.pluralLabel}:`);
                         output.push(`    LedgerEntryType: ${entryType === 'NFT' ? 'NFTs' : label}`);
                         output.push(`    ${label}:`);
                         group.forEach(obj => {
                              output.push(`        ${typeConfig.label}`);
                              typeConfig.fields.forEach(field => {
                                   const value = obj[field.key];
                                   const formattedValue = field.format(value);
                                   if (formattedValue !== null && formattedValue !== undefined) {
                                        // console.log(`Key: ${field.key}, Value: ${value || 'N/A'}`);
                                        if (typeof value === 'object' && value !== null) {
                                             output.push(`            ${field.key}:`);
                                             Object.entries(value).forEach(([subKey, subValue]) => {
                                                  if (subValue !== null && subValue !== undefined) {
                                                       if (subValue.length == 40) {
                                                            // subValue = decodeCurrencyCode(subValue);
                                                            let subValueTemp = decodeCurrencyCode(subValue);
                                                            if (subValueTemp.length > 10) {
                                                                 subValue = labelCurrencyCode(subValue);
                                                            } else {
                                                                 subValue = subValueTemp;
                                                            }
                                                       }
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
                                        // console.log(`Key: ${field.key}, Value: ${value || 'N/A'}`);
                                        if (field.key === 'NFTokens' && Array.isArray(value)) {
                                             output.push(`    ${field.key}:`);
                                             value.forEach(nft => {
                                                  output.push(`        NFToken`);
                                                  Object.entries(nft.NFToken).forEach(([subKey, subValue]) => {
                                                       if (subValue !== null && subValue !== undefined) {
                                                            if (subValue.length == 40) {
                                                                 // subValue = decodeCurrencyCode(subValue);
                                                                 let subValueTemp = decodeCurrencyCode(subValue);
                                                                 if (subValueTemp.length > 10) {
                                                                      subValue = labelCurrencyCode(subValue);
                                                                 } else {
                                                                      subValue = subValueTemp;
                                                                 }
                                                            }
                                                            output.push(`            ${subKey}: ${subValue}`);
                                                       }
                                                  });
                                             });
                                        } else if (typeof value === 'object' && value !== null) {
                                             output.push(`    ${field.key}:`);
                                             Object.entries(value).forEach(([subKey, subValue]) => {
                                                  if (subValue !== null && subValue !== undefined) {
                                                       if (subValue.length == 40) {
                                                            // subValue = decodeCurrencyCode(subValue);
                                                            let subValueTemp = decodeCurrencyCode(subValue);
                                                            if (subValueTemp.length > 10) {
                                                                 subValue = labelCurrencyCode(subValue);
                                                            } else {
                                                                 subValue = subValueTemp;
                                                            }
                                                       } else if (subValue.SignerEntry != undefined) {
                                                            subValue = `Account: ${subValue.SignerEntry.Account} Signer Weight: ${subValue.SignerEntry.SignerWeight}`;
                                                       }
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
          if (ledgerHash !== 'N/A') output.push(`\nLedger Hash: ${ledgerHash}`);
          output.push(`Ledger ${response.ledger_index ? 'index' : 'current_index'}: ${ledgerIndex}`);
          output.push(`Validated: ${validated}`);

          return output.join('\n');
     } catch (error) {
          console.error('Error parsing XRPL response:', error);
          return `Error: Failed to parse XRPL response\nDetails: ${error.message}`;
     }
}

export async function getTransaction() {
     console.log('Entering getTransaction');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');
     resultField.innerHTML = EMPTY_STRING; // Clear content

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     let transactionInput = document.getElementById('transactionField');
     if (!transactionInput) return setError('ERROR: DOM element "transactionField" not found', spinner);
     transactionInput = transactionInput.value.trim();
     if (!transactionInput) return setError('ERROR: Transaction field cannot be empty', spinner);

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.innerHTML = `Connected to ${environment} ${net}\nGetting transaction information.\n\n`;

          // Determine if input is a transaction hash or CTID
          let requestParams = { id: 1, command: 'tx' };
          if (isValidTransactionHash(transactionInput)) {
               requestParams.transaction = transactionInput;
          } else if (isValidCTID(transactionInput)) {
               requestParams.ctid = transactionInput;
          } else {
               return setError('ERROR: Invalid input. Must be a valid Transaction Hash orCTID', spinner);
          }

          const tx = await client.request(requestParams);
          console.log('Get transaction response', tx);
          renderTransactionDetails(tx);
          resultField.classList.add('success');
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`, spinner);
     } finally {
          if (spinner) spinner.style.display = 'none';
          console.log('Leaving getTransaction');
     }
}

export async function getOnlyTokenBalance(client, wallet, currency) {
     try {
          const lines = await client.request({
               command: 'account_lines',
               account: wallet,
          });

          if (currency.length > 3) {
               currency = encodeCurrencyCode(currency);
          }
          const tstLines = lines.result.lines.filter(line => line.currency === currency);
          const tstBalance = tstLines.reduce((sum, line) => sum + parseFloat(line.balance), 0);
          return tstBalance;
     } catch (error) {
          log.error('Error fetching token balance:', error);
          return error;
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
                    const balance = await client.getXrpBalance(accountAddressField.value.trim());
                    console.log(`Account ${accountAddressField.value.trim()} is funded. Balance: ${balance} XRP`);
                    xrpBalanceField.value = balance;
                    break;
               } catch (err) {
                    if (err.message.includes('Account not found')) {
                         console.log(`Waiting for account ${accountAddressField.value.trim()} to be activated`);
                         await new Promise(res => setTimeout(res, delayMs));
                    } else {
                         throw err;
                    }
               }
          }
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
     } finally {
          if (spinner) spinner.style.display = 'none';
          console.log('Leaving getXrpBalance');
     }
}

export async function getCurrentLedger(client) {
     try {
          // Get the current ledger index from the client
          const ledger_info = await client.request({
               command: 'ledger',
               ledger_index: 'current',
          });
          return ledger_info.result.ledger_current_index;
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
     }
}

export async function getAccountReserves(client, address) {
     try {
          // Get the current ledger index from the client
          const account_info = await client.request({
               command: 'account_info',
               account: address,
               ledger_index: 'validated',
          });

          const accountData = account_info.result.account_data;
          const ownerCount = accountData.OwnerCount;

          const { reserveBaseXRP, reserveIncrementXRP } = await getXrplReserve(client);
          const totalReserveXRP = reserveBaseXRP + ownerCount * reserveIncrementXRP;

          return { ownerCount, totalReserveXRP };
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
     }
}

export async function getXrplReserve(client) {
     try {
          // Get the current ledger index from the client
          const server_info = await client.request({
               command: 'server_info',
          });
          console.debug(`Server Info ${JSON.stringify(server_info, null, 2)}`);
          console.debug(`Base Fee: ${server_info.result.info.validated_ledger.base_fee_xrp} XRP`);
          console.debug(`Base Reserve: ${server_info.result.info.validated_ledger.reserve_base_xrp} XRP`);
          console.debug(`Total incremental owner count: ${server_info.result.info.validated_ledger.reserve_inc_xrp} XRP`);

          const ledger_info = await client.request({
               command: 'server_state',
               ledger_index: 'current',
          });

          const ledgerData = ledger_info.result.state.validated_ledger;
          const baseFee = ledgerData.base_fee;
          const reserveBaseXRP = ledgerData.reserve_base;
          const reserveIncrementXRP = ledgerData.reserve_inc;

          console.debug(`baseFee: ${baseFee}`);
          console.debug(`reserveBaseXRP: ${xrpl.dropsToXrp(reserveBaseXRP)}`);
          console.debug(`Total incremental owner count: ${xrpl.dropsToXrp(reserveIncrementXRP)} XRP`);
          console.debug(`Total Reserve: ${xrpl.dropsToXrp(reserveIncrementXRP)} XRP`);

          return { reserveBaseXRP, reserveIncrementXRP };
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
     }
}

export async function updateOwnerCountAndReserves(client, address, ownerCountField, totalXrpReservesField) {
     const { ownerCount, totalReserveXRP } = await getAccountReserves(client, address);
     console.log(`Owner Count: ${ownerCount} Total XRP Reserves: ${xrpl.dropsToXrp(totalReserveXRP)}`);
     ownerCountField.value = ownerCount;
     totalXrpReservesField.value = xrpl.dropsToXrp(totalReserveXRP);
}

export function convertUserInputToInt(userInput) {
     const input = parseInt(userInput);
     if (isNaN(input) || input < 0) {
          throw new Error(`Invalid user input. ${userInput} is not a valid number and cannot be less than zero`);
     }
     return input;
}

export function convertUserInputToFloat(userInput) {
     const input = parseFloat(userInput);
     if (isNaN(input) || input < 0) {
          throw new Error(`Invalid user input. ${userInput} is not a valid number and cannot be less than zero`);
     }
     return input;
}

export function getTransferRate(userInput) {
     const ratePercent = convertUserInputToFloat(userInput);
     return Math.round(1_000_000_000 * (1 + ratePercent / 100));
}

export function parseTransferRateToPercentage(transferRate) {
     const rate = parseInt(transferRate, 10);
     if (isNaN(rate) || rate < 1_000_000_000) {
          return 0; // Default rate is 0% fee (1.0x multiplier)
     }
     return (rate / 1_000_000_000 - 1) * 100;
}

export function renderAccountDetails(accountInfo, accountObjects) {
     const container = document.getElementById('resultField');
     if (!container) {
          console.error('Error: #resultField not found');
          return;
     }
     container.innerHTML = ''; // Clear content

     // Add search bar
     const searchBar = document.createElement('input');
     searchBar.type = 'text';
     searchBar.id = 'resultSearch';
     searchBar.placeholder = 'Search account info...';
     searchBar.className = 'result-search';
     searchBar.style.boxSizing = 'border-box';
     container.appendChild(searchBar);

     // Group account objects by LedgerEntryType while preserving order
     const objectsByType = accountObjects.account_objects.reduce((acc, obj, idx) => {
          const type = obj.LedgerEntryType;
          if (!acc[type]) {
               acc[type] = { type, objects: [], order: idx };
          }
          acc[type].objects.push({ ...obj, originalIndex: idx });
          return acc;
     }, {});

     // Convert grouped objects to subSections
     const subSections = Object.values(objectsByType)
          .sort((a, b) => {
               // Prioritize RippleState, then maintain original order
               if (a.type === 'RippleState' && b.type !== 'RippleState') return -1;
               if (a.type !== 'RippleState' && b.type === 'RippleState') return 1;
               return a.order - b.order;
          })
          .map(group => {
               const nestedFields =
                    {
                         RippleState: ['Balance', 'HighLimit', 'LowLimit'],
                         Offer: ['TakerPays', 'TakerGets'],
                         SignerList: ['SignerEntries'],
                         Check: ['Amount', 'DestinationTag', 'SourceTag'],
                         Escrow: ['Amount', 'Condition', 'DestinationTag', 'SourceTag'],
                         PayChannel: ['Amount', 'Balance', 'PublicKey', 'DestinationTag', 'SourceTag'],
                         NFTokenPage: ['NFTokens'],
                         Ticket: [],
                         DepositPreauth: [],
                         AMMBid: ['BidMin', 'BidMax', 'AuthAccounts'],
                         AMM: ['LPTokenBalance', 'TradingFee', 'Asset', 'Asset2'],
                    }[group.type] || [];

               const subItems = group.objects.map((obj, idx) => {
                    const subItemContent = Object.entries(obj)
                         .filter(([k]) => !nestedFields.includes(k) && k !== 'originalIndex')
                         .map(([key, value]) => ({
                              key,
                              value: key.includes('PreviousTxnID') || key.includes('index') || key === 'Account' || key.includes('PublicKey') ? `<code>${value}</code>` : value,
                         }));

                    const subItemSubItems = nestedFields
                         .filter(field => obj[field])
                         .map(field => {
                              let content;
                              if (field === 'SignerEntries') {
                                   content = obj[field].map((entry, i) => ({
                                        key: `Signer ${i + 1}`,
                                        value: `<code>${entry.SignerEntry.Account}</code> (Weight: ${entry.SignerEntry.SignerWeight})`,
                                   }));
                              } else if (field === 'NFTokens') {
                                   content = obj[field].map((nft, i) => ({
                                        key: `NFT ${i + 1}`,
                                        value: `<code>${nft.NFToken.NFTokenID}</code> \nURI: ${decodeHex(nft.NFToken.URI)}`,
                                   }));
                              } else if (field === 'AuthAccounts') {
                                   content = obj[field].map((acc, i) => ({
                                        key: `Account ${i + 1}`,
                                        value: `<code>${acc.AuthAccount.Account}</code>`,
                                   }));
                              } else if (typeof obj[field] === 'object') {
                                   content = Object.entries(obj[field]).map(([k, v]) => ({
                                        key: k,
                                        value: k === 'issuer' || k === 'index' || k === 'Account' ? `<code>${v}</code>` : v,
                                   }));
                              } else {
                                   content = [{ key: field, value: obj[field] }];
                              }
                              return { key: field, content };
                         });

                    return {
                         id: `${group.type} ${idx + 1}`,
                         content: subItemContent,
                         subItems: subItemSubItems,
                    };
               });

               return {
                    type: group.type,
                    id: group.type, // e.g., "RippleState"
                    content: [], // No direct content for group
                    subItems,
               };
          });

     const sections = {
          account: {
               title: 'Account Data',
               content: [
                    { key: 'Account', value: `<code>${accountInfo.account_data.Account}</code>` },
                    { key: 'Balance', value: (parseInt(accountInfo.account_data.Balance) / 1_000_000).toFixed(6) + ' XRP' },
                    { key: 'OwnerCount', value: accountInfo.account_data.OwnerCount },
                    { key: 'Sequence', value: accountInfo.account_data.Sequence },
               ],
          },
          metadata: {
               title: 'Account Meta Data',
               content: [
                    { key: 'BurnedNFTokens', value: accountInfo.account_data.BurnedNFTokens },
                    { key: 'MintedNFTokens', value: accountInfo.account_data.MintedNFTokens },
                    {
                         key: 'Domain',
                         value: accountInfo.account_data.Domain ? Buffer.from(accountInfo.account_data.Domain, 'hex').toString('ascii') : 'Not Set',
                    },
                    { key: 'TickSize', value: accountInfo.account_data.TickSize },
                    { key: 'TransferRate', value: (accountInfo.account_data.TransferRate / 1_000_000_000).toFixed(9) },
                    { key: 'FirstNFTokenSequence', value: accountInfo.account_data.FirstNFTokenSequence },
               ],
          },
          flags: {
               title: 'Flag Details',
               content: Object.entries(accountInfo.account_flags).map(([key, value]) => ({
                    key,
                    value: value ? '<span class="flag-true">True</span>' : 'False',
               })),
          },
          objects: {
               title: 'Account Objects',
               content: [],
               subSections,
          },
     };

     // Render sections
     for (const section of Object.values(sections)) {
          if (section.content.length || (section.subSections && section.subSections.length)) {
               const details = document.createElement('details');
               details.className = 'result-section';
               if (section.title === 'Account Data') {
                    details.setAttribute('open', 'open');
               }
               const summary = document.createElement('summary');
               summary.textContent = section.title;
               details.appendChild(summary);

               if (section.content.length) {
                    const table = document.createElement('div');
                    table.className = 'result-table';
                    const header = document.createElement('div');
                    header.className = 'result-row result-header';
                    header.innerHTML = `
                     <div class="result-cell key">Key</div>
                     <div class="result-cell value">Value</div>
                 `;
                    table.appendChild(header);

                    for (const item of section.content) {
                         const row = document.createElement('div');
                         row.className = 'result-row';
                         row.innerHTML = `
                         <div class="result-cell key">${item.key}</div>
                         <div class="result-cell value">${item.value}</div>
                     `;
                         table.appendChild(row);
                    }
                    details.appendChild(table);
               }

               if (section.subSections) {
                    for (const group of section.subSections) {
                         const groupDetails = document.createElement('details');
                         groupDetails.className = 'object-group'; // New class for groups
                         const groupSummary = document.createElement('summary');
                         groupSummary.textContent = group.id;
                         groupDetails.appendChild(groupSummary);

                         if (group.content.length) {
                              const groupTable = document.createElement('div');
                              groupTable.className = 'result-table';
                              const groupHeader = document.createElement('div');
                              groupHeader.className = 'result-row result-header';
                              groupHeader.innerHTML = `
                             <div class="result-cell key">Key</div>
                             <div class="result-cell value">Value</div>
                         `;
                              groupTable.appendChild(groupHeader);

                              for (const item of group.content) {
                                   const row = document.createElement('div');
                                   row.className = 'result-row';
                                   row.innerHTML = `
                                 <div class="result-cell key">${item.key}</div>
                                 <div class="result-cell value">${item.value}</div>
                             `;
                                   groupTable.appendChild(row);
                              }
                              groupDetails.appendChild(groupTable);
                         }

                         for (const subItem of group.subItems) {
                              const objDetails = document.createElement('details');
                              objDetails.className = 'nested-object';
                              const objSummary = document.createElement('summary');
                              objSummary.textContent = subItem.id;
                              objDetails.appendChild(objSummary);

                              if (subItem.content.length) {
                                   const objTable = document.createElement('div');
                                   objTable.className = 'result-table';
                                   const objHeader = document.createElement('div');
                                   objHeader.className = 'result-row result-header';
                                   objHeader.innerHTML = `
                                 <div class="result-cell key">Key</div>
                                 <div class="result-cell value">Value</div>
                             `;
                                   objTable.appendChild(objHeader);

                                   for (const item of subItem.content) {
                                        const row = document.createElement('div');
                                        row.className = 'result-row';
                                        row.innerHTML = `
                                     <div class="result-cell key">${item.key}</div>
                                     <div class="result-cell value">${item.value}</div>
                                 `;
                                        objTable.appendChild(row);
                                   }
                                   objDetails.appendChild(objTable);
                              }

                              for (const nestedItem of subItem.subItems) {
                                   const nestedDetails = document.createElement('details');
                                   nestedDetails.className = 'nested-object';
                                   const nestedSummary = document.createElement('summary');
                                   nestedSummary.textContent = nestedItem.key;
                                   nestedDetails.appendChild(nestedSummary);

                                   const nestedTable = document.createElement('div');
                                   nestedTable.className = 'result-table';
                                   const nestedHeader = document.createElement('div');
                                   nestedHeader.className = 'result-row result-header';
                                   nestedHeader.innerHTML = `
                                 <div class="result-cell key">Key</div>
                                 <div class="result-cell value">Value</div>
                             `;
                                   nestedTable.appendChild(nestedHeader);

                                   for (const nestedContent of nestedItem.content) {
                                        const nestedRow = document.createElement('div');
                                        nestedRow.className = 'result-row';
                                        nestedRow.innerHTML = `
                                     <div class="result-cell key">${nestedContent.key}</div>
                                     <div class="result-cell value">${nestedContent.value}</div>
                                 `;
                                        nestedTable.appendChild(nestedRow);
                                   }
                                   nestedDetails.appendChild(nestedTable);
                                   objDetails.appendChild(nestedDetails);
                              }

                              groupDetails.appendChild(objDetails);
                         }

                         details.appendChild(groupDetails);
                    }
               }

               container.appendChild(details);
          }
     }

     // Add toggle event listeners and persist state
     document.querySelectorAll('.result-section, .object-group, .nested-object').forEach(details => {
          const summary = details.querySelector('summary');
          if (summary) {
               const title = summary.textContent;
               const savedState = localStorage.getItem(`collapse_${title}`);
               if (savedState === 'closed') details.removeAttribute('open');
               else if (
                    savedState === 'open' ||
                    title === 'Account Data' ||
                    title === 'RippleState' // Open RippleState group by default
               ) {
                    details.setAttribute('open', 'open');
               }
               details.addEventListener('toggle', () => {
                    localStorage.setItem(`collapse_${title}`, details.open ? 'open' : 'closed');
                    container.offsetHeight;
                    container.style.height = 'auto';
               });
          }
     });

     // Search functionality
     searchBar.addEventListener('input', e => {
          const search = e.target.value.toLowerCase().trim();
          const sections = document.querySelectorAll('.result-section');

          if (!search) {
               sections.forEach(section => {
                    section.style.display = '';
                    section.querySelectorAll('.result-row').forEach(row => (row.style.display = 'flex'));
                    section.querySelectorAll('.object-group, .nested-object').forEach(nested => {
                         nested.style.display = '';
                         nested.querySelectorAll('.result-row').forEach(row => (row.style.display = 'flex'));
                    });
                    const title = section.querySelector('summary').textContent;
                    if (title === 'Account Data') {
                         section.setAttribute('open', 'open');
                    } else {
                         section.removeAttribute('open');
                    }
               });
               return;
          }

          sections.forEach(section => {
               let hasVisibleContent = false;
               const directRows = section.querySelectorAll(':scope > .result-table > .result-row:not(.result-header)');
               directRows.forEach(row => {
                    const keyText = stripHTML(row.querySelector('.key').innerHTML).toLowerCase();
                    const valueText = stripHTML(row.querySelector('.value').innerHTML).toLowerCase();
                    const isMatch = keyText.includes(search) || valueText.includes(search);
                    row.style.display = isMatch ? 'flex' : 'none';
                    if (isMatch) hasVisibleContent = true;
               });

               const groupDetails = section.querySelectorAll('.object-group');
               groupDetails.forEach(group => {
                    let groupHasVisibleContent = false;
                    const nestedDetails = group.querySelectorAll('.nested-object');
                    nestedDetails.forEach(nested => {
                         let nestedHasVisibleContent = false;
                         const tableRows = nested.querySelectorAll('.result-table > .result-row:not(.result-header)');
                         tableRows.forEach(row => {
                              const keyText = stripHTML(row.querySelector('.key').innerHTML).toLowerCase();
                              const valueText = stripHTML(row.querySelector('.value').innerHTML).toLowerCase();
                              const isMatch = keyText.includes(search) || valueText.includes(search);
                              row.style.display = isMatch ? 'flex' : 'none';
                              if (isMatch) nestedHasVisibleContent = true;
                         });

                         const deeperDetails = nested.querySelectorAll('.nested-object');
                         deeperDetails.forEach(deeper => {
                              let deeperHasVisibleContent = false;
                              const deeperRows = deeper.querySelectorAll('.result-table > .result-row:not(.result-header)');
                              deeperRows.forEach(row => {
                                   const keyText = stripHTML(row.querySelector('.key').innerHTML).toLowerCase();
                                   const valueText = stripHTML(row.querySelector('.value').innerHTML).toLowerCase();
                                   const isMatch = keyText.includes(search) || valueText.includes(search);
                                   row.style.display = isMatch ? 'flex' : 'none';
                                   if (isMatch) deeperHasVisibleContent = true;
                              });
                              deeper.style.display = deeperHasVisibleContent ? '' : 'none';
                              if (deeperHasVisibleContent) nestedHasVisibleContent = true;
                         });

                         nested.style.display = nestedHasVisibleContent ? '' : 'none';
                         if (nestedHasVisibleContent) groupHasVisibleContent = true;
                    });

                    group.style.display = groupHasVisibleContent ? '' : 'none';
                    if (groupHasVisibleContent) hasVisibleContent = true;
               });

               section.style.display = hasVisibleContent ? '' : 'none';
               if (hasVisibleContent) section.setAttribute('open', 'open');
          });
     });
}

export function renderPaymentChannelDetails(data) {
     const container = document.getElementById('resultField');
     if (!container) {
          console.error('Error: #resultField not found');
          return;
     }
     container.classList.remove('error', 'success');
     container.innerHTML = '';

     // Add search bar
     const searchBar = document.createElement('input');
     searchBar.type = 'text';
     searchBar.id = 'resultSearch';
     searchBar.placeholder = 'Search results...';
     searchBar.className = 'result-search';
     searchBar.style.boxSizing = 'border-box';
     container.appendChild(searchBar);

     // Render sections
     for (const section of data.sections) {
          if (!section.content && !section.subItems) continue;

          const details = document.createElement('details');
          details.className = 'result-section';
          if (section.openByDefault) {
               details.setAttribute('open', 'open');
          }
          const summary = document.createElement('summary');
          summary.textContent = section.title;
          details.appendChild(summary);

          // Render direct content (e.g., Network in Connection Status)
          if (section.content && section.content.length) {
               const table = document.createElement('div');
               table.className = 'result-table';
               const header = document.createElement('div');
               header.className = 'result-row result-header';
               header.innerHTML = `
                 <div class="result-cell key" data-key="Key">Key</div>
                 <div class="result-cell value" data-key="Value">Value</div>
             `;
               table.appendChild(header);

               for (const item of section.content) {
                    const row = document.createElement('div');
                    row.className = 'result-row';
                    row.innerHTML = `
                     <div class="result-cell key" data-key="Key">${item.key}</div>
                     <div class="result-cell value" data-key="Value">${item.value}</div>
                 `;
                    table.appendChild(row);
               }
               details.appendChild(table);
          }

          // Render nested sub-items (e.g., Channels)
          if (section.subItems && section.subItems.length) {
               for (const subItem of section.subItems) {
                    const subDetails = document.createElement('details');
                    subDetails.className = 'nested-object';
                    if (subItem.openByDefault) {
                         subDetails.setAttribute('open', 'open');
                    }
                    const subSummary = document.createElement('summary');
                    subSummary.textContent = subItem.key;
                    subDetails.appendChild(subSummary);

                    const subTable = document.createElement('div');
                    subTable.className = 'result-table';
                    const subHeader = document.createElement('div');
                    subHeader.className = 'result-row result-header';
                    subHeader.innerHTML = `
                     <div class="result-cell key" data-key="Key">Key</div>
                     <div class="result-cell value" data-key="Value">Value}</div>
                 `;
                    subTable.appendChild(subHeader);

                    for (const subContent of subItem.content) {
                         const subRow = document.createElement('div');
                         subRow.className = 'result-row';
                         subRow.innerHTML = `
                         <div class="result-cell key" data-key="Key">${subContent.key}</div>
                         <div class="result-cell value" data-key="Value">${subContent.value || ''}</div>
                     `;
                         subTable.appendChild(subRow);
                    }
                    subDetails.appendChild(subTable);
                    details.appendChild(subDetails);
               }
          }

          container.appendChild(details);
     }

     // Add search functionality
     searchBar.addEventListener('input', e => {
          const search = e.target.value.toLowerCase().trim();
          const sections = container.querySelectorAll('.result-section');

          if (!search) {
               sections.forEach(section => {
                    section.style.display = '';
                    section.querySelectorAll('.result-row').forEach(row => (row.style.display = 'flex'));
                    section.querySelectorAll('.nested-object').forEach(nested => {
                         nested.style.display = 'block';
                         nested.querySelectorAll('.result-row').forEach(row => (row.style.display = 'flex'));
                    });
                    const title = section.querySelector('summary').textContent;
                    if (data.sections.find(s => s.title === title && s.openByDefault)) {
                         section.setAttribute('open', 'open');
                    } else {
                         section.removeAttribute('open');
                    }
               });
               return;
          }

          sections.forEach(section => {
               let hasVisibleContent = false;
               const directRows = section.querySelectorAll(':scope > .result-table > .result-row:not(.result-header)');
               directRows.forEach(row => {
                    const keyText = stripHTML(row.querySelector('.key').innerHTML).toLowerCase();
                    const valueText = stripHTML(row.querySelector('.value').innerHTML).toLowerCase();
                    const isMatch = keyText.includes(search) || valueText.includes(search);
                    row.style.display = isMatch ? 'flex' : 'none';
                    if (isMatch) hasVisibleContent = true;
               });

               const nestedDetails = section.querySelectorAll('.nested-object');
               nestedDetails.forEach(nested => {
                    let nestedHasVisibleContent = false;
                    const allTableRows = nested.querySelectorAll('.result-table .result-row:not(.result-header)');
                    allTableRows.forEach(row => {
                         const keyText = stripHTML(row.querySelector('.key').innerHTML).toLowerCase();
                         const valueText = stripHTML(row.querySelector('.value').innerHTML).toLowerCase();
                         const isMatch = keyText.includes(search) || valueText.includes(search);
                         row.style.display = isMatch ? 'flex' : 'none';
                         if (isMatch) nestedHasVisibleContent = true;
                    });
                    nested.style.display = nestedHasVisibleContent ? 'block' : 'none';
                    if (nestedHasVisibleContent) {
                         nested.setAttribute('open', 'open');
                         hasVisibleContent = true;
                    }
               });

               section.style.display = hasVisibleContent ? 'block' : 'none';
               if (hasVisibleContent) section.setAttribute('open', 'open');
          });
     });

     // Add toggle listeners for dynamic resizing
     container.querySelectorAll('.result-section, .nested-object').forEach(details => {
          details.addEventListener('toggle', () => {
               container.offsetHeight;
               container.style.height = 'auto';
          });
     });

     container.classList.add('success');
}

export function renderTransactionDetails(transactionResponse) {
     console.log(`transactionResponse ${JSON.stringify(transactionResponse, null, 2)}`);
     const container = document.getElementById('resultField');
     if (!container) {
          console.error('Error: #resultField not found');
          return;
     }
     container.innerHTML = EMPTY_STRING;

     // Add search bar
     const searchBar = document.createElement('input');
     searchBar.type = 'text';
     searchBar.id = 'resultSearch';
     searchBar.placeholder = 'Search transaction...';
     searchBar.className = 'result-search';
     searchBar.style.boxSizing = 'border-box';
     container.appendChild(searchBar);

     const result = transactionResponse.result;

     // Define nested fields for each transaction type (unchanged)
     const nestedFieldsByType = {
          Payment: ['Amount', 'DeliverMax', 'DestinationTag', 'SourceTag', 'InvoiceID', 'PreviousFields', 'Balance', 'Sequence'],
          OfferCreate: ['TakerGets', 'TakerPays'],
          OfferCancel: [],
          TrustSet: ['LimitAmount'],
          AccountSet: ['ClearFlag', 'SetFlag', 'Domain', 'EmailHash', 'MessageKey', 'TransferRate', 'TickSize'],
          AccountDelete: [],
          SetRegularKey: ['RegularKey'],
          SignerListSet: ['SignerEntries'],
          EscrowCreate: ['Amount', 'Condition', 'DestinationTag', 'SourceTag'],
          EscrowFinish: ['Condition', 'Fulfillment'],
          EscrowCancel: [],
          PaymentChannelCreate: ['Amount', 'DestinationTag', 'SourceTag', 'PublicKey'],
          PaymentChannelFund: ['Amount'],
          PaymentChannelClaim: ['Balance', 'Amount', 'Signature', 'PublicKey'],
          CheckCreate: ['Amount', 'DestinationTag', 'SourceTag', 'InvoiceID'],
          CheckCash: ['Amount', 'DeliverMin'],
          CheckCancel: [],
          DepositPreauth: ['Authorize', 'Unauthorize'],
          TicketCreate: [],
          NFTokenMint: ['NFTokenTaxon', 'Issuer', 'TransferFee', 'URI'],
          NFTokenBurn: [],
          NFTokenCreateOffer: ['Amount', 'Destination'],
          NFTokenCancelOffer: ['NFTokenOffers'],
          NFTokenAcceptOffer: [],
          AMMCreate: ['Amount', 'Amount2', 'TradingFee'],
          AMMFund: ['Amount', 'Amount2'],
          AMMBid: ['BidMin', 'BidMax', 'AuthAccounts'],
          AMMWithdraw: ['Amount', 'Amount2', 'LPTokenIn'],
          AMMVote: [],
          AMMDelete: [],
          EnableAmendment: [],
          SetFee: [],
          UNLModify: [],
          Clawback: ['Amount'],
          XChainBridge: ['MinAccountCreateAmount', 'SignatureReward'],
          XChainCreateClaimId: [],
          XChainCommit: ['Amount', 'OtherChainDestination'],
          XChainClaim: [],
          XChainAccountCreateCommit: ['Amount', 'SignatureReward'],
          XChainAddAccountCreateAttestation: [],
          XChainAddClaimAttestation: [],
          XChainCreateBridge: ['MinAccountCreateAmount', 'SignatureReward'],
          XChainModifyBridge: ['MinAccountCreateAmount', 'SignatureReward'],
          DIDSet: ['Data', 'URI', 'Attestation'],
          DIDDelete: [],
     };

     // Define sections
     const sections = {
          transaction: {
               title: 'Transaction Details',
               content: [
                    { key: 'Transaction Type', value: result.tx_json.TransactionType },
                    { key: 'Hash', value: `<code>${result.hash}</code>` },
                    { key: 'CTID', value: result.ctid },
                    { key: 'Date', value: new Date(result.close_time_iso).toLocaleString() },
                    { key: 'Result', value: result.meta.TransactionResult },
                    { key: 'Ledger Hash', value: `<code>${result.ledger_hash}</code>` },
                    { key: 'Ledger Index', value: result.ledger_index },
                    { key: 'Validated', value: result.validated },
               ],
          },
          tx_data: {
               title: 'Transaction Data',
               content: Object.entries(result.tx_json)
                    .filter(([key]) => !['TransactionType', 'date', 'ledger_index'].includes(key))
                    .map(([key, value]) => {
                         const nestedFields = nestedFieldsByType[result.tx_json.TransactionType] || [];
                         if (nestedFields.includes(key) && typeof value === 'object') return null;
                         return {
                              key,
                              value: key === 'Account' || key === 'Destination' || key.includes('PubKey') || key.includes('Signature') || key.includes('TxnSignature') ? `<code>${value}</code>` : typeof value === 'string' && value.length > 50 ? `<code>${value.slice(0, 50)}...</code>` : value,
                         };
                    })
                    .filter(item => item),
               subItems: (nestedFieldsByType[result.tx_json.TransactionType] || [])
                    .filter(field => result.tx_json[field])
                    .map(field => {
                         let content;
                         if (field === 'SignerEntries') {
                              content = result.tx_json[field].map((entry, i) => ({
                                   key: `Signer ${i + 1}`,
                                   value: `<code>${entry.SignerEntry.Account}</code> (Weight: ${entry.SignerEntry.SignerWeight})`,
                              }));
                         } else if (field === 'NFTokenOffers') {
                              content = result.tx_json[field].map((offer, i) => ({
                                   key: `Offer ${i + 1}`,
                                   value: `<code>${offer}</code>`,
                              }));
                         } else if (field === 'AuthAccounts') {
                              content = result.tx_json[field].map((acc, i) => ({
                                   key: `Account ${i + 1}`,
                                   value: `<code>${acc.AuthAccount.Account}</code>`,
                              }));
                         } else if (typeof result.tx_json[field] === 'object') {
                              content = Object.entries(result.tx_json[field]).map(([k, v]) => ({
                                   key: k,
                                   value: k === 'issuer' || k === 'Account' ? `<code>${v}</code>` : v,
                              }));
                         } else {
                              content = [{ key: field, value: result.tx_json[field] }];
                         }
                         return { key: field, content };
                    }),
          },
          meta: {
               title: 'Meta Data',
               content: [
                    { key: 'Transaction Index', value: result.meta.TransactionIndex },
                    { key: 'Transaction Result', value: result.meta.TransactionResult },
                    { key: 'Delivered Amount', value: result.meta.delivered_amount ? formatAmount(result.meta.delivered_amount) : 'N/A' },
               ],
               subItems: [
                    {
                         key: 'Affected Nodes',
                         content: result.meta.AffectedNodes.map((node, idx) => {
                              const nodeType = Object.keys(node)[0];
                              const entry = node[nodeType];
                              console.log(`entry ${JSON.stringify(entry, null, 2)}`);
                              return {
                                   key: `${nodeType} ${idx + 1}`,
                                   value: null,
                                   subContent: [
                                        { key: 'Ledger Entry Type', value: entry.LedgerEntryType },
                                        { key: 'Ledger Index', value: `<code>${entry.LedgerIndex}</code>` },
                                        { key: 'Previous Txn ID', value: entry.PreviousTxnID },
                                        { key: 'Previous Txn Lgr Seq', value: `<code>${entry.PreviousTxnLgrSeq}</code>` },
                                        ...Object.entries(entry.FinalFields || {}).map(([k, v]) => ({
                                             key: k,
                                             value: k === 'Account' || k.includes('index') ? `<code>${v}</code>` : formatAmount(v),
                                        })),
                                        ...(entry.PreviousFields
                                             ? [
                                                    {
                                                         key: 'Previous Fields',
                                                         subContent: Object.entries(entry.PreviousFields).map(([k, v]) => ({
                                                              key: k,
                                                              value: k === 'Account' || k.includes('index') || k == 'Balance' ? `<code>${v}</code>` : formatAmount(v),
                                                         })),
                                                    },
                                               ]
                                             : []),
                                   ],
                              };
                         }),
                    },
               ],
          },
          // ledger: {
          //      title: 'Ledger Info',
          //      content: [
          //           { key: 'Ledger Hash', value: `<code>${result.ledger_hash}</code>` },
          //           { key: 'Ledger Index', value: result.ledger_index },
          //           { key: 'Validated', value: result.validated },
          //      ],
          // },
     };

     // Helper to format amounts (unchanged)
     function formatAmount(value) {
          if (typeof value === 'string' && /^\d+$/.test(value)) {
               return (parseInt(value) / 1_000_000).toFixed(6) + ' XRP';
          } else if (typeof value === 'object' && value.currency) {
               return `${value.value} ${value.currency}${value.issuer ? ` (<code>${value.issuer}</code>)` : EMPTY_STRING}`;
          }
          return value;
     }

     // Render sections
     for (const section of Object.values(sections)) {
          if (section.content.length || (section.subItems && section.subItems.length)) {
               const details = document.createElement('details');
               details.className = 'result-section';
               if (section.title === 'Transaction Details' || section.title === 'Transaction Data') {
                    details.setAttribute('open', 'open');
               }
               const summary = document.createElement('summary');
               summary.textContent = section.title;
               details.appendChild(summary);

               if (section.content.length) {
                    const table = document.createElement('div');
                    table.className = 'result-table';
                    const header = document.createElement('div');
                    header.className = 'result-row result-header';
                    header.innerHTML = `
                     <div class="result-cell key" data-key="Key">Key</div>
                     <div class="result-cell value" data-key="Value">Value</div>
                 `;
                    table.appendChild(header);

                    for (const item of section.content) {
                         const row = document.createElement('div');
                         row.className = 'result-row';
                         row.innerHTML = `
                         <div class="result-cell key" data-key="Key">${item.key}</div>
                         <div class="result-cell value" data-key="Value">${item.value}</div>
                     `;
                         table.appendChild(row);
                    }
                    details.appendChild(table);
               }

               if (section.subItems) {
                    for (const subItem of section.subItems) {
                         const subDetails = document.createElement('details');
                         subDetails.className = 'nested-object';
                         const subSummary = document.createElement('summary');
                         subSummary.textContent = subItem.key;
                         subDetails.appendChild(subSummary);

                         const subTable = document.createElement('div');
                         subTable.className = 'result-table';
                         const subHeader = document.createElement('div');
                         subHeader.className = 'result-row result-header';
                         subHeader.innerHTML = `
                         <div class="result-cell key" data-key="Key">Key</div>
                         <div class="result-cell value" data-key="Value">Value</div>
                     `;
                         subTable.appendChild(subHeader);

                         for (const subContent of subItem.content) {
                              const subRow = document.createElement('div');
                              subRow.className = 'result-row';
                              subRow.innerHTML = `<div class="result-cell key" data-key="Key">${subContent.key}</div><div class="result-cell value" data-key="Value">${subContent.value || EMPTY_STRING}</div>`;
                              if (subContent.subContent) {
                                   const nestedDetails = document.createElement('details');
                                   nestedDetails.className = 'nested-object';
                                   const nestedSummary = document.createElement('summary');
                                   nestedSummary.textContent = subContent.key;
                                   nestedDetails.appendChild(nestedSummary);

                                   const nestedTable = document.createElement('div');
                                   nestedTable.className = 'result-table';
                                   const nestedHeader = document.createElement('div');
                                   nestedHeader.className = 'result-row result-header';
                                   nestedHeader.innerHTML = `
                                 <div class="result-cell key" data-key="Key">Key</div>
                                 <div class="result-cell value" data-key="Value">Value</div>
                             `;
                                   nestedTable.appendChild(nestedHeader);

                                   for (const nestedItem of subContent.subContent) {
                                        const nestedRow = document.createElement('div');
                                        nestedRow.className = 'result-row';
                                        const value = nestedItem.value || EMPTY_STRING;
                                        nestedRow.innerHTML = `
                                     <div class="result-cell key" data-key="Key">${nestedItem.key}</div>
                                     <div class="result-cell value" data-key="Value">${value}</div>
                                 `;
                                        nestedTable.appendChild(nestedRow);
                                   }
                                   nestedDetails.appendChild(nestedTable);
                                   subRow.appendChild(nestedDetails);
                              }
                              subTable.appendChild(subRow);
                         }
                         subDetails.appendChild(subTable);
                         details.appendChild(subDetails);
                    }
               }

               container.appendChild(details);
          }
     }

     // Add toggle event listeners
     document.querySelectorAll('.result-section, .nested-object').forEach(details => {
          details.addEventListener('toggle', () => {
               container.offsetHeight;
               container.style.height = 'auto';
          });
     });

     // Updated search functionality
     searchBar.addEventListener('input', e => {
          const search = e.target.value.toLowerCase().trim();
          const sections = document.querySelectorAll('.result-section');

          if (!search) {
               // Restore default state
               sections.forEach(section => {
                    section.style.display = EMPTY_STRING;
                    section.querySelectorAll('.result-row').forEach(row => (row.style.display = 'flex'));
                    section.querySelectorAll('.nested-object').forEach(nested => {
                         nested.style.display = EMPTY_STRING;
                         nested.querySelectorAll('.result-row').forEach(row => (row.style.display = 'flex'));
                    });
                    const title = section.querySelector('summary').textContent;
                    if (title === 'Transaction Details' || title === 'Transaction Data') {
                         section.setAttribute('open', 'open');
                    } else {
                         section.removeAttribute('open');
                    }
               });
               return;
          }

          // Process each top-level section
          sections.forEach(section => {
               let hasVisibleContent = false;

               // Check direct rows in section's result-table
               const directRows = section.querySelectorAll(':scope > .result-table > .result-row:not(.result-header)');
               directRows.forEach(row => {
                    const keyText = stripHTML(row.querySelector('.key').innerHTML).toLowerCase();
                    const valueText = stripHTML(row.querySelector('.value').innerHTML).toLowerCase();
                    const isMatch = keyText.includes(search) || valueText.includes(search);
                    row.style.display = isMatch ? 'flex' : 'none';
                    if (isMatch) hasVisibleContent = true;
               });

               // Check nested details
               const nestedDetails = section.querySelectorAll('.nested-object');
               nestedDetails.forEach(nested => {
                    let nestedHasVisibleContent = false;
                    // Check all rows in all result-tables within this nested detail
                    const allTableRows = nested.querySelectorAll('.result-table .result-row:not(.result-header)');
                    allTableRows.forEach(row => {
                         const keyText = stripHTML(row.querySelector('.key').innerHTML).toLowerCase();
                         const valueText = stripHTML(row.querySelector('.value').innerHTML).toLowerCase();
                         const isMatch = keyText.includes(search) || valueText.includes(search);
                         row.style.display = isMatch ? 'flex' : 'none';
                         if (isMatch) nestedHasVisibleContent = true;
                    });
                    // Skip top-level row check for nodes like ModifiedNode 1
                    const topRow = nested.parentElement.closest('.result-row');
                    if (topRow && nestedHasVisibleContent) {
                         topRow.style.display = 'flex'; // Ensure parent row is visible
                    }
                    nested.style.display = nestedHasVisibleContent ? EMPTY_STRING : 'none';
                    if (nestedHasVisibleContent) {
                         nested.setAttribute('open', 'open'); // Expand nested details
                         hasVisibleContent = true;
                    }
               });

               section.style.display = hasVisibleContent ? EMPTY_STRING : 'none';
               if (hasVisibleContent) section.setAttribute('open', 'open');
          });
     });
}

export function renderCheckDetails(data) {
     const container = document.getElementById('resultField');
     if (!container) {
          console.error('Error: #resultField not found');
          return;
     }
     container.classList.remove('error', 'success');
     container.innerHTML = '';

     const searchBar = document.createElement('input');
     searchBar.type = 'text';
     searchBar.id = 'resultSearch';
     searchBar.placeholder = 'Search results...';
     searchBar.className = 'result-search';
     searchBar.style.boxSizing = 'border-box';
     container.appendChild(searchBar);

     for (const section of data.sections) {
          if (!section.content && !section.subItems) continue;

          const details = document.createElement('details');
          details.className = 'result-section';
          if (section.openByDefault) {
               details.setAttribute('open', 'open');
          }
          const summary = document.createElement('summary');
          summary.textContent = section.title;
          details.appendChild(summary);

          if (section.content && section.content.length) {
               const table = document.createElement('div');
               table.className = 'result-table';
               const header = document.createElement('div');
               header.className = 'result-row result-header';
               header.innerHTML = `
                 <div class="result-cell key" data-key="Key">Key</div>
                 <div class="result-cell value" data-key="Value">Value</div>
             `;
               table.appendChild(header);

               for (const item of section.content) {
                    const row = document.createElement('div');
                    row.className = 'result-row';
                    row.innerHTML = `
                     <div class="result-cell key" data-key="Key">${item.key}</div>
                     <div class="result-cell value" data-key="Value">${item.value}</div>
                 `;
                    table.appendChild(row);
               }
               details.appendChild(table);
          }

          if (section.subItems && section.subItems.length) {
               for (const subItem of section.subItems) {
                    const subDetails = document.createElement('details');
                    subDetails.className = 'nested-object';
                    if (subItem.openByDefault) {
                         subDetails.setAttribute('open', 'open');
                    }
                    const subSummary = document.createElement('summary');
                    subSummary.textContent = subItem.key;
                    subDetails.appendChild(subSummary);

                    const subTable = document.createElement('div');
                    subTable.className = 'result-table';
                    const subHeader = document.createElement('div');
                    subHeader.className = 'result-row result-header';
                    subHeader.innerHTML = `
                     <div class="result-cell key" data-key="Key">Key</div>
                     <div class="result-cell value" data-key="Value">Value</div>
                 `;
                    subTable.appendChild(subHeader);

                    for (const subContent of subItem.content) {
                         const subRow = document.createElement('div');
                         subRow.className = 'result-row';
                         subRow.innerHTML = `
                         <div class="result-cell key" data-key="Key">${subContent.key}</div>
                         <div class="result-cell value" data-key="Value">${subContent.value || ''}</div>
                     `;
                         subTable.appendChild(subRow);
                    }
                    subDetails.appendChild(subTable);
                    details.appendChild(subDetails);
               }
          }

          container.appendChild(details);
     }

     searchBar.addEventListener('input', e => {
          const search = e.target.value.toLowerCase().trim();
          const sections = container.querySelectorAll('.result-section');

          if (!search) {
               sections.forEach(section => {
                    section.style.display = '';
                    section.querySelectorAll('.result-row').forEach(row => (row.style.display = 'flex'));
                    section.querySelectorAll('.nested-object').forEach(nested => {
                         nested.style.display = 'block';
                         nested.querySelectorAll('.result-row').forEach(row => (row.style.display = 'flex'));
                    });
                    const title = section.querySelector('summary').textContent;
                    if (data.sections.find(s => s.title === title && s.openByDefault)) {
                         section.setAttribute('open', 'open');
                    } else {
                         section.removeAttribute('open');
                    }
               });
               return;
          }

          sections.forEach(section => {
               let hasVisibleContent = false;
               const directRows = section.querySelectorAll(':scope > .result-table > .result-row:not(.result-header)');
               directRows.forEach(row => {
                    const keyText = stripHTML(row.querySelector('.key').innerHTML).toLowerCase();
                    const valueText = stripHTML(row.querySelector('.value').innerHTML).toLowerCase();
                    const isMatch = keyText.includes(search) || valueText.includes(search);
                    row.style.display = isMatch ? 'flex' : 'none';
                    if (isMatch) hasVisibleContent = true;
               });

               const nestedDetails = section.querySelectorAll('.nested-object');
               nestedDetails.forEach(nested => {
                    let nestedHasVisibleContent = false;
                    const allTableRows = nested.querySelectorAll('.result-table .result-row:not(.result-header)');
                    allTableRows.forEach(row => {
                         const keyText = stripHTML(row.querySelector('.key').innerHTML).toLowerCase();
                         const valueText = stripHTML(row.querySelector('.value').innerHTML).toLowerCase();
                         const isMatch = keyText.includes(search) || valueText.includes(search);
                         row.style.display = isMatch ? 'flex' : 'none';
                         if (isMatch) nestedHasVisibleContent = true;
                    });
                    nested.style.display = nestedHasVisibleContent ? 'block' : 'none';
                    if (nestedHasVisibleContent) {
                         nested.setAttribute('open', 'open');
                         hasVisibleContent = true;
                    }
               });

               section.style.display = hasVisibleContent ? 'block' : 'none';
               if (hasVisibleContent) section.setAttribute('open', 'open');
          });
     });

     container.querySelectorAll('.result-section, .nested-object').forEach(details => {
          details.addEventListener('toggle', () => {
               container.offsetHeight;
               container.style.height = 'auto';
          });
     });

     container.classList.add('success');
}

export function renderTicketDetails(data) {
     const container = document.getElementById('resultField');
     if (!container) {
          console.error('Error: #resultField not found');
          return;
     }
     container.classList.remove('error', 'success');
     container.innerHTML = '';

     // Add search bar
     const searchBar = document.createElement('input');
     searchBar.type = 'text';
     searchBar.id = 'resultSearch';
     searchBar.placeholder = 'Search results...';
     searchBar.className = 'result-search';
     searchBar.style.boxSizing = 'border-box';
     container.appendChild(searchBar);

     // Render sections
     for (const section of data.sections) {
          if (!section.content && !section.subItems) continue;

          const details = document.createElement('details');
          details.className = 'result-section';
          if (section.openByDefault) {
               details.setAttribute('open', 'open');
          }
          const summary = document.createElement('summary');
          summary.textContent = section.title;
          details.appendChild(summary);

          // Render direct content (e.g., Network in Connection Status)
          if (section.content && section.content.length) {
               const table = document.createElement('div');
               table.className = 'result-table';
               const header = document.createElement('div');
               header.className = 'result-row result-header';
               header.innerHTML = `
                 <div class="result-cell key" data-key="Key">Key</div>
                 <div class="result-cell value" data-key="Value">Value</div>
             `;
               table.appendChild(header);

               for (const item of section.content) {
                    const row = document.createElement('div');
                    row.className = 'result-row';
                    row.innerHTML = `
                     <div class="result-cell key" data-key="Key">${item.key}</div>
                     <div class="result-cell value" data-key="Value">${item.value}</div>
                 `;
                    table.appendChild(row);
               }
               details.appendChild(table);
          }

          // Render nested sub-items (e.g., Tickets, Checks)
          if (section.subItems && section.subItems.length) {
               for (const subItem of section.subItems) {
                    const subDetails = document.createElement('details');
                    subDetails.className = 'nested-object';
                    if (subItem.openByDefault) {
                         subDetails.setAttribute('open', 'open');
                    }
                    const subSummary = document.createElement('summary');
                    subSummary.textContent = subItem.key;
                    subDetails.appendChild(subSummary);

                    const subTable = document.createElement('div');
                    subTable.className = 'result-table';
                    const subHeader = document.createElement('div');
                    subHeader.className = 'result-row result-header';
                    subHeader.innerHTML = `
                     <div class="result-cell key" data-key="Key">Key</div>
                     <div class="result-cell value" data-key="Value">Value</div>
                 `;
                    subTable.appendChild(subHeader);

                    for (const subContent of subItem.content) {
                         const subRow = document.createElement('div');
                         subRow.className = 'result-row';
                         subRow.innerHTML = `
                         <div class="result-cell key" data-key="Key">${subContent.key}</div>
                         <div class="result-cell value" data-key="Value">${subContent.value || ''}</div>
                     `;
                         subTable.appendChild(subRow);
                    }
                    subDetails.appendChild(subTable);
                    details.appendChild(subDetails);
               }
          }

          container.appendChild(details);
     }

     // Add search functionality
     searchBar.addEventListener('input', e => {
          const search = e.target.value.toLowerCase().trim();
          const sections = container.querySelectorAll('.result-section');

          if (!search) {
               sections.forEach(section => {
                    section.style.display = '';
                    section.querySelectorAll('.result-row').forEach(row => (row.style.display = 'flex'));
                    section.querySelectorAll('.nested-object').forEach(nested => {
                         nested.style.display = 'block';
                         nested.querySelectorAll('.result-row').forEach(row => (row.style.display = 'flex'));
                    });
                    const title = section.querySelector('summary').textContent;
                    if (data.sections.find(s => s.title === title && s.openByDefault)) {
                         section.setAttribute('open', 'open');
                    } else {
                         section.removeAttribute('open');
                    }
               });
               return;
          }

          sections.forEach(section => {
               let hasVisibleContent = false;
               const directRows = section.querySelectorAll(':scope > .result-table > .result-row:not(.result-header)');
               directRows.forEach(row => {
                    const keyText = stripHTML(row.querySelector('.key').innerHTML).toLowerCase();
                    const valueText = stripHTML(row.querySelector('.value').innerHTML).toLowerCase();
                    const isMatch = keyText.includes(search) || valueText.includes(search);
                    row.style.display = isMatch ? 'flex' : 'none';
                    if (isMatch) hasVisibleContent = true;
               });

               const nestedDetails = section.querySelectorAll('.nested-object');
               nestedDetails.forEach(nested => {
                    let nestedHasVisibleContent = false;
                    const allTableRows = nested.querySelectorAll('.result-table .result-row:not(.result-header)');
                    allTableRows.forEach(row => {
                         const keyText = stripHTML(row.querySelector('.key').innerHTML).toLowerCase();
                         const valueText = stripHTML(row.querySelector('.value').innerHTML).toLowerCase();
                         const isMatch = keyText.includes(search) || valueText.includes(search);
                         row.style.display = isMatch ? 'flex' : 'none';
                         if (isMatch) nestedHasVisibleContent = true;
                    });
                    nested.style.display = nestedHasVisibleContent ? 'block' : 'none';
                    if (nestedHasVisibleContent) {
                         nested.setAttribute('open', 'open');
                         hasVisibleContent = true;
                    }
               });

               section.style.display = hasVisibleContent ? 'block' : 'none';
               if (hasVisibleContent) section.setAttribute('open', 'open');
          });
     });

     // Add toggle listeners for dynamic resizing
     container.querySelectorAll('.result-section, .nested-object').forEach(details => {
          details.addEventListener('toggle', () => {
               container.offsetHeight;
               container.style.height = 'auto';
          });
     });

     container.classList.add('success');
}

export function renderNftDetails(data) {
     const container = document.getElementById('resultField');
     if (!container) {
          console.error('Error: #resultField not found');
          return;
     }
     container.classList.remove('error', 'success');
     container.innerHTML = '';

     const searchBar = document.createElement('input');
     searchBar.type = 'text';
     searchBar.id = 'resultSearch';
     searchBar.placeholder = 'Search results...';
     searchBar.className = 'result-search';
     searchBar.style.boxSizing = 'border-box';
     container.appendChild(searchBar);

     for (const section of data.sections) {
          if (!section.content && !section.subItems) continue;

          const details = document.createElement('details');
          details.className = 'result-section';
          if (section.openByDefault) {
               details.setAttribute('open', 'open');
          }
          const summary = document.createElement('summary');
          summary.textContent = section.title;
          details.appendChild(summary);

          if (section.content && section.content.length) {
               const table = document.createElement('div');
               table.className = 'result-table';
               const header = document.createElement('div');
               header.className = 'result-row result-header';
               header.innerHTML = `
                 <div class="result-cell key" data-key="Key">Key</div>
                 <div class="result-cell value" data-key="Value">Value</div>
             `;
               table.appendChild(header);

               for (const item of section.content) {
                    const row = document.createElement('div');
                    row.className = 'result-row';
                    row.innerHTML = `
                     <div class="result-cell key" data-key="Key">${item.key}</div>
                     <div class="result-cell value" data-key="Value">${item.value}</div>
                 `;
                    table.appendChild(row);
               }
               details.appendChild(table);
          }

          if (section.subItems && section.subItems.length) {
               for (const subItem of section.subItems) {
                    const subDetails = document.createElement('details');
                    subDetails.className = 'nested-object';
                    if (subItem.openByDefault) {
                         subDetails.setAttribute('open', 'open');
                    }
                    const subSummary = document.createElement('summary');
                    subSummary.textContent = subItem.key;
                    subDetails.appendChild(subSummary);

                    const subTable = document.createElement('div');
                    subTable.className = 'result-table';
                    const subHeader = document.createElement('div');
                    subHeader.className = 'result-row result-header';
                    subHeader.innerHTML = `
                     <div class="result-cell key" data-key="Key">Key</div>
                     <div class="result-cell value" data-key="Value">Value</div>
                 `;
                    subTable.appendChild(subHeader);

                    for (const subContent of subItem.content) {
                         const subRow = document.createElement('div');
                         subRow.className = 'result-row';
                         subRow.innerHTML = `
                         <div class="result-cell key" data-key="Key">${subContent.key}</div>
                         <div class="result-cell value" data-key="Value">${subContent.value || ''}</div>
                     `;
                         subTable.appendChild(subRow);
                    }
                    subDetails.appendChild(subTable);
                    details.appendChild(subDetails);
               }
          }

          container.appendChild(details);
     }

     searchBar.addEventListener('input', e => {
          const search = e.target.value.toLowerCase().trim();
          const sections = container.querySelectorAll('.result-section');

          if (!search) {
               sections.forEach(section => {
                    section.style.display = '';
                    section.querySelectorAll('.result-row').forEach(row => (row.style.display = 'flex'));
                    section.querySelectorAll('.nested-object').forEach(nested => {
                         nested.style.display = 'block';
                         nested.querySelectorAll('.result-row').forEach(row => (row.style.display = 'flex'));
                    });
                    const title = section.querySelector('summary').textContent;
                    if (data.sections.find(s => s.title === title && s.openByDefault)) {
                         section.setAttribute('open', 'open');
                    } else {
                         section.removeAttribute('open');
                    }
               });
               return;
          }

          sections.forEach(section => {
               let hasVisibleContent = false;
               const directRows = section.querySelectorAll(':scope > .result-table > .result-row:not(.result-header)');
               directRows.forEach(row => {
                    const keyText = stripHTML(row.querySelector('.key').innerHTML).toLowerCase();
                    const valueText = stripHTML(row.querySelector('.value').innerHTML).toLowerCase();
                    const isMatch = keyText.includes(search) || valueText.includes(search);
                    row.style.display = isMatch ? 'flex' : 'none';
                    if (isMatch) hasVisibleContent = true;
               });

               const nestedDetails = section.querySelectorAll('.nested-object');
               nestedDetails.forEach(nested => {
                    let nestedHasVisibleContent = false;
                    const allTableRows = nested.querySelectorAll('.result-table .result-row:not(.result-header)');
                    allTableRows.forEach(row => {
                         const keyText = stripHTML(row.querySelector('.key').innerHTML).toLowerCase();
                         const valueText = stripHTML(row.querySelector('.value').innerHTML).toLowerCase();
                         const isMatch = keyText.includes(search) || valueText.includes(search);
                         row.style.display = isMatch ? 'flex' : 'none';
                         if (isMatch) nestedHasVisibleContent = true;
                    });
                    nested.style.display = nestedHasVisibleContent ? 'block' : 'none';
                    if (nestedHasVisibleContent) {
                         nested.setAttribute('open', 'open');
                         hasVisibleContent = true;
                    }
               });

               section.style.display = hasVisibleContent ? 'block' : 'none';
               if (hasVisibleContent) section.setAttribute('open', 'open');
          });
     });

     container.querySelectorAll('.result-section, .nested-object').forEach(details => {
          details.addEventListener('toggle', () => {
               container.offsetHeight;
               container.style.height = 'auto';
          });
     });

     container.classList.add('success');
}

export function renderNFTOffersDetails(data) {
     const container = document.getElementById('resultField');
     if (!container) {
          console.error('Error: #resultField not found');
          return;
     }
     container.classList.remove('error', 'success');
     container.innerHTML = '';

     const searchBar = document.createElement('input');
     searchBar.type = 'text';
     searchBar.id = 'resultSearch';
     searchBar.placeholder = 'Search results...';
     searchBar.className = 'result-search';
     searchBar.style.boxSizing = 'border-box';
     container.appendChild(searchBar);

     for (const section of data.sections) {
          if (!section.content && !section.subItems) continue;

          const details = document.createElement('details');
          details.className = 'result-section';
          if (section.openByDefault) {
               details.setAttribute('open', 'open');
          }
          const summary = document.createElement('summary');
          summary.textContent = section.title;
          details.appendChild(summary);

          if (section.content && section.content.length) {
               const table = document.createElement('div');
               table.className = 'result-table';
               const header = document.createElement('div');
               header.className = 'result-row result-header';
               header.innerHTML = `
                 <div class="result-cell key" data-key="Key">Key</div>
                 <div class="result-cell value" data-key="Value">Value</div>
             `;
               table.appendChild(header);

               for (const item of section.content) {
                    const row = document.createElement('div');
                    row.className = 'result-row';
                    row.innerHTML = `
                     <div class="result-cell key" data-key="Key">${item.key}</div>
                     <div class="result-cell value" data-key="Value">${item.value || ''}</div>
                 `;
                    table.appendChild(row);
               }
               details.appendChild(table);
          }

          if (section.subItems && section.subItems.length) {
               for (const subItem of section.subItems) {
                    const subDetails = document.createElement('details');
                    subDetails.className = 'nested-object';
                    if (subItem.openByDefault) {
                         subDetails.setAttribute('open', 'open');
                    }
                    const subSummary = document.createElement('summary');
                    subSummary.textContent = subItem.key;
                    subDetails.appendChild(subSummary);

                    const subTable = document.createElement('div');
                    subTable.className = 'result-table';
                    const subHeader = document.createElement('div');
                    subHeader.className = 'result-row result-header';
                    subHeader.innerHTML = `
                     <div class="result-cell key" data-key="Key">Key</div>
                     <div class="result-cell value" data-key="Value">Value</div>
                 `;
                    subTable.appendChild(subHeader);

                    for (const subContent of subItem.content) {
                         const subRow = document.createElement('div');
                         subRow.className = 'result-row';
                         subRow.innerHTML = `
                         <div class="result-cell key" data-key="Key">${subContent.key}</div>
                         <div class="result-cell value" data-key="Value">${subContent.value || ''}</div>
                     `;
                         subTable.appendChild(subRow);
                    }
                    subDetails.appendChild(subTable);
                    details.appendChild(subDetails);
               }
          }

          container.appendChild(details);
     }

     searchBar.addEventListener('input', e => {
          const search = e.target.value.toLowerCase().trim();
          const sections = container.querySelectorAll('.result-section');

          if (!search) {
               sections.forEach(section => {
                    section.style.display = '';
                    section.querySelectorAll('.result-row').forEach(row => (row.style.display = 'flex'));
                    section.querySelectorAll('.nested-object').forEach(nested => {
                         nested.style.display = 'block';
                         nested.querySelectorAll('.result-row').forEach(row => (row.style.display = 'flex'));
                    });
                    const title = section.querySelector('summary').textContent;
                    if (data.sections.find(s => s.title === title && s.openByDefault)) {
                         section.setAttribute('open', 'open');
                    } else {
                         section.removeAttribute('open');
                    }
               });
               return;
          }

          sections.forEach(section => {
               let hasVisibleContent = false;
               const directRows = section.querySelectorAll(':scope > .result-table > .result-row:not(.result-header)');
               directRows.forEach(row => {
                    const keyText = stripHTML(row.querySelector('.key').innerHTML).toLowerCase();
                    const valueText = stripHTML(row.querySelector('.value').innerHTML).toLowerCase();
                    const isMatch = keyText.includes(search) || valueText.includes(search);
                    row.style.display = isMatch ? 'flex' : 'none';
                    if (isMatch) hasVisibleContent = true;
               });

               const nestedDetails = section.querySelectorAll('.nested-object');
               nestedDetails.forEach(nested => {
                    let nestedHasVisibleContent = false;
                    const allTableRows = nested.querySelectorAll('.result-table .result-row:not(.result-header)');
                    allTableRows.forEach(row => {
                         const keyText = stripHTML(row.querySelector('.key').innerHTML).toLowerCase();
                         const valueText = stripHTML(row.querySelector('.value').innerHTML).toLowerCase();
                         const isMatch = keyText.includes(search) || valueText.includes(search);
                         row.style.display = isMatch ? 'flex' : 'none';
                         if (isMatch) nestedHasVisibleContent = true;
                    });
                    nested.style.display = nestedHasVisibleContent ? 'block' : 'none';
                    if (nestedHasVisibleContent) {
                         nested.setAttribute('open', 'open');
                         hasVisibleContent = true;
                    }
               });

               section.style.display = hasVisibleContent ? 'block' : 'none';
               if (hasVisibleContent) section.setAttribute('open', 'open');
          });
     });

     container.querySelectorAll('.result-section, .nested-object').forEach(details => {
          details.addEventListener('toggle', () => {
               container.offsetHeight;
               container.style.height = 'auto';
          });
     });

     container.classList.add('success');
}

export function renderAMMPoolDetails(data) {
     const container = document.getElementById('resultField');
     if (!container) {
          console.error('Error: #resultField not found');
          return;
     }
     console.log('Rendering data:', data); // Debug: Log the input data
     container.classList.remove('error', 'success');
     container.innerHTML = '';

     const searchBar = document.createElement('input');
     searchBar.type = 'text';
     searchBar.id = 'resultSearch';
     searchBar.placeholder = 'Search results...';
     searchBar.className = 'result-search';
     searchBar.style.boxSizing = 'border-box';
     container.appendChild(searchBar);

     for (const section of data.sections) {
          if (!section.content && !section.subItems) {
               console.log('Skipping empty section:', section.title); // Debug
               continue;
          }

          const details = document.createElement('details');
          details.className = 'result-section';
          if (section.openByDefault) {
               details.setAttribute('open', 'open');
          }
          const summary = document.createElement('summary');
          summary.textContent = section.title;
          details.appendChild(summary);

          if (section.content && section.content.length) {
               const table = document.createElement('div');
               table.className = 'result-table';
               const header = document.createElement('div');
               header.className = 'result-row result-header';
               header.innerHTML = `
                 <div class="result-cell key" data-key="Key">Key</div>
                 <div class="result-cell value" data-key="Value">Value</div>
             `;
               table.appendChild(header);

               for (const item of section.content) {
                    const row = document.createElement('div');
                    row.className = 'result-row';
                    row.innerHTML = `
                     <div class="result-cell key" data-key="Key">${item.key}</div>
                     <div class="result-cell value" data-key="Value">${item.value || ''}</div>
                 `;
                    table.appendChild(row);
               }
               details.appendChild(table);
          }

          if (section.subItems && section.subItems.length) {
               for (const subItem of section.subItems) {
                    const subDetails = document.createElement('details');
                    subDetails.className = 'nested-object';
                    if (subItem.openByDefault) {
                         subDetails.setAttribute('open', 'open');
                    }
                    const subSummary = document.createElement('summary');
                    subSummary.textContent = subItem.key;
                    subDetails.appendChild(subSummary);

                    const subTable = document.createElement('div');
                    subTable.className = 'result-table';
                    const subHeader = document.createElement('div');
                    subHeader.className = 'result-row result-header';
                    subHeader.innerHTML = `
                     <div class="result-cell key" data-key="Key">Key</div>
                     <div class="result-cell value" data-key="Value">Value</div>
                 `;
                    subTable.appendChild(subHeader);

                    for (const subContent of subItem.content) {
                         const subRow = document.createElement('div');
                         subRow.className = 'result-row';
                         subRow.innerHTML = `
                         <div class="result-cell key" data-key="Key">${subContent.key}</div>
                         <div class="result-cell value" data-key="Value">${subContent.value || ''}</div>
                     `;
                         subTable.appendChild(subRow);
                    }
                    subDetails.appendChild(subTable);
                    details.appendChild(subDetails);
               }
          }

          container.appendChild(details);
     }

     searchBar.addEventListener('input', e => {
          const search = e.target.value.toLowerCase().trim();
          const sections = container.querySelectorAll('.result-section');

          if (!search) {
               sections.forEach(section => {
                    section.style.display = '';
                    section.querySelectorAll('.result-row').forEach(row => (row.style.display = 'flex'));
                    section.querySelectorAll('.nested-object').forEach(nested => {
                         nested.style.display = 'block';
                         nested.querySelectorAll('.result-row').forEach(row => (row.style.display = 'flex'));
                    });
                    const title = section.querySelector('summary').textContent;
                    if (data.sections.find(s => s.title === title && s.openByDefault)) {
                         section.setAttribute('open', 'open');
                    } else {
                         section.removeAttribute('open');
                    }
               });
               return;
          }

          sections.forEach(section => {
               let hasVisibleContent = false;
               const directRows = section.querySelectorAll(':scope > .result-table > .result-row:not(.result-header)');
               directRows.forEach(row => {
                    const keyText = stripHTML(row.querySelector('.key').innerHTML).toLowerCase();
                    const valueText = stripHTML(row.querySelector('.value').innerHTML).toLowerCase();
                    const isMatch = keyText.includes(search) || valueText.includes(search);
                    row.style.display = isMatch ? 'flex' : 'none';
                    if (isMatch) hasVisibleContent = true;
               });

               const nestedDetails = section.querySelectorAll('.nested-object');
               nestedDetails.forEach(nested => {
                    let nestedHasVisibleContent = false;
                    const allTableRows = nested.querySelectorAll('.result-table .result-row:not(.result-header)');
                    allTableRows.forEach(row => {
                         const keyText = stripHTML(row.querySelector('.key').innerHTML).toLowerCase();
                         const valueText = stripHTML(row.querySelector('.value').innerHTML).toLowerCase();
                         const isMatch = keyText.includes(search) || valueText.includes(search);
                         row.style.display = isMatch ? 'flex' : 'none';
                         if (isMatch) nestedHasVisibleContent = true;
                    });
                    nested.style.display = nestedHasVisibleContent ? 'block' : 'none';
                    if (nestedHasVisibleContent) {
                         nested.setAttribute('open', 'open');
                         hasVisibleContent = true;
                    }
               });

               section.style.display = hasVisibleContent ? 'block' : 'none';
               if (hasVisibleContent) section.setAttribute('open', 'open');
          });
     });

     container.querySelectorAll('.result-section, .nested-object').forEach(details => {
          details.addEventListener('toggle', () => {
               container.offsetHeight;
               container.style.height = 'auto';
          });
     });

     container.classList.add('success');
}

export function renderOffersDetails(data) {
     const container = document.getElementById('resultField');
     if (!container) {
          console.error('Error: #resultField not found');
          return;
     }
     console.log('Rendering data:', data); // Debug: Log the input data
     container.classList.remove('error', 'success');
     container.innerHTML = '';

     const searchBar = document.createElement('input');
     searchBar.type = 'text';
     searchBar.id = 'resultSearch';
     searchBar.placeholder = 'Search results...';
     searchBar.className = 'result-search';
     searchBar.style.boxSizing = 'border-box';
     container.appendChild(searchBar);

     for (const section of data.sections) {
          if (!section.content && !section.subItems) {
               console.log('Skipping empty section:', section.title); // Debug
               continue;
          }

          const details = document.createElement('details');
          details.className = 'result-section';
          if (section.openByDefault) {
               details.setAttribute('open', 'open');
          }
          const summary = document.createElement('summary');
          summary.textContent = section.title;
          details.appendChild(summary);

          if (section.content && section.content.length) {
               const table = document.createElement('div');
               table.className = 'result-table';
               const header = document.createElement('div');
               header.className = 'result-row result-header';
               header.innerHTML = `
                 <div class="result-cell key" data-key="Key">Key</div>
                 <div class="result-cell value" data-key="Value">Value</div>
             `;
               table.appendChild(header);

               for (const item of section.content) {
                    const row = document.createElement('div');
                    row.className = 'result-row';
                    row.innerHTML = `
                     <div class="result-cell key" data-key="Key">${item.key}</div>
                     <div class="result-cell value" data-key="Value">${item.value || ''}</div>
                 `;
                    table.appendChild(row);
               }
               details.appendChild(table);
          }

          if (section.subItems && section.subItems.length) {
               for (const subItem of section.subItems) {
                    const subDetails = document.createElement('details');
                    subDetails.className = 'nested-object';
                    if (subItem.openByDefault) {
                         subDetails.setAttribute('open', 'open');
                    }
                    const subSummary = document.createElement('summary');
                    subSummary.textContent = subItem.key;
                    subDetails.appendChild(subSummary);

                    const subTable = document.createElement('div');
                    subTable.className = 'result-table';
                    const subHeader = document.createElement('div');
                    subHeader.className = 'result-row result-header';
                    subHeader.innerHTML = `
                     <div class="result-cell key" data-key="Key">Key</div>
                     <div class="result-cell value" data-key="Value">Value</div>
                 `;
                    subTable.appendChild(subHeader);

                    for (const subContent of subItem.content) {
                         const subRow = document.createElement('div');
                         subRow.className = 'result-row';
                         subRow.innerHTML = `
                         <div class="result-cell key" data-key="Key">${subContent.key}</div>
                         <div class="result-cell value" data-key="Value">${subContent.value || ''}</div>
                     `;
                         subTable.appendChild(subRow);
                    }
                    subDetails.appendChild(subTable);
                    details.appendChild(subDetails);
               }
          }

          container.appendChild(details);
     }

     searchBar.addEventListener('input', e => {
          const search = e.target.value.toLowerCase().trim();
          const sections = container.querySelectorAll('.result-section');

          if (!search) {
               sections.forEach(section => {
                    section.style.display = '';
                    section.querySelectorAll('.result-row').forEach(row => (row.style.display = 'flex'));
                    section.querySelectorAll('.nested-object').forEach(nested => {
                         nested.style.display = 'block';
                         nested.querySelectorAll('.result-row').forEach(row => (row.style.display = 'flex'));
                    });
                    const title = section.querySelector('summary').textContent;
                    if (data.sections.find(s => s.title === title && s.openByDefault)) {
                         section.setAttribute('open', 'open');
                    } else {
                         section.removeAttribute('open');
                    }
               });
               return;
          }

          sections.forEach(section => {
               let hasVisibleContent = false;
               const directRows = section.querySelectorAll(':scope > .result-table > .result-row:not(.result-header)');
               directRows.forEach(row => {
                    const keyText = stripHTML(row.querySelector('.key').innerHTML).toLowerCase();
                    const valueText = stripHTML(row.querySelector('.value').innerHTML).toLowerCase();
                    const isMatch = keyText.includes(search) || valueText.includes(search);
                    row.style.display = isMatch ? 'flex' : 'none';
                    if (isMatch) hasVisibleContent = true;
               });

               const nestedDetails = section.querySelectorAll('.nested-object');
               nestedDetails.forEach(nested => {
                    let nestedHasVisibleContent = false;
                    const allTableRows = nested.querySelectorAll('.result-table .result-row:not(.result-header)');
                    allTableRows.forEach(row => {
                         const keyText = stripHTML(row.querySelector('.key').innerHTML).toLowerCase();
                         const valueText = stripHTML(row.querySelector('.value').innerHTML).toLowerCase();
                         const isMatch = keyText.includes(search) || valueText.includes(search);
                         row.style.display = isMatch ? 'flex' : 'none';
                         if (isMatch) nestedHasVisibleContent = true;
                    });
                    nested.style.display = nestedHasVisibleContent ? 'block' : 'none';
                    if (nestedHasVisibleContent) {
                         nested.setAttribute('open', 'open');
                         hasVisibleContent = true;
                    }
               });

               section.style.display = hasVisibleContent ? 'block' : 'none';
               if (hasVisibleContent) section.setAttribute('open', 'open');
          });
     });

     container.querySelectorAll('.result-section, .nested-object').forEach(details => {
          details.addEventListener('toggle', () => {
               container.offsetHeight;
               container.style.height = 'auto';
          });
     });

     container.classList.add('success');
}

export function renderOrderBookDetails(data) {
     const container = document.getElementById('resultField');
     if (!container) {
          console.error('Error: #resultField not found');
          return;
     }
     console.log('Rendering data:', data); // Debug: Log the input data
     container.classList.remove('error', 'success');
     container.innerHTML = '';

     const searchBar = document.createElement('input');
     searchBar.type = 'text';
     searchBar.id = 'resultSearch';
     searchBar.placeholder = 'Search results...';
     searchBar.className = 'result-search';
     searchBar.style.boxSizing = 'border-box';
     container.appendChild(searchBar);

     for (const section of data.sections) {
          if (!section.content && !section.subItems) {
               console.log('Skipping empty section:', section.title); // Debug
               continue;
          }

          const details = document.createElement('details');
          details.className = 'result-section';
          if (section.openByDefault) {
               details.setAttribute('open', 'open');
          }
          const summary = document.createElement('summary');
          summary.textContent = section.title;
          details.appendChild(summary);

          if (section.content && section.content.length) {
               const table = document.createElement('div');
               table.className = 'result-table';
               const header = document.createElement('div');
               header.className = 'result-row result-header';
               header.innerHTML = `
                 <div class="result-cell key" data-key="Key">Key</div>
                 <div class="result-cell value" data-key="Value">Value</div>
             `;
               table.appendChild(header);

               for (const item of section.content) {
                    const row = document.createElement('div');
                    row.className = 'result-row';
                    row.innerHTML = `
                     <div class="result-cell key" data-key="Key">${item.key}</div>
                     <div class="result-cell value" data-key="Value">${item.value || ''}</div>
                 `;
                    table.appendChild(row);
               }
               details.appendChild(table);
          }

          if (section.subItems && section.subItems.length) {
               for (const subItem of section.subItems) {
                    const subDetails = document.createElement('details');
                    subDetails.className = 'nested-object';
                    if (subItem.openByDefault) {
                         subDetails.setAttribute('open', 'open');
                    }
                    const subSummary = document.createElement('summary');
                    subSummary.textContent = subItem.key;
                    subDetails.appendChild(subSummary);

                    const subTable = document.createElement('div');
                    subTable.className = 'result-table';
                    const subHeader = document.createElement('div');
                    subHeader.className = 'result-row result-header';
                    subHeader.innerHTML = `
                     <div class="result-cell key" data-key="Key">Key</div>
                     <div class="result-cell value" data-key="Value">Value</div>
                 `;
                    subTable.appendChild(subHeader);

                    for (const subContent of subItem.content) {
                         const subRow = document.createElement('div');
                         subRow.className = 'result-row';
                         subRow.innerHTML = `
                         <div class="result-cell key" data-key="Key">${subContent.key}</div>
                         <div class="result-cell value" data-key="Value">${subContent.value || ''}</div>
                     `;
                         subTable.appendChild(subRow);
                    }
                    subDetails.appendChild(subTable);
                    details.appendChild(subDetails);
               }
          }

          container.appendChild(details);
     }

     searchBar.addEventListener('input', e => {
          const search = e.target.value.toLowerCase().trim();
          const sections = container.querySelectorAll('.result-section');

          if (!search) {
               sections.forEach(section => {
                    section.style.display = '';
                    section.querySelectorAll('.result-row').forEach(row => (row.style.display = 'flex'));
                    section.querySelectorAll('.nested-object').forEach(nested => {
                         nested.style.display = 'block';
                         nested.querySelectorAll('.result-row').forEach(row => (row.style.display = 'flex'));
                    });
                    const title = section.querySelector('summary').textContent;
                    if (data.sections.find(s => s.title === title && s.openByDefault)) {
                         section.setAttribute('open', 'open');
                    } else {
                         section.removeAttribute('open');
                    }
               });
               return;
          }

          sections.forEach(section => {
               let hasVisibleContent = false;
               const directRows = section.querySelectorAll(':scope > .result-table > .result-row:not(.result-header)');
               directRows.forEach(row => {
                    const keyText = stripHTML(row.querySelector('.key').innerHTML).toLowerCase();
                    const valueText = stripHTML(row.querySelector('.value').innerHTML).toLowerCase();
                    const isMatch = keyText.includes(search) || valueText.includes(search);
                    row.style.display = isMatch ? 'flex' : 'none';
                    if (isMatch) hasVisibleContent = true;
               });

               const nestedDetails = section.querySelectorAll('.nested-object');
               nestedDetails.forEach(nested => {
                    let nestedHasVisibleContent = false;
                    const allTableRows = nested.querySelectorAll('.result-table .result-row:not(.result-header)');
                    allTableRows.forEach(row => {
                         const keyText = stripHTML(row.querySelector('.key').innerHTML).toLowerCase();
                         const valueText = stripHTML(row.querySelector('.value').innerHTML).toLowerCase();
                         const isMatch = keyText.includes(search) || valueText.includes(search);
                         row.style.display = isMatch ? 'flex' : 'none';
                         if (isMatch) nestedHasVisibleContent = true;
                    });
                    nested.style.display = nestedHasVisibleContent ? 'block' : 'none';
                    if (nestedHasVisibleContent) {
                         nested.setAttribute('open', 'open');
                         hasVisibleContent = true;
                    }
               });

               section.style.display = hasVisibleContent ? 'block' : 'none';
               if (hasVisibleContent) section.setAttribute('open', 'open');
          });
     });

     container.querySelectorAll('.result-section, .nested-object').forEach(details => {
          details.addEventListener('toggle', () => {
               container.offsetHeight;
               container.style.height = 'auto';
          });
     });

     container.classList.add('success');
}

export function renderTokenBalanceDetails(data) {
     const container = document.getElementById('resultField');
     if (!container) {
          console.error('Error: #resultField not found');
          return;
     }
     console.log('Rendering data:', data); // Debug: Log the input data
     container.classList.remove('error', 'success');
     container.innerHTML = '';

     const searchBar = document.createElement('input');
     searchBar.type = 'text';
     searchBar.id = 'resultSearch';
     searchBar.placeholder = 'Search results...';
     searchBar.className = 'result-search';
     searchBar.style.boxSizing = 'border-box';
     container.appendChild(searchBar);

     for (const section of data.sections) {
          if (!section.content && !section.subItems) {
               console.log('Skipping empty section:', section.title); // Debug
               continue;
          }

          const details = document.createElement('details');
          details.className = 'result-section';
          if (section.openByDefault) {
               details.setAttribute('open', 'open');
          }
          const summary = document.createElement('summary');
          summary.textContent = section.title;
          details.appendChild(summary);

          if (section.content && section.content.length) {
               const table = document.createElement('div');
               table.className = 'result-table';
               const header = document.createElement('div');
               header.className = 'result-row result-header';
               header.innerHTML = `
                 <div class="result-cell key" data-key="Key">Key</div>
                 <div class="result-cell value" data-key="Value">Value</div>
             `;
               table.appendChild(header);

               for (const item of section.content) {
                    const row = document.createElement('div');
                    row.className = 'result-row';
                    row.innerHTML = `
                     <div class="result-cell key" data-key="Key">${item.key}</div>
                     <div class="result-cell value" data-key="Value">${item.value || ''}</div>
                 `;
                    table.appendChild(row);
               }
               details.appendChild(table);
          }

          if (section.subItems && section.subItems.length) {
               for (const subItem of section.subItems) {
                    const subDetails = document.createElement('details');
                    subDetails.className = 'nested-object';
                    if (subItem.openByDefault) {
                         subDetails.setAttribute('open', 'open');
                    }
                    const subSummary = document.createElement('summary');
                    subSummary.textContent = subItem.key;
                    subDetails.appendChild(subSummary);

                    const subTable = document.createElement('div');
                    subTable.className = 'result-table';
                    const subHeader = document.createElement('div');
                    subHeader.className = 'result-row result-header';
                    subHeader.innerHTML = `
                     <div class="result-cell key" data-key="Key">Key</div>
                     <div class="result-cell value" data-key="Value">Value</div>
                 `;
                    subTable.appendChild(subHeader);

                    for (const subContent of subItem.content) {
                         const subRow = document.createElement('div');
                         subRow.className = 'result-row';
                         subRow.innerHTML = `
                         <div class="result-cell key" data-key="Key">${subContent.key}</div>
                         <div class="result-cell value" data-key="Value">${subContent.value || ''}</div>
                     `;
                         subTable.appendChild(subRow); // Correct: Append subRow to subTable
                    }
                    subDetails.appendChild(subTable);
                    details.appendChild(subDetails);
               }
          }

          container.appendChild(details);
     }

     searchBar.addEventListener('input', e => {
          const search = e.target.value.toLowerCase().trim();
          const sections = container.querySelectorAll('.result-section');

          if (!search) {
               sections.forEach(section => {
                    section.style.display = '';
                    section.querySelectorAll('.result-row').forEach(row => (row.style.display = 'flex'));
                    section.querySelectorAll('.nested-object').forEach(nested => {
                         nested.style.display = 'block';
                         nested.querySelectorAll('.result-row').forEach(row => (row.style.display = 'flex'));
                    });
                    const title = section.querySelector('summary').textContent;
                    if (data.sections.find(s => s.title === title && s.openByDefault)) {
                         section.setAttribute('open', 'open');
                    } else {
                         section.removeAttribute('open');
                    }
               });
               return;
          }

          sections.forEach(section => {
               let hasVisibleContent = false;
               const directRows = section.querySelectorAll(':scope > .result-table > .result-row:not(.result-header)');
               directRows.forEach(row => {
                    const keyText = stripHTML(row.querySelector('.key').innerHTML).toLowerCase();
                    const valueText = stripHTML(row.querySelector('.value').innerHTML).toLowerCase();
                    const isMatch = keyText.includes(search) || valueText.includes(search);
                    row.style.display = isMatch ? 'flex' : 'none';
                    if (isMatch) hasVisibleContent = true;
               });

               const nestedDetails = section.querySelectorAll('.nested-object');
               nestedDetails.forEach(nested => {
                    let nestedHasVisibleContent = false;
                    const allTableRows = nested.querySelectorAll('.result-table .result-row:not(.result-header)');
                    allTableRows.forEach(row => {
                         const keyText = stripHTML(row.querySelector('.key').innerHTML).toLowerCase();
                         const valueText = stripHTML(row.querySelector('.value').innerHTML).toLowerCase();
                         const isMatch = keyText.includes(search) || valueText.includes(search);
                         row.style.display = isMatch ? 'flex' : 'none';
                         if (isMatch) nestedHasVisibleContent = true;
                    });
                    nested.style.display = nestedHasVisibleContent ? 'block' : 'none';
                    if (nestedHasVisibleContent) {
                         nested.setAttribute('open', 'open');
                         hasVisibleContent = true;
                    }
               });

               section.style.display = hasVisibleContent ? 'block' : 'none';
               if (hasVisibleContent) section.setAttribute('open', 'open');
          });
     });

     container.querySelectorAll('.result-section, .nested-object').forEach(details => {
          details.addEventListener('toggle', () => {
               container.offsetHeight;
               container.style.height = 'auto';
          });
     });

     container.classList.add('success');
}

export function renderTrustLineDetails(data) {
     const container = document.getElementById('resultField');
     if (!container) {
          console.error('Error: #resultField not found');
          return;
     }
     console.log('Rendering data:', data); // Debug: Log the input data
     container.classList.remove('error', 'success');
     container.innerHTML = '';

     const searchBar = document.createElement('input');
     searchBar.type = 'text';
     searchBar.id = 'resultSearch';
     searchBar.placeholder = 'Search results...';
     searchBar.className = 'result-search';
     searchBar.style.boxSizing = 'border-box';
     container.appendChild(searchBar);

     for (const section of data.sections) {
          if (!section.content && !section.subItems) {
               console.log('Skipping empty section:', section.title); // Debug
               continue;
          }

          const details = document.createElement('details');
          details.className = 'result-section';
          if (section.openByDefault) {
               details.setAttribute('open', 'open');
          }
          const summary = document.createElement('summary');
          summary.textContent = section.title;
          details.appendChild(summary);

          if (section.content && section.content.length) {
               const table = document.createElement('div');
               table.className = 'result-table';
               const header = document.createElement('div');
               header.className = 'result-row result-header';
               header.innerHTML = `
                 <div class="result-cell key" data-key="Key">Key</div>
                 <div class="result-cell value" data-key="Value">Value</div>
             `;
               table.appendChild(header);

               for (const item of section.content) {
                    const row = document.createElement('div');
                    row.className = 'result-row';
                    row.innerHTML = `
                     <div class="result-cell key" data-key="Key">${item.key}</div>
                     <div class="result-cell value" data-key="Value">${item.value || ''}</div>
                 `;
                    table.appendChild(row);
               }
               details.appendChild(table);
          }

          if (section.subItems && section.subItems.length) {
               for (const subItem of section.subItems) {
                    const subDetails = document.createElement('details');
                    subDetails.className = 'nested-object';
                    if (subItem.openByDefault) {
                         subDetails.setAttribute('open', 'open');
                    }
                    const subSummary = document.createElement('summary');
                    subSummary.textContent = subItem.key;
                    subDetails.appendChild(subSummary);

                    const subTable = document.createElement('div');
                    subTable.className = 'result-table';
                    const subHeader = document.createElement('div');
                    subHeader.className = 'result-row result-header';
                    subHeader.innerHTML = `
                     <div class="result-cell key" data-key="Key">Key</div>
                     <div class="result-cell value" data-key="Value">Value</div>
                 `;
                    subTable.appendChild(subHeader);

                    for (const subContent of subItem.content) {
                         const subRow = document.createElement('div');
                         subRow.className = 'result-row';
                         subRow.innerHTML = `
                         <div class="result-cell key" data-key="Key">${subContent.key}</div>
                         <div class="result-cell value" data-key="Value">${subContent.value || ''}</div>
                     `;
                         subTable.appendChild(subRow);
                    }
                    subDetails.appendChild(subTable);
                    details.appendChild(subDetails);
               }
          }

          container.appendChild(details);
     }

     searchBar.addEventListener('input', e => {
          const search = e.target.value.toLowerCase().trim();
          const sections = container.querySelectorAll('.result-section');

          if (!search) {
               sections.forEach(section => {
                    section.style.display = '';
                    section.querySelectorAll('.result-row').forEach(row => (row.style.display = 'flex'));
                    section.querySelectorAll('.nested-object').forEach(nested => {
                         nested.style.display = 'block';
                         nested.querySelectorAll('.result-row').forEach(row => (row.style.display = 'flex'));
                    });
                    const title = section.querySelector('summary').textContent;
                    if (data.sections.find(s => s.title === title && s.openByDefault)) {
                         section.setAttribute('open', 'open');
                    } else {
                         section.removeAttribute('open');
                    }
               });
               return;
          }

          sections.forEach(section => {
               let hasVisibleContent = false;
               const directRows = section.querySelectorAll(':scope > .result-table > .result-row:not(.result-header)');
               directRows.forEach(row => {
                    const keyText = stripHTML(row.querySelector('.key').innerHTML).toLowerCase();
                    const valueText = stripHTML(row.querySelector('.value').innerHTML).toLowerCase();
                    const isMatch = keyText.includes(search) || valueText.includes(search);
                    row.style.display = isMatch ? 'flex' : 'none';
                    if (isMatch) hasVisibleContent = true;
               });

               const nestedDetails = section.querySelectorAll('.nested-object');
               nestedDetails.forEach(nested => {
                    let nestedHasVisibleContent = false;
                    const allTableRows = nested.querySelectorAll('.result-table .result-row:not(.result-header)');
                    allTableRows.forEach(row => {
                         const keyText = stripHTML(row.querySelector('.key').innerHTML).toLowerCase();
                         const valueText = stripHTML(row.querySelector('.value').innerHTML).toLowerCase();
                         const isMatch = keyText.includes(search) || valueText.includes(search);
                         row.style.display = isMatch ? 'flex' : 'none';
                         if (isMatch) nestedHasVisibleContent = true;
                    });
                    nested.style.display = nestedHasVisibleContent ? 'block' : 'none';
                    if (nestedHasVisibleContent) {
                         nested.setAttribute('open', 'open');
                         hasVisibleContent = true;
                    }
               });

               section.style.display = hasVisibleContent ? 'block' : 'none';
               if (hasVisibleContent) section.setAttribute('open', 'open');
          });
     });

     container.querySelectorAll('.result-section, .nested-object').forEach(details => {
          details.addEventListener('toggle', () => {
               container.offsetHeight;
               container.style.height = 'auto';
          });
     });

     container.classList.add('success');
     console.log('Rendered HTML:', container.innerHTML); // Debug: Log the generated HTML
}

export function renderIssueCurrencyDetails(data) {
     const container = document.getElementById('resultField');
     if (!container) {
          console.error('Error: #resultField not found');
          return;
     }
     console.log('Rendering data:', data); // Debug: Log the input data
     container.classList.remove('error', 'success');
     container.innerHTML = '';

     const searchBar = document.createElement('input');
     searchBar.type = 'text';
     searchBar.id = 'resultSearch';
     searchBar.placeholder = 'Search results...';
     searchBar.className = 'result-search';
     searchBar.style.boxSizing = 'border-box';
     container.appendChild(searchBar);

     for (const section of data.sections) {
          if (!section.content && !section.subItems) {
               console.log('Skipping empty section:', section.title); // Debug
               continue;
          }

          const details = document.createElement('details');
          details.className = 'result-section';
          if (section.openByDefault) {
               details.setAttribute('open', 'open');
          }
          const summary = document.createElement('summary');
          summary.textContent = section.title;
          details.appendChild(summary);

          if (section.content && section.content.length) {
               const table = document.createElement('div');
               table.className = 'result-table';
               const header = document.createElement('div');
               header.className = 'result-row result-header';
               header.innerHTML = `
                 <div class="result-cell key" data-key="Key">Key</div>
                 <div class="result-cell value" data-key="Value">Value</div>
             `;
               table.appendChild(header);

               for (const item of section.content) {
                    const row = document.createElement('div');
                    row.className = 'result-row';
                    row.innerHTML = `
                     <div class="result-cell key" data-key="Key">${item.key}</div>
                     <div class="result-cell value" data-key="Value">${item.value || ''}</div>
                 `;
                    table.appendChild(row);
               }
               details.appendChild(table);
          }

          if (section.subItems && section.subItems.length) {
               for (const subItem of section.subItems) {
                    const subDetails = document.createElement('details');
                    subDetails.className = 'nested-object';
                    if (subItem.openByDefault) {
                         subDetails.setAttribute('open', 'open');
                    }
                    const subSummary = document.createElement('summary');
                    subSummary.textContent = subItem.key;
                    subDetails.appendChild(subSummary);

                    const subTable = document.createElement('div');
                    subTable.className = 'result-table';
                    const subHeader = document.createElement('div');
                    subHeader.className = 'result-row result-header';
                    subHeader.innerHTML = `
                     <div class="result-cell key" data-key="Key">Key</div>
                     <div class="result-cell value" data-key="Value">Value</div>
                 `;
                    subTable.appendChild(subHeader);

                    for (const subContent of subItem.content) {
                         const subRow = document.createElement('div');
                         subRow.className = 'result-row';
                         subRow.innerHTML = `
                         <div class="result-cell key" data-key="Key">${subContent.key}</div>
                         <div class="result-cell value" data-key="Value">${subContent.value || ''}</div>
                     `;
                         if (subContent.subContent) {
                              const nestedDetails = document.createElement('details');
                              nestedDetails.className = 'nested-object';
                              const nestedSummary = document.createElement('summary');
                              nestedSummary.textContent = subContent.key;
                              nestedDetails.appendChild(nestedSummary);

                              const nestedTable = document.createElement('div');
                              nestedTable.className = 'result-table';
                              const nestedHeader = document.createElement('div');
                              nestedHeader.className = 'result-row result-header';
                              nestedHeader.innerHTML = `
                             <div class="result-cell key" data-key="Key">Key</div>
                             <div class="result-cell value" data-key="Value">Value</div>
                         `;
                              nestedTable.appendChild(nestedHeader);

                              for (const nestedItem of subContent.subContent) {
                                   const nestedRow = document.createElement('div');
                                   nestedRow.className = 'result-row';
                                   const value = nestedItem.value || '';
                                   nestedRow.innerHTML = `
                                 <div class="result-cell key" data-key="Key">${nestedItem.key}</div>
                                 <div class="result-cell value" data-key="Value">${value}</div>
                             `;
                                   nestedTable.appendChild(nestedRow);
                              }
                              nestedDetails.appendChild(nestedTable);
                              subRow.appendChild(nestedDetails);
                         }
                         subTable.appendChild(subRow);
                    }
                    subDetails.appendChild(subTable);
                    details.appendChild(subDetails);
               }
          }

          container.appendChild(details);
     }

     // Add toggle event listeners
     container.querySelectorAll('.result-section, .nested-object').forEach(details => {
          details.addEventListener('toggle', () => {
               container.offsetHeight;
               container.style.height = 'auto';
          });
     });

     // Search functionality
     searchBar.addEventListener('input', e => {
          const search = e.target.value.toLowerCase().trim();
          const sections = container.querySelectorAll('.result-section');

          if (!search) {
               sections.forEach(section => {
                    section.style.display = '';
                    section.querySelectorAll('.result-row').forEach(row => (row.style.display = 'flex'));
                    section.querySelectorAll('.nested-object').forEach(nested => {
                         nested.style.display = '';
                         nested.querySelectorAll('.result-row').forEach(row => (row.style.display = 'flex'));
                    });
                    const title = section.querySelector('summary').textContent;
                    if (data.sections.find(s => s.title === title && s.openByDefault)) {
                         section.setAttribute('open', 'open');
                    } else {
                         section.removeAttribute('open');
                    }
               });
               return;
          }

          sections.forEach(section => {
               let hasVisibleContent = false;
               const directRows = section.querySelectorAll(':scope > .result-table > .result-row:not(.result-header)');
               directRows.forEach(row => {
                    const keyText = stripHTML(row.querySelector('.key').innerHTML).toLowerCase();
                    const valueText = stripHTML(row.querySelector('.value').innerHTML).toLowerCase();
                    const isMatch = keyText.includes(search) || valueText.includes(search);
                    row.style.display = isMatch ? 'flex' : 'none';
                    if (isMatch) hasVisibleContent = true;
               });

               const nestedDetails = section.querySelectorAll('.nested-object');
               nestedDetails.forEach(nested => {
                    let nestedHasVisibleContent = false;
                    const allTableRows = nested.querySelectorAll('.result-table .result-row:not(.result-header)');
                    allTableRows.forEach(row => {
                         const keyText = stripHTML(row.querySelector('.key').innerHTML).toLowerCase();
                         const valueText = stripHTML(row.querySelector('.value').innerHTML).toLowerCase();
                         const isMatch = keyText.includes(search) || valueText.includes(search);
                         row.style.display = isMatch ? 'flex' : 'none';
                         if (isMatch) nestedHasVisibleContent = true;
                    });
                    const topRow = nested.parentElement.closest('.result-row');
                    if (topRow && nestedHasVisibleContent) {
                         topRow.style.display = 'flex';
                    }
                    nested.style.display = nestedHasVisibleContent ? '' : 'none';
                    if (nestedHasVisibleContent) {
                         nested.setAttribute('open', 'open');
                         hasVisibleContent = true;
                    }
               });

               section.style.display = hasVisibleContent ? '' : 'none';
               if (hasVisibleContent) section.setAttribute('open', 'open');
          });
     });

     container.classList.add('success');
     console.log('Rendered HTML:', container.innerHTML); // Debug: Log the generated HTML
}

export function buildTransactionSections(transactionResponse) {
     const result = transactionResponse.result;

     // Define nested fields for each transaction type (copied from renderTransactionDetails)
     const nestedFieldsByType = {
          Payment: ['Amount', 'DeliverMax', 'DestinationTag', 'SourceTag', 'InvoiceID'],
          OfferCreate: ['TakerGets', 'TakerPays'],
          OfferCancel: [],
          TrustSet: ['LimitAmount'],
          AccountSet: ['ClearFlag', 'SetFlag', 'Domain', 'EmailHash', 'MessageKey', 'TransferRate', 'TickSize'],
          AccountDelete: [],
          SetRegularKey: ['RegularKey'],
          SignerListSet: ['SignerEntries'],
          EscrowCreate: ['Amount', 'Condition', 'DestinationTag', 'SourceTag'],
          EscrowFinish: ['Condition', 'Fulfillment'],
          EscrowCancel: [],
          PaymentChannelCreate: ['Amount', 'DestinationTag', 'SourceTag', 'PublicKey'],
          PaymentChannelFund: ['Amount'],
          PaymentChannelClaim: ['Balance', 'Amount', 'Signature', 'PublicKey'],
          CheckCreate: ['Amount', 'DestinationTag', 'SourceTag', 'InvoiceID'],
          CheckCash: ['Amount', 'DeliverMin'],
          CheckCancel: [],
          DepositPreauth: ['Authorize', 'Unauthorize'],
          TicketCreate: [],
          NFTokenMint: ['NFTokenTaxon', 'Issuer', 'TransferFee', 'URI'],
          NFTokenBurn: [],
          NFTokenCreateOffer: ['Amount', 'Destination'],
          NFTokenCancelOffer: ['NFTokenOffers'],
          NFTokenAcceptOffer: [],
          AMMCreate: ['Amount', 'Amount2', 'TradingFee'],
          AMMFund: ['Amount', 'Amount2'],
          AMMBid: ['BidMin', 'BidMax', 'AuthAccounts'],
          AMMWithdraw: ['Amount', 'Amount2', 'LPTokenIn'],
          AMMVote: [],
          AMMDelete: [],
          EnableAmendment: [],
          SetFee: [],
          UNLModify: [],
          Clawback: ['Amount'],
          XChainBridge: ['MinAccountCreateAmount', 'SignatureReward'],
          XChainCreateClaimId: [],
          XChainCommit: ['Amount', 'OtherChainDestination'],
          XChainClaim: [],
          XChainAccountCreateCommit: ['Amount', 'SignatureReward'],
          XChainAddAccountCreateAttestation: [],
          XChainAddClaimAttestation: [],
          XChainCreateBridge: ['MinAccountCreateAmount', 'SignatureReward'],
          XChainModifyBridge: ['MinAccountCreateAmount', 'SignatureReward'],
          DIDSet: ['Data', 'URI', 'Attestation'],
          DIDDelete: [],
     };

     // Helper to format amounts (copied from renderTransactionDetails)
     function formatAmount(value) {
          if (typeof value === 'string' && /^\d+$/.test(value)) {
               return (parseInt(value) / 1_000_000).toFixed(6) + ' XRP';
          } else if (typeof value === 'object' && value.currency) {
               return `${value.value} ${value.currency}${value.issuer ? ` (<code>${value.issuer}</code>)` : ''}`;
          }
          return value;
     }

     // Build transaction sections
     return {
          transaction: {
               title: 'Transaction Details',
               openByDefault: true,
               content: [
                    { key: 'Transaction Type', value: result.tx_json.TransactionType },
                    { key: 'Hash', value: `<code>${result.hash}</code>` },
                    { key: 'CTID', value: result.ctid },
                    { key: 'Date', value: new Date(result.close_time_iso).toLocaleString() },
                    { key: 'Result', value: result.meta.TransactionResult },
                    { key: 'Ledger Hash', value: `<code>${result.ledger_hash}</code>` },
                    { key: 'Ledger Index', value: result.ledger_index },
                    { key: 'Validated', value: result.validated },
               ],
          },
          tx_data: {
               title: 'Transaction Data',
               openByDefault: true,
               content: Object.entries(result.tx_json)
                    .filter(([key]) => !['TransactionType', 'date', 'ledger_index'].includes(key))
                    .map(([key, value]) => {
                         const nestedFields = nestedFieldsByType[result.tx_json.TransactionType] || [];
                         if (nestedFields.includes(key) && typeof value === 'object') return null;
                         return {
                              key,
                              value: key === 'Account' || key === 'Destination' || key.includes('PubKey') || key.includes('Signature') || key.includes('TxnSignature') ? `<code>${value}</code>` : typeof value === 'string' && value.length > 50 ? `<code>${value.slice(0, 50)}...</code>` : value,
                         };
                    })
                    .filter(item => item),
               subItems: (nestedFieldsByType[result.tx_json.TransactionType] || [])
                    .filter(field => result.tx_json[field])
                    .map(field => {
                         let content;
                         if (field === 'SignerEntries') {
                              content = result.tx_json[field].map((entry, i) => ({
                                   key: `Signer ${i + 1}`,
                                   value: `<code>${entry.SignerEntry.Account}</code> (Weight: ${entry.SignerEntry.SignerWeight})`,
                              }));
                         } else if (field === 'NFTokenOffers') {
                              content = result.tx_json[field].map((offer, i) => ({
                                   key: `Offer ${i + 1}`,
                                   value: `<code>${offer}</code>`,
                              }));
                         } else if (field === 'AuthAccounts') {
                              content = result.tx_json[field].map((acc, i) => ({
                                   key: `Account ${i + 1}`,
                                   value: `<code>${acc.AuthAccount.Account}</code>`,
                              }));
                         } else if (typeof result.tx_json[field] === 'object') {
                              content = Object.entries(result.tx_json[field]).map(([k, v]) => ({
                                   key: k,
                                   value: k === 'issuer' || k === 'Account' ? `<code>${v}</code>` : v,
                              }));
                         } else {
                              content = [{ key: field, value: result.tx_json[field] }];
                         }
                         return { key: field, content };
                    }),
          },
          meta: {
               title: 'Meta Data',
               openByDefault: false,
               content: [
                    { key: 'Transaction Index', value: result.meta.TransactionIndex },
                    { key: 'Transaction Result', value: result.meta.TransactionResult },
                    {
                         key: 'Delivered Amount',
                         value: result.meta.delivered_amount ? formatAmount(result.meta.delivered_amount) : 'N/A',
                    },
               ],
               subItems: [
                    {
                         key: 'Affected Nodes',
                         content: result.meta.AffectedNodes.map((node, idx) => {
                              const nodeType = Object.keys(node)[0];
                              const entry = node[nodeType];
                              return {
                                   key: `${nodeType} ${idx + 1}`,
                                   content: [
                                        { key: 'Ledger Entry Type', value: entry.LedgerEntryType },
                                        { key: 'Ledger Index', value: `<code>${entry.LedgerIndex}</code>` },
                                        ...Object.entries(entry.FinalFields || {}).map(([k, v]) => ({
                                             key: k,
                                             value: k === 'Account' || k.includes('index') ? `<code>${v}</code>` : formatAmount(v),
                                        })),
                                        ...(entry.PreviousFields
                                             ? [
                                                    {
                                                         key: 'Previous Fields',
                                                         content: Object.entries(entry.PreviousFields).map(([k, v]) => ({
                                                              key: k,
                                                              value: k === 'Account' || k.includes('index') ? `<code>${v}</code>` : formatAmount(v),
                                                         })),
                                                    },
                                               ]
                                             : []),
                                   ],
                              };
                         }),
                    },
               ],
          },
          // ledger: {
          //      title: 'Ledger Info',
          //      openByDefault: false,
          //      content: [
          //           { key: 'Ledger Hash', value: `<code>${result.ledger_hash}</code>` },
          //           { key: 'Ledger Index', value: result.ledger_index },
          //           { key: 'Validated', value: result.validated },
          //      ],
          // },
     };
}

export function renderCreateOfferDetails(data) {
     const container = document.getElementById('resultField');
     if (!container) {
          console.error('Error: #resultField not found');
          return;
     }
     console.log('Rendering data:', data); // Debug: Log the input data
     container.classList.remove('error', 'success');
     container.innerHTML = '';

     const searchBar = document.createElement('input');
     searchBar.type = 'text';
     searchBar.id = 'resultSearch';
     searchBar.placeholder = 'Search results...';
     searchBar.className = 'result-search';
     searchBar.style.boxSizing = 'border-box';
     container.appendChild(searchBar);

     for (const section of data.sections) {
          if (!section.content && !section.subItems) {
               console.log('Skipping empty section:', section.title); // Debug
               continue;
          }

          const details = document.createElement('details');
          details.className = 'result-section';
          if (section.openByDefault) {
               details.setAttribute('open', 'open');
          }
          const summary = document.createElement('summary');
          summary.textContent = section.title;
          details.appendChild(summary);

          if (section.content && section.content.length) {
               const table = document.createElement('div');
               table.className = 'result-table';
               const header = document.createElement('div');
               header.className = 'result-row result-header';
               header.innerHTML = `
                 <div class="result-cell key" data-key="Key">Key</div>
                 <div class="result-cell value" data-key="Value">Value</div>
             `;
               table.appendChild(header);

               for (const item of section.content) {
                    const row = document.createElement('div');
                    row.className = 'result-row';
                    row.innerHTML = `
                     <div class="result-cell key" data-key="Key">${item.key}</div>
                     <div class="result-cell value" data-key="Value">${item.value || ''}</div>
                 `;
                    table.appendChild(row);
               }
               details.appendChild(table);
          }

          if (section.subItems && section.subItems.length) {
               for (const subItem of section.subItems) {
                    const subDetails = document.createElement('details');
                    subDetails.className = 'nested-object';
                    if (subItem.openByDefault) {
                         subDetails.setAttribute('open', 'open');
                    }
                    const subSummary = document.createElement('summary');
                    subSummary.textContent = subItem.key;
                    subDetails.appendChild(subSummary);

                    const subTable = document.createElement('div');
                    subTable.className = 'result-table';
                    const subHeader = document.createElement('div');
                    subHeader.className = 'result-row result-header';
                    subHeader.innerHTML = `
                     <div class="result-cell key" data-key="Key">Key</div>
                     <div class="result-cell value" data-key="Value">Value</div>
                 `;
                    subTable.appendChild(subHeader);

                    for (const subContent of subItem.content) {
                         const subRow = document.createElement('div');
                         subRow.className = 'result-row';
                         subRow.innerHTML = `
                         <div class="result-cell key" data-key="Key">${subContent.key}</div>
                         <div class="result-cell value" data-key="Value">${subContent.value || ''}</div>
                     `;
                         if (subContent.subContent) {
                              const nestedDetails = document.createElement('details');
                              nestedDetails.className = 'nested-object';
                              const nestedSummary = document.createElement('summary');
                              nestedSummary.textContent = subContent.key;
                              nestedDetails.appendChild(nestedSummary);

                              const nestedTable = document.createElement('div');
                              nestedTable.className = 'result-table';
                              const nestedHeader = document.createElement('div');
                              nestedHeader.className = 'result-row result-header';
                              nestedHeader.innerHTML = `
                             <div class="result-cell key" data-key="Key">Key</div>
                             <div class="result-cell value" data-key="Value">Value</div>
                         `;
                              nestedTable.appendChild(nestedHeader);

                              for (const nestedItem of subContent.subContent) {
                                   const nestedRow = document.createElement('div');
                                   nestedRow.className = 'result-row';
                                   const value = nestedItem.value || '';
                                   nestedRow.innerHTML = `
                                 <div class="result-cell key" data-key="Key">${nestedItem.key}</div>
                                 <div class="result-cell value" data-key="Value">${value}</div>
                             `;
                                   nestedTable.appendChild(nestedRow);
                              }
                              nestedDetails.appendChild(nestedTable);
                              subRow.appendChild(nestedDetails);
                         }
                         subTable.appendChild(subRow);
                    }
                    subDetails.appendChild(subTable);
                    details.appendChild(subDetails);
               }
          }

          container.appendChild(details);
     }

     // Add toggle event listeners
     container.querySelectorAll('.result-section, .nested-object').forEach(details => {
          details.addEventListener('toggle', () => {
               container.offsetHeight;
               container.style.height = 'auto';
          });
     });

     // Search functionality
     searchBar.addEventListener('input', e => {
          const search = e.target.value.toLowerCase().trim();
          const sections = container.querySelectorAll('.result-section');

          if (!search) {
               sections.forEach(section => {
                    section.style.display = '';
                    section.querySelectorAll('.result-row').forEach(row => (row.style.display = 'flex'));
                    section.querySelectorAll('.nested-object').forEach(nested => {
                         nested.style.display = '';
                         nested.querySelectorAll('.result-row').forEach(row => (row.style.display = 'flex'));
                    });
                    const title = section.querySelector('summary').textContent;
                    if (data.sections.find(s => s.title === title && s.openByDefault)) {
                         section.setAttribute('open', 'open');
                    } else {
                         section.removeAttribute('open');
                    }
               });
               return;
          }

          sections.forEach(section => {
               let hasVisibleContent = false;
               const directRows = section.querySelectorAll(':scope > .result-table > .result-row:not(.result-header)');
               directRows.forEach(row => {
                    const keyText = stripHTML(row.querySelector('.key').innerHTML).toLowerCase();
                    const valueText = stripHTML(row.querySelector('.value').innerHTML).toLowerCase();
                    const isMatch = keyText.includes(search) || valueText.includes(search);
                    row.style.display = isMatch ? 'flex' : 'none';
                    if (isMatch) hasVisibleContent = true;
               });

               const nestedDetails = section.querySelectorAll('.nested-object');
               nestedDetails.forEach(nested => {
                    let nestedHasVisibleContent = false;
                    const allTableRows = nested.querySelectorAll('.result-table .result-row:not(.result-header)');
                    allTableRows.forEach(row => {
                         const keyText = stripHTML(row.querySelector('.key').innerHTML).toLowerCase();
                         const valueText = stripHTML(row.querySelector('.value').innerHTML).toLowerCase();
                         const isMatch = keyText.includes(search) || valueText.includes(search);
                         row.style.display = isMatch ? 'flex' : 'none';
                         if (isMatch) nestedHasVisibleContent = true;
                    });
                    const topRow = nested.parentElement.closest('.result-row');
                    if (topRow && nestedHasVisibleContent) {
                         topRow.style.display = 'flex';
                    }
                    nested.style.display = nestedHasVisibleContent ? '' : 'none';
                    if (nestedHasVisibleContent) {
                         nested.setAttribute('open', 'open');
                         hasVisibleContent = true;
                    }
               });

               section.style.display = hasVisibleContent ? '' : 'none';
               if (hasVisibleContent) section.setAttribute('open', 'open');
          });
     });

     container.classList.add('success');
     console.log('Rendered HTML:', container.innerHTML); // Debug: Log the generated HTML
}
