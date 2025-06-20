import * as xrpl from 'xrpl';
import { getClient, getNet, disconnectClient, validatInput, setError, parseXRPLTransaction, gatherAccountInfo, clearFields, distributeAccountInfo, getTransaction, updateOwnerCountAndReserves, prepareTxHashForOutput } from './utils.js';
import { ed25519_ENCRYPTION, secp256k1_ENCRYPTION, MAINNET, TES_SUCCESS } from './constants.js';
import { getAccountDetails, fetchAccountObjects } from './account.js';
import { derive } from 'xrpl-accountlib';

// MoonPay On-Ramp
export async function createOnRamp(fiatAmount, currency, walletAddress) {
     console.log('Entering createOnRamp');
     const startTime = Date.now();
     const resultField = document.getElementById('resultField');
     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';
     resultField?.classList.remove('error', 'success');

     try {
          // Validate inputs
          if (!fiatAmount || fiatAmount <= 0) return setError('ERROR: Invalid fiat amount', spinner);
          if (!['USD', 'EUR'].includes(currency)) return setError('ERROR: Unsupported currency', spinner);
          if (!xrpl.isValidAddress(walletAddress)) return setError('ERROR: Invalid wallet address', spinner);

          // MoonPay API call (replace with your API key and endpoint)
          const response = await fetch('https://api.moonpay.com/v3/quote', {
               method: 'POST',
               headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer YOUR_MOONPAY_API_KEY',
               },
               body: JSON.stringify({
                    baseCurrencyCode: currency.toLowerCase(),
                    quoteCurrencyCode: 'xrp',
                    baseCurrencyAmount: fiatAmount,
                    destinationWalletAddress: walletAddress,
               }),
          });

          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'MoonPay API error');

          // Redirect user to MoonPay’s hosted payment page
          resultField.value = `Redirecting to MoonPay for ${fiatAmount} ${currency} to XRP\n`;
          window.location.href = data.redirectUrl;

          resultField.classList.add('success');
     } catch (error) {
          console.error('On-Ramp Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`, spinner);
     } finally {
          if (spinner) spinner.style.display = 'none';
          console.log(`Leaving createOnRamp in ${Date.now() - startTime}ms`);
     }
}

// Wyre Off-Ramp
export async function createOffRamp(xrpAmount, currency, bankAccountDetails, wallet) {
     console.log('Entering createOffRamp');
     const startTime = Date.now();
     const resultField = document.getElementById('resultField');
     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';
     resultField?.classList.remove('error', 'success');

     try {
          // Validate inputs
          if (!xrpAmount || xrpAmount <= 0) return setError('ERROR: Invalid XRP amount', spinner);
          if (!['USD', 'EUR'].includes(currency)) return setError('ERROR: Unsupported currency', spinner);
          if (!bankAccountDetails.accountNumber || !bankAccountDetails.routingNumber) {
               return setError('ERROR: Invalid bank details', spinner);
          }

          // Wyre API call to create transfer
          const response = await fetch('https://api.sendwyre.com/v3/transfers', {
               method: 'POST',
               headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer YOUR_WYRE_API_KEY',
               },
               body: JSON.stringify({
                    sourceCurrency: 'XRP',
                    destCurrency: currency.toLowerCase(),
                    amount: xrpAmount,
                    source: `xrpl:${wallet.classicAddress}`,
                    dest: `bank:account=${bankAccountDetails.accountNumber}&routing=${bankAccountDetails.routingNumber}`,
               }),
          });

          const data = await response.json();
          if (!response.ok) throw new Error(data.message || 'Wyre API error');

          // Submit XRP transaction to Wyre’s wallet
          const client = await getClient();
          const tx = await client.autofill({
               TransactionType: 'Payment',
               Account: wallet.classicAddress,
               Amount: xrpl.xrpToDrops(xrpAmount),
               Destination: data.destXrplAddress,
          });

          const txResponse = await client.submitAndWait(tx, { wallet });
          if (txResponse.result.meta.TransactionResult !== 'tesSUCCESS') {
               throw new Error(`XRPL transaction failed: ${txResponse.result.meta.TransactionResult}`);
          }

          resultField.value += `Off-ramp successful: ${xrpAmount} XRP to ${fiatAmount} ${currency}\n`;
          resultField.value += `Transaction Hash: ${txResponse.result.hash}\n`;
          resultField.classList.add('success');
     } catch (error) {
          console.error('Off-Ramp Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`, spinner);
     } finally {
          if (spinner) spinner.style.display = 'none';
          console.log(`Leaving createOffRamp in ${Date.now() - startTime}ms`);
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

window.createOnRamp = createOnRamp;
window.createOffRamp = createOffRamp;

window.displayDataForAccount1 = displayDataForAccount1;
window.displayDataForAccount2 = displayDataForAccount2;
window.disconnectClient = disconnectClient;
window.gatherAccountInfo = gatherAccountInfo;
window.clearFields = clearFields;
window.distributeAccountInfo = distributeAccountInfo;
window.distributeAccountInfo = distributeAccountInfo;
window.getTransaction = getTransaction;
