import * as xrpl from 'xrpl';
import { getClient, disconnectClient, validatInput, populate1, populate2, populate3, populateTakerGetsTakerPayFields, parseXRPLTransaction, getNet, getOnlyTokenBalance, getCurrentLedger, parseXRPLAccountObjects, setError, gatherAccountInfo, clearFields, distributeAccountInfo, getTransaction, updateOwnerCountAndReserves, prepareTxHashForOutput, encodeCurrencyCode, decodeCurrencyCode, getXrplReserve, renderAMMPoolDetails, renderTransactionDetails } from './utils.js';
import { fetchAccountObjects } from './account.js';
import { getTokenBalance } from './send-currency.js';
import { XRP_CURRENCY, ed25519_ENCRYPTION, secp256k1_ENCRYPTION, MAINNET, TES_SUCCESS, EMPTY_STRING } from './constants.js';
import { derive } from 'xrpl-accountlib';

export async function getAMMPoolInfo() {
     console.log('Entering getAMMPoolInfo');
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
          accountName: document.getElementById('accountNameField'),
          accountAddress: document.getElementById('accountAddressField'),
          accountSeed: document.getElementById('accountSeedField'),
          xrpBalance: document.getElementById('xrpBalanceField'),
          weWantCurrency: document.getElementById('weWantCurrencyField'),
          weWantIssuer: document.getElementById('weWantIssuerField'),
          weWantAmount: document.getElementById('weWantAmountField'),
          weSpendCurrency: document.getElementById('weSpendCurrencyField'),
          weSpendIssuer: document.getElementById('weSpendIssuerField'),
          weSpendAmount: document.getElementById('weSpendAmountField'),
          lpTokenBalance: document.getElementById('lpTokenBalanceField'),
          assetPool1Balance: document.getElementById('assetPool1Balance'),
          assetPool2Balance: document.getElementById('assetPool2Balance'),
          tradingFee: document.getElementById('tradingFeeField'),
          withdrawlLpTokenFromPool: document.getElementById('withdrawlLpTokenFromPoolField'),
          totalExecutionTime: document.getElementById('totalExecutionTime'),
     };

     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim();
          }
     }

     const { accountName, accountAddress, accountSeed, xrpBalance, weWantCurrency, weWantIssuer, weWantAmount, weSpendCurrency, weSpendIssuer, weSpendAmount, lpTokenBalance, tradingFee, withdrawlLpTokenFromPool, totalExecutionTime, assetPool1Balance, assetPool2Balance } = fields;

     const validations = [
          [!validatInput(accountName.value), 'Account Name cannot be empty'],
          [!validatInput(accountAddress.value), 'Account Address cannot be empty'],
          [!xrpl.isValidAddress(accountAddress.value), 'Invalid Account address'],
          [!validatInput(accountSeed.value), 'Account seed cannot be empty'],
          [!validatInput(xrpBalance.value), 'XRP balance cannot be empty'],
          [!validatInput(weWantCurrency.value), 'Taker Gets currency cannot be empty'],
          [weWantCurrency.value.length < 3, 'Invalid Taker Gets currency. Length must be greater than 3'],
          [!validatInput(weSpendCurrency.value), 'Taker Pays currency cannot be empty'],
          [weSpendCurrency.value.length < 3, 'Invalid Taker Pays currency. Length must be greater than 3'],
          [!validatInput(weWantAmount.value), 'Taker Gets amount cannot be empty'],
          [isNaN(weWantAmount.value), 'Taker Gets amount must be a valid number'],
          [parseFloat(weWantAmount.value) <= 0, 'Taker Gets amount must be greater than zero'],
          [!validatInput(weSpendAmount.value), 'Taker Pays amount cannot be empty'],
          [isNaN(weSpendAmount.value), 'Taker Pays amount must be a valid number'],
          [parseFloat(weSpendAmount.value) <= 0, 'Taker Pays amount must be greater than zero'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          // Check server version
          const serverInfo = await client.request({ method: 'server_info' });
          const serverVersion = serverInfo.result.info.build_version;
          console.log('Server Version: ' + serverVersion);

          // Initialize wallet
          let wallet;
          if (accountSeed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(accountSeed.value, {
                    algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION,
               });
          } else if (accountSeed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(accountSeed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, {
                    algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION,
               });
          } else {
               wallet = xrpl.Wallet.fromSeed(accountSeed.value, {
                    algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION,
               });
          }

          // Prepare assets
          let asset, asset2;
          if (weWantCurrency.value === XRP_CURRENCY) {
               asset = { currency: XRP_CURRENCY };
          } else {
               const currency = weWantCurrency.value.length > 3 ? encodeCurrencyCode(weWantCurrency.value) : weWantCurrency.value;
               asset = { currency, issuer: weWantIssuer.value };
          }
          if (weSpendCurrency.value === XRP_CURRENCY) {
               asset2 = { currency: XRP_CURRENCY };
          } else {
               const currency = weSpendCurrency.value.length > 3 ? encodeCurrencyCode(weSpendCurrency.value) : weSpendCurrency.value;
               asset2 = { currency, issuer: weSpendIssuer.value };
          }

          // Prepare data for rendering
          const data = {
               sections: [],
          };

          // Fetch AMM pool info
          let poolData;
          try {
               const ammInfo = await client.request({
                    command: 'amm_info',
                    asset,
                    asset2,
               });
               poolData = ammInfo.result;

               // Format Asset 1
               const asset1Content = [];
               if (poolData.amm.amount.currency === undefined) {
                    asset1Content.push({ key: 'Asset', value: 'XRP' });
                    const amount = poolData.amm.amount.value || poolData.amm.amount;
                    asset1Content.push({ key: 'Amount (drops)', value: amount });
                    asset1Content.push({ key: 'Amount (XRP)', value: xrpl.dropsToXrp(amount) });
                    assetPool1Balance.value = `${xrpl.dropsToXrp(amount)} XRP`;
               } else {
                    asset1Content.push({ key: 'Asset', value: poolData.amm.amount.currency });
                    if (poolData.amm.amount.issuer) {
                         asset1Content.push({ key: 'Issuer', value: `<code>${poolData.amm.amount.issuer}</code>` });
                    }
                    asset1Content.push({ key: 'Amount', value: poolData.amm.amount.value || poolData.amm.amount });
                    assetPool1Balance.value = poolData.amm.amount.value || poolData.amm.amount;
               }

               // Format Asset 2
               const asset2Content = [];
               if (poolData.amm.amount2.currency === undefined) {
                    asset2Content.push({ key: 'Asset', value: 'XRP' });
                    const amount = poolData.amm.amount2.value || poolData.amm.amount2;
                    asset2Content.push({ key: 'Amount (drops)', value: amount });
                    asset2Content.push({ key: 'Amount (XRP)', value: xrpl.dropsToXrp(amount) });
                    assetPool2Balance.value = `${xrpl.dropsToXrp(amount)} XRP`;
               } else {
                    asset2Content.push({ key: 'Asset', value: poolData.amm.amount2.currency });
                    if (poolData.amm.amount2.issuer) {
                         asset2Content.push({ key: 'Issuer', value: `<code>${poolData.amm.amount2.issuer}</code>` });
                    }
                    asset2Content.push({ key: 'Amount', value: poolData.amm.amount2.value || poolData.amm.amount2 });
                    assetPool2Balance.value = poolData.amm.amount2.value || poolData.amm.amount2;
               }

               // AMM Pool Details section
               data.sections.push({
                    title: 'AMM Pool Details',
                    openByDefault: true,
                    subItems: [
                         {
                              key: 'Asset 1',
                              openByDefault: true,
                              content: asset1Content,
                         },
                         {
                              key: 'Asset 2',
                              openByDefault: true,
                              content: asset2Content,
                         },
                         {
                              key: 'Pool Info',
                              openByDefault: true,
                              content: [
                                   { key: 'Trading Fee', value: `${poolData.amm.trading_fee / 10000}%` },
                                   { key: 'AMM Account', value: `<code>${poolData.amm.account}</code>` },
                              ],
                         },
                    ],
               });

               // Update trading fee field
               tradingFee.value = `${poolData.amm.trading_fee / 10000}`;

               // Fetch LP Token balance
               const accountLines = await client.request({
                    command: 'account_lines',
                    account: wallet.classicAddress,
                    ledger_index: 'current',
               });
               const lpTokenLine = accountLines.result.lines.find(line => line.currency === poolData.amm.lp_token.currency && line.account === poolData.amm.lp_token.issuer);
               lpTokenBalance.value = lpTokenLine ? lpTokenLine.balance : '0';

               // LP Token section
               data.sections.push({
                    title: 'LP Token',
                    openByDefault: true,
                    content: [
                         { key: 'Currency', value: poolData.amm.lp_token.currency },
                         { key: 'Balance', value: poolData.amm.lp_token.value },
                         { key: 'User Balance', value: lpTokenBalance.value },
                    ],
               });
          } catch (error) {
               console.error('AMM Info Error:', error);
               data.sections.push({
                    title: 'AMM Pool Details',
                    openByDefault: true,
                    content: [
                         {
                              key: 'Status',
                              value: error.message.includes('Account not found') ? 'No AMM pool exists for this asset pair. Try creating one with "Create AMM Pool".' : `Error fetching AMM pool info: ${error.message}`,
                         },
                    ],
               });
               lpTokenBalance.value = '';
               withdrawlLpTokenFromPool.value = '';
          }

          console.debug('data: ', data);

          // Render data
          renderAMMPoolDetails(data);

          // Update XRP balance
          xrpBalance.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`, spinner);
     } finally {
          if (spinner) spinner.style.display = 'none';
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving getAMMPoolInfo in ${now}ms`);
     }
}

export async function createAMMPool() {
     console.log('Entering createAMMPool');
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
          accountName: document.getElementById('accountNameField'),
          accountAddress: document.getElementById('accountAddressField'),
          accountSeed: document.getElementById('accountSeedField'),
          xrpBalance: document.getElementById('xrpBalanceField'),
          weWantCurrency: document.getElementById('weWantCurrencyField'),
          weWantIssuer: document.getElementById('weWantIssuerField'),
          weWantAmount: document.getElementById('weWantAmountField'),
          weSpendCurrency: document.getElementById('weSpendCurrencyField'),
          weSpendIssuer: document.getElementById('weSpendIssuerField'),
          weSpendAmount: document.getElementById('weSpendAmountField'),
          tradingFee: document.getElementById('tradingFeeField'),
          ownerCount: document.getElementById('ownerCountField'),
          totalXrpReserves: document.getElementById('totalXrpReservesField'),
          weWantTokenBalance: document.getElementById('weWantTokenBalanceField'),
          weSpendTokenBalance: document.getElementById('weSpendTokenBalanceField'),
          lpTokenBalance: document.getElementById('lpTokenBalanceField'),
          totalExecutionTime: document.getElementById('totalExecutionTime'),
     };

     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim();
          }
     }

     const { accountName, accountAddress, accountSeed, xrpBalance, weWantCurrency, weWantIssuer, weWantAmount, weSpendCurrency, weSpendIssuer, weSpendAmount, tradingFee, ownerCount, totalXrpReserves, weWantTokenBalance, weSpendTokenBalance, lpTokenBalance, totalExecutionTime } = fields;

     const validations = [
          [!validatInput(accountName.value), 'Account Name can not be empty'],
          [!validatInput(accountAddress.value), 'Account Address can not be empty'],
          [!xrpl.isValidAddress(accountAddress.value), 'Invalid Account address'],
          [!validatInput(accountSeed.value), 'Account seed amount can not be empty'],
          [!validatInput(xrpBalance.value), 'XRP balance can not be empty'],
          [!validatInput(weWantCurrency.value), 'Taker Gets currency can not be empty'],
          [weWantCurrency.value.length < 3, 'Invalid Taker Gets currency. Length must be greater than 3'],
          [!validatInput(weSpendCurrency.value), 'Taker Pays currency can not be empty'],
          [weSpendCurrency.value.length < 3, 'Invalid Taker Pays currency. Length must be greater than 3'],
          [!validatInput(weWantAmount.value), 'Taker Gets amount cannot be empty'],
          [isNaN(weWantAmount.value), 'Taker Gets amount must be a valid number'],
          [parseFloat(weWantAmount.value) <= 0, 'Taker Gets amount must be greater than zero'],
          [!validatInput(weSpendAmount.value), 'Taker Pays amount cannot be empty'],
          [isNaN(weSpendAmount.value), 'Taker Pays amount must be a valid number'],
          [parseFloat(weSpendAmount.value) <= 0, 'Taker Pays amount must be greater than zero'],
          [tradingFee.value !== '' && isNaN(tradingFee.value), 'Trading fee must be a valid number'],
          [tradingFee.value !== '' && parseFloat(tradingFee.value) <= 0, 'Trading fee must be greater than zero'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          let wallet;
          if (accountSeed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(accountSeed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (accountSeed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(accountSeed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

          resultField.innerHTML = `Connected to ${environment} ${net}\nCreating AMM Pool\n\n`;

          // Prepare asset and asset2
          let asset, asset2;
          if (weWantCurrency.value === XRP_CURRENCY) {
               asset = { currency: XRP_CURRENCY };
          } else {
               if (weWantCurrency.value.length > 3) {
                    const endcodedCurrency = encodeCurrencyCode(weWantCurrency.value);
                    asset = { currency: endcodedCurrency, issuer: weWantIssuer.value };
               } else {
                    asset = { currency: weWantCurrency.value, issuer: weWantIssuer.value };
               }
          }
          if (weSpendCurrency.value === XRP_CURRENCY) {
               asset2 = { currency: XRP_CURRENCY };
          } else {
               if (!weSpendIssuer.value) {
                    throw new Error(`Issuer required for ${weSpendCurrency.value}.`);
               }
               if (weSpendCurrency.value.length > 3) {
                    const endcodedCurrency = encodeCurrencyCode(weSpendCurrency.value);
                    asset2 = { currency: endcodedCurrency, issuer: weSpendIssuer.value };
               } else {
                    asset2 = { currency: weSpendCurrency.value, issuer: weSpendIssuer.value };
               }
          }

          // Check if AMM pool already exists
          try {
               const ammInfo = await client.request({
                    command: 'amm_info',
                    asset,
                    asset2,
               });
               // If the request succeeds, the pool exists
               return setError(`AMM pool already exists for ${weWantCurrency.value}/${weSpendCurrency.value} pair.`, spinner);
          } catch (error) {
               if (error.message.includes('Account not found') || error.message.includes('AMM does not exist')) {
                    // Pool does not exist, proceed with creation
                    console.log('No existing AMM pool found, proceeding with creation.');
               } else if (error.message.includes('already exists')) {
                    // Re-throw the custom error for existing pool
                    let errorMessage = `ERROR: ${error || 'Unknown error'}`;
                    return setError(errorMessage, spinner);
               } else {
                    // Other errors (e.g., network issues)
                    return setError(`Failed to check AMM pool: ${error.message}`, spinner);
               }
          }

          let amount;
          if (weWantCurrency.value === XRP_CURRENCY) {
               amount = xrpl.xrpToDrops(weWantAmount.value); // Convert XRP to drops (string)
          } else {
               if (weWantCurrency.value.length > 3) {
                    const endcodedCurrency = encodeCurrencyCode(weWantCurrency.value);
                    amount = {
                         currency: endcodedCurrency,
                         issuer: weWantIssuer.value,
                         value: weWantAmount.value.toString(),
                    };
               } else {
                    amount = {
                         currency: weWantCurrency.value,
                         issuer: weWantIssuer.value,
                         value: weWantAmount.value.toString(),
                    };
               }
          }

          // Prepare Amount2
          let amount2;
          if (weSpendCurrency.value === XRP_CURRENCY) {
               amount2 = xrpl.xrpToDrops(weSpendAmount.value); // Convert XRP to drops (string)
          } else {
               if (weSpendCurrency.value.length > 3) {
                    const endcodedCurrency = encodeCurrencyCode(weSpendCurrency.value);
                    amount2 = {
                         currency: endcodedCurrency,
                         issuer: weSpendIssuer.value,
                         value: weSpendAmount.value.toString(),
                    };
               } else {
                    amount2 = {
                         currency: weSpendCurrency.value,
                         issuer: weSpendIssuer.value,
                         value: weSpendAmount.value.toString(),
                    };
               }
          }

          await checkRippling(client, weWantIssuer.value, weWantCurrency.value);
          await checkRippling(client, weSpendIssuer.value, weSpendCurrency.value);
          await checkBalancesAndTrustLines(client, wallet.classicAddress, weWantCurrency.value, weWantIssuer.value, weWantAmount.value, weSpendIssuer.value, weSpendAmount.value, weSpendCurrency.value);

          // Default to 0.5% fee if not specified by the user
          if (tradingFee.value === '') {
               tradingFee.value = 500;
          }

          const ammCreate = {
               TransactionType: 'AMMCreate',
               Account: wallet.classicAddress,
               Amount: amount,
               Amount2: amount2,
               TradingFee: parseInt(tradingFee.value),
          };

          if (tradingFee.value !== '') {
               const tradingFeeValue = parseFloat(tradingFee.value);
               tradingFee.value = tradingFeeValue / 1000; // → 0.
          }

          const prepared = await client.autofill(ammCreate);
          const signed = wallet.sign(prepared);
          const tx = await client.submitAndWait(signed.tx_blob);

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               renderTransactionDetails(tx);
               resultField.classList.add('error');
               return;
          }

          renderTransactionDetails(tx);
          resultField.classList.add('success');

          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCount, totalXrpReserves);
          xrpBalance.value = (await client.getXrpBalance(wallet.classicAddress)) - totalXrpReserves.value;

          if (weWantCurrency.value === XRP_CURRENCY) {
               weSpendTokenBalance.value = await getOnlyTokenBalance(client, wallet.classicAddress, weSpendCurrency.value);
               weWantTokenBalance.value = xrpBalance.value;
          } else {
               weWantTokenBalance.value = await getOnlyTokenBalance(client, wallet.classicAddress, weWantCurrency.value);
               weSpendTokenBalance.value = xrpBalance.value;
          }

          const ammInfo = await client.request({
               command: 'amm_info',
               asset: asset,
               asset2: asset2,
          });

          // Format pool details
          const poolData = ammInfo.result;

          const accountLines = await client.request({
               command: 'account_lines',
               account: wallet.classicAddress,
               ledger_index: 'current',
          });
          const lpTokenLine = accountLines.result.lines.find(line => line.currency === poolData.amm.lp_token.currency && line.account === poolData.amm.lp_token.issuer);
          lpTokenBalance.value = lpTokenLine ? lpTokenLine.balance : '0';
     } catch (error) {
          console.error('Error:', error);
          let errorMessage = `ERROR: ${error.message || 'Unknown error'}`;
          if (error.message.includes('tecUNFUNDED_AMM')) {
               errorMessage += '\nInsufficient funds or reserves to create the AMM pool. Check your XRP and token balances.';
          }
          setError(errorMessage);
     } finally {
          if (spinner) spinner.style.display = 'none';
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving createAMMPool in ${now}ms`);
     }
}

export async function depositToAMM() {
     console.log('Entering depositToAMM');
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
          accountName: document.getElementById('accountNameField'),
          accountAddress: document.getElementById('accountAddressField'),
          accountSeed: document.getElementById('accountSeedField'),
          xrpBalance: document.getElementById('xrpBalanceField'),
          weWantCurrency: document.getElementById('weWantCurrencyField'),
          weWantIssuer: document.getElementById('weWantIssuerField'),
          weWantAmount: document.getElementById('weWantAmountField'),
          weSpendCurrency: document.getElementById('weSpendCurrencyField'),
          weSpendIssuer: document.getElementById('weSpendIssuerField'),
          weSpendAmount: document.getElementById('weSpendAmountField'),
          lpTokenBalance: document.getElementById('lpTokenBalanceField'),
          weWantTokenBalance: document.getElementById('weWantTokenBalanceField'),
          weSpendTokenBalance: document.getElementById('weSpendTokenBalanceField'),
          ownerCount: document.getElementById('ownerCountField'),
          totalXrpReserves: document.getElementById('totalXrpReservesField'),
          isDepositIntoBothPools: document.getElementById('isDepositIntoBothPools'),
          isDepositIntoFirstPoolOnly: document.getElementById('isDepositIntoFirstPoolOnly'),
          isDepositIntoSecondPoolOnly: document.getElementById('isDepositIntoSecondPoolOnly'),
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

     const { accountName, accountAddress, accountSeed, xrpBalance, weWantCurrency, weWantIssuer, weWantAmount, weSpendCurrency, weSpendIssuer, weSpendAmount, lpTokenBalance, weWantTokenBalance, weSpendTokenBalance, ownerCount, totalXrpReserves, isDepositIntoBothPools, isDepositIntoFirstPoolOnly, isDepositIntoSecondPoolOnly, totalExecutionTime } = fields;

     const validations = [
          [!validatInput(accountName.value), 'Account Name can not be empty'],
          [!validatInput(accountAddress.value), 'Account Address can not be empty'],
          [!xrpl.isValidAddress(accountAddress.value), 'Invalid Account address'],
          [!validatInput(accountSeed.value), 'Account seed amount can not be empty'],
          [!validatInput(xrpBalance.value), 'XRP balance can not be empty'],
          [!validatInput(weWantCurrency.value), 'Taker Gets currency can not be empty'],
          [weWantCurrency.value.length < 3, 'Invalid Taker Gets currency. Length must be greater than 3'],
          [!validatInput(weSpendCurrency.value), 'Taker Pays currency can not be empty'],
          [weSpendCurrency.value.length < 3, 'Invalid Taker Pays currency. Length must be greater than 3'],
          [!validatInput(weWantAmount.value), 'Taker Gets amount cannot be empty'],
          [isNaN(weWantAmount.value), 'Taker Gets amount must be a valid number'],
          [parseFloat(weWantAmount.value) <= 0, 'Taker Gets amount must be greater than zero'],
          [!validatInput(weSpendAmount.value), 'Taker Pays amount cannot be empty'],
          [isNaN(weSpendAmount.value), 'Taker Pays amount must be a valid number'],
          [parseFloat(weSpendAmount.value) <= 0, 'Taker Pays amount must be greater than zero'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.innerHTML = `Connected to ${environment} ${net}\nDeposit token into AMM Pool.\n\n`;

          let wallet;
          if (accountSeed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(accountSeed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (accountSeed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(accountSeed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

          // const wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          console.log(`Deposit Option: isDepositIntoBothPools ${isDepositIntoBothPools.checked} isDepositIntoFirstPoolOnly ${isDepositIntoFirstPoolOnly.checked} isDepositIntoSecondPoolOnly ${isDepositIntoSecondPoolOnly.checked}`);

          let ammDeposit;
          if (isDepositIntoBothPools.checked) {
               ammDeposit = {
                    TransactionType: 'AMMDeposit',
                    Account: wallet.classicAddress,
                    Asset: {
                         currency: weWantCurrency.value,
                         issuer: weWantIssuer.value,
                    },
                    Asset2: { currency: XRP_CURRENCY },
                    Amount: {
                         currency: weWantCurrency.value,
                         issuer: weWantIssuer.value,
                         value: weWantAmount.value,
                    },
                    Amount2: xrpl.xrpToDrops(weSpendAmount.value),
                    Flags: xrpl.AMMDepositFlags.tfTwoAsset,
               };
          } else if (isDepositIntoFirstPoolOnly.checked) {
               ammDeposit = {
                    TransactionType: 'AMMDeposit',
                    Account: wallet.classicAddress,
                    Asset: {
                         currency: weWantCurrency.value,
                         issuer: weWantIssuer.value,
                    },
                    Asset2: { currency: XRP_CURRENCY },
                    Amount: {
                         currency: weWantCurrency.value,
                         issuer: weWantIssuer.value,
                         value: weWantAmount.value,
                    },
                    Flags: xrpl.AMMDepositFlags.tfSingleAsset,
               };
          } else if (isDepositIntoSecondPoolOnly.checked) {
               // Swap asset and amount if depositing into second pool
               ammDeposit = {
                    TransactionType: 'AMMDeposit',
                    Account: wallet.classicAddress,
                    Asset: {
                         currency: XRP_CURRENCY,
                    },
                    Asset2: {
                         currency: weWantCurrency.value,
                         issuer: weWantIssuer.value,
                    },
                    Amount: xrpl.xrpToDrops(weSpendAmount.value),
                    Flags: xrpl.AMMDepositFlags.tfSingleAsset,
               };
          } else {
               throw new Error('No deposit option selected.');
          }

          console.log('ammDeposit:', JSON.stringify(ammDeposit, null, 2));

          const ledgerResponse = await client.request({ command: 'ledger' });
          const currentLedger = parseInt(ledgerResponse.result.closed.ledger.ledger_index);
          const prepared = await client.autofill(ammDeposit, 20);
          prepared.LastLedgerSequence = currentLedger + 20;

          const signed = wallet.sign(prepared);
          const tx = await client.submitAndWait(signed.tx_blob);

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               renderTransactionDetails(tx);
               resultField.classList.add('error');
               return;
          }

          resultField.innerHTML += `Deposited: ${isDepositIntoBothPools.checked ? `${weWantAmount.value} ${weWantCurrency.value} + ${weSpendAmount.value} ${XRP_CURRENCY}` : isDepositIntoFirstPoolOnly.checked ? `${weWantAmount.value} ${weWantCurrency.value}` : isDepositIntoSecondPoolOnly.checked ? `${weSpendAmount.value} ${XRP_CURRENCY}` : 'No deposit option selected'}\n`;

          renderTransactionDetails(tx);
          resultField.classList.add('success');

          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCount, totalXrpReserves);
          xrpBalance.value = (await client.getXrpBalance(wallet.classicAddress)) - totalXrpReserves.value;

          if (weWantCurrency.value === XRP_CURRENCY) {
               weSpendTokenBalance.value = await getOnlyTokenBalance(client, wallet.classicAddress, weSpendCurrency.value);
               weWantTokenBalance.value = xrpBalance.value;
          } else {
               weWantTokenBalance.value = await getOnlyTokenBalance(client, wallet.classicAddress, weWantCurrency.value);
               weSpendTokenBalance.value = xrpBalance.value;
          }
     } catch (error) {
          console.error('Error:', error);
          let errorMessage = '';
          if (error.message.includes('Account not found')) {
               errorMessage += 'ERROR: No AMM pool exists for this asset pair. Try creating one with "Create AMM Pool".';
          } else {
               errorMessage = `ERROR: ${error.message || 'Unknown error'}`;
          }
          setError(errorMessage);
     } finally {
          if (spinner) spinner.style.display = 'none';
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving getAMMPoolInfo in ${now}ms`);
     }
}

export async function withdrawFromAMM() {
     console.log(`Entering withdrawFromAMM`);
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
          accountAddress: document.getElementById('accountAddressField'),
          accountSeed: document.getElementById('accountSeedField'),
          xrpBalance: document.getElementById('xrpBalanceField'),
          weWantCurrency: document.getElementById('weWantCurrencyField'),
          weWantIssuer: document.getElementById('weWantIssuerField'),
          weWantAmount: document.getElementById('weWantAmountField'),
          weSpendCurrency: document.getElementById('weSpendCurrencyField'),
          weSpendIssuer: document.getElementById('weSpendIssuerField'),
          weSpendAmount: document.getElementById('weSpendAmountField'),
          withdrawlLpTokenFromPool: document.getElementById('withdrawlLpTokenFromPoolField'),
          isWithdrawFromBothPools: document.getElementById('isWithdrawFromBothPools'),
          isWithdrawFromFirstPoolOnly: document.getElementById('isWithdrawFromFirstPoolOnly'),
          isWithdrawFromSecondPoolOnly: document.getElementById('isWithdrawFromSecondPoolOnly'),
          totalExecutionTime: document.getElementById('totalExecutionTime'),
     };

     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim();
          }
     }
     const { accountAddress, accountSeed, xrpBalance, weWantCurrency, weWantIssuer, weWantAmount, weSpendCurrency, weSpendIssuer, weSpendAmount, withdrawlLpTokenFromPool, isWithdrawFromBothPools, isWithdrawFromFirstPoolOnly, isWithdrawFromSecondPoolOnly, totalExecutionTime } = fields;

     const validations = [
          [!validatInput(accountAddress.value), 'Account Address can not be empty'],
          [!xrpl.isValidAddress(accountAddress.value), 'Invalid Account address'],
          [!validatInput(accountSeed.value), 'Account seed amount can not be empty'],
          [!validatInput(xrpBalance.value), 'XRP balance can not be empty'],
          [!validatInput(weWantCurrency.value), 'Taker Gets currency can not be empty'],
          [weWantCurrency.value.length < 3, 'Invalid Taker Gets currency. Length must be greater than 3'],
          [!validatInput(weSpendCurrency.value), 'Taker Pays currency can not be empty'],
          [weSpendCurrency.value.length < 3, 'Invalid Taker Pays currency. Length must be greater than 3'],
          [!validatInput(weWantAmount.value), 'Taker Gets amount cannot be empty'],
          [isNaN(weWantAmount.value), 'Taker Gets amount must be a valid number'],
          [parseFloat(weWantAmount.value) <= 0, 'Taker Gets amount must be greater than zero'],
          [!validatInput(weSpendAmount.value), 'Taker Pays amount cannot be empty'],
          [isNaN(weSpendAmount.value), 'Taker Pays amount must be a valid number'],
          [parseFloat(weSpendAmount.value) <= 0, 'Taker Pays amount must be greater than zero'],
          [!validatInput(withdrawlLpTokenFromPool.value), 'Withdrawl Lp Token From Pool amount cannot be empty'],
          [isNaN(withdrawlLpTokenFromPool.value), 'Withdrawl Lp Token From Pool amount must be a valid number'],
          [parseFloat(withdrawlLpTokenFromPool.value) <= 0, 'Withdrawl Lp Token From Pool amount must be greater than zero'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     const selectedOptions = [isWithdrawFromFirstPoolOnly.checked, isWithdrawFromSecondPoolOnly.checked, isWithdrawFromBothPools.checked].filter(Boolean);

     if (selectedOptions.length !== 1) {
          return setError('Please select exactly one withdrawal option.', spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          let wallet;
          if (accountSeed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(accountSeed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (accountSeed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(accountSeed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

          resultField.innerHTML = `Connected to ${environment} ${net}\nWithdrawing from AMM Pool\n\n`;

          // Prepare asset and asset2
          let asset = weWantCurrency.value === XRP_CURRENCY ? { currency: XRP_CURRENCY } : { currency: weWantCurrency.value, issuer: weWantIssuer.value };
          let asset2 = weSpendCurrency.value === XRP_CURRENCY ? { currency: XRP_CURRENCY } : { currency: weSpendCurrency.value, issuer: weSpendIssuer.value };

          // Fetch AMM info
          const ammResponse = await client.request({ command: 'amm_info', asset, asset2 });
          const lpToken = ammResponse.result.amm.lp_token;

          // Fetch account lines
          const linesResponse = await client.request({
               command: 'account_lines',
               account: wallet.classicAddress,
               ledger_index: 'current',
          });

          const lpTokenLine = linesResponse.result.lines.find(line => line.currency === lpToken.currency && line.account === lpToken.issuer);
          if (!lpTokenLine || parseFloat(lpTokenLine.balance) <= 0) {
               return setError('No LP tokens available to withdraw.', spinner);
          }

          // Prepare AMMWithdraw transaction
          let flags = 0;
          let ammWithdraw = {
               TransactionType: 'AMMWithdraw',
               Account: wallet.classicAddress,
               Asset: asset,
               Asset2: asset2,
               LPTokenIn: {
                    currency: lpToken.currency,
                    issuer: lpToken.issuer,
                    value: withdrawlLpTokenFromPool.value,
               },
          };

          if (isWithdrawFromFirstPoolOnly.checked) {
               flags = xrpl.AMMWithdrawFlags.tfLPToken;
               ammWithdraw.Flags = flags;
          } else if (isWithdrawFromSecondPoolOnly.checked) {
               flags = xrpl.AMMWithdrawFlags.tfLPToken;
               ammWithdraw.Asset2Out = {
                    currency: asset2.currency,
                    issuer: asset2.issuer,
                    value: weSpendAmount.value, // or appropriate field
               };
               ammWithdraw.Flags = flags;
          } else if (isWithdrawFromBothPools.checked) {
               flags = 0x00010000; // No flag = default, withdraw both proportionally
               ammWithdraw.Flags = flags;
          }

          console.log('ammWithdraw:', JSON.stringify(ammWithdraw, null, 2));

          const ledgerResponse = await client.request({ command: 'ledger' });
          const currentLedger = parseInt(ledgerResponse.result.closed.ledger.ledger_index);
          console.log(`current_ledger ${currentLedger}`);

          const prepared = await client.autofill(ammWithdraw, 20);
          prepared.LastLedgerSequence = currentLedger + 20;

          const signed = wallet.sign(prepared);

          const tx = await client.submitAndWait(signed.tx_blob);
          console.log('Create Escrow tx', tx);

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               renderTransactionDetails(tx);
               resultField.classList.add('error');
               return;
          }

          console.log(`Withdrew: ${isWithdrawFromBothPools.checked ? `${weWantAmount.value} ${weWantCurrency.value} + ${weSpendAmount.value} ${weSpendCurrency.value}` : isWithdrawFromFirstPoolOnly.checked ? `${weWantAmount.value} ${weWantCurrency.value}` : isWithdrawFromSecondPoolOnly.checked ? `${weSpendAmount.value} ${weSpendCurrency.value}` : 'No withdrawal option selected'}`);
          console.log(`Assets remaining in pool: ${ammResponse.result.amm.amount.value} ${weWantCurrency.value} ${xrpl.dropsToXrp(ammResponse.result.amm.amount2)} XRP`);

          renderTransactionDetails(tx);
          resultField.classList.add('success');
     } catch (error) {
          console.error('Error:', error);
          let errorMessage = `ERROR: ${error.message || 'Unknown error'}`;
          if (error.message.includes('Account not found')) {
               errorMessage += '\nNo AMM pool exists for this asset pair.';
          } else if (error.message.includes('Still in CONNECTING state')) {
               errorMessage += '\nSubmission failed. Retry or share timing logs and getClient function for debugging.';
          } else if (error.message.includes('temMALFORMED') && error.message.includes('LastLedgerSequence')) {
               errorMessage += '\nLedger sequence expired. Retry.';
          }
          setError(errorMessage);
     } finally {
          if (spinner) spinner.style.display = 'none';
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving withdrawFromAMM in ${now}ms`);
     }
}

export async function deleteAMMPool() {
     console.log('Entering deleteAMMPool');
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
          accountName: document.getElementById('accountNameField'),
          accountAddress: document.getElementById('accountAddressField'),
          accountSeed: document.getElementById('accountSeedField'),
          xrpBalance: document.getElementById('xrpBalanceField'),
          weWantCurrency: document.getElementById('weWantCurrencyField'),
          weWantIssuer: document.getElementById('weWantIssuerField'),
          weWantAmount: document.getElementById('weWantAmountField'),
          weSpendCurrency: document.getElementById('weSpendCurrencyField'),
          weSpendIssuer: document.getElementById('weSpendIssuerField'),
          weSpendAmount: document.getElementById('weSpendAmountField'),
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

     const { accountName, accountAddress, accountSeed, xrpBalance, weWantCurrency, weWantIssuer, weWantAmount, weSpendCurrency, weSpendIssuer, weSpendAmount, totalExecutionTime } = fields;

     const validations = [
          [!validatInput(accountName.value), 'Account Name can not be empty'],
          [!validatInput(accountAddress.value), 'Account Address can not be empty'],
          [!xrpl.isValidAddress(accountAddress.value), 'Invalid Account address'],
          [!validatInput(accountSeed.value), 'Account seed amount can not be empty'],
          [!validatInput(xrpBalance.value), 'XRP balance can not be empty'],
          [!validatInput(weWantCurrency.value), 'Taker Gets currency can not be empty'],
          [weWantCurrency.value.length < 3, 'Invalid Taker Gets currency. Length must be greater than 3'],
          [!validatInput(weSpendCurrency.value), 'Taker Pays currency can not be empty'],
          [weSpendCurrency.value.length < 3, 'Invalid Taker Pays currency. Length must be greater than 3'],
          [!validatInput(weWantAmount.value), 'Taker Gets amount cannot be empty'],
          [isNaN(weWantAmount.value), 'Taker Gets amount must be a valid number'],
          [parseFloat(weWantAmount.value) <= 0, 'Taker Gets amount must be greater than zero'],
          [!validatInput(weSpendAmount.value), 'Taker Pays amount cannot be empty'],
          [isNaN(weSpendAmount.value), 'Taker Pays amount must be a valid number'],
          [parseFloat(weSpendAmount.value) <= 0, 'Taker Pays amount must be greater than zero'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          let wallet;
          if (accountSeed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(accountSeed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (accountSeed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(accountSeed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

          // const wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          resultField.innerHTML = `Connected to ${environment} ${net}\nDeleting AMM Pool\n\n`;

          // Prepare asset and asset2
          let asset, asset2;
          if (weWantCurrency.value === XRP_CURRENCY) {
               asset = { currency: XRP_CURRENCY };
          } else {
               if (!weWantIssuer.value) throw new Error(`Issuer required for ${weWantCurrency.value}.`);
               asset = { currency: weWantCurrency.value, issuer: weWantIssuer.value };
          }
          if (weSpendCurrency.value === XRP_CURRENCY) {
               asset2 = { currency: XRP_CURRENCY };
          } else {
               if (!weSpendIssuer.value) throw new Error(`Issuer required for ${weSpendCurrency.value}.`);
               asset2 = { currency: weSpendCurrency.value, issuer: weSpendIssuer.value };
          }

          // Verify pool existence and LP token balance
          let ammInfo;
          try {
               ammInfo = await client.request({
                    command: 'amm_info',
                    asset,
                    asset2,
               });
          } catch (error) {
               return setError('AMM pool does not exist for DOG/XRP.', spinner);
          }
          const poolData = ammInfo.result;
          const lpToken = poolData.amm.lp_token;
          const ammAccount = poolData.amm.account;

          // Check LP token balance
          const accountLines = await client.request({
               command: 'account_lines',
               account: wallet.classicAddress,
               ledger_index: 'current',
          });

          const lpTokenCurrency = poolData.amm.lp_token.currency;
          const lpTokenIssuer = poolData.amm.lp_token.issuer;
          const hasTrustline = accountLines.result.lines.some(line => line.currency === lpTokenCurrency && line.account === lpTokenIssuer);
          console.log('Trustlines:', JSON.stringify(accountLines.result.lines, null, 2));
          if (!hasTrustline) {
               throw new Error('Account lacks trustline for AMM LP token. Set up a trustline first.');
          }

          const lpTokenLine = accountLines.result.lines.find(line => line.currency === lpToken.currency && line.account === lpToken.issuer);

          // Check XRP balance for fee
          const accountInfo = await client.request({
               command: 'account_info',
               account: wallet.classicAddress,
               ledger_index: 'current',
          });
          const xrpBalance = parseFloat(xrpl.dropsToXrp(accountInfo.result.account_data.Balance));
          const { reserveBaseXRP, reserveIncrementXRP } = await getXrplReserve(client);
          const { result: feeResponse } = await client.request({ command: 'fee' });
          const fee = feeResponse.drops.open_ledger_fee;
          const requiredXrp = xrpl.dropsToXrp(reserveBaseXRP) + xrpl.dropsToXrp(fee);
          if (xrpBalance < requiredXrp) {
               throw new Error(`Insufficient XRP balance. Have: ${xrpBalance} XRP, Need: ~${requiredXrp} XRP for fee.`);
          }

          let tx;
          if (lpTokenLine && parseFloat(lpTokenLine.balance) > 0) {
               resultField.innerHTML += `LP tokens detected (${lpTokenLine.balance}). Withdrawing liquidity\n`;
               // Withdraw all LP tokens
               const ammWithdraw = {
                    TransactionType: 'AMMWithdraw',
                    Account: wallet.classicAddress,
                    Asset: asset,
                    Asset2: asset2,
                    LPTokenIn: {
                         currency: lpToken.currency,
                         issuer: lpToken.issuer,
                         value: lpTokenLine.balance,
                    },
                    Flags: xrpl.AMMWithdrawFlags.tfLPToken,
               };

               const ledgerResponse = await client.request({ command: 'ledger' });
               const currentLedger = parseInt(ledgerResponse.result.closed.ledger.ledger_index);
               console.log(`current_ledger ${currentLedger}`);

               const withdrawPrepared = await client.autofill(ammWithdraw, 20); // Increase buffer to 20 ledgers
               withdrawPrepared.LastLedgerSequence = currentLedger + 20;

               let withdrawSigned = wallet.sign(withdrawPrepared);
               tx = await client.submitAndWait(withdrawSigned.tx_blob);

               const resultCode = tx.result.meta.TransactionResult;
               if (resultCode !== TES_SUCCESS) {
                    renderTransactionDetails(tx);
                    resultField.classList.add('error');
                    return;
               }

               resultField.innerHTML += `Liquidity withdrawn\n`;
               renderTransactionDetails(tx);
               resultField.classList.add('success');
          }

          // Double check if the AMM still exists after withdrawal
          let ammStillExists = true;
          try {
               await client.request({
                    command: 'amm_info',
                    asset,
                    asset2,
               });
          } catch (e) {
               if (e.data?.error === 'no_amm' || e.data?.error === 'actNotFound') {
                    ammStillExists = false;
                    resultField.innerHTML += `AMM pool has already been auto-deleted after last LP withdrawal.\n`;
               } else {
                    throw e; // Rethrow other errors
               }
          }

          if (ammStillExists) {
               // Check XRP balance for fee
               const accountInfo = await client.request({
                    command: 'account_info',
                    account: wallet.classicAddress,
                    ledger_index: 'current',
               });
               const xrpBalance = parseFloat(xrpl.dropsToXrp(accountInfo.result.account_data.Balance));
               const { reserveBaseXRP, reserveIncrementXRP } = await getXrplReserve(client);
               const { result: feeResponse } = await client.request({ command: 'fee' });
               const fee = feeResponse.drops.open_ledger_fee;
               const requiredXrp = xrpl.dropsToXrp(reserveBaseXRP) + xrpl.dropsToXrp(fee);
               if (xrpBalance < requiredXrp) {
                    throw new Error(`Insufficient XRP balance. Have: ${xrpBalance} XRP, Need: ~${requiredXrp} XRP for fee.`);
               }

               // Submit AMMDelete transaction
               const ammDelete = {
                    TransactionType: 'AMMDelete',
                    Account: wallet.classicAddress,
                    Asset: asset,
                    Asset2: asset2,
               };

               const ledgerResponse = await client.request({ command: 'ledger' });
               const currentLedger = parseInt(ledgerResponse.result.closed.ledger.ledger_index);
               console.log(`current_ledger ${currentLedger}`);

               const prepared = await client.autofill(ammDelete, 20);
               prepared.LastLedgerSequence = currentLedger + 20;
               let signed = wallet.sign(prepared);
               tx = await client.submitAndWait(signed.tx_blob);

               const resultCode = tx.result.meta.TransactionResult;
               if (resultCode !== TES_SUCCESS) {
                    renderTransactionDetails(tx);
                    resultField.classList.add('error');
                    return;
               }
               resultField.innerHTML += `AMM Pool Deleted:\n`;
          }

          resultField.innerHTML += `\nAssets returned to ${wallet.classicAddress}.\n`;

          renderTransactionDetails(tx);
          resultField.classList.add('success');
     } catch (error) {
          console.error('Error:', error);
          let errorMessage = `ERROR: ${error.message || 'Unknown error'}`;
          if (error.message.includes('Account not found')) {
               errorMessage += '\nNo AMM pool exists for this asset pair.';
          } else if (error.message.includes('tecAMM_NOT_EMPTY')) {
               errorMessage += '\nPool contains outstanding LP tokens. Ensure all liquidity is withdrawn by all holders. Click "Withdraw from AMM Pool" to redeem your liquidity.';
          } else if (error.message.includes('ledger sequence')) {
               errorMessage += '\nLedger sequence expired. Please try again.';
          }
          setError(errorMessage);
     } finally {
          if (spinner) spinner.style.display = 'none';
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving deleteAMMPool in ${now}ms`);
     }
}

export async function swapViaAMM() {
     console.log('Entering swapViaAMM');
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
          accountName: document.getElementById('accountNameField'),
          accountAddress: document.getElementById('accountAddressField'),
          accountSeed: document.getElementById('accountSeedField'),
          xrpBalance: document.getElementById('xrpBalanceField'),
          weWantCurrency: document.getElementById('weWantCurrencyField'),
          weWantIssuer: document.getElementById('weWantIssuerField'),
          weWantAmount: document.getElementById('weWantAmountField'),
          weSpendCurrency: document.getElementById('weSpendCurrencyField'),
          weSpendIssuer: document.getElementById('weSpendIssuerField'),
          weSpendAmount: document.getElementById('weSpendAmountField'),
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

     const { accountName, accountAddress, accountSeed, xrpBalance, weWantCurrency, weWantIssuer, weWantAmount, weSpendCurrency, weSpendIssuer, weSpendAmount, totalExecutionTime } = fields;

     const validations = [
          [!validatInput(accountName.value), 'Account Name can not be empty'],
          [!validatInput(accountAddress.value), 'Account Address can not be empty'],
          [!xrpl.isValidAddress(accountAddress.value), 'Invalid Account address'],
          [!validatInput(accountSeed.value), 'Account seed amount can not be empty'],
          [!validatInput(xrpBalance.value), 'XRP balance can not be empty'],
          [!validatInput(weWantCurrency.value), 'Taker Gets currency can not be empty'],
          [weWantCurrency.value.length < 3, 'Invalid Taker Gets currency. Length must be greater than 3'],
          [!validatInput(weSpendCurrency.value), 'Taker Pays currency can not be empty'],
          [weSpendCurrency.value.length < 3, 'Invalid Taker Pays currency. Length must be greater than 3'],
          [!validatInput(weWantAmount.value), 'Taker Gets amount cannot be empty'],
          [isNaN(weWantAmount.value), 'Taker Gets amount must be a valid number'],
          [parseFloat(weWantAmount.value) <= 0, 'Taker Gets amount must be greater than zero'],
          [!validatInput(weSpendAmount.value), 'Taker Pays amount cannot be empty'],
          [isNaN(weSpendAmount.value), 'Taker Pays amount must be a valid number'],
          [parseFloat(weSpendAmount.value) <= 0, 'Taker Pays amount must be greater than zero'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          let wallet;
          if (accountSeed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(accountSeed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (accountSeed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(accountSeed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

          // const wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          const weWantCur = weWantCurrency.value.length > 3 ? encodeCurrencyCode(weWantCurrency.value) : weWantCurrency.value;
          const weSpendCur = weSpendCurrency.value.length > 3 ? encodeCurrencyCode(weSpendCurrency.value) : weSpendCurrency.value;
          console.log('Encoded currencies:', weWantCur, weSpendCur);

          try {
               const ammInfo = await client.request({
                    command: 'amm_info',
                    asset: {
                         currency: weWantCur,
                         issuer: weWantIssuer.value,
                    },
                    asset2: {
                         currency: weSpendCur,
                         issuer: weSpendIssuer.value,
                    },
               });
               if (!ammInfo.result.amm) {
                    return setError('ERROR: No AMM pool exists for this asset pair.', spinner);
               }
          } catch (e) {
               if (e.data?.error === 'no_amm' || e.data?.error === 'actNotFound') {
                    resultField.innerHTML += `AMM pool has already been auto-deleted after last LP withdrawal.\n`;
               } else {
                    throw e;
               }
          }

          const payment = {
               TransactionType: 'Payment',
               Account: wallet.classicAddress,
               SendMax: {
                    currency: weWantCur,
                    issuer: weWantIssuer.value,
                    value: weWantAmount.value,
               },
               Destination: wallet.classicAddress, // Swap returns to same account
               Amount: {
                    currency: weSpendCur,
                    issuer: weSpendIssuer.value,
                    value: weSpendAmount.value,
               },
          };

          console.log('payment:', JSON.stringify(payment, null, 2));

          const ledgerResponse = await client.request({ command: 'ledger' });
          const currentLedger = parseInt(ledgerResponse.result.closed.ledger.ledger_index);
          console.log(`current_ledger ${currentLedger}`);

          const prepared = await client.autofill(payment, 20);
          prepared.LastLedgerSequence = currentLedger + 20;
          let signed = wallet.sign(prepared);
          const tx = await client.submitAndWait(signed.tx_blob);

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               renderTransactionDetails(tx);
               resultField.classList.add('error');
               return;
          }

          resultField.innerHTML += `\nSwap was successful.\n`;

          renderTransactionDetails(tx);
          resultField.classList.add('success');
     } catch (error) {
          console.error('Error:', error);
          let errorMessage = `ERROR: ${error.message || 'Unknown error'}`;
          if (error.message.includes('Account not found')) {
               errorMessage += '\nNo AMM pool exists for this asset pair.';
          } else if (error.message.includes('tecAMM_NOT_EMPTY')) {
               errorMessage += '\nPool contains outstanding LP tokens. Ensure all liquidity is withdrawn by all holders. Click "Withdraw from AMM Pool" to redeem your liquidity.';
          } else if (error.message.includes('ledger sequence')) {
               errorMessage += '\nLedger sequence expired. Please try again.';
          }
          setError(errorMessage);
     } finally {
          if (spinner) spinner.style.display = 'none';
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving swapViaAMM in ${now}ms`);
     }
}

export async function checkRippling(client, issuer, currency) {
     if (!issuer || currency === XRP_CURRENCY) {
          return true;
     }

     const accountInfo = await client.request({
          command: 'account_info',
          account: issuer,
     });
     const flags = accountInfo.result.account_flags;

     if (flags.defaultRipple === false) {
          throw new Error(`Issuer ${issuer} for ${currency} has NoRipple flag enabled. Rippling must be enabled for AMM pool creation.`);
     }
     return true;
}

export async function checkCurrency(client, address, currency, issuer, amount) {
     if (currency === XRP_CURRENCY) {
          return;
     }

     const lines = await client.request({
          command: 'account_lines',
          account: address,
          ledger_index: 'current',
     });
     const trustLine = lines.result.lines.find(line => line.currency === currency && line.account === issuer);

     if (!trustLine) {
          throw new Error(`No trust line exists for ${currency} from issuer ${issuer}. Create one first.`);
     }

     const balance = parseFloat(trustLine.balance);
     if (balance < amount) {
          throw new Error(`Insufficient ${currency} balance. Have: ${balance}, Need: ${amount}.`);
     }
}

export async function checkBalancesAndTrustLines(client, address, weWantCurrency, weWantIssuer, weWantAmount, weSpendIssuer, weSpendAmount, weSpendCurrency) {
     const accountInfo = await client.request({
          command: 'account_info',
          account: address,
          ledger_index: 'current',
     });
     const xrpBalance = parseFloat(xrpl.dropsToXrp(accountInfo.result.account_data.Balance));
     const reserve = parseFloat(xrpl.dropsToXrp(accountInfo.result.account_data.OwnerReserve || '0')) + 1; // Base reserve + owner reserve

     // Estimate required XRP (1 base + 0.4 for AMM + LP token + fee)
     const requiredXrp = reserve + (weWantCurrency === XRP_CURRENCY ? parseFloat(weWantAmount) : 0) + (weSpendCurrency === XRP_CURRENCY ? parseFloat(weSpendAmount) : 0) + 0.001; // Approx fee
     if (xrpBalance < requiredXrp) {
          throw new Error(`Insufficient XRP balance. Have: ${xrpBalance} XRP, Need: ~${requiredXrp} XRP (including reserves and fee).`);
     }

     await checkCurrency(client, address, weWantCurrency, weWantIssuer, weWantAmount);
     await checkCurrency(client, address, weSpendCurrency, weSpendIssuer, weSpendAmount);
}

export async function getXrpReserveRequirements(client, address) {
     const accountInfo = await client.request({
          command: 'account_info',
          account: address,
          ledger_index: 'validated',
     });

     // Current XRP reserve requirements (in drops)
     const ownerReserve = 2 * 1000000; // 2 XRP per owned item (offer/trustline)
     const baseReserve = 10 * 1000000; // 10 XRP base reserve

     return {
          baseReserve: baseReserve,
          ownerReserve: ownerReserve,
          currentReserve: accountInfo.result.account_data.Reserve,
          ownerCount: accountInfo.result.account_data.OwnerCount,
     };
}

export async function getCurrencyBalance(currencyCode) {
     try {
          const accountAddressField = document.getElementById('accountAddressField');
          const response = await fetchAccountObjects(accountAddressField);
          const accountObjects = response.result.account_objects;

          const matchingObjects = accountObjects.filter(obj => obj.Balance && obj.Balance.currency === currencyCode.toUpperCase());

          const total = matchingObjects.reduce((sum, obj) => {
               return sum + parseFloat(obj.Balance.value);
          }, 0);

          return total;
     } catch (error) {
          console.error('Error fetching balance:', error);
          return null;
     }
}

export async function prepareAssetForAmmInfo(weWantCurrency, weWantIssuer, weSpendCurrency, weSpendIssuer) {
     let asset, asset2;

     if (weWantCurrency === XRP_CURRENCY) {
          asset = { currency: XRP_CURRENCY };
     } else {
          if (weWantCurrency.length > 3) {
               const endcodedCurrency = encodeCurrencyCode(weWantCurrency);
               asset = { currency: endcodedCurrency, issuer: weWantIssuer };
          } else {
               asset = { currency: weWantCurrency, issuer: weWantIssuer };
          }
     }

     if (weSpendCurrency === XRP_CURRENCY) {
          asset2 = { currency: XRP_CURRENCY };
     } else {
          if (weSpendCurrency.length > 3) {
               const endcodedCurrency = encodeCurrencyCode(weSpendCurrency);
               asset = { currency: endcodedCurrency, issuer: weWantIssuer };
          }
          asset2 = { currency: weSpendCurrency, issuer: weSpendIssuer };
     }

     console.log(`asset: ${JSON.stringify(asset, null, 2)}`);
     console.log(`asset2: ${JSON.stringify(asset2, null, 2)}`);
     return asset, asset2;
}

export async function getXrpBalance() {
     try {
          const client = await getClient();
          const accountAddressField = document.getElementById('accountAddressField');
          return await client.getXrpBalance(accountAddressField.value);
     } catch (error) {
          console.error('Error fetching balance:', error);
          return null;
     }
}

window.getCurrencyBalance = getCurrencyBalance;
window.encodeCurrencyCode = encodeCurrencyCode;
window.getXrpBalance = getXrpBalance;
window.getTransaction = getTransaction;
window.getTokenBalance = getTokenBalance;

window.getAMMPoolInfo = getAMMPoolInfo;
window.createAMMPool = createAMMPool;
window.deleteAMMPool = deleteAMMPool;
window.withdrawFromAMM = withdrawFromAMM;
window.depositToAMM = depositToAMM;
window.swapViaAMM = swapViaAMM;

window.populate1 = populate1;
window.populate2 = populate2;
window.populate3 = populate3;
window.populateTakerGetsTakerPayFields = populateTakerGetsTakerPayFields;
window.disconnectClient = disconnectClient;
window.gatherAccountInfo = gatherAccountInfo;
window.clearFields = clearFields;
window.distributeAccountInfo = distributeAccountInfo;
