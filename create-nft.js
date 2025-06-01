import * as xrpl from 'xrpl';
import { getClient, disconnectClient, validatInput, getEnvironment, populate1, populate2, populate3, setError, parseXRPLTransaction, parseXRPLAccountObjects, autoResize, getTransaction, gatherAccountInfo, clearFields, distributeAccountInfo } from './utils.js';

async function getNFT() {
     console.log('Entering getNFT');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          accountAddress: document.getElementById('accountAddressField'),
          accountSeed: document.getElementById('accountSeedField'),
          balance: document.getElementById('xrpBalanceField'),
     };

     // Validate DOM elements
     if (Object.values(fields).some(el => !el)) return setError(`ERROR: DOM element not found`, spinner);

     const seed = fields.accountSeed.value.trim();

     // Validate user inputs
     if (!validatInput(seed)) return setError('ERROR: Seed cannot be empty', spinner);

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\nGetting NFT\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed, { algorithm: 'secp256k1' });

          // Fetch the NFT ID
          const nftInfo = await client.request({
               command: 'account_nfts',
               account: wallet.address,
          });
          console.log('nftInfo', nftInfo);

          results += parseXRPLAccountObjects(nftInfo.result);
          resultField.value = results;
          resultField.classList.add('success');

          fields.balance.value = await client.getXrpBalance(wallet.address);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving getNFT');
     }
}

async function mintNFT() {
     console.log('Entering mintNFT');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          address: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          balance: document.getElementById('xrpBalanceField'),
          issuerAddress: document.getElementById('issuerAddressField'), // New field for issuer address
          uriField: document.getElementById('uriField'), // New field for URI
     };

     // Validate DOM elements
     if (Object.values(fields).some(el => !el)) return setError(` Friend, it looks like a DOM element is missing. Please check your HTML to ensure all required fields (accountAddressField, accountSeedField, xrpBalanceField, issuerAddressField, uriField) are present.`, spinner);

     const seed = fields.seed.value.trim();
     const issuerAddress = fields.issuerAddress.value.trim();
     const uri = fields.uriField.value.trim() || 'ipfs://bafybeidf5geku675serlvutcibc5n5fjnzqacv43mjfcrh4ur6hcn4xkw4.metadata.json';

     // Validate user inputs
     if (!validatInput(seed)) return setError('ERROR: Seed cannot be empty', spinner);
     if (issuerAddress && !xrpl.isValidAddress(issuerAddress)) return setError('ERROR: Invalid issuer address', spinner);
     if (!validatInput(uri)) return setError('ERROR: URI cannot be empty', spinner);

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\nMinting NFT\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed, { algorithm: 'secp256k1' });

          const transaction = {
               TransactionType: 'NFTokenMint',
               Account: wallet.address,
               URI: xrpl.convertStringToHex(uri),
               // Flags: 8 | 16, // Transferable (8) + Mutable (16)
               Flags: 8,
               NFTokenTaxon: 0,
          };

          // Add Issuer field if provided
          if (issuerAddress) {
               transaction.Issuer = issuerAddress;
          }

          const preparedTx = await client.autofill(transaction);
          const signed = wallet.sign(preparedTx);
          const tx = await client.submitAndWait(signed.tx_blob);

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== 'tesSUCCESS') {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          results += `NFT mint finished successfully.\n\n`;
          results += parseXRPLTransaction(tx.result);

          resultField.value = results;
          resultField.classList.add('success');

          fields.balance.value = await client.getXrpBalance(wallet.address);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving mintNFT');
     }
}

// async function mintNFT() {
//      console.log('Entering mintNFT');

//      const resultField = document.getElementById('resultField');
//      resultField?.classList.remove('error', 'success');

//      const spinner = document.getElementById('spinner');
//      if (spinner) spinner.style.display = 'block';

//      const fields = {
//           accountAddress: document.getElementById('accountAddressField'),
//           accountSeed: document.getElementById('accountSeedField'),
//           balance: document.getElementById('xrpBalanceField'),
//      };

//      // Validate DOM elements
//      if (Object.values(fields).some(el => !el)) return setError(`ERROR: DOM element not found`, spinner);

//      const seed = fields.accountSeed.value.trim();

//      // Validate user inputs
//      if (!validatInput(seed)) return setError('ERROR: Seed cannot be empty', spinner);

//      try {
//           const { environment } = getEnvironment();
//           const client = await getClient();

//           let results = `Connected to ${environment}.\nMinting NFT\n\n`;
//           resultField.value = results;

//           const wallet = xrpl.Wallet.fromSeed(seed, { algorithm: 'secp256k1' });

//           const preparedTx = await client.autofill({
//                TransactionType: 'NFTokenMint',
//                Account: wallet.address,
//                URI: xrpl.convertStringToHex('ipfs://bafybeidf5geku675serlvutcibc5n5fjnzqacv43mjfcrh4ur6hcn4xkw4.metadata.json'),
//                // Flags: 1, // 1 = Creator can mint more (royalties), 8 = Transferable
//                // NFTokenTaxon: 42, // Unique series ID (for royalties)
//                Flags: 8,
//                NFTokenTaxon: 0,
//           });

//           const signed = wallet.sign(preparedTx);
//           const response = await client.submitAndWait(signed.tx_blob);
//           console.log('Mint NFT response:', response);

//           const resultCode = response.result.meta.TransactionResult;
//           if (resultCode !== 'tesSUCCESS') {
//                const { txDetails, accountChanges } = parseXRPLTransaction(response.result);
//                return setError(`ERROR: Minting NFT failed: ${resultCode}\n${displayTransaction({ txDetails, accountChanges })}`, spinner);
//           }

//           results += `NFT mint finished successfully.\n\n`;
//           const { txDetails, accountChanges } = parseXRPLTransaction(response.result);
//           results += displayTransaction({ txDetails, accountChanges });

//           resultField.value = results;
//           resultField.classList.add('success');

//           fields.balance.value = await client.getXrpBalance(wallet.address);
//      } catch (error) {
//           console.error('Error:', error);
//           setError(`ERROR: ${error.message || 'Unknown error'}`);
//           await client?.disconnect?.();
//      } finally {
//           if (spinner) spinner.style.display = 'none';
//           autoResize();
//           console.log('Leaving mintNFT');
//      }
// }

async function mintBatchNFT() {
     console.log('Entering mintBatchNFT');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          address: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          balance: document.getElementById('xrpBalanceField'),
          amount: document.getElementById('amountField'),
          uriField: document.getElementById('uriField'),
     };

     // Validate DOM elements
     if (Object.values(fields).some(el => !el)) return setError(`ERROR: DOM element not found`, spinner);

     const seed = fields.seed.value.trim();
     const amount = fields.amount.value.trim();
     const uri = fields.uriField.value.trim() || 'ipfs://bafybeidf5geku675serlvutcibc5n5fjnzqacv43mjfcrh4ur6hcn4xkw4.metadata.json';

     // Validate user inputs
     if (!validatInput(seed)) return setError('ERROR: Seed cannot be empty', spinner);
     if (!validatInput(amount)) return setError('ERROR: Amount cannot be empty', spinner);
     if (isNaN(amount)) return setError('ERROR: Amount must be a valid number', spinner);
     const nftCount = parseInt(amount);
     if (nftCount <= 0) return setError('ERROR: Amount must be greater than zero', spinner);
     if (!validatInput(uri)) return setError('ERROR: URI cannot be empty', spinner);

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\nMinting ${nftCount} NFTs\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed, { algorithm: 'secp256k1' });

          // Use Batch Transactions if supported (rippled 2.5.0+)
          const transactions = [];
          for (let i = 0; i < nftCount; i++) {
               transactions.push({
                    TransactionType: 'NFTokenMint',
                    Account: wallet.address,
                    URI: xrpl.convertStringToHex(uri),
                    Flags: 8 | 16, // Transferable + Mutable
                    NFTokenTaxon: 0,
               });
          }

          let tx;
          if (transactions.length > 1 && client.getServerInfo().buildVersion >= '2.5.0') {
               const batchTx = {
                    TransactionType: 'Batch',
                    Account: wallet.address,
                    Transactions: transactions,
               };
               const preparedTx = await client.autofill(batchTx);
               const signed = wallet.sign(preparedTx);
               tx = await client.submitAndWait(signed.tx_blob);
          } else {
               // Fallback to individual transactions
               for (const transaction of transactions) {
                    const preparedTx = await client.autofill(transaction);
                    const signed = wallet.sign(preparedTx);
                    const singleTx = await client.submitAndWait(signed.tx_blob);
                    if (singleTx.result.meta.TransactionResult !== 'tesSUCCESS') {
                         return setError(`ERROR: Minting NFT ${i + 1} failed: ${singleTx.result.meta.TransactionResult}\n${parseXRPLTransaction(singleTx.result)}`, spinner);
                    }
               }
               tx = transactions[transactions.length - 1]; // Use last transaction for result display
          }

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== 'tesSUCCESS') {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          results += `Successfully minted ${nftCount} NFTs.\n\n`;
          results += parseXRPLTransaction(tx.result);
          resultField.value = results;
          resultField.classList.add('success');

          fields.balance.value = await client.getXrpBalance(wallet.address);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving mintBatchNFT');
     }
}

async function setAuthorizedMinter() {
     console.log('Entering setAuthorizedMinter');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          address: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          balance: document.getElementById('xrpBalanceField'),
          minterAddress: document.getElementById('minterAddressField'),
     };

     // Validate DOM elements
     if (Object.values(fields).some(el => !el)) return setError(`ERROR: DOM element not found`, spinner);

     const seed = fields.seed.value.trim();
     const minterAddress = fields.minterAddress.value.trim();

     // Validate user inputs
     if (!validatInput(seed)) return setError('ERROR: Seed cannot be empty', spinner);
     if (!validatInput(minterAddress)) return setError('ERROR: Minter address cannot be empty', spinner);
     if (!xrpl.isValidAddress(minterAddress)) return setError('ERROR: Invalid minter address', spinner);

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\nSetting Authorized Minter\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed, { algorithm: 'secp256k1' });

          const transaction = {
               TransactionType: 'AccountSet',
               Account: wallet.address,
               NFTokenMinter: minterAddress,
          };

          const preparedTx = await client.autofill(transaction);
          const signed = wallet.sign(preparedTx);
          const tx = await client.submitAndWait(signed.tx_blob);

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== 'tesSUCCESS') {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          results += `Authorized minter set successfully.\n\n`;
          results += parseXRPLTransaction(tx.result);
          resultField.value = results;
          resultField.classList.add('success');

          fields.balance.value = await client.getXrpBalance(wallet.address);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving setAuthorizedMinter');
     }
}

async function sellNFT() {
     console.log('Entering sellNFT');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          address: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          balance: document.getElementById('xrpBalanceField'),
          amount: document.getElementById('amountField'),
          nftIdField: document.getElementById('nftIdField'),
          expirationField: document.getElementById('expirationField'), // New field for expiration (e.g., in hours)
     };

     // Validate DOM elements
     if (Object.values(fields).some(el => !el)) return setError(`ERROR: DOM element not found`, spinner);

     const seed = fields.seed.value.trim();
     const amount = fields.amount.value.trim();
     const nftId = fields.nftIdField.value.trim();
     const expirationHours = fields.expirationField.value.trim();

     // Validate user inputs
     if (!validatInput(seed)) return setError('ERROR: Seed cannot be empty', spinner);
     if (!validatInput(amount)) return setError('ERROR: Amount cannot be empty', spinner);
     if (isNaN(amount)) return setError('ERROR: Amount must be a valid number', spinner);
     if (parseFloat(amount) <= 0) return setError('ERROR: Amount must be greater than zero', spinner);
     if (!validatInput(nftId)) return setError('ERROR: NFT Id cannot be empty', spinner);
     if (expirationHours && (isNaN(expirationHours) || parseFloat(expirationHours) <= 0)) {
          return setError('ERROR: Expiration must be a valid positive number', spinner);
     }

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\nSelling NFT\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed, { algorithm: 'secp256k1' });

          const transaction = {
               TransactionType: 'NFTokenCreateOffer',
               Account: wallet.address,
               NFTokenID: nftId,
               Amount: xrpl.xrpToDrops(amount),
               Flags: 1, // Sell offer
          };

          // Add expiration if provided
          if (expirationHours) {
               const expirationDate = new Date();
               expirationDate.setHours(expirationDate.getHours() + parseFloat(expirationHours));
               transaction.Expiration = Math.floor(expirationDate.getTime() / 1000);
          }

          const preparedTx = await client.autofill(transaction);
          const signed = wallet.sign(preparedTx);
          const tx = await client.submitAndWait(signed.tx_blob);

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== 'tesSUCCESS') {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          results += `NFT sell offer created successfully.\n\n`;
          results += parseXRPLTransaction(tx.result);
          resultField.value = results;
          resultField.classList.add('success');

          fields.balance.value = await client.getXrpBalance(wallet.address);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving sellNFT');
     }
}

async function createBuyOfferNFT() {
     console.log('Entering createBuyOfferNFT');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          address: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          balance: document.getElementById('xrpBalanceField'),
          amount: document.getElementById('amountField'),
          nftIdField: document.getElementById('nftIdField'),
     };

     // Validate DOM elements
     if (Object.values(fields).some(el => !el)) return setError(`ERROR: DOM element not found`, spinner);

     const seed = fields.seed.value.trim();
     const amount = fields.amount.value.trim();
     const nftId = fields.nftIdField.value.trim();

     // Validate user inputs
     if (!validatInput(seed)) return setError('ERROR: Seed cannot be empty', spinner);
     if (!validatInput(amount)) return setError('ERROR: Amount cannot be empty', spinner);
     if (isNaN(amount)) return setError('ERROR: Amount must be a valid number', spinner);
     if (parseFloat(amount) <= 0) return setError('ERROR: Amount must be greater than zero', spinner);
     if (!validatInput(nftId)) return setError('ERROR: NFT Id cannot be empty', spinner);

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\nCreating NFT Buy Offer\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed, { algorithm: 'secp256k1' });

          const transaction = {
               TransactionType: 'NFTokenCreateOffer',
               Account: wallet.address,
               NFTokenID: nftId,
               Amount: xrpl.xrpToDrops(amount), // Offer amount in XRP (converted to drops)
               Flags: 0, // 0 = Buy offer
          };

          const preparedTx = await client.autofill(transaction);
          const signed = wallet.sign(preparedTx);
          const tx = await client.submitAndWait(signed.tx_blob);

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== 'tesSUCCESS') {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          results += `NFT buy offer created successfully.\n\n`;
          results += parseXRPLTransaction(tx.result);
          resultField.value = results;
          resultField.classList.add('success');

          fields.balance.value = await client.getXrpBalance(wallet.address);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving createBuyOfferNFT');
     }
}

async function buyNFT() {
     console.log('Entering buyNFT');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          address: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          balance: document.getElementById('xrpBalanceField'),
          amount: document.getElementById('amountField'),
          nftIdField: document.getElementById('nftIdField'),
     };

     // Validate DOM elements
     if (Object.values(fields).some(el => !el)) return setError(`ERROR: DOM element not found`, spinner);

     const seed = fields.seed.value.trim();
     const amount = fields.amount.value.trim();
     const nftId = fields.nftIdField.value.trim();

     // Validate user inputs
     if (!validatInput(seed)) return setError('ERROR: Seed cannot be empty', spinner);
     if (!validatInput(amount)) return setError('ERROR: Amount cannot be empty', spinner);
     if (isNaN(amount)) return setError('ERROR: Amount must be a valid number', spinner);
     if (parseFloat(amount) <= 0) return setError('ERROR: Amount must be greater than zero', spinner);
     if (!validatInput(nftId)) return setError('ERROR: NFT Id cannot be empty', spinner);

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\nSending XRP\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed, { algorithm: 'secp256k1' });

          // Fetch sell offers
          const response = await client.request({
               command: 'nft_sell_offers',
               nft_id: nftId,
               ledger_index: 'validated',
          });

          const sellOffer = response.result.offers[0];
          if (!sellOffer) {
               throw new Error('No sell offers found!');
          }

          const transaction = {
               TransactionType: 'NFTokenAcceptOffer',
               Account: wallet.address,
               NFTokenSellOffer: sellOffer.nft_offer_index,
          };

          // Buy the NFT
          const tx = await client.submitAndWait(transaction, { wallet });

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== 'tesSUCCESS') {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          results += `NFT buy finished successfully.\n\n`;
          results += parseXRPLTransaction(tx.result);
          resultField.value = results;
          resultField.classList.add('success');

          fields.balance.value = await client.getXrpBalance(wallet.address);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving buyNFT');
     }
}

async function burnNFT() {
     console.log('Entering burnNFT');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          address: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          balance: document.getElementById('xrpBalanceField'),
          nftIdField: document.getElementById('nftIdField'),
     };

     // Validate DOM elements
     if (Object.values(fields).some(el => !el)) return setError(`ERROR: DOM element not found`, spinner);

     const seed = fields.seed.value.trim();
     const nftId = fields.nftIdField.value.trim();

     // Validate user inputs
     if (!validatInput(seed)) return setError('ERROR: Seed cannot be empty', spinner);
     if (!validatInput(nftId)) return setError('ERROR: NFT Id cannot be empty', spinner);

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\nSending XRP\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed, { algorithm: 'secp256k1' });

          const transaction = {
               TransactionType: 'NFTokenBurn',
               Account: wallet.address,
               NFTokenID: nftId,
          };

          const tx = await client.submitAndWait(transaction, { wallet });
          console.log('NFT Burned! Tx Hash:', tx.result.hash);

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== 'tesSUCCESS') {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          results += `NFT mint finished successfully.\n\n`;
          results += parseXRPLTransaction(tx.result);
          resultField.value = results;
          resultField.classList.add('success');

          fields.balance.value = await client.getXrpBalance(wallet.address);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving burnNFT');
     }
}

async function updateNFTMetadata() {
     console.log('Entering updateNFTMetadata');

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
     };

     // Validate DOM elements
     if (Object.values(fields).some(el => !el)) return setError(`ERROR: DOM element not found`, spinner);

     const seed = fields.seed.value.trim();
     const nftId = fields.nftIdField.value.trim();
     const uri = fields.uriField.value.trim();

     // Validate user inputs
     if (!validatInput(seed)) return setError('ERROR: Seed cannot be empty', spinner);
     if (!validatInput(nftId)) return setError('ERROR: NFT Id cannot be empty', spinner);
     if (!validatInput(uri)) return setError('ERROR: URI cannot be empty', spinner);

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\nUpdating NFT Metadata\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed, { algorithm: 'secp256k1' });

          const transaction = {
               TransactionType: 'NFTokenModify',
               Account: wallet.address,
               NFTokenID: nftId,
               URI: xrpl.convertStringToHex(uri),
          };

          const preparedTx = await client.autofill(transaction);
          const signed = wallet.sign(preparedTx);
          const tx = await client.submitAndWait(signed.tx_blob);

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== 'tesSUCCESS') {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          results += `NFT metadata updated successfully.\n\n`;
          results += parseXRPLTransaction(tx.result);
          resultField.value = results;
          resultField.classList.add('success');

          fields.balance.value = await client.getXrpBalance(wallet.address);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving updateNFTMetadata');
     }
}

async function getNFTOffers() {
     console.log('Entering getNFTOffers');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const fields = {
          nftIdField: document.getElementById('nftIdField'),
          accountAddress: document.getElementById('accountAddressField'),
     };

     // Validate DOM elements
     if (!fields.nftIdField || !fields.accountAddress) return setError(`ERROR: DOM element not found (nftIdField or accountAddressField)`, spinner);

     const nftId = fields.nftIdField.value.trim();
     const accountAddress = fields.accountAddress.value.trim();

     // Validate user inputs
     if (!validatInput(nftId)) return setError('ERROR: NFT ID cannot be empty', spinner);
     if (!/^[0-9A-F]{64}$/.test(nftId)) return setError('ERROR: Invalid NFT ID format', spinner);
     if (!validatInput(accountAddress)) return setError('ERROR: Account address cannot be empty', spinner);
     if (!xrpl.isValidAddress(accountAddress)) return setError('ERROR: Invalid account address', spinner);

     let client;
     try {
          const { environment } = getEnvironment();
          client = await getClient();

          let results = `Connected to ${environment}.\nFetching NFT Offers for TokenID: ${nftId}\n\n`;
          resultField.value = results;

          // Check server version
          const serverInfo = await client.request({ method: 'server_info' });
          const serverVersion = serverInfo.result.info.build_version;
          if (!serverVersion || parseFloat(serverVersion) < 1.9) {
               results += `WARNING: Server version (${serverVersion}) may not fully support NFT operations. Consider using a server with rippled 1.9.0 or higher.\n\n`;
          }

          // Step 1: Verify NFT exists by checking account_nfts
          let nftExists = false;
          try {
               const nftInfo = await client.request({
                    method: 'account_nfts',
                    account: accountAddress,
               });
               const nfts = nftInfo.result.account_nfts || [];
               nftExists = nfts.some(nft => nft.NFTokenID === nftId);
               if (nftExists) {
                    const nft = nfts.find(nft => nft.NFTokenID === nftId);
                    results += `NFT found. Issuer: ${nft.Issuer || accountAddress}, Taxon: ${nft.NFTokenTaxon}\n`;
               } else {
                    results += `WARNING: NFT with TokenID ${nftId} not found in account ${accountAddress}. It may exist in another account or be burned.\n`;
               }
          } catch (nftError) {
               console.warn('Account NFTs Error:', nftError);
               results += `WARNING: Could not verify NFT existence: ${nftError.message}\n`;
          }

          // Step 2: Fetch sell offers
          let sellOffers = [];
          try {
               const sellOffersResponse = await client.request({
                    method: 'nft_sell_offers',
                    nft_id: nftId,
               });
               sellOffers = sellOffersResponse.result.offers || [];
          } catch (sellError) {
               if (sellError.message.includes('objectNotFound') || sellError.message.includes('actNotFound')) {
                    results += `No sell offers found for NFT.\n`;
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
                    nft_id: nftId,
               });
               buyOffers = buyOffersResponse.result.offers || [];
          } catch (buyError) {
               if (buyError.message.includes('objectNotFound') || buyError.message.includes('actNotFound')) {
                    results += `No buy offers found for NFT.\n`;
               } else {
                    console.warn('Buy Offers Error:', buyError);
                    console.warn(`WARNING: Error fetching buy offers: ${buyError.message}\n`);
               }
          }

          // Step 4: Display results
          results += `\nSell Offers:\n`;
          if (sellOffers.length === 0) {
               results += `No sell offers available.\n`;
          } else {
               sellOffers.forEach((offer, index) => {
                    const amount = offer.amount ? `${xrpl.dropsToXrp(offer.amount)} XRP` : 'Unknown';
                    const expiration = offer.expiration ? `Expires: ${new Date(offer.expiration * 1000).toISOString()}` : 'No expiration';
                    results += `Offer ${index + 1}: ${amount}, Owner: ${offer.owner}, Index: ${offer.index}, ${expiration}\n`;
               });
          }

          results += `\nBuy Offers:\n`;
          if (buyOffers.length === 0) {
               results += `No buy offers available.\n`;
          } else {
               buyOffers.forEach((offer, index) => {
                    const amount = offer.amount ? `${xrpl.dropsToXrp(offer.amount)} XRP` : 'Unknown';
                    const expiration = offer.expiration ? `Expires: ${new Date(offer.expiration * 1000).toISOString()}` : 'No expiration';
                    results += `Offer ${index + 1}: ${amount}, Owner: ${offer.owner}, Index: ${offer.index}, ${expiration}\n`;
               });
          }

          results += `\nNote: Each NFT offer reserves 0.2 XRP on your account until accepted or canceled.\n`;
          resultField.value = results;
          resultField.classList.add('success');
     } catch (error) {
          console.error('Error in getNFTOffers:', error);
          setError(`ERROR: ${error.message || 'Failed to fetch NFT offers'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving getNFTOffers');
     }
}

window.mintNFT = mintNFT;
window.mintBatchNFT = mintBatchNFT;
window.setAuthorizedMinter = setAuthorizedMinter;
window.sellNFT = sellNFT;
window.buyNFT = buyNFT;
window.getNFT = getNFT;
window.burnNFT = burnNFT;
window.createBuyOfferNFT = createBuyOfferNFT;
window.updateNFTMetadata = updateNFTMetadata;
window.getNFTOffers = getNFTOffers;
window.getTransaction = getTransaction;

window.populate1 = populate1;
window.populate2 = populate2;
window.populate3 = populate3;
window.autoResize = autoResize;
window.disconnectClient = disconnectClient;
window.gatherAccountInfo = gatherAccountInfo;
window.clearFields = clearFields;
window.distributeAccountInfo = distributeAccountInfo;
