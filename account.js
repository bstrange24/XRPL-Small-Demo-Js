import * as xrpl from 'xrpl';
import { getClient, disconnectClient, validatInput, getEnvironment, populate1, populate2, populate3, populateAccount1Only, populateAccount2Only, parseAccountFlagsDetails, parseTransactionDetails} from './utils.js';

const flagList = [
     { name: 'asfRequireDest', label: 'Require Destination Tag', value: 1, xrplName: 'requireDestinationTag' },
     { name: 'asfRequireAuth', label: 'Require Trust Line Auth', value: 2, xrplName: 'requireAuthorization' },
     { name: 'asfDisallowXRP', label: 'Disallow XRP Payments', value: 3, xrplName: 'disallowIncomingXRP' },
     { name: 'asfDisableMaster', label: 'Disable Master Key', value: 4, xrplName: 'disableMasterKey' },
     { name: 'asfNoFreeze', label: 'Prevent Freezing Trust Lines', value: 6, xrplName: 'noFreeze' },
     { name: 'asfGlobalFreeze', label: 'Freeze All Trust Lines', value: 7, xrplName: 'globalFreeze' },
     { name: 'asfDefaultRipple', label: 'Enable Rippling', value: 8, xrplName: 'defaultRipple' },
     { name: 'asfDepositAuth', label: 'Require Deposit Auth', value: 9, xrplName: 'depositAuth' },
     { name: 'asfDisallowIncomingNFTokenOffer', label: 'Block NFT Offers', value: 12, xrplName: 'disallowIncomingNFTokenOffer' },
     { name: 'asfDisallowIncomingCheck', label: 'Block Checks', value: 13, xrplName: 'disallowIncomingCheck' },
     { name: 'asfDisallowIncomingPayChan', label: 'Block Payment Channels', value: 14, xrplName: 'disallowIncomingPayChan' },
     { name: 'asfDisallowIncomingTrustline', label: 'Block Trust Lines', value: 15, xrplName: 'disallowIncomingTrustline' },
     { name: 'asfAllowTrustLineClawback', label: 'Allow Trust Line Clawback', value: 16, xrplName: 'allowTrustLineClawback' },
];

const flagMap = {
     asfRequireDest: 'requireDestinationTag',
     asfRequireAuth: 'requireAuthorization',
     asfDisallowXRP: 'disallowIncomingXRP',
     asfDisableMaster: 'disableMasterKey',
     asfNoFreeze: 'noFreeze',
     asfGlobalFreeze: 'globalFreeze',
     asfDefaultRipple: 'defaultRipple',
     asfDepositAuth: 'depositAuth',
     asfDisallowIncomingNFTokenOffer: 'disallowIncomingNFTokenOffer',
     asfDisallowIncomingCheck: 'disallowIncomingCheck',
     asfDisallowIncomingPayChan: 'disallowIncomingPayChan',
     asfDisallowIncomingTrustline: 'disallowIncomingTrustline',
     asfAllowTrustLineClawback: 'allowTrustLineClawback',
};

export async function getAccountInfo() {
     console.log('Entering getAccountInfo');

     // Clear previous error styling
     resultField.classList.remove("error");
     resultField.classList.remove("success");

     let accountAddressField;
     let accountSeedField;
     let xrpBalanceField;

     const selectedRadio = getSelectedAccount();
     if(selectedRadio != null && selectedRadio == 'account1') {
          accountAddressField = document.getElementById('accountAddress1Field');
          accountSeedField = document.getElementById('accountSeed1Field');
          xrpBalanceField = document.getElementById('xrpBalance1Field');
     } else {
          accountAddressField = document.getElementById('accountAddress2Field');
          accountSeedField = document.getElementById('accountSeed2Field');
          xrpBalanceField = document.getElementById('xrpBalance2Field');
     }

     if (!accountAddressField || !accountSeedField || !xrpBalanceField) {
          resultField.value = 'ERROR: DOM elements not found';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(accountSeedField.value)) {
          resultField.value = 'ERROR: Seed can not be empty';
          resultField.classList.add("error");
          return;
     }

     try {
          const { environment } = getEnvironment()
          const client = await getClient();

          let results = `Connected to ${environment}.\nGetting Account Data.\n\n`;
          resultField.value = results;
          
          const wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'secp256k1' });

          // Fetch account info
          const accountInfo = await client.request({
               method: 'account_info',
               account: wallet.address,
               ledger_index: 'validated',
          });

          console.log('accountInfo',accountInfo.result);

          flagList.forEach((flag) => {
               const input = document.getElementById(flag.name);
               if (input && flagMap[flag.name]) {
                    const apiFlag = flagMap[flag.name];
                    input.checked = !!accountInfo.result.account_flags[apiFlag];
               }
          });

          const accountObjects = await client.request({
               method: 'account_objects',
               account: wallet.address,
               ledger_index: 'validated',
          });
          console.log('accountObjects', accountObjects);

          const accountFlagsDetails = parseAccountFlagsDetails(accountInfo.result.account_flags, accountObjects);
          results += `Address: ${wallet.address}\nBalance: ${xrpBalanceField.value} XRP\n${accountFlagsDetails}\n`;
          console.log('account_objects', JSON.stringify(accountObjects.result.account_objects, null, 2));
          resultField.value = results;
          resultField.classList.add("success");
     } catch (error) {
          console.error('Error:', error);
          resultField.value = "ERROR: " + error.message || 'Unknown error';
          resultField.classList.add("error");
          await disconnectClient();
     } finally {
          console.log('Leaving getAccountInfo');
     } 
}

async function updateFlags() {
     console.log('Entering updateFlags');

     const resultField = document.getElementById('resultField');
     resultField.classList.remove('error');
     resultField.classList.remove("success");

     let accountSeedField;
     const selectedRadio = getSelectedAccount();
     if(selectedRadio != null && selectedRadio == 'account1') {
          accountSeedField = document.getElementById('accountSeed1Field');
     } else {
          accountSeedField = document.getElementById('accountSeed2Field');
     }

     if (!accountSeedField || !resultField) {
          console.error('DOM elements not found');
          resultField.value = 'ERROR: DOM elements not found';
          resultField.classList.add('error');
          return;
     }

     if (!accountSeedField.value.trim()) {
          resultField.value = 'ERROR: Account seed cannot be empty';
          resultField.classList.add('error');
          return;
     }

     if (document.getElementById('asfNoFreeze').checked && document.getElementById('asfGlobalFreeze').checked) {
          resultField.value = 'ERROR: Cannot enable both NoFreeze and GlobalFreeze';
          resultField.classList.add('error');
          return;
     }

     try {
          const { environment } = getEnvironment()
          const client = await getClient();

          let results = `Connected to ${environment}.\nGetting Account Data.\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'secp256k1' });

          const accountInfo = await client.request({
               method: 'account_info',
               account: wallet.address,
               ledger_index: 'validated',
          });

          console.log('accountInfo',accountInfo.result.account_flags);

          const setFlags = [];
          const clearFlags = [];

          // Compare current flags with desired states from checkboxes
          flagList.forEach((flag) => {
               console.log('flag.name', flag.name);
               const input = document.getElementById(flag.name);
               
               if (input) {
                    const desiredState = input.checked;
                    console.log('desiredState', desiredState);
                    const xrplFlagState = accountInfo.result.account_flags[flag.xrplName];
                    console.log('xrplFlagState', xrplFlagState);
                    if(desiredState == xrplFlagState) { 
                         /* empty Continue with next loop iteration */ 
                    } else if (desiredState && !xrplFlagState) {
                         setFlags.push(flag.value);
                    } else if (!desiredState && xrplFlagState) {
                         clearFlags.push(flag.value);
                    }
               }
          });

          // Submit one transaction per flag change (XRPL limitation)
          for (const flagValue of setFlags) {
               const transaction = {
                    TransactionType: 'AccountSet',
                    Account: wallet.address,
                    SetFlag: parseInt(flagValue),
               };
               const response = await client.submitAndWait(transaction, { wallet });

               if(response.result.meta.TransactionResult != "tesSUCCESS") {
                    resultField.value = "ERROR: " + response.result.meta.TransactionResult + '\n' + parseTransactionDetails(response.result);
                    resultField.classList.add("error");
               } else {
                    resultField.value += `\n\nSet Flag ${flagList.find(f => f.value === flagValue).name} Result:\n${parseTransactionDetails(response.result)}`;
                    resultField.classList.add("success");
               }
          }

          for (const flagValue of clearFlags) {
               const transaction = {
                    TransactionType: 'AccountSet',
                    Account: wallet.address,
                    ClearFlag: parseInt(flagValue),
               };
               const response = await client.submitAndWait(transaction, { wallet });
               resultField.value += `\n\nClear Flag ${flagList.find(f => f.value === flagValue).name} Result:\n${JSON.stringify(response.result, null, 2)}`;
               resultField.classList.add("success");
          }

          // Refresh details
          await getAccountInfo();
     } catch (error) {
          console.error('Error:', error);
          resultField.value = `Error: ${error.message || 'Unknown error'}`;
          resultField.classList.add('error');
          await client.disconnect();
     } finally {
          console.log('Leaving updateFlags');
     }
}

async function setDepositAuthAccounts(authorizeFlag) {
     console.log('Entering setDepositAuthAccounts');
     console.log('Authorize Flag', authorizeFlag);

     const resultField = document.getElementById('resultField');
     resultField.classList.remove('error');
     resultField.classList.remove("success");

     let accountSeedField;
     let accountAddressField;
     let authorizedAddressField;
     
     const selectedRadio = getSelectedAccount();
     if (!selectedRadio) {
          resultField.value = 'ERROR: Please select an account';
          resultField.classList.add('error');
          return;
     }

     if(selectedRadio != null && selectedRadio == 'account1') {
        accountSeedField = document.getElementById('accountSeed1Field');
        accountAddressField = document.getElementById('accountAddress1Field');
        authorizedAddressField = document.getElementById('accountAddress2Field');
     } else {
        accountSeedField = document.getElementById('accountSeed2Field');
        accountAddressField = document.getElementById('accountAddress2Field');
        authorizedAddressField = document.getElementById('accountAddress1Field');
     }

     if (!accountSeedField || !accountAddressField || !resultField) {
          console.error('DOM elements not found');
          resultField.value = 'ERROR: DOM elements not found';
          resultField.classList.add('error');
          return;
     }

     if (!accountSeedField.value.trim()) {
          resultField.value = 'ERROR: Account seed can not be empty';
          resultField.classList.add('error');
          return;
     }

     if (!authorizedAddressField.value.trim()) {
          resultField.value = 'ERROR: Authorized account address can not be empty';
          resultField.classList.add('error');
          return;
     }

     if(!xrpl.isValidAddress(authorizedAddressField.value)) {
          resultField.value = 'ERROR: Authorized account address is invalid';
          resultField.classList.add('error');
          return;
     }

     try {
          const { environment } = getEnvironment();
          const client = await getClient();
     
          let results = `Connected to ${environment}.\nSetting Deposit Authorization.\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'secp256k1' });

          // Validate authorized account exists
          try {
               await client.request({
                   method: 'account_info',
                    account: authorizedAddressField.value,
                    ledger_index: 'validated',
               });
          } catch (error) {
               if (error.data.error === 'actNotFound') {
                    resultField.value = 'ERROR: Authorized account does not exist (tecNO_TARGET)';
                    resultField.classList.add('error');
                    return;
               }
               throw error;
          }

          // Check if asfDepositAuth is enabled
          const accountInfo = await client.request({
               method: 'account_info',
               account: wallet.address,
               ledger_index: 'validated',
          });
          
          const flags = accountInfo.result.account_flags;
          if (!flags.depositAuth) {
               resultField.value = 'ERROR: Account must have asfDepositAuth flag enabled';
               resultField.classList.add('error');
               return;
          }

           // Check for existing preauthorization
          const accountObjects = await client.request({
               method: 'account_objects',
               account: wallet.address,
               type: 'deposit_preauth',
               ledger_index: 'validated',
          });
          const existingPreauth = accountObjects.result.account_objects.find(
               (obj) => obj.Authorize === authorizedAddressField.value
          );

          if (existingPreauth && authorizeFlag === 'Y') {
               resultField.value = 'ERROR: Preauthorization already exists (tecDUPLICATE). Use Unauthorize to remove.';
               resultField.classList.add('error');
               return;
          }
          
          // Get current fee
          const feeResponse = await client.request({ command: 'fee' });
          const fee = feeResponse.result.drops.open_ledger_fee;

          // Prepare DepositPreauth transaction
          const depositAuthTx = await client.autofill({
               TransactionType: 'DepositPreauth',
               Account: wallet.address,
               [authorizeFlag === 'Y' ? 'Authorize' : 'Unauthorize']: authorizedAddressField.value,
               Fee: fee,
          });

          console.log('DepositPreauth Transaction:', depositAuthTx);
          // results += `Prepared Transaction:\n${JSON.stringify(depositAuthTx, null, 2)}\n`;

          // Submit transaction
          const response = await client.submitAndWait(depositAuthTx, { wallet });
          console.log('response:', response);

          if(response.result.meta.TransactionResult != "tesSUCCESS") {
               resultField.value = "ERROR: " + response.result.meta.TransactionResult;
               resultField.classList.add("error");
               return;
          } else {
               results += `${parseTransactionDetails(response.result)}`;
               resultField.value = results;
               resultField.classList.add("success");
          }

          // Refresh account details
          // await getAccountInfo();
     } catch (error) {
          console.error('Error:', error);
          resultField.value = "ERROR: " + error.message || 'Unknown error';
          resultField.classList.add("error");
          await disconnectClient();
     } finally {
          console.log('Leaving setDepositAuthAccounts');
     }
}

function getSelectedAccount() {
    const account1 = document.getElementById('account1');
    const account2 = document.getElementById('account2');

    if (account1.checked) {
        return account1.value; // 'account1'
    } else if (account2.checked) {
        return account2.value; // 'account2'
    }  else {
        return null; // No radio button checked
    }
}

window.getAccountInfo = getAccountInfo;
window.updateFlags = updateFlags;
window.setDepositAuthAccounts = setDepositAuthAccounts;
window.populate1 = populate1;
window.populate2 = populate2;
window.populate3 = populate3;
window.populateAccount1Only = populateAccount1Only;
window.populateAccount2Only = populateAccount2Only;
