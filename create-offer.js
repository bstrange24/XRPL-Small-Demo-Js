import * as xrpl from 'xrpl';
import { getClient, disconnectClient, validatInput, getEnvironment, populate1, populate2, populate3, parseOffersTransactionDetails} from './utils.js';

 async function createOffer() {
     console.log('Entering createOffer');

     // Clear previous error styling
     resultField.classList.remove("error");
     resultField.classList.remove("success");

     let takerGets;
     let takerGetsString;
     let takerPays;
     let takerPaysString;

     const accountNameField = document.getElementById('accountNameField');
     const accountAddressField = document.getElementById('accountAddressField');
     const accountSeedField = document.getElementById('accountSeedField');
     const xrpBalanceField = document.getElementById('xrpBalanceField');
     const payCurrencyField = document.getElementById('payCurrencyField');
     const getCurrencyField = document.getElementById('getCurrencyField');
     const payIssuerField = document.getElementById('payIssuerField');
     const getIssuerField = document.getElementById('getIssuerField');
     const payAmountField = document.getElementById('payAmountField');
     const getAmountField = document.getElementById('getAmountField');

     if (!accountNameField || !accountAddressField || !accountSeedField || !xrpBalanceField || !payCurrencyField || !getCurrencyField || !payIssuerField || !getIssuerField || !payAmountField || !getAmountField) {
          resultField.value = 'ERROR: DOM elements not found';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(accountAddressField.value)) {
          resultField.value = 'ERROR: Account Address can not be empty';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(accountSeedField.value)) {
          resultField.value = 'ERROR: Account seed amount can not be empty';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(xrpBalanceField.value)) {
          resultField.value = 'ERROR: XRP amount can not be empty';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(payCurrencyField.value)) {
          resultField.value = 'ERROR: Taker Pays currency can not be empty';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(getCurrencyField.value)) {
          resultField.value = 'ERROR: Taker Gets currency can not be empty';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(payIssuerField.value)) {
          resultField.value = 'ERROR: Pay issuer can not be empty';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(getIssuerField.value)) {
          resultField.value = 'ERROR: Get issuer can not be empty';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(payAmountField.value)) {
          resultField.value = 'ERROR: Pay amount can not be empty';
          resultField.classList.add("error");
          return;
     }

     if (!validatInput(getAmountField.value)) {
          resultField.value = 'ERROR: Get amount can not be empty';
          resultField.classList.add("error");
          return;
     }

     const { environment } = getEnvironment()
     const client = await getClient();

     try {
          let results = `Connected to ${environment}.\nCreating Offer.\n\n`;
          resultField.value = results;
          const wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'secp256k1' });
          results += accountNameField.value + " account address: " + wallet.address + "\n";
          resultField.value = results;

          if (getCurrencyField.value == 'XRP') {
               takerGets = getAmountField.value;
          } else {
               takerGetsString = '{"currency": "' + getCurrencyField.value +'",\n' +
               '"issuer": "' + getIssuerField.value + '",\n' +
               '"value": "' + getAmountField.value + '"}';
               takerGets = JSON.parse(takerGetsString);
          }

          if (payCurrencyField.value == 'XRP') {
               takerPays = payAmountField.value;
          } else {
               takerPaysString = '{"currency": "' + payCurrencyField.value + '",\n' +
                    '"issuer": "' + payIssuerField.value + '",\n' +
                    '"value": "' + payAmountField.value + '"}';
               takerPays = JSON.parse(takerPaysString);
          }

          const prepared = await client.autofill({
               "TransactionType": "OfferCreate",
               "Account": wallet.address,
               "TakerGets": takerGets,
               "TakerPays": takerPays
          });

          const signed = wallet.sign(prepared);
          results += "\nSubmitting transaction....";
          const tx = await client.submitAndWait(signed.tx_blob);
          results  += "\nBalance changes: " + JSON.stringify(xrpl.getBalanceChanges(tx.result.meta), null, 2);
          resultField.value = results;

          xrpBalanceField.value =  (await client.getXrpBalance(wallet.address));
          getOffers();         
     } catch (error) {
          console.error('Error:', error);
          resultField.value = "ERROR: " + error.message || 'Unknown error';
          resultField.classList.add("error");
          await disconnectClient();
     } finally {
          console.log('Leaving createOffer');
     } 
  
}

async function getOffers() {
     console.log('Entering getOffers');

     // Clear previous error styling
     resultField.classList.remove("error");
     resultField.classList.remove("success");

     const accountSeedField = document.getElementById('accountSeedField');

     if (!accountSeedField) {
          console.error('DOM elements not found');
          return;
     }

     const { environment } = getEnvironment()
     const client = await getClient();
     
     try {
          let results = `Connected to ${environment}.\n*** Getting Offers ***.\n\n`;
          const wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'secp256k1' });
          results += accountNameField.value + " account: " + wallet.address + "\n";

          try {
               const offers = await client.request({
                    method: "account_offers",
                    account: wallet.address,
                    ledger_index: "validated"
               });
               results += parseOffersTransactionDetails(offers.result.offers);
          } catch (err) {
               results += err;
          }
          resultField.value = results;
     } catch (error) {
          console.error('Error:', error);
          resultField.value = "ERROR: " + error.message || 'Unknown error';
          resultField.classList.add("error");
          await disconnectClient();
     } finally {
          console.log('Leaving getOffers');
     } 
}

async function cancelOffer() {
     console.log('Entering cancelOffer');

     // Clear previous error styling
     resultField.classList.remove("error");
     resultField.classList.remove("success");

     const accountSeedField = document.getElementById('accountSeedField');
     const xrpBalanceField = document.getElementById('xrpBalanceField');

     if (!accountSeedField || !xrpBalanceField) {
          console.error('DOM elements not found');
          return;
     }

     if (!validatInput(accountSeedField.value)) {
          alert('Account seed can not be empty');
          return;
     }

     if (!validatInput(xrpBalanceField.value)) {
          alert('Xrp balance amount can not be empty');
          return;
     }

     const { environment } = getEnvironment()
     const client = await getClient();

     try {
          let results = `Connected to ${environment}.\nCancel Offers.\n\n`;
          resultField.value = results;
        
          const wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'secp256k1' })
          results += "wallet.address: " + wallet.address;
          resultField.value = results;

          /* OfferSequence is the Seq value when you getOffers. */
          const prepared = await client.autofill({
               "TransactionType": "OfferCancel",
               "Account": wallet.address,
               "OfferSequence": parseInt(offerSequenceField.value)
          })

          const signed = wallet.sign(prepared)
          const tx = await client.submitAndWait(signed.tx_blob)
      
          results  += "\nBalance changes: \n" + JSON.stringify(xrpl.getBalanceChanges(tx.result.meta), null, 2)
          resultField.value = results
          xrpBalanceField.value =  (await client.getXrpBalance(wallet.address))
     } catch (error) {
          console.error('Error:', error);
          resultField.value = "ERROR: " + error.message || 'Unknown error';
          resultField.classList.add("error");
          await disconnectClient();
     } finally {
          console.log('Leaving cancelOffer');
     } 
}

async function getOrderBook() {
     console.log('Entering getOrderBook');
     
     // Clear previous error styling
     resultField.classList.remove("error");
     resultField.classList.remove("success");
     
     let takerGets;
     let takerPays;
     
     const accountNameField = document.getElementById('accountNameField');
     const accountAddressField = document.getElementById('accountAddressField');
     const accountSeedField = document.getElementById('accountSeedField');
     const xrpBalanceField = document.getElementById('xrpBalanceField');
     const payCurrencyField = document.getElementById('payCurrencyField');
     const getCurrencyField = document.getElementById('getCurrencyField');
     const payIssuerField = document.getElementById('payIssuerField');
     const getIssuerField = document.getElementById('getIssuerField');
     const payAmountField = document.getElementById('payAmountField');
     const getAmountField = document.getElementById('getAmountField');
     
     if (!accountNameField || !accountAddressField || !accountSeedField || !xrpBalanceField || !payCurrencyField || !getCurrencyField
          || !payIssuerField || !getIssuerField || !payAmountField || !getAmountField) {
          resultField.value = 'ERROR: DOM elements not found';
          resultField.classList.add("error");
          return;
     }
     
     if (!validatInput(accountAddressField.value)) {
          resultField.value = 'ERROR: Account Address can not be empty';
          resultField.classList.add("error");
          return;
     }
     
     if (!validatInput(accountSeedField.value)) {
          resultField.value = 'ERROR: Account seed amount can not be empty';
          resultField.classList.add("error");
          return;
     }
     
     if (!validatInput(xrpBalanceField.value)) {
          resultField.value = 'ERROR: XRP amount can not be empty';
          resultField.classList.add("error");
          return;
     }
     
     if (!validatInput(payCurrencyField.value)) {
          resultField.value = 'ERROR: Taker Pays currency can not be empty';
          resultField.classList.add("error");
          return;
     }
     
     if (!validatInput(getCurrencyField.value)) {
          resultField.value = 'ERROR: Taker Gets currency can not be empty';
          resultField.classList.add("error");
          return;
     }
     
     if (!validatInput(payIssuerField.value)) {
          resultField.value = 'ERROR: Pay issuer can not be empty';
          resultField.classList.add("error");
          return;
     }
     
     if (!validatInput(getIssuerField.value)) {
          resultField.value = 'ERROR: Get issuer can not be empty';
          resultField.classList.add("error");
          return;
     }
     
     if (!validatInput(payAmountField.value)) {
          resultField.value = 'ERROR: Pay amount can not be empty';
          resultField.classList.add("error");
          return;
     }
     
     if (!validatInput(getAmountField.value)) {
          resultField.value = 'ERROR: Get amount can not be empty';
          resultField.classList.add("error");
          return;
     }
     
     const { environment } = getEnvironment();
     const client = await getClient();
     
     try {
          let results = `Connected to ${environment}.\nGet Order Book.\n\n`;
          const wallet = xrpl.Wallet.fromSeed(accountSeedField.value, { algorithm: 'secp256k1' });
          results += accountNameField.value + " account: " + wallet.address;
     
          // Set takerPays
          if (payCurrencyField.value === 'XRP') {
               takerPays = { currency: "XRP" };
          } else {
               takerPays = {
               currency: payCurrencyField.value,
               issuer: payIssuerField.value,
               value: payAmountField.value
               };
          }

          // Set takerGets
          if (getCurrencyField.value === 'XRP') {
               takerGets = { currency: "XRP" };
          } else {
               takerGets = {
               currency: getCurrencyField.value,
               issuer: getIssuerField.value,
               value: getAmountField.value
               };
          }
     
          results += '\n\n*** Order Book ***\n';
          try {
               const orderBook = await client.request({
                    method: "book_offers",
                    taker: wallet.address,
                    ledger_index: "validated",
                    taker_gets: takerGets,
                    taker_pays: takerPays
               });
               results += JSON.stringify(orderBook, null, 2);
          } catch (err) {
               results += err.message || err;
          }
          resultField.value = results;
     } catch (error) {
          console.error('Error:', error);
          resultField.value = "ERROR: " + error.message || 'Unknown error';
          resultField.classList.add("error");
          await disconnectClient();
     } finally {
          console.log('Leaving getOrderBook');
     }
}

window.createOffer = createOffer;
window.getOffers = getOffers;
window.cancelOffer = cancelOffer;
window.getOrderBook = getOrderBook;
window.populate1 = populate1;
window.populate2 = populate2;
window.populate3 = populate3;