import * as xrpl from 'xrpl';
import { getClient, disconnectClient, validatInput, getEnvironment, populate1, populate2, populate3, setError, parseXRPLTransaction, displayTransaction, parseXRPLAccountObjects, displayAccountObjects, autoResize, getTransaction } from './utils.js';

async function getNFT() {
     console.log('Entering getNFT');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const fields = {
          accountAddress: document.getElementById('accountAddressField'),
          accountSeed: document.getElementById('accountSeedField'),
          balance: document.getElementById('xrpBalanceField'),
          
     };

     // Validate DOM elements
     if (Object.values(fields).some(el => !el)) {
          return setError(`ERROR: DOM element not found`);
     }

     const seed = fields.accountSeed.value.trim();
     
     // Validate user inputs
     if (!validatInput(seed)) return setError('ERROR: Seed cannot be empty');

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\Getting NFT\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed, { algorithm: 'secp256k1' });

          // Fetch the NFT ID
          const nftInfo = await client.request({
               method: 'account_nfts',
               account: wallet.address,
          });

          const details = parseXRPLAccountObjects(nftInfo.result);
          results += displayAccountObjects(details);
          resultField.value = results;
          resultField.classList.add('success');

          fields.balance.value = await client.getXrpBalance(wallet.address);
     } catch (error) {
          console.error('Error:', error);
          setError(error.message || 'Unknown error');
          await disconnectClient();
     } finally {
          console.log('Leaving getNFT');
     }
}

async function mintNFT() {
     console.log('Entering mintNFT');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const fields = {
          accountAddress: document.getElementById('accountAddressField'),
          accountSeed: document.getElementById('accountSeedField'),
          balance: document.getElementById('xrpBalanceField'),
     };

     // Validate DOM elements
     if (Object.values(fields).some(el => !el)) {
          return setError(`ERROR: DOM element not found`);
     }

     const seed = fields.accountSeed.value.trim();

     // Validate user inputs
     if (!validatInput(seed)) return setError('ERROR: Seed cannot be empty');

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\nMinting NFT\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed, { algorithm: 'secp256k1' });

          const preparedTx = await client.autofill({
               TransactionType: 'NFTokenMint',
               Account: wallet.address,
               URI: xrpl.convertStringToHex("ipfs://bafybeidf5geku675serlvutcibc5n5fjnzqacv43mjfcrh4ur6hcn4xkw4.metadata.json"),
               // Flags: 1, // 1 = Creator can mint more (royalties), 8 = Transferable
               // NFTokenTaxon: 42, // Unique series ID (for royalties)
               Flags: 8,
               NFTokenTaxon: 0,
          });

          const signed = wallet.sign(preparedTx);
          const response = await client.submitAndWait(signed.tx_blob);
          console.log('Mint NFT response:', response);

          const resultCode = response.result.meta.TransactionResult;
          if (resultCode !== 'tesSUCCESS') {
               const { txDetails, accountChanges } = parseXRPLTransaction(response.result);
               return setError(`ERROR: Minting NFT failed: ${resultCode}\n${displayTransaction({ txDetails, accountChanges })}`);
          }

          results += `NFT mint finished successfully.\n\n`;
          const { txDetails, accountChanges } = parseXRPLTransaction(response.result);
          results += displayTransaction({ txDetails, accountChanges });

          resultField.value = results;
          resultField.classList.add('success');

          fields.balance.value = await client.getXrpBalance(wallet.address);
     } catch (error) {
          console.error('Error:', error);
          setError(error.message || 'Unknown error');
          await disconnectClient();
     } finally {
          autoResize();
          console.log('Leaving mintNFT');
     }
}

async function mintBatchNFT() {
     console.log('Entering mintNFT');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const fields = {
          address: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          balance: document.getElementById('xrpBalanceField'),
          amount: document.getElementById('amountField'),
     };

     // Validate DOM elements
     if (Object.values(fields).some(el => !el)) {
          return setError(`ERROR: DOM element not found`);
     }

     const seed = fields.seed.value.trim();
     const amount = fields.amount.value.trim();

     // Validate user inputs
     if (!validatInput(seed)) return setError('ERROR: Seed cannot be empty');
     if (!validatInput(amount)) return setError('ERROR: Amount cannot be empty');
     if (isNaN(amount)) return setError('ERROR: Amount must be a valid number');
     if (parseFloat(amount) <= 0) return setError('ERROR: Amount must be greater than zero');

     const { environment } = getEnvironment();
     const client = await getClient();

     try {
          let results = `Connected to ${environment}.\nSending XRP\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed, { algorithm: 'secp256k1' });

          fields.balance.value = await client.getXrpBalance(wallet.address);
     } catch (error) {
          console.error('Error:', error);
          setError(error.message || 'Unknown error');
          await disconnectClient();
     } finally {
          console.log('Leaving mintNFT');
     }
}

async function sellNFT() {
     console.log('Entering sellNFT');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const fields = {
          address: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          balance: document.getElementById('xrpBalanceField'),
          amount: document.getElementById('amountField'),
          nftIdField: document.getElementById('nftIdField'),
     };

     // Validate DOM elements
     if (Object.values(fields).some(el => !el)) {
          return setError(`ERROR: DOM element not found`);
     }

     const seed = fields.seed.value.trim();
     const amount = fields.amount.value.trim();
     const nftId = fields.nftIdField.value.trim();

     // Validate user inputs
     if (!validatInput(seed)) return setError('ERROR: Seed cannot be empty');
     if (!validatInput(amount)) return setError('ERROR: Amount cannot be empty');
     if (isNaN(amount)) return setError('ERROR: Amount must be a valid number');
     if (parseFloat(amount) <= 0) return setError('ERROR: Amount must be greater than zero');
     if (!validatInput(nftId)) return setError('ERROR: NFT Id cannot be empty');

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
               Amount: xrpl.xrpToDrops(amount), // Price in XRP (converted to drops)
               Flags: 1, // 1 = Sell offer (owner is seller)
          };

          const tx = await client.submitAndWait(transaction, { wallet });
          console.log('NFT Listed for Sale', tx);

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== 'tesSUCCESS') {
               const { txDetails, accountChanges } = parseXRPLTransaction(tx.result);
               return setError(`ERROR: Selling NFT failed: ${resultCode}\n${displayTransaction({ txDetails, accountChanges })}`);
          }

          results += `NFT sell finished successfully.\n\n`;
          const { txDetails, accountChanges } = parseXRPLTransaction(tx.result);
          results += displayTransaction({ txDetails, accountChanges });

          resultField.value = results;
          resultField.classList.add('success');

          // Update balance
          fields.balance.value = await client.getXrpBalance(wallet.address);
     } catch (error) {
          console.error('Error:', error);
          setError(error.message || 'Unknown error');
          await disconnectClient();
     } finally {
          console.log('Leaving sellNFT');
     }
}

async function buyNFT() {
     console.log('Entering buyNFT');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const fields = {
          address: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          balance: document.getElementById('xrpBalanceField'),
          amount: document.getElementById('amountField'),
          nftIdField: document.getElementById('nftIdField'),
     };

     // Validate DOM elements
     if (Object.values(fields).some(el => !el)) {
          return setError(`ERROR: DOM element not found`);
     }

     const seed = fields.seed.value.trim();
     const amount = fields.amount.value.trim();
     const nftId = fields.nftIdField.value.trim();

     // Validate user inputs
     if (!validatInput(seed)) return setError('ERROR: Seed cannot be empty');
     if (!validatInput(amount)) return setError('ERROR: Amount cannot be empty');
     if (isNaN(amount)) return setError('ERROR: Amount must be a valid number');
     if (parseFloat(amount) <= 0) return setError('ERROR: Amount must be greater than zero');
     if (!validatInput(nftId)) return setError('ERROR: NFT Id cannot be empty');

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\nSending XRP\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed, { algorithm: 'secp256k1' });

          // Fetch sell offers
          const response = await client.request({
               method: 'nft_sell_offers',
               nft_id: nftId,
          });

          const sellOffer = response.result.offers[0];
          if (!sellOffer) {
               throw new Error('No sell offers found!');
          }

          const transaction = {
               TransactionType: 'NFTokenAcceptOffer',
               Account: wallet.address,
               NFTokenSellOffer: sellOffer.index,
          };

          // Buy the NFT
          const tx = await client.submitAndWait(transaction, { wallet });

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== 'tesSUCCESS') {
               const { txDetails, accountChanges } = parseXRPLTransaction(tx.result);
               return setError(`ERROR: Buying NFT failed: ${resultCode}\n${displayTransaction({ txDetails, accountChanges })}`);
          }

          results += `NFT buy finished successfully.\n\n`;
          const { txDetails, accountChanges } = parseXRPLTransaction(tx.result);
          results += displayTransaction({ txDetails, accountChanges });

          resultField.value = results;
          resultField.classList.add('success');

          fields.balance.value = await client.getXrpBalance(wallet.address);
     } catch (error) {
          console.error('Error:', error);
          setError(error.message || 'Unknown error');
          await disconnectClient();
     } finally {
          console.log('Leaving buyNFT');
     }
}

async function burnNFT() {
     console.log('Entering burnNFT');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const fields = {
          address: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          balance: document.getElementById('xrpBalanceField'),
          nftIdField: document.getElementById('nftIdField'),
     };

     // Validate DOM elements
     if (Object.values(fields).some(el => !el)) {
          return setError(`ERROR: DOM element not found`);
     }

     const seed = fields.seed.value.trim();
     const nftId = fields.nftIdField.value.trim();

     // Validate user inputs
     if (!validatInput(seed)) return setError('ERROR: Seed cannot be empty');
     if (!validatInput(nftId)) return setError('ERROR: NFT Id cannot be empty');

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
               const { txDetails, accountChanges } = parseXRPLTransaction(tx.result);
               return setError(`ERROR: Minting NFT failed: ${resultCode}\n${displayTransaction({ txDetails, accountChanges })}`);
          }

          results += `NFT mint finished successfully.\n\n`;
          const { txDetails, accountChanges } = parseXRPLTransaction(tx.result);
          results += displayTransaction({ txDetails, accountChanges });

          resultField.value = results;
          resultField.classList.add('success');

          fields.balance.value = await client.getXrpBalance(wallet.address);
     } catch (error) {
          console.error('Error:', error);
          setError(error.message || 'Unknown error');
          await disconnectClient();
     } finally {
          console.log('Leaving burnNFT');
     }
}

window.mintNFT = mintNFT;
window.mintBatchNFT = mintBatchNFT;
window.sellNFT = sellNFT;
window.buyNFT = buyNFT;
window.getNFT = getNFT;
window.burnNFT = burnNFT;
window.getTransaction = getTransaction;

window.populate1 = populate1;
window.populate2 = populate2;
window.populate3 = populate3;
window.autoResize = autoResize;
