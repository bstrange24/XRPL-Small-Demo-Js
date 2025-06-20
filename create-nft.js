import * as xrpl from 'xrpl';
import { getClient, getNet, disconnectClient, validatInput, setError, getTransaction, gatherAccountInfo, clearFields, distributeAccountInfo, updateOwnerCountAndReserves, renderNftDetails, renderNFTOffersDetails, renderTransactionDetails } from './utils.js';
import { ed25519_ENCRYPTION, secp256k1_ENCRYPTION, MAINNET, TES_SUCCESS, EMPTY_STRING } from './constants.js';
import { derive } from 'xrpl-accountlib';

export async function getNFT() {
     console.log('Entering getNFT');
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
          seed: document.getElementById('accountSeedField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
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

     const { seed, xrpBalanceField, ownerCountField, totalXrpReservesField, totalExecutionTime } = fields;

     const validations = [[!validatInput(seed.value), 'Seed cannot be empty']];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          let wallet;
          if (seed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (seed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(seed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

          const nftInfo = await client.request({
               command: 'account_nfts',
               account: wallet.classicAddress,
          });
          console.log('nftInfo', nftInfo);

          // Prepare data for renderAccountDetails
          const data = {
               sections: [{}],
          };

          if (nftInfo.result.account_nfts.length <= 0) {
               data.sections.push({
                    title: 'NFTs',
                    openByDefault: true,
                    content: [{ key: 'Status', value: `No NFTs found for <code>${wallet.classicAddress}</code>` }],
               });
          } else {
               data.sections.push({
                    title: `NFTs (${nftInfo.result.account_nfts.length})`,
                    openByDefault: true,
                    subItems: nftInfo.result.account_nfts.map((nft, index) => {
                         const { NFTokenID, NFTokenTaxon, Issuer, URI, Flags, TransferFee } = nft;
                         return {
                              key: `NFT ${index + 1} (ID: ${NFTokenID.slice(0, 8)}...)`,
                              openByDefault: false,
                              content: [{ key: 'NFToken ID', value: `<code>${NFTokenID}</code>` }, { key: 'Taxon', value: String(NFTokenTaxon) }, ...(Issuer ? [{ key: 'Issuer', value: `<code>${Issuer}</code>` }] : []), ...(URI ? [{ key: 'URI', value: `<code>${URI}</code>` }] : []), { key: 'Flags', value: String(Flags) }, ...(TransferFee ? [{ key: 'Transfer Fee', value: `${TransferFee / 1000}%` }] : [])],
                         };
                    }),
               });
          }

          // Render data
          renderNftDetails(data);

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
     } finally {
          if (spinner) spinner.style.display = 'none';
          totalExecutionTime.value = Date.now() - startTime;
          console.log(`Leaving getNFT in ${totalExecutionTime.value}ms`);
     }
}

export async function mintNFT() {
     console.log('Entering mintNFT');
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

     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim();
          }
     }

     const { seed, xrpBalanceField, issuerAddress, uriField, ownerCountField, totalXrpReservesField, totalExecutionTime } = fields;

     const uri = uriField.value.trim() || 'ipfs://bafybeidf5geku675serlvutcibc5n5fjnzqacv43mjfcrh4ur6hcn4xkw4.metadata.json';

     const validations = [
          [!validatInput(seed.value), 'Seed cannot be empty'],

          [!validatInput(uri), 'URI cannot be empty'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     const flags = setNftFlags();

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.innerHTML = `Connected to ${environment} ${net}\nMinting NFT\n\n`;

          let wallet;
          if (seed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (seed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(seed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

          const transaction = {
               TransactionType: 'NFTokenMint',
               Account: wallet.classicAddress,
               Flags: flags,
               NFTokenTaxon: 0,
          };

          if (issuerAddress.value) {
               if (!xrpl.isValidAddress(issuerAddress.value)) {
                    setError('ERROR: Invalid Account address', spinner);
               }
               transaction.Issuer = issuerAddress.value;
          }

          if (uri) {
               transaction.URI = xrpl.convertStringToHex(uri);
          }

          const tx = await client.submitAndWait(transaction, { wallet });

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               renderTransactionDetails(tx);
               resultField.classList.add('error');
          }

          resultField.innerHTML += `NFT mint finished successfully.\n\n`;

          renderTransactionDetails(tx);
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
     } finally {
          if (spinner) spinner.style.display = 'none';
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving mintNFT in ${now}ms`);
     }
}

export async function mintBatchNFT() {
     console.log('Entering mintBatchNFT');
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
          seed: document.getElementById('accountSeedField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
          amount: document.getElementById('amountField'),
          uriField: document.getElementById('uriField'),
          ownerCountField: document.getElementById('ownerCountField'),
          totalXrpReservesField: document.getElementById('totalXrpReservesField'),
          totalExecutionTime: document.getElementById('totalExecutionTime'),
          nftCount: document.getElementById('nftCountField'),
     };

     for (const [name, field] of Object.entries(fields)) {
          if (!field) {
               return setError(`ERROR: DOM element ${name} not found`, spinner);
          } else {
               field.value = field.value.trim();
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

     const flags = setNftFlags();

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.innerHTML = `Connected to ${environment} ${net}\nMinting ${nftCount.value} NFTs\n\n`;

          let wallet;
          if (seed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (seed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(seed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

          // Use Batch Transactions if supported (rippled 2.5.0+)
          const transactions = [];
          const transactionResults = [];
          for (let i = 0; i < parseInt(nftCount.value); i++) {
               transactions.push({
                    TransactionType: 'NFTokenMint',
                    Account: wallet.classicAddress,
                    URI: xrpl.convertStringToHex(uri),
                    Flags: flags, // 8 | 16, // Transferable + Mutable
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
               tx = await client.submitAndWait(batchTx, { wallet });
          } else {
               // Fallback to individual transactions
               for (const transaction of transactions) {
                    const singleTx = await client.submitAndWait(transaction, { wallet });
                    if (singleTx.result.meta.TransactionResult !== TES_SUCCESS) {
                         resultField.innerHTML += `ERROR: Minting NFT ${i + 1} failed: ${singleTx.result.meta.TransactionResult}\n`;
                         renderTransactionDetails(tx);
                         resultField.classList.add('error');
                    }
                    transactionResults.push(singleTx);
               }
               tx = transactionResults[transactions.length - 1];
          }

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               renderTransactionDetails(tx);
               resultField.classList.add('error');
          }

          resultField.innerHTML += `Successfully minted ${nftCount} NFTs.\n\n`;

          renderTransactionDetails(tx);
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
     } finally {
          if (spinner) spinner.style.display = 'none';
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving mintBatchNFT in ${now}ms`);
     }
}

export async function burnNFT() {
     console.log('Entering burnNFT');
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
          seed: document.getElementById('accountSeedField'),
          xrpBalanceField: document.getElementById('xrpBalanceField'),
          nftIdField: document.getElementById('nftIdField'),
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

          resultField.innerHTML = `Connected to ${environment} ${net}\nBurning NFT\n\n`;

          let wallet;
          if (seed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (seed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(seed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

          const transaction = {
               TransactionType: 'NFTokenBurn',
               Account: wallet.classicAddress,
               NFTokenID: nftIdField.value,
          };

          const tx = await client.submitAndWait(transaction, { wallet });
          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               renderTransactionDetails(tx);
               resultField.classList.add('error');
          }

          resultField.innerHTML += `NFT burned successfully.\n\n`;

          renderTransactionDetails(tx);
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
     } finally {
          if (spinner) spinner.style.display = 'none';
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving burnNFT in ${now}ms`);
     }
}

export async function getNFTOffers() {
     console.log('Entering getNFTOffers');
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
               field.value = field.value.trim();
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

          // Check server version
          const serverInfo = await client.request({ method: 'server_info' });
          const serverVersion = serverInfo.result.info.build_version;
          console.log('Server Version: ' + serverVersion);

          // Prepare data for rendering
          const data = {
               sections: [],
          };

          // Step 1: Verify NFT exists
          let nftExists = false;
          let nftDetails = {};
          try {
               const nftInfo = await client.request({
                    method: 'account_nfts',
                    account: accountAddress.value,
               });
               const nfts = nftInfo.result.account_nfts || [];
               nftExists = nfts.some(nft => nft.NFTokenID === nftIdField.value);
               if (nftExists) {
                    const nft = nfts.find(nft => nft.NFTokenID === nftIdField.value);
                    nftDetails = {
                         title: 'NFT Details',
                         openByDefault: true,
                         content: [{ key: 'NFToken ID', value: `<code>${nft.NFTokenID}</code>` }, { key: 'Issuer', value: `<code>${nft.Issuer || accountAddress.value}</code>` }, { key: 'Taxon', value: String(nft.NFTokenTaxon) }, ...(nft.URI ? [{ key: 'URI', value: `<code>${nft.URI}</code>` }] : []), { key: 'Serial', value: String(nft.nft_serial) }],
                    };
                    data.sections.push(nftDetails);
               } else {
                    data.sections.push({
                         title: 'NFT Details',
                         openByDefault: true,
                         content: [{ key: 'Status', value: `No NFT found for TokenID <code>${nftIdField.value}</code> in account <code>${accountAddress.value}</code>` }],
                    });
               }
          } catch (nftError) {
               console.warn('Account NFTs Error:', nftError);
               data.sections.push({
                    title: 'NFT Details',
                    openByDefault: true,
                    content: [{ key: 'Status', value: `WARNING: Could not verify NFT existence: ${nftError.message}` }],
               });
          }

          // Step 2: Fetch sell offers
          let sellOffers = [];
          try {
               const sellOffersResponse = await client.request({
                    method: 'nft_sell_offers',
                    nft_id: nftIdField.value,
               });
               sellOffers = sellOffersResponse.result.offers || [];
               const sellSection = {
                    title: `Sell Offers (${sellOffers.length})`,
                    openByDefault: true,
                    subItems: sellOffers.length
                         ? sellOffers.map((offer, index) => ({
                                key: `Sell Offer ${index + 1} (Index: ${offer.nft_offer_index.slice(0, 8)}...)`,
                                openByDefault: false,
                                content: [{ key: 'Offer Index', value: `<code>${offer.nft_offer_index}</code>` }, { key: 'Amount', value: offer.amount ? `${xrpl.dropsToXrp(offer.amount)} XRP` : 'Unknown' }, { key: 'Owner', value: `<code>${offer.owner}</code>` }, ...(offer.expiration ? [{ key: 'Expiration', value: new Date(offer.expiration * 1000).toISOString() }] : []), ...(offer.destination ? [{ key: 'Destination', value: `<code>${offer.destination}</code>` }] : [])],
                           }))
                         : [
                                {
                                     key: 'No Sell Offers',
                                     openByDefault: false,
                                     content: [{ key: 'Status', value: 'No sell offers available' }],
                                },
                           ],
               };
               data.sections.push(sellSection);
          } catch (sellError) {
               console.warn('Sell Offers Error:', sellError);
               data.sections.push({
                    title: 'Sell Offers',
                    openByDefault: true,
                    content: [
                         {
                              key: 'Status',
                              value: sellError.message.includes('object was not found') || sellError.message.includes('act not found') ? 'No sell offers available' : `Error fetching sell offers: ${sellError.message}`,
                         },
                    ],
               });
          }

          // Step 3: Fetch buy offers
          let buyOffers = [];
          try {
               const buyOffersResponse = await client.request({
                    method: 'nft_buy_offers',
                    nft_id: nftIdField.value,
               });
               buyOffers = buyOffersResponse.result.offers || [];
               const buySection = {
                    title: `Buy Offers (${buyOffers.length})`,
                    openByDefault: true,
                    subItems: buyOffers.length
                         ? buyOffers.map((offer, index) => ({
                                key: `Buy Offer ${index + 1} (Index: ${offer.nft_offer_index.slice(0, 8)}...)`,
                                openByDefault: false,
                                content: [{ key: 'Offer Index', value: `<code>${offer.nft_offer_index}</code>` }, { key: 'Amount', value: offer.amount ? `${xrpl.dropsToXrp(offer.amount)} XRP` : 'Unknown' }, { key: 'Owner', value: `<code>${offer.owner}</code>` }, ...(offer.expiration ? [{ key: 'Expiration', value: new Date(offer.expiration * 1000).toISOString() }] : []), ...(offer.destination ? [{ key: 'Destination', value: `<code>${offer.destination}</code>` }] : [])],
                           }))
                         : [
                                {
                                     key: 'No Buy Offers',
                                     openByDefault: false,
                                     content: [{ key: 'Status', value: 'No buy offers available' }],
                                },
                           ],
               };
               data.sections.push(buySection);
          } catch (buyError) {
               console.warn('Buy Offers Error:', buyError);
               data.sections.push({
                    title: 'Buy Offers',
                    openByDefault: true,
                    content: [
                         {
                              key: 'Status',
                              value: buyError.message.includes('object was not found') || buyError.message.includes('act not found') ? 'No buy offers available' : `Error fetching buy offers: ${buyError.message}`,
                         },
                    ],
               });
          }

          // // Step 4: Add server info
          // data.sections.push({
          //      title: 'Server Info',
          //      openByDefault: false,
          //      content: [{ key: 'Environment', value: environment }, { key: 'Network', value: net }, { key: 'Server Version', value: serverVersion }, ...(parseFloat(serverVersion) < 1.9 ? [{ key: 'Warning', value: 'Server version may not fully support NFT operations (requires rippled 1.9.0 or higher)' }] : [])],
          // });

          // Render data
          renderNFTOffersDetails(data);

          // Update account details
          await updateOwnerCountAndReserves(client, accountAddress.value, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(accountAddress.value);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`, spinner);
     } finally {
          if (spinner) spinner.style.display = 'none';
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving getNFTOffers in ${now}ms`);
     }
}

export async function setAuthorizedMinter() {
     console.log('Entering setAuthorizedMinter');
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
          [!validatInput(minterAddress.value), 'Minter address cannot be empty'],
          [!xrpl.isValidAddress(minterAddress.value), 'Invalid issuer address'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.innerHTML = `Connected to ${environment} ${net}\nSetting Authorized Minter\n\n`;

          let wallet;
          if (seed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (seed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(seed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

          const transaction = {
               TransactionType: 'AccountSet',
               Account: wallet.classicAddress,
               NFTokenMinter: minterAddress.value,
          };

          const tx = await client.submitAndWait(transaction, { wallet });

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               renderTransactionDetails(tx);
               resultField.classList.add('error');
          }

          resultField.innerHTML += `Authorized minter set successfully.\n\n`;

          renderTransactionDetails(tx);
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
     } finally {
          if (spinner) spinner.style.display = 'none';
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving setAuthorizedMinter in ${now}ms`);
     }
}

export async function buyNFT() {
     console.log('Entering buyNFT');
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
          [!validatInput(nftIdField.value), 'ERROR: NFT ID cannot be empty'],
     ];

     for (const [condition, message] of validations) {
          if (condition) return setError(`ERROR: ${message}`, spinner);
     }

     try {
          const { net, environment } = getNet();
          const client = await getClient();

          resultField.innerHTML = `Connected to ${environment} ${net}\nBuying NFT\n\n`;

          let wallet;
          if (accountSeedField.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(accountSeedField.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (accountSeedField.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(accountSeedField.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

          // Fetch sell offers
          let response = EMPTY_STRING;
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
               renderTransactionDetails(tx);
               resultField.classList.add('error');
          }

          resultField.innerHTML += `NFT buy finished successfully.\n\n`;

          renderTransactionDetails(tx);
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
     } finally {
          if (spinner) spinner.style.display = 'none';
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving buyNFT in ${now}ms`);
     }
}

export async function cancelBuyOffer() {
     console.log('Entering cancelBuyOffer');
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

          resultField.innerHTML = `Connected to ${environment} ${net}\nCanceling NFT Sell Offer\n\n`;

          let wallet;
          if (seed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (seed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(seed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

          // const wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });

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
               renderTransactionDetails(tx);
               resultField.classList.add('error');
          }

          resultField.innerHTML += `Sell offer canceled successfully.\n\n`;
          renderTransactionDetails(tx);
          resultField.classList.add('error');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
     } finally {
          if (spinner) spinner.style.display = 'none';
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving cancelBuyOffer in ${now}ms`);
     }
}

export async function sellNFT() {
     console.log('Entering sellNFT');
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

          resultField.innerHTML = `Connected to ${environment} ${net}\nSelling NFT\n\n`;

          let wallet;
          if (seed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (seed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(seed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

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

          const tx = await client.submitAndWait(transaction, { wallet });

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               renderTransactionDetails(tx);
               resultField.classList.add('error');
          }

          resultField.innerHTML += `NFT sell offer created successfully.\n\n`;

          renderTransactionDetails(tx);
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
     } finally {
          if (spinner) spinner.style.display = 'none';
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving sellNFT in ${now}ms`);
     }
}

export async function cancelSellOffer() {
     console.log('Entering cancelSellOffer');
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

          resultField.innerHTML = `Connected to ${environment} ${net}\nCanceling NFT Sell Offer\n\n`;

          let wallet;
          if (accountSeedField.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(accountSeedField.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (accountSeedField.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(accountSeedField.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

          const transaction = {
               TransactionType: 'NFTokenCancelOffer',
               Account: wallet.classicAddress,
               NFTokenOffers: [nftIndexField.value],
          };

          const tx = await client.submitAndWait(transaction, { wallet });

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               renderTransactionDetails(tx);
               resultField.classList.add('error');
          }

          resultField.innerHTML += `Sell offer canceled successfully.\n\n`;

          renderTransactionDetails(tx);
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
     } finally {
          if (spinner) spinner.style.display = 'none';
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving cancelSellOffer in ${now}ms`);
     }
}

export async function updateNFTMetadata() {
     console.log('Entering updateNFTMetadata');
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

          resultField.innerHTML = `Connected to ${environment} ${net}\nUpdating NFT Metadata\n\n`;

          let wallet;
          if (seed.value.split(' ').length > 1) {
               wallet = xrpl.Wallet.fromMnemonic(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else if (seed.value.includes(',')) {
               const derive_account_with_secret_numbers = derive.secretNumbers(seed.value);
               wallet = xrpl.Wallet.fromSeed(derive_account_with_secret_numbers.secret.familySeed, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          } else {
               wallet = xrpl.Wallet.fromSeed(seed.value, { algorithm: environment === MAINNET ? ed25519_ENCRYPTION : secp256k1_ENCRYPTION });
          }

          const transaction = {
               TransactionType: 'NFTokenModify',
               Account: wallet.classicAddress,
               NFTokenID: nftIdField.value,
               URI: xrpl.convertStringToHex(uriField.value),
          };

          const tx = await client.submitAndWait(transaction, { wallet });

          const resultCode = tx.result.meta.TransactionResult;
          if (resultCode !== TES_SUCCESS) {
               renderTransactionDetails(tx);
               resultField.classList.add('error');
          }

          resultField.innerHTML += `NFT metadata updated successfully.\n\n`;

          renderTransactionDetails(tx);
          resultField.classList.add('success');

          await updateOwnerCountAndReserves(client, wallet.classicAddress, ownerCountField, totalXrpReservesField);
          xrpBalanceField.value = await client.getXrpBalance(wallet.classicAddress);
     } catch (error) {
          console.error('Error:', error);
          setError(`ERROR: ${error.message || 'Unknown error'}`);
     } finally {
          if (spinner) spinner.style.display = 'none';
          const now = Date.now() - startTime;
          totalExecutionTime.value = now;
          console.log(`Leaving updateNFTMetadata in ${now}ms`);
     }
}

export function setNftFlags() {
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
     return flags;
}

export async function displayNftDataForAccount1() {
     accountNameField.value = account1name.value;
     accountAddressField.value = account1address.value;
     if (account1seed.value === EMPTY_STRING) {
          if (account1mnemonic.value === EMPTY_STRING) {
               accountSeedField.value = account1secretNumbers.value;
          } else {
               accountSeedField.value = account1mnemonic.value;
          }
     } else {
          accountSeedField.value = account1seed.value;
     }

     const amountField = document.getElementById('amountField');
     if (validatInput(amountField)) {
          amountField.value = EMPTY_STRING;
     }

     const minterAddressField = document.getElementById('minterAddressField');
     if (validatInput(minterAddressField)) {
          minterAddressField.value = EMPTY_STRING;
     }

     const issuerAddressField = document.getElementById('issuerAddressField');
     if (validatInput(issuerAddressField)) {
          issuerAddressField.value = EMPTY_STRING;
     }

     const expirationField = document.getElementById('expirationField');
     if (validatInput(expirationField)) {
          expirationField.value = EMPTY_STRING;
     }

     const uriField = document.getElementById('uriField');
     if (validatInput(uriField)) {
          uriField.value = EMPTY_STRING;
     }

     const memoField = document.getElementById('memoField');
     if (validatInput(memoField)) {
          memoField.value = EMPTY_STRING;
     }

     const nftCheckboxes = document.querySelectorAll('input[class="nftCheckboxes"]');
     nftCheckboxes.forEach(radio => {
          radio.checked = false;
     });

     getXrpBalance();
     getNFT();
}

export async function displayNftDataForAccount2() {
     accountNameField.value = account2name.value;
     accountAddressField.value = account2address.value;
     if (account2seed.value === EMPTY_STRING) {
          if (account1mnemonic.value === EMPTY_STRING) {
               accountSeedField.value = account2secretNumbers.value;
          } else {
               accountSeedField.value = account2mnemonic.value;
          }
     } else {
          accountSeedField.value = account2seed.value;
     }

     const amountField = document.getElementById('amountField');
     if (validatInput(amountField)) {
          amountField.value = EMPTY_STRING;
     }

     const minterAddressField = document.getElementById('minterAddressField');
     if (validatInput(minterAddressField)) {
          minterAddressField.value = EMPTY_STRING;
     }

     const issuerAddressField = document.getElementById('issuerAddressField');
     if (validatInput(issuerAddressField)) {
          issuerAddressField.value = EMPTY_STRING;
     }

     const expirationField = document.getElementById('expirationField');
     if (validatInput(expirationField)) {
          expirationField.value = EMPTY_STRING;
     }

     const uriField = document.getElementById('uriField');
     if (validatInput(uriField)) {
          uriField.value = EMPTY_STRING;
     }

     const memoField = document.getElementById('memoField');
     if (validatInput(memoField)) {
          memoField.value = EMPTY_STRING;
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
window.disconnectClient = disconnectClient;
window.gatherAccountInfo = gatherAccountInfo;
window.clearFields = clearFields;
window.distributeAccountInfo = distributeAccountInfo;
