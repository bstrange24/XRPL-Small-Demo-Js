import * as xrpl from 'xrpl';
import { getClient, getNet, disconnectClient, validatInput, setError, parseXRPLTransaction, parseXRPLAccountObjects, autoResize, getTransaction, gatherAccountInfo, clearFields, distributeAccountInfo, updateOwnerCountAndReserves, prepareTxHashForOutput } from './utils.js';
import { ed25519_ENCRYPTION, secp256k1_ENCRYPTION, MAINNET, TES_SUCCESS } from './constants.js';

async function getNFT() {
     console.log('Entering getNFT');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          accountSeed: document.getElementById('accountSeedField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
          ownerCountField: document.getElementById('ownerCountField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
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

     const { accountSeed, xrpBalanceField, ownerCountField, totalXrpReservesField, totalExecutionTime } = fields;

     // Validate input values
     const validations = [[!validatInput(accountSeed.value), 'Seed cannot be empty']];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.value = `Connected to ${environment} ${net}\nGetting NFT\n\n`;

          const wallet = xrpl.Wallet.fromSeed(accountSeed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          const nftInfo = await client.request({
               command: 'account_nfts',
               account: wallet.classicAddress,
          });
          console.log('nftInfo', nftInfo);

          if (nftInfo.result.account_nfts.length <= 0) {
               resultField.value += `No NFTS found for account ${wallet.classicAddress}`;
               resultField.classList.add('success');
               await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
               xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
               return;
          }

          resultField.value += `Total NFT's ${nftInfo.result.account_nfts.length}\n\n`;
          resultField.value += parseXRPLAccountObjects(nftInfo.result);
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving createConditionalEscrow in ${now}ms`);
          console.log('Leaving getNFT');
     }
}

async function mintNFT() {
     console.log('Entering mintNFT');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          seed: document.getElementById('accountSeedField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
          issuerAddress: document.getElementById('issuerAddressField'),
          uriField: document.getElementById('uriField'),
          burnableNft: document.getElementById('burnableNft'),
          onlyXrpNft: document.getElementById('onlyXrpNft'),
          transferableNft: document.getElementById('transferableNft'),
          mutableNft: document.getElementById('mutableNft'),
          ownerCountField: document.getElementById('ownerCountField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
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

     const { seed, xrpBalanceField, issuerAddress, uriField, burnableNft, onlyXrpNft, transferableNft, mutableNft, ownerCountField, totalXrpReservesField, totalExecutionTime } = fields;

     const uri = uriField.value.trim() || 'ipfs://bafybeidf5geku675serlvutcibc5n5fjnzqacv43mjfcrh4ur6hcn4xkw4.metadata.json';

     const validations = [
          [!validatInput(seed.value), 'Seed cannot be empty'],
          [!validatInput(uri), 'URI cannot be empty'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     let flags = 0;
     if (burnableNft.checked) {
          flags = xrpl.NFTokenMintFlags.tfBurnable;
     }

     if (onlyXrpNft.checked) {
          if (flags === undefined) {
               flags = xrpl.NFTokenMintFlags.tfOnlyXRP;
          } else {
               flags |= xrpl.NFTokenMintFlags.tfOnlyXRP;
          }
     }

     if (transferableNft.checked) {
          if (flags === undefined) {
               flags = xrpl.NFTokenMintFlags.tfTransferable;
          } else {
               flags |= xrpl.NFTokenMintFlags.tfTransferable;
          }
     }

     if (mutableNft.checked) {
          if (flags === undefined) {
               flags = xrpl.NFTokenMintFlags.tfMutable;
          } else {
               flags |= xrpl.NFTokenMintFlags.tfMutable;
          }
     }

     console.log('flags ' + flags);

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.value = `Connected to ${environment} ${net}\nMinting NFT\n\n`;

          const wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          const transaction = {
               TransactionType: 'NFTokenMint',
               Account: wallet.classicAddress,
               Flags: flags,
               NFTokenTaxon: 0,
          };

          if (issuerAddress.value) {
               transaction.Issuer = issuerAddress.value;
          }

          if (uri) {
               transaction.URI = xrpl.convertStringToHex(uri);
          }

          const tx = await client.submitAndWait(transaction, { wallet });

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          resultField.value += `NFT mint finished successfully.\n\n`;
          resultField.value += `Tx Hash: ${tx.result.hash}\n\n`;
          resultField.value += parseXRPLTransaction(tx.result);

          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving mintNFT in ${now}ms`);
     }
}

async function mintBatchNFT() {
     console.log('Entering mintBatchNFT');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          seed: document.getElementById('accountSeedField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
          amount: document.getElementById('amountField'),
          uriField: document.getElementById('uriField'),
          ownerCountField: document.getElementById('ownerCountField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
          totalExecutionTime: document.getElementById('totalExecutionTime'),
          nftCount: document.getElementById('nftCountField'),
     };

     // DOM existence check
     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim(); // Trim whitespace
          }
     }

     const { seed, xrpBalanceField, amount, uriField, ownerCountField, totalXrpReservesField, totalExecutionTime, nftCount } = fields;

     const uri = uriField.value.trim() || 'ipfs://bafybeidf5geku675serlvutcibc5n5fjnzqacv43mjfcrh4ur6hcn4xkw4.metadata.json';

     const validations = [
          [!validatInput(seed.value), 'Seed cannot be empty'],
          [!validatInput(amount.value), 'Amount cannot be empty'],
          [isNaN(amount.value), 'Amount must be a valid number'],
          [parseFloat(amount.value) <= 0, 'Amount must be greater than zero'],
          [!validatInput(uri), 'URI cannot be empty'],
          [!validatInput(nftCount.value), 'NFT count cannot be empty'],
          [isNaN(nftCount.value), 'NFT count must be a valid number'],
          [parseFloat(nftCount.value) <= 0, 'NFT count must be greater than zero'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.value = `Connected to ${environment} ${net}\nMinting ${nftCount.value} NFTs\n\n`;

          const wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          // Use Batch Transactions if supported (rippled 2.5.0+)
          const transactions = [];
          const transactionResults = [];
          for (let i = 0; i < parseInt(nftCount.value); i++) {
               transactions.push({
                    TransactionType: 'NFTokenMint',
                    Account: wallet.classicAddress,
                    URI: xrpl.convertStringToHex(uri),
                    Flags: 8 | 16, // Transferable + Mutable
                    NFTokenTaxon: 0,
               });
          }

          let tx;
          if (transactions.length > 1 && client.getServerInfo().buildVersion >= '2.5.0') {
               const batchTx = {
                    TransactionType: 'Batch',
                    Account: wallet.classicAddress,
                    Transactions: transactions,
               };
               // const preparedTx = await client.autofill(batchTx);
               // const signed = wallet.sign(preparedTx);
               // tx = await client.submitAndWait(signed.tx_blob);
               tx = await client.submitAndWait(batchTx, { wallet });
          } else {
               // Fallback to individual transactions
               for (const transaction of transactions) {
                    // const preparedTx = await client.autofill(transaction);
                    // const signed = wallet.sign(preparedTx);
                    // const singleTx = await client.submitAndWait(signed.tx_blob);
                    const singleTx = await client.submitAndWait(transaction, { wallet });
                    if (singleTx.result.meta.TransactionResult !== TES_SUCCESS) {
                         return setError(`ERROR: Minting NFT ${i + 1} failed: ${singleTx.result.meta.TransactionResult}\n${parseXRPLTransaction(singleTx.result)}`, spinner);
                    }
                    transactionResults.push(singleTx);
               }
               tx = transactionResults[transactions.length - 1];
          }

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          resultField.value += `Successfully minted ${nftCount} NFTs.\n\n`;
          resultField.value += prepareTxHashForOutput(tx.result.hash) + '\n';
          resultField.value += parseXRPLTransaction(tx.result);
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving mintBatchNFT in ${now}ms`);
     }
}

async function burnNFT() {
     console.log('Entering burnNFT');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          seed: document.getElementById('accountSeedField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
          nftIdField: document.getElementById('nftIdField'),
          ownerCountField: document.getElementById('ownerCountField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
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

     const { seed, xrpBalanceField, nftIdField, ownerCountField, totalXrpReservesField, totalExecutionTime } = fields;

     const validations = [
          [!validatInput(seed.value), 'Seed cannot be empty'],
          [!validatInput(nftIdField.value), 'NFT Id cannot be empty'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.value = `Connected to ${environment} ${net}\nBurning NFT\n\n`;

          const wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          const transaction = {
               TransactionType: 'NFTokenBurn',
               Account: wallet.classicAddress,
               NFTokenID: nftIdField.value,
          };

          const tx = await client.submitAndWait(transaction, { wallet });
          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          resultField.value += `NFT burned successfully.\n\n`;
          resultField.value += prepareTxHashForOutput(tx.result.hash) + '\n';
          resultField.value += parseXRPLTransaction(tx.result);
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving burnNFT in ${now}ms`);
     }
}

async function getNFTOffers() {
     console.log('Entering getNFTOffers');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          nftIdField: document.getElementById('nftIdField'),
          accountAddress: document.getElementById('accountAddressField'),
          ownerCountField: document.getElementById('ownerCountField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
          totalExecutionTime: document.getElementById('totalExecutionTime'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
     };

     // DOM existence check
     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim(); // Trim whitespace
          }
     }

     const { nftIdField, accountAddress, ownerCountField, totalExecutionTime, totalXrpReservesField, xrpBalanceField } = fields;

     const validations = [
          [!validatInput(accountAddress.value), 'Account address cannot be empty'],
          [!xrpl.isValidAddress(accountAddress.value), 'Invalid account address'],
          [!validatInput(nftIdField.value), 'NFT Id cannot be empty'],
          [!/^[0-9A-F]{64}$/.test(nftIdField.value), 'Invalid NFT ID format'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.value = `Connected to ${environment} ${net}\nFetching NFT Offers for TokenID: ${nftIdField.value}\n\n`;

          // Check server version
          const serverInfo = await client.request({ method: 'server_info' });
          const serverVersion = serverInfo.result.info.build_version;
          console.log('Server Version: ' + serverVersion);
          if (!serverVersion || parseFloat(serverVersion) < 1.9) {
               resultField.value += `WARNING: Server version (${serverVersion}) may not fully support NFT operations. Consider using a server with rippled 1.9.0 or higher.\n\n`;
          }

          // Step 1: Verify NFT exists by checking account_nfts
          let nftExists = false;
          try {
               const nftInfo = await client.request({
                    method: 'account_nfts',
                    account: accountAddress.value,
               });
               const nfts = nftInfo.result.account_nfts || [];
               nftExists = nfts.some(nft => nft.NFTokenID === nftIdField.value);
               if (nftExists) {
                    const nft = nfts.find(nft => nft.NFTokenID === nftIdField.value);
                    resultField.value += `NFT found.\nIssuer: ${nft.Issuer || accountAddress.value}\nTaxon: ${nft.NFTokenTaxon}\nNFT Serial: ${nft.nft_serial}\nNFT URI: ${nft.URI}\n`;
               } else {
                    resultField.value += `WARNING: NFT with TokenID ${nftIdField.value} not found in account ${accountAddress.value}. It may exist in another account or be burned.\n`;
               }
          } catch (nftError) {
               console.warn('Account NFTs Error:', nftError);
               resultField.value += `WARNING: Could not verify NFT existence: ${nftError.message}\n`;
          }

          // Step 2: Fetch sell offers
          let sellOffers = [];
          try {
               const sellOffersResponse = await client.request({
                    method: 'nft_sell_offers',
                    nft_id: nftIdField.value,
               });
               sellOffers = sellOffersResponse.result.offers || [];
          } catch (sellError) {
               if (sellError.message.includes('object was not found') || sellError.message.includes('act not found')) {
                    console.warn('No sell offers found for NFT.');
               } else {
                    console.warn('Sell Offers Error:', sellError);
                    console.warn(`WARNING: Error fetching sell offers: ${sellError.message}\n`);
               }
          }

          // Step 3: Fetch buy offers
          let buyOffers = [];
          try {
               const buyOffersResponse = await client.request({
                    method: 'nft_buy_offers',
                    nft_id: nftIdField.value,
               });
               buyOffers = buyOffersResponse.result.offers || [];
          } catch (buyError) {
               if (buyError.message.includes('object was not found') || buyError.message.includes('act not found')) {
                    console.warn('No buy offers found for NFT.');
               } else {
                    resultField.value += `Buy Offers Error: ${buyError}`;
                    console.warn('Buy Offers Error:', buyError);
                    console.warn(`WARNING: Error fetching buy offers: ${buyError.message}\n`);
               }
          }

          // Step 4: Display results
          resultField.value += `\nSell Offers:\n`;
          if (sellOffers.length === 0) {
               resultField.value += `No sell offers available.\n`;
          } else {
               sellOffers.forEach((offer, index) => {
                    const amount = offer.amount ? `${xrpl.dropsToXrp(offer.amount)} XRP` : 'Unknown';
                    const expiration = offer.expiration ? `Expires: ${new Date(offer.expiration * 1000).toISOString()}` : 'No expiration';
                    resultField.value += `Offer ${index + 1}: ${amount}, Owner: ${offer.owner}, Index: ${offer.nft_offer_index}, ${expiration}\n`;
               });
          }

          resultField.value += `\nBuy Offers:\n`;
          if (buyOffers.length === 0) {
               resultField.value += `No buy offers available.\n`;
          } else {
               buyOffers.forEach((offer, index) => {
                    const amount = offer.amount ? `${xrpl.dropsToXrp(offer.amount)} XRP` : 'Unknown';
                    const expiration = offer.expiration ? `Expires: ${new Date(offer.expiration * 1000).toISOString()}` : 'No expiration';
                    resultField.value += `Offer ${index + 1}: ${amount}, Owner: ${offer.owner}, Index: ${offer.nft_offer_index}, ${expiration}\n`;
               });
          }

          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, accountAddress.value, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(accountAddress.value);
     } catch (error) {
          console.error('Error in getNFTOffers:', error);
          setError(`ERROR: ${error.message || 'Failed to fetch NFT offers'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving getNFTOffers in ${now}ms`);
     }
}

async function setAuthorizedMinter() {
     console.log('Entering setAuthorizedMinter');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          seed: document.getElementById('accountSeedField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
          minterAddress: document.getElementById('minterAddressField'),
          ownerCountField: document.getElementById('ownerCountField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
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

     const { seed, xrpBalanceField, minterAddress, ownerCountField, totalXrpReservesField, totalExecutionTime } = fields;

     const validations = [
          [!validatInput(seed.value), 'Seed cannot be empty'],
          [!xrpl.isValidAddress(minterAddress.value), 'Minter address cannot be empty'],
          [!xrpl.isValidAddress(minterAddress.value), 'Invalid issuer address'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.value = `Connected to ${environment} ${net}\nSetting Authorized Minter\n\n`;

          const wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          const transaction = {
               TransactionType: 'AccountSet',
               Account: wallet.classicAddress,
               NFTokenMinter: minterAddress.value,
          };

          // const preparedTx = await client.autofill(transaction);
          // const signed = wallet.sign(preparedTx);
          // const tx = await client.submitAndWait(signed.tx_blob);
          const tx = await client.submitAndWait(transaction, { wallet });

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          resultField.value += `Authorized minter set successfully.\n\n`;
          resultField.value += prepareTxHashForOutput(tx.result.hash) + '\n';
          resultField.value += parseXRPLTransaction(tx.result);
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving setAuthorizedMinter in ${now}ms`);
     }
}

async function buyNFT() {
     console.log('Entering buyNFT');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          seed: document.getElementById('accountSeedField'),
          amount: document.getElementById('amountField'),
          nftIdField: document.getElementById('nftIdField'),
          ownerCountField: document.getElementById('ownerCountField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
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

     const { seed, xrpBalanceField, amount, nftIdField, ownerCountField, totalXrpReservesField, totalExecutionTime } = fields;

     const validations = [
          [!validatInput(seed.value), 'Seed cannot be empty'],
          [!validatInput(amount.value), 'Amount cannot be empty'],
          [isNaN(amount.value), 'Amount must be a valid number'],
          [parseFloat(amount.value) <= 0, 'Amount must be greater than zero'],
          [!validatInput(nftIdField.value), 'ERROR: URI cannot be empty'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.value = `Connected to ${environment} ${net}\nBuying NFT\n\n`;

          const wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          // Fetch sell offers
          let response = '';
          try {
               response = await client.request({
                    command: 'nft_sell_offers',
                    nft_id: nftIdField.value,
                    // ledger_index: 'validated',
               });
          } catch (error) {
               console.error('Error:', error);
               setError(`ERROR: ${error.message || 'Unknown error'}`);
          }

          const sellOffer = response.result?.offers || [];
          if (!Array.isArray(sellOffer) || sellOffer.length === 0) {
               setError('ERROR: No sell offers found for this NFT.', spinner);
          }

          // Filter offers where:
          // - no Destination is specified (anyone can buy)
          // - OR destination matches our wallet
          // - And price is valid
          const validOffers = sellOffer.filter(offer => {
               const isUnrestricted = !offer.Destination;
               const isTargeted = offer.Destination === wallet.classicAddress;
               return (isUnrestricted || isTargeted) && offer.amount;
          });

          if (validOffers.length === 0) {
               setError('ERROR: No matching sell offers found for this wallet.', spinner);
          }

          // Sort by lowest price
          validOffers.sort((a, b) => parseInt(a.amount) - parseInt(b.amount));

          const matchingOffers = sellOffer.filter(o => o.amount && o.flags === 1); // 1 = tfSellNFToken
          console.log('Matching Offers:', matchingOffers);

          const selectedOffer = validOffers[0];
          console.log('First sell offer:', validOffers[0]);

          if (sellOffer.Destination) {
               console.log(`This NFT is only purchasable by: ${sellOffer.Destination}`);
          }

          const transaction = {
               TransactionType: 'NFTokenAcceptOffer',
               Account: wallet.classicAddress,
               NFTokenSellOffer: selectedOffer.nft_offer_index,
          };

          // Buy the NFT
          const tx = await client.submitAndWait(transaction, { wallet });

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          resultField.value += `NFT buy finished successfully.\n\n`;
          resultField.value += prepareTxHashForOutput(tx.result.hash) + '\n';
          resultField.value += parseXRPLTransaction(tx.result);
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving buyNFT in ${now}ms`);
     }
}

async function cancelBuyOffer() {
     console.log('Entering cancelBuyOffer');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          seed: document.getElementById('accountSeedField'),
          nftIndexField: document.getElementById('nftIndexField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
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

     const { seed, nftIndexField, xrpBalanceField, totalXrpReservesField, totalExecutionTime } = fields;

     const validations = [
          [!validatInput(seed.value), 'Seed cannot be empty'],
          [!validatInput(nftIndexField.value), 'Offer index cannot be empty'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.value = `Connected to ${environment} ${net}\nCanceling NFT Sell Offer\n\n`;

          const wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          const transaction = {
               TransactionType: 'NFTokenCancelOffer',
               Account: wallet.classicAddress,
               NFTokenOffers: [nftIndexField.value],
          };

          // const prepared = await client.autofill(transaction);
          // const signed = wallet.sign(prepared);
          // const tx = await client.submitAndWait(signed.tx_blob);
          const tx = await client.submitAndWait(transaction, { wallet });

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          resultField.value += `Sell offer canceled successfully.\n\n`;
          resultField.value += prepareTxHashForOutput(tx.result.hash) + '\n';
          resultField.value += parseXRPLTransaction(tx.result);
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving cancelBuyOffer in ${now}ms`);
     }
}

async function sellNFT() {
     console.log('Entering sellNFT');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          seed: document.getElementById('accountSeedField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
          amount: document.getElementById('amountField'),
          nftIdField: document.getElementById('nftIdField'),
          expirationField: document.getElementById('expirationField'), // New field for expiration (e.g., in hours)
          ownerCountField: document.getElementById('ownerCountField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
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

     const { seed, xrpBalanceField, amount, nftIdField, expirationField, ownerCountField, totalXrpReservesField, totalExecutionTime } = fields;

     const validations = [
          [!validatInput(seed.value), 'Seed cannot be empty'],
          [!validatInput(amount.value), 'Amount cannot be empty'],
          [isNaN(amount.value), 'Amount must be a valid number'],
          [parseFloat(amount.value) <= 0, 'Amount must be greater than zero'],
          [!validatInput(nftIdField.value), 'NFT Id cannot be empty'],
          // [!validatInput(expirationField.value), 'Expiration cannot be empty'],
          // [isNaN(expirationField.value), 'Expiration must be a valid number'],
          // [parseFloat(expirationField.value) <= 0, 'Expiration must be greater than zero'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.value = `Connected to ${environment} ${net}\nSelling NFT\n\n`;

          const wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          const transaction = {
               TransactionType: 'NFTokenCreateOffer',
               Account: wallet.classicAddress,
               NFTokenID: nftIdField.value,
               Amount: xrpl.xrpToDrops(amount.value),
               Flags: 1, // Sell offer
          };

          // Add expiration if provided
          if (expirationField.value) {
               const expirationDate = new Date();
               expirationDate.setHours(expirationDate.getHours() + parseFloat(expirationField.value));
               transaction.Expiration = Math.floor(expirationDate.getTime() / 1000);
          }

          // const preparedTx = await client.autofill(transaction);
          // const signed = wallet.sign(preparedTx);
          // const tx = await client.submitAndWait(signed.tx_blob);
          const tx = await client.submitAndWait(transaction, { wallet });

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          resultField.value += `NFT sell offer created successfully.\n\n`;
          resultField.value += prepareTxHashForOutput(tx.result.hash) + '\n';
          resultField.value += parseXRPLTransaction(tx.result);
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving sellNFT in ${now}ms`);
     }
}

async function cancelSellOffer() {
     console.log('Entering cancelSellOffer');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          seed: document.getElementById('accountSeedField'),
          ownerCountField: document.getElementById('ownerCountField'),
          nftIndexField: document.getElementById('nftIndexField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
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

     const { seed, nftIndexField, xrpBalanceField, totalXrpReservesField, totalExecutionTime } = fields;

     const validations = [
          [!validatInput(seed.value), 'Seed cannot be empty'],
          [!validatInput(nftIndexField.value), 'Offer index cannot be empty'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.value = `Connected to ${environment} ${net}\nCanceling NFT Sell Offer\n\n`;

          const wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          const transaction = {
               TransactionType: 'NFTokenCancelOffer',
               Account: wallet.classicAddress,
               NFTokenOffers: [nftIndexField.value],
          };

          // const prepared = await client.autofill(transaction);
          // const signed = wallet.sign(prepared);
          // const tx = await client.submitAndWait(signed.tx_blob);
          const tx = await client.submitAndWait(transaction, { wallet });

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          resultField.value += `Sell offer canceled successfully.\n\n`;
          resultField.value += prepareTxHashForOutput(tx.result.hash) + '\n';
          resultField.value += parseXRPLTransaction(tx.result);
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving cancelSellOffer in ${now}ms`);
     }
}

async function updateNFTMetadata() {
     console.log('Entering updateNFTMetadata');
     const startTime = Date.now();

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          address: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          balance: document.getElementById('xrpBalanceField'),
          nftIdField: document.getElementById('nftIdField'),
          uriField: document.getElementById('uriField'),
          ownerCountField: document.getElementById('ownerCountField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
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

     const { seed, xrpBalanceField, nftIdField, uriField, ownerCountField, totalXrpReservesField, totalExecutionTime } = fields;

     const validations = [
          [!validatInput(seed.value), 'Seed cannot be empty'],
          [!validatInput(nftIdField.value), 'NFT Id cannot be empty'],
          [!validatInput(uriField.value), 'NFT Id cannot be empty'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.value = `Connected to ${environment} ${net}\nUpdating NFT Metadata\n\n`;

          const wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

          const transaction = {
               TransactionType: 'NFTokenModify',
               Account: wallet.classicAddress,
               NFTokenID: nftIdField.value,
               URI: xrpl.convertStringToHex(uriField.value),
          };

          // const preparedTx = await client.autofill(transaction);
          // const signed = wallet.sign(preparedTx);
          // const tx = await client.submitAndWait(signed.tx_blob);
          const tx = await client.submitAndWait(transaction, { wallet });

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          resultField.value += `NFT metadata updated successfully.\n\n`;
          resultField.value += prepareTxHashForOutput(tx.result.hash) + '\n';
          resultField.value += parseXRPLTransaction(tx.result);
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving updateNFTMetadata in ${now}ms`);
     }
}

export async function displayNftDataForAccount1() {
     console.log('displayNftDataForAccount1');
     accountNameField.value = account1name.value;
     accountAddressField.value = account1address.value;
     accountSeedField.value = account1seed.value;

     const amountField = document.getElementById('amountField');
     if (validatInput(amountField)) {
          amountField.value = '';
     }

     const minterAddressField = document.getElementById('minterAddressField');
     if (validatInput(minterAddressField)) {
          minterAddressField.value = '';
     }

     const issuerAddressField = document.getElementById('issuerAddressField');
     if (validatInput(issuerAddressField)) {
          issuerAddressField.value = '';
     }

     const expirationField = document.getElementById('expirationField');
     if (validatInput(expirationField)) {
          expirationField.value = '';
     }

     const uriField = document.getElementById('uriField');
     if (validatInput(uriField)) {
          uriField.value = '';
     }

     const memoField = document.getElementById('memoField');
     if (validatInput(memoField)) {
          memoField.value = '';
     }

     const nftCheckboxes = document.querySelectorAll('input[class="nftCheckboxes"]');
     nftCheckboxes.forEach(radio => {
          radio.checked = false;
     });

     getXrpBalance();
     getNFT();
}

export async function displayNftDataForAccount2() {
     console.log('displayNftDataForAccount2');
     accountNameField.value = account2name.value;
     accountAddressField.value = account2address.value;
     accountSeedField.value = account2seed.value;

     const amountField = document.getElementById('amountField');
     if (validatInput(amountField)) {
          amountField.value = '';
     }

     const minterAddressField = document.getElementById('minterAddressField');
     if (validatInput(minterAddressField)) {
          minterAddressField.value = '';
     }

     const issuerAddressField = document.getElementById('issuerAddressField');
     if (validatInput(issuerAddressField)) {
          issuerAddressField.value = '';
     }

     const expirationField = document.getElementById('expirationField');
     if (validatInput(expirationField)) {
          expirationField.value = '';
     }

     const uriField = document.getElementById('uriField');
     if (validatInput(uriField)) {
          uriField.value = '';
     }

     const memoField = document.getElementById('memoField');
     if (validatInput(memoField)) {
          memoField.value = '';
     }

     const nftCheckboxes = document.querySelectorAll('input[class="nftCheckboxes"]');
     nftCheckboxes.forEach(radio => {
          radio.checked = false;
     });

     getXrpBalance();
     getNFT();
}

window.mintNFT = mintNFT;
window.mintBatchNFT = mintBatchNFT;
window.setAuthorizedMinter = setAuthorizedMinter;
window.sellNFT = sellNFT;
window.buyNFT = buyNFT;
window.getNFT = getNFT;
window.burnNFT = burnNFT;
window.cancelSellOffer = cancelSellOffer;
window.cancelBuyOffer = cancelBuyOffer;
window.updateNFTMetadata = updateNFTMetadata;
window.getNFTOffers = getNFTOffers;
window.getTransaction = getTransaction;

window.displayNftDataForAccount1 = displayNftDataForAccount1;
window.displayNftDataForAccount2 = displayNftDataForAccount2;
window.autoResize = autoResize;
window.disconnectClient = disconnectClient;
window.gatherAccountInfo = gatherAccountInfo;
window.clearFields = clearFields;
window.distributeAccountInfo = distributeAccountInfo;
