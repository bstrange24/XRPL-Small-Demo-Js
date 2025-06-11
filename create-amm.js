import * as xrpl from 'xrpl';
import { getClient, disconnectClient, validatInput, populate1, populate2, populate3, populateTakerGetsTakerPayFields, parseXRPLTransaction, getNet, amt_str, getOnlyTokenBalance, getCurrentLedger, parseXRPLAccountObjects, setError, autoResize, gatherAccountInfo, clearFields, distributeAccountInfo, getTransaction, updateOwnerCountAndReserves, prepareTxHashForOutput, encodeCurrencyCode, decodeCurrencyCode } from './utils.js';
import { fetchAccountObjects, getTrustLines } from './account.js';
import { getTokenBalance } from './send-currency.js';

// Get AMM Pool Info
async function getAMMPoolInfo() {
     console.log('Entering getAMMPoolInfo');

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

     const { accountName: accountNameField, accountAddress: accountAddressField, accountSeed: accountSeedField, xrpBalance: xrpBalanceField, weWantCurrency: weWantCurrencyField, weWantIssuer: weWantIssuerField, weWantAmount: weWantAmountField, weSpendCurrency: weSpendCurrencyField, weSpendIssuer: weSpendIssuerField, weSpendAmount: weSpendAmountField } = fields;

     const validations = [
          [!validatInput(accountNameField.value), 'ERROR: Account Name can not be empty'],
          [!validatInput(accountAddressField.value), 'ERROR: Account Address can not be empty'],
          [!validatInput(accountSeedField.value), 'ERROR: Account seed amount can not be empty'],
          [!validatInput(xrpBalanceField.value), 'ERROR: XRP balance can not be empty'],
          [!validatInput(weWantCurrencyField.value), 'ERROR: Taker Gets currency can not be empty'],
          [weWantCurrencyField.value.length < 3, 'Invalid Taker Gets currency. Length must be greater than 3'],
          [!validatInput(weSpendCurrencyField.value), 'ERROR: Taker Pays currency can not be empty'],
          [weSpendCurrencyField.value.length < 3, 'Invalid Taker Pays currency. Length must be greater than 3'],
          [!validatInput(weWantAmountField.value), 'ERROR: Taker Gets amount cannot be empty'],
          [isNaN(weWantAmountField.value), 'ERROR: Taker Gets amount must be a valid number'],
          [parseFloat(weWantAmountField.value) <= 0, 'ERROR: Taker Gets amount must be greater than zero'],
          [!validatInput(weSpendAmountField.value), 'ERROR: Taker Pays amount cannot be empty'],
          [isNaN(weSpendAmountField.value), 'ERROR: Taker Pays amount must be a valid number'],
          [parseFloat(weSpendAmountField.value) <= 0, 'ERROR: Taker Pays amount must be greater than zero'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();
          const spinner = document.getElementById('spinner');
          if (spinner) spinner.style.display = 'block';

          let results = `Connected to ${environment} ${net}\nGet AMM Pool Info.\n\n`;

          const wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: environment === 'Mainnet' ? 'ed25519' : 'secp256k1' });

          // Prepare asset and asset2
          const weWantCurrency = weWantCurrencyField.value;
          const weWantIssuer = weWantIssuerField.value;
          const weSpendCurrency = weSpendCurrencyField.value;
          const weSpendIssuer = weSpendIssuerField.value;

          let asset, asset2;
          if (weWantCurrency === 'XRP') {
               asset = { currency: 'XRP' };
          } else {
               asset = { currency: weWantCurrency, issuer: weWantIssuer };
          }
          if (weSpendCurrency === 'XRP') {
               asset2 = { currency: 'XRP' };
          } else {
               asset2 = { currency: weSpendCurrency, issuer: weSpendIssuer };
          }

          const ammInfo = await client.request({
               command: 'amm_info',
               asset: asset,
               asset2: asset2,
          });

          // Format pool details
          const poolData = ammInfo.result;
          results += `AMM Pool Details:\n`;
          if (poolData.amm.amount.currency === undefined) {
               results += `Asset 1: XRP, Amount: ${poolData.amm.amount.value || poolData.amm.amount}\n`;
          } else {
               results += `Asset 1: ${poolData.amm.amount.currency} ${poolData.amm.amount.issuer ? `(Issuer: ${poolData.amm.amount.issuer})` : ''}, Amount: ${poolData.amm.amount.value || poolData.amm.amount}\n`;
          }

          if (poolData.amm.amount2.currency === undefined) {
               results += `Asset 2: XRP, Amount: ${poolData.amm.amount2.value || poolData.amm.amount2}\n`;
          } else {
               results += `Asset 2: ${poolData.amm.amount2.currency} ${poolData.amm.amount2.issuer ? `(Issuer: ${poolData.amm.amount2.issuer})` : ''}, Amount: ${poolData.amm.amount2.value || poolData.amm.amount2}\n`;
          }

          results += `Trading Fee: ${poolData.amm.trading_fee / 10000}%\n`;
          results += `LP Token: ${poolData.amm.lp_token.currency}, Balance: ${poolData.amm.lp_token.value}\n`;
          results += `AMM Account: ${poolData.amm.account}\n`;

          const accountLines = await client.request({
               command: 'account_lines',
               account: wallet.classicAddress,
               ledger_index: 'current',
          });
          const lpTokenLine = accountLines.result.lines.find(line => line.currency === poolData.amm.lp_token.currency && line.account === poolData.amm.lp_token.issuer);
          document.getElementById('lpTokenBalanceField').value = lpTokenLine ? lpTokenLine.balance : '0';

          document.getElementById('resultField').value = results;
          document.getElementById('resultField').classList.add('success');
     } catch (error) {
          console.error('Error:', error);
          let errorMessage = `ERROR: ${error.message || 'Unknown error'}`;
          if (error.message.includes('Account not found')) {
               errorMessage += '\nNo AMM pool exists for this asset pair. Try creating one with "Create AMM Pool".';
          }
          setError(errorMessage);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving getAMMPoolInfo');
     }
}

//////////////////////////
/// Create AMM Pool Info
async function createAMMPool() {
     console.log('Entering createAMMPool');

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

     const { accountName: accountNameField, accountAddress: accountAddressField, accountSeed: accountSeedField, xrpBalance: xrpBalanceField, weWantCurrency: weWantCurrencyField, weWantIssuer: weWantIssuerField, weWantAmount: weWantAmountField, weSpendCurrency: weSpendCurrencyField, weSpendIssuer: weSpendIssuerField, weSpendAmount: weSpendAmountField } = fields;

     const validations = [
          [!validatInput(accountNameField.value), 'ERROR: Account Name can not be empty'],
          [!validatInput(accountAddressField.value), 'ERROR: Account Address can not be empty'],
          [!validatInput(accountSeedField.value), 'ERROR: Account seed amount can not be empty'],
          [!validatInput(xrpBalanceField.value), 'ERROR: XRP balance can not be empty'],
          [!validatInput(weWantCurrencyField.value), 'ERROR: Taker Gets currency can not be empty'],
          [weWantCurrencyField.value.length < 3, 'Invalid Taker Gets currency. Length must be greater than 3'],
          [!validatInput(weSpendCurrencyField.value), 'ERROR: Taker Pays currency can not be empty'],
          [weSpendCurrencyField.value.length < 3, 'Invalid Taker Pays currency. Length must be greater than 3'],
          [!validatInput(weWantAmountField.value), 'ERROR: Taker Gets amount cannot be empty'],
          [isNaN(weWantAmountField.value), 'ERROR: Taker Gets amount must be a valid number'],
          [parseFloat(weWantAmountField.value) <= 0, 'ERROR: Taker Gets amount must be greater than zero'],
          [!validatInput(weSpendAmountField.value), 'ERROR: Taker Pays amount cannot be empty'],
          [isNaN(weSpendAmountField.value), 'ERROR: Taker Pays amount must be a valid number'],
          [parseFloat(weSpendAmountField.value) <= 0, 'ERROR: Taker Pays amount must be greater than zero'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();
          const spinner = document.getElementById('spinner');
          if (spinner) spinner.style.display = 'block';

          const wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: environment === 'Mainnet' ? 'ed25519' : 'secp256k1' });

          let results = `Connected to ${environment} ${net}\nCreating AMM Pool...\n\n`;

          // Prepare Amount
          const weWantCurrency = document.getElementById('weWantCurrencyField').value;
          const weWantAmount = parseFloat(document.getElementById('weWantAmountField').value);
          const weWantIssuer = document.getElementById('weWantIssuerField').value;
          let amount;
          if (weWantCurrency === 'XRP') {
               amount = xrpl.xrpToDrops(weWantAmount); // Convert XRP to drops (string)
          } else {
               amount = {
                    currency: weWantCurrency,
                    issuer: weWantIssuer,
                    value: weWantAmount.toString(),
               };
          }

          // Prepare Amount2
          const weSpendCurrency = document.getElementById('weSpendCurrencyField').value;
          const weSpendAmount = parseFloat(document.getElementById('weSpendAmountField').value);
          const weSpendIssuer = document.getElementById('weSpendIssuerField').value;
          let amount2;
          if (weSpendCurrency === 'XRP') {
               amount2 = xrpl.xrpToDrops(weSpendAmount); // Convert XRP to drops (string)
          } else {
               amount2 = {
                    currency: weSpendCurrency,
                    issuer: weSpendIssuer,
                    value: weSpendAmount.toString(),
               };
          }

          // Validate inputs
          if (!weWantAmount || !weSpendAmount || isNaN(weWantAmount) || isNaN(weSpendAmount) || weWantAmount <= 0 || weSpendAmount <= 0) {
               throw new Error('Please enter valid positive amounts for both assets.');
          }

          // Check rippling for non-XRP assets
          async function checkRippling(issuer, currency) {
               if (!issuer || currency === 'XRP') return true;
               const accountInfo = await client.request({
                    command: 'account_info',
                    account: issuer,
               });
               const flags = accountInfo.result.account_data.Flags;
               const noRipple = (flags & xrpl.AccountFlags.lsfNoRipple) !== 0;
               if (noRipple) {
                    throw new Error(`Issuer ${issuer} for ${currency} has NoRipple flag enabled. Rippling must be enabled for AMM pool creation.`);
               }
               return true;
          }
          await checkRippling(weWantIssuer, weWantCurrency);
          await checkRippling(weSpendIssuer, weSpendCurrency);

          // Check balances and trust lines
          async function checkBalancesAndTrustLines() {
               const accountInfo = await client.request({
                    command: 'account_info',
                    account: wallet.address,
                    ledger_index: 'current',
               });
               const xrpBalance = parseFloat(xrpl.dropsToXrp(accountInfo.result.account_data.Balance));
               const reserve = parseFloat(xrpl.dropsToXrp(accountInfo.result.account_data.OwnerReserve || '0')) + 1; // Base reserve + owner reserve

               // Estimate required XRP (1 base + 0.4 for AMM + LP token + fee)
               const requiredXrp = reserve + (weWantCurrency === 'XRP' ? weWantAmount : 0) + (weSpendCurrency === 'XRP' ? weSpendAmount : 0) + 0.001; // Approx fee
               if (xrpBalance < requiredXrp) {
                    throw new Error(`Insufficient XRP balance. Have: ${xrpBalance} XRP, Need: ~${requiredXrp} XRP (including reserves and fee).`);
               }

               // Check trust lines and balances for non-XRP assets
               async function checkCurrency(currency, issuer, amount) {
                    if (currency === 'XRP') return;
                    const lines = await client.request({
                         command: 'account_lines',
                         account: wallet.address,
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
               await checkCurrency(weWantCurrency, weWantIssuer, weWantAmount);
               await checkCurrency(weSpendCurrency, weSpendIssuer, weSpendAmount);
          }
          await checkBalancesAndTrustLines();

          console.log('amount: ' + JSON.stringify(amount, null, 2));
          console.log('amount2: ' + JSON.stringify(amount2, null, 2));

          const ammCreate = {
               TransactionType: 'AMMCreate',
               Account: wallet.address,
               Amount: amount,
               Amount2: amount2,
               TradingFee: 500, // 0.5% fee
          };

          const prepared = await client.autofill(ammCreate);
          const signed = wallet.sign(prepared);
          const tx = await client.submitAndWait(signed.tx_blob);

          results += prepareTxHashForOutput(tx.result.hash) + '\n';
          results += parseXRPLTransaction(tx.result);

          document.getElementById('resultField').value = results;
          document.getElementById('resultField').classList.add('success');
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

//////////////////////////
// depositToAMM
async function depositToAMM() {
     const client = new xrpl.Client(getNet());
     await client.connect();
     const wallet = xrpl.Wallet.fromSeed(document.getElementById('accountSeedField').value);
     const ammDeposit = {
          TransactionType: 'AMMDeposit',
          Account: wallet.address,
          Asset: {
               currency: document.getElementById('weWantCurrencyField').value,
               issuer: document.getElementById('weWantIssuerField').value,
          },
          Asset2: { currency: 'XRP' },
          Amount: {
               currency: document.getElementById('weWantCurrencyField').value,
               issuer: document.getElementById('weWantIssuerField').value,
               value: document.getElementById('weWantAmountField').value,
          },
     };
     const prepared = await client.autofill(ammDeposit);
     const signed = wallet.sign(prepared);
     const result = await client.submitAndWait(signed.tx_blob);
     document.getElementById('resultField').value += `\nDeposited to AMM: ${JSON.stringify(result, null, 2)}`;
     await client.disconnect();
}

//////////////////////////
// withdrawFromAMM
async function withdrawFromAMM() {
     console.log('Entering withdrawFromAMM');

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
     const { accountName: accountNameField, accountAddress: accountAddressField, accountSeed: accountSeedField, xrpBalance: xrpBalanceField, weWantCurrency: weWantCurrencyField, weWantIssuer: weWantIssuerField, weWantAmount: weWantAmountField, weSpendCurrency: weSpendCurrencyField, weSpendIssuer: weSpendIssuerField, weSpendAmount: weSpendAmountField } = fields;

     const validations = [
          [!validatInput(accountNameField.value), 'ERROR: Account Name can not be empty'],
          [!validatInput(accountAddressField.value), 'ERROR: Account Address can not be empty'],
          [!validatInput(accountSeedField.value), 'ERROR: Account seed amount can not be empty'],
          [!validatInput(xrpBalanceField.value), 'ERROR: XRP balance can not be empty'],
          [!validatInput(weWantCurrencyField.value), 'ERROR: Taker Gets currency can not be empty'],
          [weWantCurrencyField.value.length < 3, 'Invalid Taker Gets currency. Length must be greater than 3'],
          [!validatInput(weSpendCurrencyField.value), 'ERROR: Taker Pays currency can not be empty'],
          [weSpendCurrencyField.value.length < 3, 'Invalid Taker Pays currency. Length must be greater than 3'],
          [!validatInput(weWantAmountField.value), 'ERROR: Taker Gets amount cannot be empty'],
          [isNaN(weWantAmountField.value), 'ERROR: Taker Gets amount must be a valid number'],
          [parseFloat(weWantAmountField.value) <= 0, 'ERROR: Taker Gets amount must be greater than zero'],
          [!validatInput(weSpendAmountField.value), 'ERROR: Taker Pays amount cannot be empty'],
          [isNaN(weSpendAmountField.value), 'ERROR: Taker Pays amount must be a valid number'],
          [parseFloat(weSpendAmountField.value) <= 0, 'ERROR: Taker Pays amount must be greater than zero'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     const startTime = Date.now();
     let client; // Declare for finally block
     try {
          const { net, environment } = getNet();
          client = await getClient();
          const spinner = document.getElementById('spinner');
          if (spinner) spinner.style.display = 'block';

          console.log(`Time: Connect client - ${Date.now() - startTime}ms`);
          console.log(`Client connected: ${client.isConnected()}`);

          const wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: environment === 'Mainnet' ? 'ed25519' : 'secp256k1' });

          let results = `Connected to ${environment} ${net}\nWithdrawing from AMM Pool...\n\n`;

          // Prepare asset and asset2
          const weWantCurrency = document.getElementById('weWantCurrencyField').value;
          const weWantIssuer = document.getElementById('weWantIssuerField').value;
          const weSpendCurrency = document.getElementById('weSpendCurrencyField').value;
          const weSpendIssuer = document.getElementById('weSpendIssuerField').value;
          const withdrawlLpTokenFromPoolField = document.getElementById('withdrawlLpTokenFromPoolField').value;

          let asset, asset2;
          if (weWantCurrency === 'XRP') {
               asset = { currency: 'XRP' };
          } else {
               if (!weWantIssuer) throw new Error(`Issuer required for ${weWantCurrency}.`);
               asset = { currency: weWantCurrency, issuer: weWantIssuer };
          }
          if (weSpendCurrency === 'XRP') {
               asset2 = { currency: 'XRP' };
          } else {
               if (!weSpendIssuer) throw new Error(`Issuer required for ${weSpendCurrency}.`);
               asset2 = { currency: weSpendCurrency, issuer: weSpendIssuer };
          }

          // Fetch AMM info
          console.log(`Time: Start AMM info - ${Date.now() - startTime}ms`);
          const ammResponse = await client.request({ command: 'amm_info', asset, asset2 });
          console.log(`Time: End AMM info - ${Date.now() - startTime}ms`);
          console.log(`AMM Info: ${JSON.stringify(ammResponse.result, null, 2)}`);

          const lpToken = ammResponse.result.amm.lp_token;

          // Fetch account lines
          console.log(`Time: Start account lines - ${Date.now() - startTime}ms`);
          const linesResponse = await client.request({
               command: 'account_lines',
               account: wallet.classicAddress,
               ledger_index: 'current',
          });
          console.log(`Time: End account lines - ${Date.now() - startTime}ms`);

          const lpTokenLine = linesResponse.result.lines.find(line => line.currency === lpToken.currency && line.account === lpToken.issuer);
          if (!lpTokenLine || parseFloat(lpTokenLine.balance) <= 0) {
               throw new Error('No LP tokens available to withdraw.');
          }
          console.log(`LP Token Trust Line: ${JSON.stringify(lpTokenLine, null, 2)}`);

          // Fetch account sequence
          console.log(`Time: Start account info - ${Date.now() - startTime}ms`);
          const accountInfo = await client.request({
               command: 'account_info',
               account: wallet.classicAddress,
               ledger_index: 'current',
          });
          const sequence = accountInfo.result.account_data.Sequence;
          console.log(`Account Sequence: ${sequence}`);
          console.log(`Time: End account info - ${Date.now() - startTime}ms`);

          // Prepare AMMWithdraw transaction
          const ammWithdraw = {
               TransactionType: 'AMMWithdraw',
               Account: wallet.classicAddress,
               Asset: asset,
               Asset2: asset2,
               LPTokenIn: {
                    currency: lpToken.currency,
                    issuer: lpToken.issuer,
                    value: withdrawlLpTokenFromPoolField,
               },
               Flags: 0x00010000, // tfLPToken flag
          };
          console.log(`ammWithdraw: ${JSON.stringify(ammWithdraw, null, 2)}`);

          // Submit transaction
          console.log(`Time: Start ledger - ${Date.now() - startTime}ms`);
          const ledgerResponse = await client.request({ command: 'ledger' });
          const currentLedger = parseInt(ledgerResponse.result.closed.ledger.ledger_index);
          console.log(`current_ledger ${currentLedger}`);
          console.log(`Time: End ledger - ${Date.now() - startTime}ms`);

          console.log(`Time: Start autofill - ${Date.now() - startTime}ms`);
          const prepared = await client.autofill(ammWithdraw, 20);
          prepared.LastLedgerSequence = currentLedger + 20;
          prepared.Sequence = sequence; // Explicitly set sequence
          console.log(`Prepared: ${JSON.stringify(prepared, null, 2)}`);
          console.log(`Time: End autofill - ${Date.now() - startTime}ms`);

          console.log(`Time: Start sign - ${Date.now() - startTime}ms`);
          const signed = wallet.sign(prepared);
          console.log(`Time: End sign - ${Date.now() - startTime}ms`);

          console.log(`Time: Start submit - ${Date.now() - startTime}ms`);
          const submitResponse = await client.submit(signed.tx_blob);
          console.log(`Submit response: ${JSON.stringify(submitResponse, null, 2)}`);
          console.log(`Time: End submit - ${Date.now() - startTime}ms`);

          // Poll for result
          console.log(`Time: Start poll - ${Date.now() - startTime}ms`);
          let attempts = 10;
          let tx;
          while (attempts > 0) {
               try {
                    tx = await client.request({
                         command: 'tx',
                         transaction: submitResponse.result.tx_json.hash,
                    });
                    if (tx.result.validated) break;
               } catch (err) {
                    // Not yet validated
               }
               await new Promise(resolve => setTimeout(resolve, 1000));
               attempts--;
          }
          if (!tx || !tx.result.validated) throw new Error('Transaction not validated after polling.');
          console.log(`Time: End poll - ${Date.now() - startTime}ms`);

          results += `Withdrawn from AMM:\n`;
          results += prepareTxHashForOutput(tx.result.hash) + '\n';
          results += parseXRPLTransaction(tx.result);
          results += `\nAssets returned: ~${ammResponse.result.amm.amount.value} ${weWantCurrency}, ~${xrpl.dropsToXrp(ammResponse.result.amm.amount2)} XRP`;

          document.getElementById('resultField').value = results;
          document.getElementById('resultField').classList.add('success');
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
          if (client && client.isConnected()) {
               console.log(`Time: Disconnect - ${Date.now() - startTime}ms`);
               await client.disconnect();
          }
          const spinner = document.getElementById('spinner');
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log(`Leaving withdrawFromAMM - Total time: ${Date.now() - startTime}ms`);
     }
}

//////////////////////////
/// Delete AMM Pool Info
async function deleteAMMPool() {
     console.log('Entering deleteAMMPool');

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

     const { accountName: accountNameField, accountAddress: accountAddressField, accountSeed: accountSeedField, xrpBalance: xrpBalanceField, weWantCurrency: weWantCurrencyField, weWantIssuer: weWantIssuerField, weWantAmount: weWantAmountField, weSpendCurrency: weSpendCurrencyField, weSpendIssuer: weSpendIssuerField, weSpendAmount: weSpendAmountField } = fields;

     const validations = [
          [!validatInput(accountNameField.value), 'ERROR: Account Name can not be empty'],
          [!validatInput(accountAddressField.value), 'ERROR: Account Address can not be empty'],
          [!validatInput(accountSeedField.value), 'ERROR: Account seed amount can not be empty'],
          [!validatInput(xrpBalanceField.value), 'ERROR: XRP balance can not be empty'],
          [!validatInput(weWantCurrencyField.value), 'ERROR: Taker Gets currency can not be empty'],
          [weWantCurrencyField.value.length < 3, 'Invalid Taker Gets currency. Length must be greater than 3'],
          [!validatInput(weSpendCurrencyField.value), 'ERROR: Taker Pays currency can not be empty'],
          [weSpendCurrencyField.value.length < 3, 'Invalid Taker Pays currency. Length must be greater than 3'],
          [!validatInput(weWantAmountField.value), 'ERROR: Taker Gets amount cannot be empty'],
          [isNaN(weWantAmountField.value), 'ERROR: Taker Gets amount must be a valid number'],
          [parseFloat(weWantAmountField.value) <= 0, 'ERROR: Taker Gets amount must be greater than zero'],
          [!validatInput(weSpendAmountField.value), 'ERROR: Taker Pays amount cannot be empty'],
          [isNaN(weSpendAmountField.value), 'ERROR: Taker Pays amount must be a valid number'],
          [parseFloat(weSpendAmountField.value) <= 0, 'ERROR: Taker Pays amount must be greater than zero'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();
          const spinner = document.getElementById('spinner');
          if (spinner) spinner.style.display = 'block';

          const wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: environment === 'Mainnet' ? 'ed25519' : 'secp256k1' });

          let results = `Connected to ${environment} ${net}\nDeleting AMM Pool...\n\n`;

          // Prepare asset and asset2
          const weWantCurrency = document.getElementById('weWantCurrencyField').value;
          const weWantIssuer = document.getElementById('weWantIssuerField').value;
          const weSpendCurrency = document.getElementById('weSpendCurrencyField').value;
          const weSpendIssuer = document.getElementById('weSpendIssuerField').value;

          let asset, asset2;
          if (weWantCurrency === 'XRP') {
               asset = { currency: 'XRP' };
          } else {
               if (!weWantIssuer) throw new Error(`Issuer required for ${weWantCurrency}.`);
               asset = { currency: weWantCurrency, issuer: weWantIssuer };
          }
          if (weSpendCurrency === 'XRP') {
               asset2 = { currency: 'XRP' };
          } else {
               if (!weSpendIssuer) throw new Error(`Issuer required for ${weSpendCurrency}.`);
               asset2 = { currency: weSpendCurrency, issuer: weSpendIssuer };
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
               results += `LP tokens detected (${lpTokenLine.balance}). Withdrawing liquidity...\n`;
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
               };
               const withdrawPrepared = await client.autofill(ammWithdraw, 20); // Increase buffer to 20 ledgers
               let withdrawSigned = wallet.sign(withdrawPrepared);
               let withdrawTx;
               let retries = 3;
               while (retries > 0) {
                    try {
                         withdrawTx = await client.submitAndWait(withdrawSigned.tx_blob);
                         break;
                    } catch (error) {
                         if (error.message.includes('temMALFORMED') && error.message.includes('LastLedgerSequence')) {
                              retries--;
                              if (retries === 0) throw new Error('Failed to withdraw liquidity after retries due to ledger sequence issue.');
                              // Re-prepare with fresh ledger sequence
                              const newPrepared = await client.autofill(ammWithdraw, 20);
                              withdrawSigned = wallet.sign(newPrepared);
                         } else {
                              throw error;
                         }
                    }
               }
               results += `Liquidity withdrawn: ${prepareTxHashForOutput(withdrawTx.result.hash)}\n`;
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

          results += `AMM Pool Deleted:\n`;
          results += prepareTxHashForOutput(deleteTx.result.hash) + '\n';
          results += parseXRPLTransaction(deleteTx.result);
          results += `\nAssets returned to ${wallet.address}. Reserve refunded (~0.4 XRP).`;

          document.getElementById('resultField').value = results;
          document.getElementById('resultField').classList.add('success');
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
