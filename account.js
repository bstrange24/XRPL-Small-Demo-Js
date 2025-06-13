import * as xrpl from 'xrpl';
import { getClient, getNet, disconnectClient, validatInput, parseAccountFlagsDetails, parseXRPLAccountObjects, setError, parseXRPLTransaction, autoResize, gatherAccountInfo, clearFields, distributeAccountInfo, getTransaction, updateOwnerCountAndReserves, prepareTxHashForOutput, getOnlyTokenBalance, convertToEstTime } from './utils.js';
import { ed25519_ENCRYPTION, secp256k1_ENCRYPTION, MAINNET, TES_SUCCESS, flagList, flagMap } from './constants.js';

export async function getAccountInfo() {
     console.log('Entering getAccountInfo');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
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

     const { ownerCountField, totalXrpReservesField, currencyField, totalExecutionTime } = fields;
     const { seedField, balanceField } = resolveAccountFields();
     const validations = [[!validatInput(seedField.value), 'ERROR: Account seed amount can not be empty']];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          const wallet = xrpl.Wallet.fromSeed(seedField.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          resultField.value = `Connected to ${environment} ${net}\nGetting Account Data.\n\n`;

          // Fetch account info
          const { result: accountInfo } = await client.request({
               method: 'account_info',
               account: wallet.classicAddress,
               ledger_index: 'validated',
          });

          console.log('accountInfo', accountInfo);

          // Set flags from account info
          flagList.forEach(flag => {
               const input = document.getElementById(flag.name);
               const flagKey = flagMap[flag.name];
               if (input && flagKey) {
                    input.checked = !!accountInfo.account_flags?.[flagKey];
               }
          });

          // Fetch account objects
          const { result: accountObjects } = await client.request({
               method: 'account_objects',
               account: wallet.classicAddress,
               ledger_index: 'validated',
          });

          console.log('accountObjects', accountObjects);

          const flagsDetails = parseAccountFlagsDetails(accountInfo.account_flags);
          resultField.value += `Address: ${wallet.classicAddress}\nBalance: ${balanceField.value} XRP\n${flagsDetails}\n`;

          if (accountObjects.account_objects.length <= 0) {
               resultField.value += `No account objects found for ${wallet.classicAddress}`;
          } else {
               resultField.value += parseXRPLAccountObjects(accountObjects);
          }

          resultField.classList.add('success');

          const currencyBalanceField = document.getElementById('currencyBalanceField');
          if (currencyBalanceField) {
               if (currencyField) {
                    currencyBalanceField.value = await getOnlyTokenBalance(client, wallet.classicAddress, currencyField.value);
               }
          }

          const currentTimeField = document.getElementById('currentTimeField');
          if (currentTimeField) {
               document.getElementById('currentTimeField').value = convertToEstTime(new Date().toISOString());
          }

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          balanceField.value = (await client.getXrpBalance(wallet.classicAddress)) - totalXrpReservesField.value;
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving getAccountInfo in ${now}ms`);
     }
}

async function updateFlags() {
     console.log('Entering updateFlags');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');
     const totalExecutionTime = document.getElementById('totalExecutionTime');

     const accountSeedField = resolveAccountSeedField();
     if (!accountSeedField) return setError('ERROR: Account seed field not found', spinner);
     if (!accountSeedField.value.trim()) return setError('ERROR: Account seed cannot be empty', spinner);

     const { seedField, balanceField } = resolveAccountFields();

     const noFreeze = document.getElementById('asfNoFreeze')?.checked;
     const globalFreeze = document.getElementById('asfGlobalFreeze')?.checked;
     if (noFreeze && globalFreeze) return setError('ERROR: Cannot enable both NoFreeze and GlobalFreeze', spinner);

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          const wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          resultField.value = `Connected to ${environment} ${net}\nGetting Account Data\n`;

          const { result: accountInfo } = await client.request({
               method: 'account_info',
               account: wallet.classicAddress,
               ledger_index: 'validated',
          });

          console.log('account_flags', accountInfo.account_flags);

          const { setFlags, clearFlags } = getFlagUpdates(accountInfo.account_flags);

          if (setFlags.length == 0 && clearFlags.length == 0) {
               resultField.value += '\nSet Flags and Clear Flags length is 0. No flags selected for update';
          }

          for (const flagValue of setFlags) {
               const response = await submitFlagTransaction(client, wallet, { SetFlag: parseInt(flagValue) });
               if (!response.success) {
                    return setError(response.message, spinner);
               }
               resultField.value += `\n\nSet Flag ${getFlagName(flagValue)} Result:\n${response.message}`;
          }

          for (const flagValue of clearFlags) {
               const response = await submitFlagTransaction(client, wallet, { ClearFlag: parseInt(flagValue) });
               if (!response.success) {
                    return setError(response.message, spinner);
               }
               resultField.value += `\n\nClear Flag ${getFlagName(flagValue)} Result:\n${response.message}`;
          }

          resultField.value += `\nTotal execution time ${Date.now() - startTime}ms`;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          balanceField.value = (await client.getXrpBalance(wallet.classicAddress)) - totalXrpReservesField.value;
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving updateFlags in ${now}ms`);
     }
}

async function setDepositAuthAccounts(authorizeFlag) {
     console.log('Entering setDepositAuthAccounts');
     const startTime = Date.now();
     console.log('Authorize Flag:', authorizeFlag);

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');
     const totalExecutionTime = document.getElementById('totalExecutionTime');

     const selected = getSelectedAccount();
     if (!selected) return setError(`Please select an account.`, spinner);

     const { seedField, balanceField } = resolveAccountFields();

     const isAccount1 = selected === 'account1';
     const accountSeedField = document.getElementById(isAccount1 ? 'accountSeed1Field' : 'accountSeed2Field');
     const accountAddressField = document.getElementById(isAccount1 ? 'accountAddress1Field' : 'accountAddress2Field');
     const authorizedAddressField = document.getElementById(isAccount1 ? 'accountAddress2Field' : 'accountAddress1Field');

     if (!accountSeedField || !accountAddressField || !authorizedAddressField || !resultField) return setError(`ERROR: DOM elements not found.`, spinner);

     const seed = accountSeedField.value.trim();
     const authorizedAddress = authorizedAddressField.value.trim();

     if (!seed) return setError(`ERROR: Account seed cannot be empty.`, spinner);
     if (!authorizedAddress) return setError(`ERROR: Authorized account address cannot be empty.`, spinner);
     if (!xrpl.isValidAddress(authorizedAddress)) return setError(`ERROR: Authorized account address is invalid.`, spinner);

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          const wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          resultField.value = `Connected to ${environment} ${net}\nSetting Deposit Authorization\n\n`;

          // Validate authorized account exists
          try {
               await client.request({
                    method: 'account_info',
                    account: authorizedAddress,
                    ledger_index: 'validated',
               });
          } catch (error) {
               if (error.data?.error === 'actNotFound') {
                    return setError(`ERROR: Authorized account does not exist (tecNO_TARGET).`, spinner);
               }
               throw error;
          }

          // Ensure DepositAuth is enabled
          const { result: accountInfo } = await client.request({
               method: 'account_info',
               account: wallet.classicAddress,
               ledger_index: 'validated',
          });

          if (!accountInfo.account_flags.depositAuth) {
               return setError(`ERROR: Account must have asfDepositAuth flag enabled.`, spinner);
          }

          // Prevent duplicate preauthorization
          const { result: accountObjects } = await client.request({
               method: 'account_objects',
               account: wallet.classicAddress,
               type: 'deposit_preauth',
               ledger_index: 'validated',
          });

          const alreadyAuthorized = accountObjects.account_objects.some(obj => obj.Authorize === authorizedAddress);
          if (authorizeFlag === 'Y' && alreadyAuthorized) {
               return setError(`ERROR: Preauthorization already exists (tecDUPLICATE). Use Unauthorize to remove.`, spinner);
          }

          // Prepare and submit DepositPreauth transaction
          const { result: feeResponse } = await client.request({ command: 'fee' });

          const tx = await client.autofill({
               TransactionType: 'DepositPreauth',
               Account: wallet.classicAddress,
               [authorizeFlag === 'Y' ? 'Authorize' : 'Unauthorize']: authorizedAddress,
               Fee: feeResponse.drops.open_ledger_fee,
          });

          console.log('DepositPreauth Transaction:', tx);

          const response = await client.submitAndWait(tx, { wallet });

          const resultCode = response.result.meta?.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(response.result)}`, spinner);
          }

          resultField.value += `Deposit Auth finished successfully.\n\n`;
          resultField.value += prepareTxHashForOutput(response.result.hash) + '\n';
          resultField.value += parseXRPLTransaction(response.result);
          resultField.value += `\nTotal execution time ${Date.now() - startTime}ms`;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          balanceField.value = (await client.getXrpBalance(wallet.classicAddress)) - totalXrpReservesField.value;
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving setDepositAuthAccounts in ${now}ms`);
     }
}

export async function getLedgerAccountInfo(client, accountAddress, validated) {
     try {
          const accountInfo = await client.request({
               command: 'account_info',
               account: accountAddress,
               ledger_index: validated,
          });
          console.debug(`accountInfo: ${accountInfo}`);
          return accountInfo;
     } catch (error) {
          return null;
     }
}

export async function fetchAccountObjects(walletAddress) {
     try {
          const client = await getClient();
          const accountObjects = await client.request({
               method: 'account_objects',
               account: walletAddress.value,
               ledger_index: 'validated',
          });
          console.debug(`account_objects: ${accountObjects}`);
          return accountObjects;
     } catch (error) {
          console.error('Error fetching account objects:', error);
          return [];
     }
}

function getSelectedAccount() {
     const account1 = document.getElementById('account1');
     const account2 = document.getElementById('account2');

     if (account1.checked) {
          return account1.value;
     } else if (account2.checked) {
          return account2.value;
     } else {
          // No radio button checked
          return null;
     }
}

function getFlagUpdates(currentFlags) {
     const setFlags = [],
          clearFlags = [];

     flagList.forEach(flag => {
          const checkbox = document.getElementById(flag.name);
          if (!checkbox || !flag.xrplName) return;

          const desired = checkbox.checked;
          const actual = !!currentFlags[flag.xrplName];

          if (desired && !actual) setFlags.push(flag.value);
          if (!desired && actual) clearFlags.push(flag.value);
     });

     return { setFlags, clearFlags };
}

async function submitFlagTransaction(client, wallet, flagPayload) {
     console.log('Entering submitFlagTransaction');
     const startTime = Date.now();

     const tx = {
          TransactionType: 'AccountSet',
          Account: wallet.classicAddress,
          ...flagPayload,
     };

     try {
          const response = await client.submitAndWait(tx, { wallet });
          const txResult = response.result.meta?.TransactionResult;
          if (txResult !== TES_SUCCESS) {
               return {
                    success: false,
                    message: `ERROR: ${txResult}\n${parseXRPLTransaction(response.result)}`,
               };
          }
          console.log(`Leaving submitFlagTransaction in ${Date.now() - startTime}ms`);
          return {
               success: true,
               message: parseXRPLTransaction(response.result),
          };
     } catch (err) {
          console.log(`Leaving submitFlagTransaction in ${Date.now() - startTime}ms`);
          return { success: false, message: `ERROR submitting flag: ${err.message}` };
     }
}

export async function getTrustLines(account, client) {
     console.log('Entering getTrustLines');
     const startTime = Date.now();
     try {
          const response = await client.request({
               command: 'account_lines',
               account: account,
               ledger_index: 'validated',
          });
          const trustLines = response.result.lines;

          // Filter out trust lines with Limit: 0
          const activeTrustLines = trustLines.filter(line => parseFloat(line.limit) > 0);
          console.debug(`Active trust lines for ${account}:`, activeTrustLines);

          if (activeTrustLines.length === 0) {
               console.log(`No active trust lines found for ${account}`);
               console.log(`Leaving getTrustLines in ${Date.now() - startTime}ms`);
               return [];
          }

          console.debug(`Trust lines for ${account}:`, activeTrustLines);
          console.log(`Leaving getTrustLines in ${Date.now() - startTime}ms`);
          return trustLines;
     } catch (error) {
          console.error('Error fetching trust lines:', error);
          console.log(`Leaving getTrustLines in ${Date.now() - startTime}ms`);
          return [];
     }
}

function getFlagName(value) {
     return flagList.find(f => f.value === value)?.name || `Flag ${value}`;
}

function resolveAccountSeedField() {
     const selected = getSelectedAccount();
     return document.getElementById(selected === 'account1' ? 'accountSeed1Field' : 'accountSeed2Field') || document.getElementById('accountSeedField');
}

export function resolveAccountFields() {
     const selected = getSelectedAccount();
     const seedField = document.getElementById(selected === 'account1' ? 'accountSeed1Field' : 'accountSeed2Field') || document.getElementById('accountSeedField');
     const balanceField = document.getElementById(selected === 'account1' ? 'xrpBalance1Field' : 'xrpBalance2Field') || document.getElementById('xrpBalanceField');
     return { seedField, balanceField };
}

export async function displayDataForAccount1() {
     accountName1Field.value = account1name.value;
     accountAddress1Field.value = account1address.value;
     accountSeed1Field.value = account1seed.value;
     await getAccountInfo();
}

export async function displayDataForAccount2() {
     accountName2Field.value = account2name.value;
     accountAddress2Field.value = account2address.value;
     accountSeed2Field.value = account2seed.value;
     await getAccountInfo();
}

window.getAccountInfo = getAccountInfo;
window.updateFlags = updateFlags;
window.setDepositAuthAccounts = setDepositAuthAccounts;
window.getTransaction = getTransaction;
window.convertToEstTime = convertToEstTime;
window.displayDataForAccount1 = displayDataForAccount1;
window.displayDataForAccount2 = displayDataForAccount2;
window.autoResize = autoResize;
window.disconnectClient = disconnectClient;
window.gatherAccountInfo = gatherAccountInfo;
window.clearFields = clearFields;
window.distributeAccountInfo = distributeAccountInfo;
