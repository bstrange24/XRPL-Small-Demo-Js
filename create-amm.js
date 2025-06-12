import * as xrpl from 'xrpl';
import { getClient, disconnectClient, validatInput, populate1, populate2, populate3, populateTakerGetsTakerPayFields, parseXRPLTransaction, getNet, getOnlyTokenBalance, getCurrentLedger, parseXRPLAccountObjects, setError, autoResize, gatherAccountInfo, clearFields, distributeAccountInfo, getTransaction, updateOwnerCountAndReserves, prepareTxHashForOutput, encodeCurrencyCode, decodeCurrencyCode } from './utils.js';
import { fetchAccountObjects } from './account.js';
import { getTokenBalance } from './send-currency.js';
import { XRP_CURRENCY, ed25519_ENCRYPTION, secp256k1_ENCRYPTION, MAINNET, TES_SUCCESS } from './constants.js';

async function getAMMPoolInfo() {
     console.log('Entering getAMMPoolInfo');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

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
          tradingFee: document.getElementById('tradingFeeField'),
          withdrawlLpTokenFromPool: document.getElementById('withdrawlLpTokenFromPoolField'),
     };

     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim();
          }
     }

     const { accountName, accountAddress, accountSeed, xrpBalance, weWantCurrency, weWantIssuer, weWantAmount, weSpendCurrency, weSpendIssuer, weSpendAmount, lpTokenBalance, tradingFee, withdrawlLpTokenFromPool } = fields;

     const validations = [
          [!validatInput(accountName.value), 'ERROR: Account Name can not be empty'],
          [!validatInput(accountAddress.value), 'ERROR: Account Address can not be empty'],
          [!validatInput(accountSeed.value), 'ERROR: Account seed amount can not be empty'],
          [!validatInput(xrpBalance.value), 'ERROR: XRP balance can not be empty'],
          [!validatInput(weWantCurrency.value), 'ERROR: Taker Gets currency can not be empty'],
          [weWantCurrency.value.length < 3, 'Invalid Taker Gets currency. Length must be greater than 3'],
          [!validatInput(weSpendCurrency.value), 'ERROR: Taker Pays currency can not be empty'],
          [weSpendCurrency.value.length < 3, 'Invalid Taker Pays currency. Length must be greater than 3'],
          [!validatInput(weWantAmount.value), 'ERROR: Taker Gets amount cannot be empty'],
          [isNaN(weWantAmount.value), 'ERROR: Taker Gets amount must be a valid number'],
          [parseFloat(weWantAmount.value) <= 0, 'ERROR: Taker Gets amount must be greater than zero'],
          [!validatInput(weSpendAmount.value), 'ERROR: Taker Pays amount cannot be empty'],
          [isNaN(weSpendAmount.value), 'ERROR: Taker Pays amount must be a valid number'],
          [parseFloat(weSpendAmount.value) <= 0, 'ERROR: Taker Pays amount must be greater than zero'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.value = `Connected to ${environment} ${net}\nGet AMM Pool Info.\n\n`;

          const wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

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
               if (weSpendCurrency.value.length > 3) {
                    const endcodedCurrency = encodeCurrencyCode(weSpendCurrency.value);
                    asset = { currency: endcodedCurrency, issuer: weWantIssuer.value };
               }
               asset2 = { currency: weSpendCurrency.value, issuer: weSpendIssuer.value };
          }

          const ammInfo = await client.request({
               command: 'amm_info',
               asset: asset,
               asset2: asset2,
          });

          // Format pool details
          const poolData = ammInfo.result;
          resultField.value += `AMM Pool Details:\n`;
          if (poolData.amm.amount.currency === undefined) {
               resultField.value += `Asset 1: XRP\n\tAmount in drops: ${poolData.amm.amount.value || poolData.amm.amount}`;
               if (poolData.amm.amount.value) {
                    resultField.value += `\n\tAmount in XRP: ${xrpl.dropsToXrp(poolData.amm.amount.value)}\n`;
               }
               if (poolData.amm.amount) {
                    resultField.value += `\n\tAmount in XRP: ${xrpl.dropsToXrp(poolData.amm.amount)}\n`;
               }
          } else {
               resultField.value += `Asset 1: ${poolData.amm.amount.currency} ${poolData.amm.amount.issuer ? `\n\tIssuer: ${poolData.amm.amount.issuer}` : ''}\n\tAmount: ${poolData.amm.amount.value || poolData.amm.amount}\n`;
          }

          if (poolData.amm.amount2.currency === undefined) {
               resultField.value += `Asset 2: XRP\n\tAmount in drops: ${poolData.amm.amount2.value || poolData.amm.amount2}`;
               if (poolData.amm.amount2.value) {
                    resultField.value += `\n\tAmount in XRP: ${xrpl.dropsToXrp(poolData.amm.amount2.value)}\n`;
               }
               if (poolData.amm.amount2) {
                    resultField.value += `\n\tAmount in XRP: ${xrpl.dropsToXrp(poolData.amm.amount2)}\n`;
               }
          } else {
               resultField.value += `Asset 2: ${poolData.amm.amount2.currency} ${poolData.amm.amount2.issuer ? `\n\tIssuer: ${poolData.amm.amount2.issuer}` : ''}\n\tAmount: ${poolData.amm.amount2.value || poolData.amm.amount2}\n`;
          }

          tradingFee.value = `${poolData.amm.trading_fee / 10000}`;
          resultField.value += `\nTrading Fee: ${poolData.amm.trading_fee / 10000}%\n`;
          resultField.value += `\nLP Token: ${poolData.amm.lp_token.currency}\n\tBalance: ${poolData.amm.lp_token.value}\n`;
          resultField.value += `\nAMM Account:\n\t${poolData.amm.account}\n`;

          const accountLines = await client.request({
               command: 'account_lines',
               account: wallet.classicAddress,
               ledger_index: 'current',
          });
          const lpTokenLine = accountLines.result.lines.find(line => line.currency === poolData.amm.lp_token.currency && line.account === poolData.amm.lp_token.issuer);
          lpTokenBalance.value = lpTokenLine ? lpTokenLine.balance : '0';

          resultField.classList.add('success');
     } catch (error) {
          console.error('Error:', error);
          let errorMessage = '';
          if (error.message.includes('Account not found')) {
               lpTokenBalance.value = '';
               withdrawlLpTokenFromPool.value = '';
               errorMessage += 'ERROR: No AMM pool exists for this asset pair. Try creating one with "Create AMM Pool".';
          } else {
               errorMessage = `ERROR: ${error.message || 'Unknown error'}`;
          }
          setError(errorMessage);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving getAMMPoolInfo');
     }
}

async function createAMMPool() {
     console.log('Entering createAMMPool');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

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
     };

     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim();
          }
     }

     const { accountName, accountAddress, accountSeed, xrpBalance, weWantCurrency, weWantIssuer, weWantAmount, weSpendCurrency, weSpendIssuer, weSpendAmount, tradingFee, ownerCount, totalXrpReserves, weWantTokenBalance, weSpendTokenBalance } = fields;

     const validations = [
          [!validatInput(accountName.value), 'Account Name can not be empty'],
          [!validatInput(accountAddress.value), 'Account Address can not be empty'],
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

          const wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          resultField.value = `Connected to ${environment} ${net}\nCreating AMM Pool\n\n`;

          // Prepare asset and asset2
          let asset, asset2;
          if (weWantCurrency.value === XRP_CURRENCY) {
               asset = { currency: XRP_CURRENCY };
          } else {
               if (!weWantIssuer.value) {
                    return setError(`Issuer required for ${weWantCurrency.value}.`, spinner);
               }
               asset = { currency: weWantCurrency.value, issuer: weWantIssuer.value };
          }
          if (weSpendCurrency.value === XRP_CURRENCY) {
               asset2 = { currency: XRP_CURRENCY };
          } else {
               if (!weSpendIssuer.value) {
                    return setError(`Issuer required for ${weSpendCurrency.value}.`, spinner);
               }
               asset2 = { currency: weSpendCurrency.value, issuer: weSpendIssuer.value };
          }

          // let asse, asst2 = await prepareAssetForAmmInfo(weWantCurrency.value, weWantIssuer.value, weSpendCurrency.value, weSpendIssuer.value);
          // console.log(`asse: ${JSON.stringify(asse, null, 2)}`);
          // console.log(`asst2: ${JSON.stringify(asst2, null, 2)}`);

          console.log(`asset: ${JSON.stringify(asset, null, 2)}`);
          console.log(`asset2: ${JSON.stringify(asset2, null, 2)}`);

          // Fetch AMM info
          const ammInfo = await client.request({ command: 'amm_info', asset, asset2 });
          const poolData = ammInfo.result;

          if (poolData) {
               return setError(`ERROR: AMM pool already exists for ${weWantCurrency.value}/${weSpendCurrency.value}`);
          }

          // const { asset, asset2 } = await prepareAssetForAmmInfo(weWantCurrency.value, weWantIssuer.value, weSpendCurrency.value, weSpendIssuer.value);
          // let asset, asset2;
          // if (weWantCurrency.value === XRP_CURRENCY) {
          //      asset = { currency: XRP_CURRENCY };
          // } else {
          //      if (weWantCurrency.value.length > 3) {
          //           const endcodedCurrency = encodeCurrencyCode(weWantCurrency.value);
          //           asset = { currency: endcodedCurrency, issuer: weWantIssuer.value };
          //      } else {
          //           asset = { currency: weWantCurrency.value, issuer: weWantIssuer.value };
          //      }
          // }
          // if (weSpendCurrency.value === XRP_CURRENCY) {
          //      asset2 = { currency: XRP_CURRENCY };
          // } else {
          //      if (weSpendCurrency.value.length > 3) {
          //           const endcodedCurrency = encodeCurrencyCode(weSpendCurrency.value);
          //           asset = { currency: endcodedCurrency, issuer: weWantIssuer.value };
          //      }
          //      asset2 = { currency: weSpendCurrency.value, issuer: weSpendIssuer.value };
          // }

          // const ammInfo = await client.request({
          //      command: 'amm_info',
          //      asset: asset,
          //      asset2: asset2,
          // });
          // const poolData = ammInfo.result;

          // if (poolData) {
          //      return setError(`ERROR: AMM pool already exists for ${weWantCurrency.value}/${weSpendCurrency.value}`);
          // }

          let amount;
          if (weWantCurrency.value === XRP_CURRENCY) {
               amount = xrpl.xrpToDrops(weWantAmount.value); // Convert XRP to drops (string)
          } else {
               amount = {
                    currency: weWantCurrency.value,
                    issuer: weWantIssuer.value,
                    value: weWantAmount.value.toString(),
               };
          }

          // Prepare Amount2
          let amount2;
          if (weSpendCurrency.value === XRP_CURRENCY) {
               amount2 = xrpl.xrpToDrops(weSpendAmount.value); // Convert XRP to drops (string)
          } else {
               amount2 = {
                    currency: weSpendCurrency.value,
                    issuer: weSpendIssuer.value,
                    value: weSpendAmount.value.toString(),
               };
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
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          resultField.value += prepareTxHashForOutput(tx.result.hash) + '\n';
          resultField.value += parseXRPLTransaction(tx.result);

          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCount, totalXrpReserves);
          xrpBalance.value = (await client.getXrpBalance(wallet.address)) - totalXrpReserves.value;

          if (weWantCurrency.value === XRP_CURRENCY) {
               weSpendTokenBalance.value = await getOnlyTokenBalance(client, wallet.classicAddress, weSpendCurrency.value);
               weWantTokenBalance.value = xrpBalance.value;
          } else {
               weWantTokenBalance.value = await getOnlyTokenBalance(client, wallet.classicAddress, weWantCurrency.value);
               weSpendTokenBalance.value = xrpBalance.value;
          }
     } catch (error) {
          console.error('Error:', error);
          let errorMessage = `ERROR: ${error.message || 'Unknown error'}`;
          if (error.message.includes('tecUNFUNDED_AMM')) {
               errorMessage += '\nInsufficient funds or reserves to create the AMM pool. Check your XRP and token balances.';
          }
          setError(errorMessage);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving createAMMPool');
     }
}

async function depositToAMM() {
     console.log('Entering depositToAMM');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

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
     };

     // DOM existence check
     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim(); // Trim whitespace
          }
     }

     const { accountName, accountAddress, accountSeed, xrpBalance, weWantCurrency, weWantIssuer, weWantAmount, weSpendCurrency, weSpendIssuer, weSpendAmount, lpTokenBalance, weWantTokenBalance, weSpendTokenBalance, ownerCount, totalXrpReserves } = fields;

     const validations = [
          [!validatInput(accountName.value), 'Account Name can not be empty'],
          [!validatInput(accountAddress.value), 'Account Address can not be empty'],
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

          resultField.value = `Connected to ${environment} ${net}\nDeposit token into AMM Pool.\n\n`;

          const wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          const ammDeposit = {
               TransactionType: 'AMMDeposit',
               Account: wallet.address,
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

          const ledgerResponse = await client.request({ command: 'ledger' });
          const currentLedger = parseInt(ledgerResponse.result.closed.ledger.ledger_index);
          const prepared = await client.autofill(ammDeposit, 20);
          prepared.LastLedgerSequence = currentLedger + 20;

          const signed = wallet.sign(prepared);
          const tx = await client.submitAndWait(signed.tx_blob);

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          resultField.value += prepareTxHashForOutput(tx.result.hash) + '\n';
          resultField.value += parseXRPLTransaction(tx.result);

          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCount, totalXrpReserves);
          xrpBalance.value = (await client.getXrpBalance(wallet.address)) - totalXrpReserves.value;

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
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving getAMMPoolInfo');
     }
}

async function withdrawFromAMM() {
     console.log(`Entering withdrawFromAMM`);
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

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
     };

     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim();
          }
     }
     const { accountAddress, accountSeed, xrpBalance, weWantCurrency, weWantIssuer, weWantAmount, weSpendCurrency, weSpendIssuer, weSpendAmount, withdrawlLpTokenFromPool } = fields;

     const validations = [
          [!validatInput(accountAddress.value), 'Account Address can not be empty'],
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

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          const wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          resultField.value = `Connected to ${environment} ${net}\nWithdrawing from AMM Pool\n\n`;

          // Prepare asset and asset2
          let asset, asset2;
          if (weWantCurrency.value === XRP_CURRENCY) {
               asset = { currency: XRP_CURRENCY };
          } else {
               if (!weWantIssuer.value) {
                    return setError(`Issuer required for ${weWantCurrency.value}.`, spinner);
               }
               asset = { currency: weWantCurrency.value, issuer: weWantIssuer.value };
          }
          if (weSpendCurrency.value === XRP_CURRENCY) {
               asset2 = { currency: XRP_CURRENCY };
          } else {
               if (!weSpendIssuer.value) {
                    return setError(`Issuer required for ${weSpendCurrency.value}.`, spinner);
               }
               asset2 = { currency: weSpendCurrency.value, issuer: weSpendIssuer.value };
          }

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
          const ammWithdraw = {
               TransactionType: 'AMMWithdraw',
               Account: wallet.classicAddress,
               Asset: asset,
               Asset2: asset2,
               LPTokenIn: {
                    currency: lpToken.currency,
                    issuer: lpToken.issuer,
                    value: withdrawlLpTokenFromPool.value,
               },
               Flags: 0x00010000, // tfLPToken flag
          };

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
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          resultField.value += `\nAssets returned: ${ammResponse.result.amm.amount.value} ${weWantCurrency.value} ${xrpl.dropsToXrp(ammResponse.result.amm.amount2)} XRP\n\n`;
          resultField.value += prepareTxHashForOutput(tx.result.hash) + '\n';
          resultField.value += parseXRPLTransaction(tx.result);

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
          const spinner = document.getElementById('spinner');
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log(`Leaving withdrawFromAMM - Total time: ${Date.now() - startTime}ms`);
     }
}

// Delete AMM Pool Info
async function deleteAMMPool() {
     console.log('Entering deleteAMMPool');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

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
     };

     // DOM existence check
     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim(); // Trim whitespace
          }
     }

     const { accountName, accountAddress, accountSeed, xrpBalance, weWantCurrency, weWantIssuer, weWantAmount, weSpendCurrency, weSpendIssuer, weSpendAmount: weSpendAmountField } = fields;

     const validations = [
          [!validatInput(accountName.value), 'Account Name can not be empty'],
          [!validatInput(accountAddress.value), 'Account Address can not be empty'],
          [!validatInput(accountSeed.value), 'Account seed amount can not be empty'],
          [!validatInput(xrpBalance.value), 'XRP balance can not be empty'],
          [!validatInput(weWantCurrency.value), 'Taker Gets currency can not be empty'],
          [weWantCurrency.value.length < 3, 'Invalid Taker Gets currency. Length must be greater than 3'],
          [!validatInput(weSpendCurrency.value), 'Taker Pays currency can not be empty'],
          [weSpendCurrency.value.length < 3, 'Invalid Taker Pays currency. Length must be greater than 3'],
          [!validatInput(weWantAmount.value), 'Taker Gets amount cannot be empty'],
          [isNaN(weWantAmount.value), 'Taker Gets amount must be a valid number'],
          [parseFloat(weWantAmount.value) <= 0, 'Taker Gets amount must be greater than zero'],
          [!validatInput(weSpendAmountField.value), 'Taker Pays amount cannot be empty'],
          [isNaN(weSpendAmountField.value), 'Taker Pays amount must be a valid number'],
          [parseFloat(weSpendAmountField.value) <= 0, 'Taker Pays amount must be greater than zero'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          const wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          resultField.value = `Connected to ${environment} ${net}\nDeleting AMM Pool...\n\n`;

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
          const ammInfo = await client.request({
               command: 'amm_info',
               asset,
               asset2,
          });
          const poolData = ammInfo.result;
          const lpToken = poolData.amm.lp_token;
          const ammAccount = poolData.amm.account;

          // Check LP token balance
          const accountLines = await client.request({
               command: 'account_lines',
               account: wallet.address,
               ledger_index: 'current',
          });
          const lpTokenLine = accountLines.result.lines.find(line => line.currency === lpToken.currency && line.account === lpToken.issuer);

          if (lpTokenLine && parseFloat(lpTokenLine.balance) > 0) {
               resultField.value += `LP tokens detected (${lpTokenLine.balance}). Withdrawing liquidity...\n`;
               // Withdraw all LP tokens
               const ammWithdraw = {
                    TransactionType: 'AMMWithdraw',
                    Account: wallet.address,
                    Asset: asset,
                    Asset2: asset2,
                    LPTokenIn: {
                         currency: lpToken.currency,
                         issuer: lpToken.issuer,
                         value: lpTokenLine.balance,
                    },
                    Flags: 0x00010000, // tfLPToken flag
               };

               const ledgerResponse = await client.request({ command: 'ledger' });
               const currentLedger = parseInt(ledgerResponse.result.closed.ledger.ledger_index);
               console.log(`current_ledger ${currentLedger}`);

               const withdrawPrepared = await client.autofill(ammWithdraw, 20); // Increase buffer to 20 ledgers
               withdrawPrepared.LastLedgerSequence = currentLedger + 20;

               let withdrawSigned = wallet.sign(withdrawPrepared);
               const tx = await client.submitAndWait(withdrawSigned.tx_blob);

               const resultCode = tx.result.meta.TransactionResult;
               if (resultCode !== TES_SUCCESS) {
                    return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
               }

               resultField.value += `Liquidity withdrawn: ${prepareTxHashForOutput(tx.result.hash)}\n`;
          }

          // Check XRP balance for fee
          const accountInfo = await client.request({
               command: 'account_info',
               account: wallet.address,
               ledger_index: 'current',
          });
          const xrpBalance = parseFloat(xrpl.dropsToXrp(accountInfo.result.account_data.Balance));
          const requiredXrp = 1 + 0.001; // Base reserve + estimated fee
          if (xrpBalance < requiredXrp) {
               throw new Error(`Insufficient XRP balance. Have: ${xrpBalance} XRP, Need: ~${requiredXrp} XRP for fee.`);
          }

          // Submit AMMDelete transaction
          const ammDelete = {
               TransactionType: 'AMMDelete',
               Account: wallet.address,
               Asset: asset,
               Asset2: asset2,
          };

          const prepared = await client.autofill(ammDelete, 20); // Increase buffer to 20 ledgers
          let signed = wallet.sign(prepared);
          let deleteTx;
          let retries = 3;
          while (retries > 0) {
               try {
                    deleteTx = await client.submitAndWait(signed.tx_blob);
                    break;
               } catch (error) {
                    if (error.message.includes('temMALFORMED') && error.message.includes('LastLedgerSequence')) {
                         retries--;
                         if (retries === 0) throw new Error('Failed to delete AMM pool after retries due to ledger sequence issue.');
                         // Re-prepare with fresh ledger sequence
                         const newPrepared = await client.autofill(ammDelete, 20);
                         signed = wallet.sign(newPrepared);
                    } else {
                         throw error;
                    }
               }
          }

          resultField.value += `AMM Pool Deleted:\n`;
          resultField.value += `\nAssets returned to ${wallet.address}. Reserve refunded (~0.4 XRP).\n`;
          resultField.value += prepareTxHashForOutput(deleteTx.result.hash) + '\n';
          resultField.value += parseXRPLTransaction(deleteTx.result);

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
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving deleteAMMPool');
     }
}

async function swapViaAMM() {
     const startTime = Date.now();
     const client = new xrpl.Client(getNet());
     await client.connect();
     const wallet = xrpl.Wallet.fromSeed(document.getElementById('accountSeedField').value);
     const payment = {
          TransactionType: 'Payment',
          Account: wallet.address,
          Amount: {
               currency: document.getElementById('weWantCurrencyField').value,
               issuer: document.getElementById('weWantIssuerField').value,
               value: document.getElementById('weWantAmountField').value,
          },
          Destination: wallet.address, // Swap returns to same account
          SendMax: {
               currency: document.getElementById('weSpendCurrencyField').value,
               issuer: document.getElementById('weSpendIssuerField').value,
               value: document.getElementById('weSpendAmountField').value,
          },
     };
     const prepared = await client.autofill(payment);
     const signed = wallet.sign(prepared);
     const result = await client.submitAndWait(signed.tx_blob);
     document.getElementById('resultField').value += `\nSwap via AMM: ${JSON.stringify(result, null, 2)}`;
     await client.disconnect();
}

// Check rippling for non-XRP assets
async function checkRippling(client, issuer, currency) {
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

// Check trust lines and balances for non-XRP assets
async function checkCurrency(client, address, currency, issuer, amount) {
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

// Check balances and trust lines
async function checkBalancesAndTrustLines(client, address, weWantCurrency, weWantIssuer, weWantAmount, weSpendIssuer, weSpendAmount, weSpendCurrency) {
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

async function getXrpReserveRequirements(client, address) {
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

async function prepareAssetForAmmInfo(weWantCurrency, weWantIssuer, weSpendCurrency, weSpendIssuer) {
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

async function getXrpBalance() {
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
window.autoResize = autoResize;
window.disconnectClient = disconnectClient;
window.gatherAccountInfo = gatherAccountInfo;
window.clearFields = clearFields;
window.distributeAccountInfo = distributeAccountInfo;
