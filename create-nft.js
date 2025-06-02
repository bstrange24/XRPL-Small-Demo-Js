import * as xrpl from 'xrpl';
import { getClient, disconnectClient, validatInput, getEnvironment, populate1, populate2, populate3, setError, parseXRPLTransaction, parseXRPLAccountObjects, autoResize, getTransaction, gatherAccountInfo, clearFields, distributeAccountInfo, updateOwnerCountAndReserves } from './utils.js';

async function getNFT() {
     console.log('Entering getNFT');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');

     const fields = {
          accountAddress: document.getElementById('accountAddressField'),
          accountSeed: document.getElementById('accountSeedField'),
          balance: document.getElementById('xrpBalanceField'),
     };

     if (Object.values(fields).some(el => !el)) return setError(`ERROR: DOM element not found`, spinner);

     const seed = fields.accountSeed.value.trim();

     if (!validatInput(seed)) return setError('ERROR: Seed cannot be empty', spinner);

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\nGetting NFT\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed, { algorithm: 'secp256k1' });

          const nftInfo = await client.request({
               command: 'account_nfts',
               account: wallet.address,
          });
          console.log('nftInfo', nftInfo);

          if (nftInfo.result.account_nfts.length <= 0) {
               resultField.value += `No NFTS found for account ${wallet.address}`;
               resultField.classList.add('success');
               return;
          }

          results += parseXRPLAccountObjects(nftInfo.result);
          resultField.value = results;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
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

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');

     const fields = {
          address: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          balance: document.getElementById('xrpBalanceField'),
          issuerAddress: document.getElementById('issuerAddressField'),
          uriField: document.getElementById('uriField'),
          burnableNft: document.getElementById('burnableNft'),
          onlyXrpNft: document.getElementById('onlyXrpNft'),
          transferableNft: document.getElementById('transferableNft'),
          mutableNft: document.getElementById('mutableNft'),
     };

     if (Object.values(fields).some(el => !el)) return setError(`ERROR: DOM element ${el} not found`, spinner);

     const seed = fields.seed.value.trim();
     const issuerAddress = fields.issuerAddress.value.trim();
     const uri = fields.uriField.value.trim() || 'ipfs://bafybeidf5geku675serlvutcibc5n5fjnzqacv43mjfcrh4ur6hcn4xkw4.metadata.json';

     if (!validatInput(seed)) return setError('ERROR: Seed cannot be empty', spinner);
     if (issuerAddress && !xrpl.isValidAddress(issuerAddress)) return setError('ERROR: Invalid issuer address', spinner);
     if (!validatInput(uri)) return setError('ERROR: URI cannot be empty', spinner);

     let flags = 0;
     if (fields.burnableNft.checked) {
          flags = xrpl.NFTokenMintFlags.tfBurnable;
     }

     if (fields.onlyXrpNft.checked) {
          if (flags === undefined) {
               flags = xrpl.NFTokenMintFlags.tfOnlyXRP;
          } else {
               flags |= xrpl.NFTokenMintFlags.tfOnlyXRP;
          }
     }

     if (fields.transferableNft.checked) {
          if (flags === undefined) {
               flags = xrpl.NFTokenMintFlags.tfTransferable;
          } else {
               flags |= xrpl.NFTokenMintFlags.tfTransferable;
          }
     }

     if (fields.mutableNft.checked) {
          if (flags === undefined) {
               flags = xrpl.NFTokenMintFlags.tfMutable;
          } else {
               flags |= xrpl.NFTokenMintFlags.tfMutable;
          }
     }

     console.log('flags ' + flags);

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
               Flags: flags,
               NFTokenTaxon: 0,
          };

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
          results += `Tx Hash: ${tx.result.hash}\n\n`;
          results += parseXRPLTransaction(tx.result);

          resultField.value = results;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
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

async function mintBatchNFT() {
     console.log('Entering mintBatchNFT');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');

     const fields = {
          address: document.getElementById('accountAddressField'),
          seed: document.getElementById('accountSeedField'),
          balance: document.getElementById('xrpBalanceField'),
          amount: document.getElementById('amountField'),
          uriField: document.getElementById('uriField'),
     };

     if (Object.values(fields).some(el => !el)) return setError(`ERROR: DOM element not found`, spinner);

     const seed = fields.seed.value.trim();
     const amount = fields.amount.value.trim();
     const uri = fields.uriField.value.trim() || 'ipfs://bafybeidf5geku675serlvutcibc5n5fjnzqacv43mjfcrh4ur6hcn4xkw4.metadata.json';

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
          results += `Tx Hash: ${tx.result.hash}\n\n`;
          results += parseXRPLTransaction(tx.result);
          resultField.value = results;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
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

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');

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
          results += `Tx Hash: ${tx.result.hash}\n\n`;
          results += parseXRPLTransaction(tx.result);
          resultField.value = results;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
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

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');

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
          results += `Tx Hash: ${tx.result.hash}\n\n`;
          results += parseXRPLTransaction(tx.result);
          resultField.value = results;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
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

async function cancelBuyOffer() {
     console.log('Entering cancelBuyOffer');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');
     const xrpBalanceField = document.getElementById('xrpBalanceField');

     const nftIndexField = document.getElementById('nftIndexField');
     const seedField = document.getElementById('accountSeedField');

     // Validate DOM
     if (!nftIndexField || !seedField) {
          return setError('ERROR: DOM field missing.', spinner);
     }

     const offerIndex = nftIndexField.value.trim();
     const seed = seedField.value.trim();

     if (!offerIndex) return setError('ERROR: Offer index is required.', spinner);
     if (!seed) return setError('ERROR: Seed is required.', spinner);

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\nCanceling NFT Sell Offer...\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed, { algorithm: 'secp256k1' });

          const transaction = {
               TransactionType: 'NFTokenCancelOffer',
               Account: wallet.address,
               NFTokenOffers: [offerIndex],
          };

          const prepared = await client.autofill(transaction);
          const signed = wallet.sign(prepared);
          const tx = await client.submitAndWait(signed.tx_blob);

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== 'tesSUCCESS') {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          results += `Sell offer canceled successfully.\n\n`;
          results += `Tx Hash: ${tx.result.hash}\n\n`;
          results += parseXRPLTransaction(tx.result);
          resultField.value = results;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.address);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving cancelBuyOffer');
     }
}

async function cancelSellOffer() {
     console.log('Entering cancelSellOffer');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');
     const xrpBalanceField = document.getElementById('xrpBalanceField');

     const seedField = document.getElementById('accountSeedField');
     const nftIndexField = document.getElementById('nftIndexField');

     // Validate DOM
     if (!nftIndexField || !seedField) {
          return setError('ERROR: DOM field missing.', spinner);
     }

     const offerIndex = nftIndexField.value.trim();
     const seed = seedField.value.trim();

     if (!offerIndex) return setError('ERROR: Offer index is required.', spinner);
     if (!seed) return setError('ERROR: Seed is required.', spinner);

     try {
          const { environment } = getEnvironment();
          const client = await getClient();

          let results = `Connected to ${environment}.\nCanceling NFT Sell Offer...\n\n`;
          resultField.value = results;

          const wallet = xrpl.Wallet.fromSeed(seed, { algorithm: 'secp256k1' });

          const transaction = {
               TransactionType: 'NFTokenCancelOffer',
               Account: wallet.address,
               NFTokenOffers: [offerIndex],
          };

          const prepared = await client.autofill(transaction);
          const signed = wallet.sign(prepared);
          const tx = await client.submitAndWait(signed.tx_blob);

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== 'tesSUCCESS') {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          results += `Sell offer canceled successfully.\n\n`;
          results += `Tx Hash: ${tx.result.hash}\n\n`;
          results += parseXRPLTransaction(tx.result);
          resultField.value = results;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.address);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
          await client?.disconnect?.();
     } finally {
          if (spinner) spinner.style.display = 'none';
          autoResize();
          console.log('Leaving cancelSellOffer');
     }
}

async function buyNFT() {
     console.log('Entering buyNFT');

     const resultField = document.getElementById('resultField');
     resultField?.classList.remove('error', 'success');

     const spinner = document.getElementById('spinner');
     if (spinner) spinner.style.display = 'block';

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');

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
          let response = '';
          try {
               response = await client.request({
                    command: 'nft_sell_offers',
                    nft_id: nftId,
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
               const isTargeted = offer.Destination === wallet.address;
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
               Account: wallet.address,
               NFTokenSellOffer: selectedOffer.nft_offer_index,
          };

          // Buy the NFT
          const tx = await client.submitAndWait(transaction, { wallet });

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== 'tesSUCCESS') {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          results += `NFT buy finished successfully.\n\n`;
          results += `Tx Hash: ${tx.result.hash}\n\n`;
          results += parseXRPLTransaction(tx.result);
          resultField.value = results;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
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

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');

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
          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== 'tesSUCCESS') {
               return setError(`ERROR: Transaction failed: ${resultCode}\n${parseXRPLTransaction(tx.result)}`, spinner);
          }

          results += `NFT burned finished successfully.\n\n`;
          results += `Tx Hash: ${tx.result.hash}\n\n`;
          results += parseXRPLTransaction(tx.result);
          resultField.value = results;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
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

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');

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
          results += `Tx Hash: ${tx.result.hash}\n\n`;
          results += parseXRPLTransaction(tx.result);
          resultField.value = results;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.address, ownerCountField, totalXrpReservesField);
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

     const ownerCountField = document.getElementById('ownerCountField');
     const totalXrpReservesField = document.getElementById('totalXrpReservesField');
     const xrpBalanceField = document.getElementById('xrpBalanceField');

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
          console.log('Server Version: ' + serverVersion);
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
                    results += `NFT found.\nIssuer: ${nft.Issuer || accountAddress}\nTaxon: ${nft.NFTokenTaxon}\nNFT Serial: ${nft.nft_serial}\nNFT URI: ${nft.URI}\n`;
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
                    nft_id: nftId,
               });
               buyOffers = buyOffersResponse.result.offers || [];
          } catch (buyError) {
               if (buyError.message.includes('object was not found') || buyError.message.includes('act not found')) {
                    console.warn('No buy offers found for NFT.');
               } else {
                    results += `Buy Offers Error: ${buyError}`;
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
                    results += `Offer ${index + 1}: ${amount}, Owner: ${offer.owner}, Index: ${offer.nft_offer_index}, ${expiration}\n`;
               });
          }

          results += `\nBuy Offers:\n`;
          if (buyOffers.length === 0) {
               results += `No buy offers available.\n`;
          } else {
               buyOffers.forEach((offer, index) => {
                    const amount = offer.amount ? `${xrpl.dropsToXrp(offer.amount)} XRP` : 'Unknown';
                    const expiration = offer.expiration ? `Expires: ${new Date(offer.expiration * 1000).toISOString()}` : 'No expiration';
                    results += `Offer ${index + 1}: ${amount}, Owner: ${offer.owner}, Index: ${offer.nft_offer_index}, ${expiration}\n`;
               });
          }

          resultField.value = results;
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, accountAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(accountAddress);
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
// window.createBuyOfferNFT = createBuyOfferNFT;
// window.createSellOfferNFT = createSellOfferNFT;
window.cancelSellOffer = cancelSellOffer;
window.cancelBuyOffer = cancelBuyOffer;
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
