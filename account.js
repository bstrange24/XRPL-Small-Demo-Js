import * as xrpl from 'xrpl';
import { getClient, getNet, disconnectClient, validatInput, getEnvironment, populate1, populate2, populate3, populateAccount1Only, populateAccount2Only, parseAccountFlagsDetails, parseXRPLAccountObjects, setError, parseXRPLTransaction, autoResize, gatherAccountInfo, clearFields, distributeAccountInfo, getTransaction, updateOwnerCountAndReserves, prepareTxHashForOutput } from './utils.js';

const flagList = [
     { name: 'asfRequireDest', label: 'Require Destination Tag', value: 1, xrplName: 'requireDestinationTag', xrplEnum: xrpl.AccountSetAsfFlags.asfRequireDest },
     { name: 'asfRequireAuth', label: 'Require Trust Line Auth', value: 2, xrplName: 'requireAuthorization', xrplEnum: xrpl.AccountSetAsfFlags.asfRequireAuth },
     { name: 'asfDisallowXRP', label: 'Disallow XRP Payments', value: 3, xrplName: 'disallowIncomingXRP', xrplEnum: xrpl.AccountSetAsfFlags.asfDisallowXRP },
     { name: 'asfDisableMaster', label: 'Disable Master Key', value: 4, xrplName: 'disableMasterKey', xrplEnum: xrpl.AccountSetAsfFlags.asfDisableMaster },
     // { name: 'asfAccountTxnID', label: 'Account Txn ID', value: 5, xrplName: 'accountTxnID', xrplEnum: xrpl.AccountSetAsfFlags.asfAccountTxnID },
     { name: 'asfNoFreeze', label: 'Prevent Freezing Trust Lines', value: 6, xrplName: 'noFreeze', xrplEnum: xrpl.AccountSetAsfFlags.asfNoFreeze },
     { name: 'asfGlobalFreeze', label: 'Freeze All Trust Lines', value: 7, xrplName: 'globalFreeze', xrplEnum: xrpl.AccountSetAsfFlags.asfGlobalFreeze },
     { name: 'asfDefaultRipple', label: 'Enable Rippling', value: 8, xrplName: 'defaultRipple', xrplEnum: xrpl.AccountSetAsfFlags.asfDefaultRipple },
     { name: 'asfDepositAuth', label: 'Require Deposit Auth', value: 9, xrplName: 'depositAuth', xrplEnum: xrpl.AccountSetAsfFlags.asfDepositAuth },
     // { name: 'asfAuthorizedNFTokenMinter', label: 'Require Deposit Auth', value: 10, xrplName: 'authorizedNFTokenMinter', xrplEnum: xrpl.AccountSetAsfFlags.asfAuthorizedNFTokenMinter },
     { name: 'asfDisallowIncomingNFTokenOffer', label: 'Block NFT Offers', value: 12, xrplName: 'disallowIncomingNFTokenOffer', xrplEnum: xrpl.AccountSetAsfFlags.asfDisallowIncomingNFTokenOffer },
     { name: 'asfDisallowIncomingCheck', label: 'Block Checks', value: 13, xrplName: 'disallowIncomingCheck', xrplEnum: xrpl.AccountSetAsfFlags.asfDisallowIncomingCheck },
     { name: 'asfDisallowIncomingPayChan', label: 'Block Payment Channels', value: 14, xrplName: 'disallowIncomingPayChan', xrplEnum: xrpl.AccountSetAsfFlags.asfDisallowIncomingPayChan },
     { name: 'asfDisallowIncomingTrustline', label: 'Block Trust Lines', value: 15, xrplName: 'disallowIncomingTrustline', xrplEnum: xrpl.AccountSetAsfFlags.asfDisallowIncomingTrustline },
     { name: 'asfAllowTrustLineClawback', label: 'Allow Trust Line Clawback', value: 16, xrplName: 'allowTrustLineClawback', xrplEnum: xrpl.AccountSetAsfFlags.asfAllowTrustLineClawback },
];

const flagMap = {
     asfRequireDest: 'requireDestinationTag',
     asfRequireAuth: 'requireAuthorization',
     asfDisallowXRP: 'disallowIncomingXRP',
     asfDisableMaster: 'disableMasterKey',
     // asfAccountTxnID: 'accountTxnID',
     asfNoFreeze: 'noFreeze',
     asfGlobalFreeze: 'globalFreeze',
     asfDefaultRipple: 'defaultRipple',
     asfDepositAuth: 'depositAuth',
     // asfAuthorizedNFTokenMinter: 'authorizedNFTokenMinter',
     asfDisallowIncomingNFTokenOffer: 'disallowIncomingNFTokenOffer',
     asfDisallowIncomingCheck: 'disallowIncomingCheck',
     asfDisallowIncomingPayChan: 'disallowIncomingPayChan',
     asfDisallowIncomingTrustline: 'disallowIncomingTrustline',
     asfAllowTrustLineClawback: 'allowTrustLineClawback',
};

export async function getAccountInfo() {
     console.log('Entering getAccountInfo');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');

     const { seedField, balanceField } = resolveAccountFields();

     if (!seedField || !balanceField) return setError('ERROR: DOM elements not found', spinner);
     if (!validatInput(seedField.value)) return setError('ERROR: Seed cannot be empty', spinner);

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          let wallet;
          if (environment === 'Mainnet') {
               wallet = xrpl.Wallet.fromSeed(seedField.value, { algorithm: 'ed25519' });
          } else {
               wallet = xrpl.Wallet.fromSeed(seedField.value, { algorithm: 'secp256k1' });
          }

          let results = `Connected to ${environment} ${net}\nGetting Account Data.\n\n`;
          resultField.value = results;

          // Fetch account info
          const { result: accountInfo } = await client.request({
               method: 'account_info',
               account: wallet.address,
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
               account: wallet.address,
               ledger_index: 'validated',
          });

          console.log('accountObjects', accountObjects);

          const flagsDetails = parseAccountFlagsDetails(accountInfo.account_flags);
          results += `Address: ${wallet.address}\nBalance: ${balanceField.value} XRP\n${flagsDetails}\n`;

          if (accountObjects.account_objects.length <= 0) {
               results += `No account objects found for ${wallet.address}`;
          } else {
               results += parseXRPLAccountObjects(accountObjects);
          }

          resultField.value = results;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
          balanceField.value = (await client.getXrpBalance(wallet.address)) - totalXrpReservesField.value;
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving getAccountInfo');
     }
}

async function updateFlags() {
     console.log('Entering updateFlags');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');

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

          let wallet;
          if (environment === 'Mainnet') {
               wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'ed25519' });
          } else {
               wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'secp256k1' });
          }

          resultField.value = `Connected to ${environment} ${net}\nGetting Account Data\n`;

          const { result: accountInfo } = await client.request({
               method: 'account_info',
               account: wallet.address,
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

          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
          balanceField.value = (await client.getXrpBalance(wallet.address)) - totalXrpReservesField.value;
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving updateFlags');
     }
}

async function setDepositAuthAccounts(authorizeFlag) {
     console.log('Entering setDepositAuthAccounts');
     console.log('Authorize Flag:', authorizeFlag);

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');

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

          let wallet;
          if (environment === 'Mainnet') {
               wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'ed25519' });
          } else {
               wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'secp256k1' });
          }

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
               account: wallet.address,
               ledger_index: 'validated',
          });

          if (!accountInfo.account_flags.depositAuth) {
               return setError(`ERROR: Account must have asfDepositAuth flag enabled.`, spinner);
          }

          // Prevent duplicate preauthorization
          const { result: accountObjects } = await client.request({
               method: 'account_objects',
               account: wallet.address,
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
               Account: wallet.address,
               [authorizeFlag === 'Y' ? 'Authorize' : 'Unauthorize']: authorizedAddress,
               Fee: feeResponse.drops.open_ledger_fee,
          });

          console.log('DepositPreauth Transaction:', tx);

          const response = await client.submitAndWait(tx, { wallet });

          const resultCode = response.result.meta?.TransactionResult;
          if (resultCode !== 'tesSUCCESS') {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(response.result)}`, spinner);
          }

          resultField.value += `Deposit Auth finished successfully.\n\n`;
          resultField.value += prepareTxHashForOutput(response.result.hash) + '\n';
          resultField.value += parseXRPLTransaction(response.result);
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
          balanceField.value = (await client.getXrpBalance(wallet.address)) - totalXrpReservesField.value;
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving setDepositAuthAccounts');
     }
}

export async function getLedgerAccountInfo(client, accountAddress, validated) {
     try {
          const accountInfo = await client.request({
               command: 'account_info',
               account: accountAddress,
               ledger_index: validated,
          });
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
          console.log('accountObjects', accountObjects);
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
          return account1.value; // 'account1'
     } else if (account2.checked) {
          return account2.value; // 'account2'
     } else {
          return null; // No radio button checked
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
     const tx = {
          TransactionType: 'AccountSet',
          Account: wallet.address,
          ...flagPayload,
     };

     try {
          const response = await client.submitAndWait(tx, { wallet });
          const txResult = response.result.meta?.TransactionResult;
          if (txResult !== 'tesSUCCESS') {
               return {
                    success: false,
                    message: `ERROR: ${txResult}\n${parseXRPLTransaction(response.result)}`,
               };
          }
          return {
               success: true,
               message: parseXRPLTransaction(response.result),
          };
     } catch (err) {
          return { success: false, message: `ERROR submitting flag: ${err.message}` };
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

export async function getTrustLines(account, client) {
     try {
          const response = await client.request({
               command: 'account_lines',
               account: account,
               ledger_index: 'validated',
          });
          const trustLines = response.result.lines;

          // Filter out trust lines with Limit: 0
          const activeTrustLines = trustLines.filter(line => parseFloat(line.limit) > 0);
          console.log(`Active trust lines for ${account}:`, activeTrustLines);

          if (activeTrustLines.length === 0) {
               console.log(`No active trust lines found for ${account}`);
               return [];
          }

          console.log(`Trust lines for ${account}:`, activeTrustLines);
          return trustLines;
     } catch (error) {
          console.error('Error fetching trust lines:', error);
          return [];
     }
}

window.getAccountInfo = getAccountInfo;
window.updateFlags = updateFlags;
window.setDepositAuthAccounts = setDepositAuthAccounts;
window.getTransaction = getTransaction;
window.populate1 = populate1;
window.populate2 = populate2;
window.populate3 = populate3;
window.populateAccount1Only = populateAccount1Only;
window.populateAccount2Only = populateAccount2Only;
window.autoResize = autoResize;
window.disconnectClient = disconnectClient;
window.gatherAccountInfo = gatherAccountInfo;
window.clearFields = clearFields;
window.distributeAccountInfo = distributeAccountInfo;
