import * as xrpl from 'xrpl';

const DESTINATION_ADDRESS = 'rDTiHvwyxrnBwResdePxYNs8mQ7j8MMuTP';
const WALLET_COUNT = 5;

async function createAndDrainWallet(client, index) {
     // Create funded wallet
     const fundResult = await client.fundWallet();
     const wallet = fundResult.wallet;

     console.log(`\nWallet ${index + 1} created:`);
     console.log('  Address:', wallet.address);
     console.log('  Seed:', wallet.seed);

     const balance = await client.getXrpBalance(wallet.address);
     console.log(`  Balance: ${balance} XRP`);

     const fee = '1200000'; // Reserve for tx fee
     const dropsToSend = (parseFloat(balance) * 1_000_000 - parseInt(fee)).toFixed(0); // in drops

     const tx = {
          TransactionType: 'Payment',
          Account: wallet.address,
          Destination: DESTINATION_ADDRESS,
          Amount: dropsToSend.toString(),
          Fee: fee,
     };

     const prepared = await client.autofill(tx);
     const signed = wallet.sign(prepared);
     const result = await client.submitAndWait(signed.tx_blob);

     console.log(`  Sent ${dropsToSend} drops to ${DESTINATION_ADDRESS}`);
     console.log('  TX result:', result.result.meta.TransactionResult);
     console.log('  Explorer:', `https://testnet.xrpl.org/transactions/${signed.hash}`);
}

function dateFormatter() {
     // Format the date in EST (America/New_York handles EST/EDT automatically)
     return new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York', // EST/EDT
          timeZoneName: 'short', // Includes EST or EDT
          year: 'numeric',
          month: 'numeric',
          day: 'numeric', // day: '2-digit',
          hour: 'numeric', // hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true, // Use 24-hour format; set to true for 12-hour with AM/PM
          // fractionalSecondDigits: 3, // Include milliseconds (3 digits)
     });
}

export function convertXRPLTime(rippleTime) {
     // Convert Ripple time (seconds since Jan 1, 2000) to UTC datetime
     const rippleEpoch = 946684800; // Jan 1, 2000 in Unix time
     const date = new Date((rippleTime + rippleEpoch) * 1000);
     const formatter = dateFormatter();
     return formatter.format(date);
}

export function addTime(amount, unit = 'seconds', date = new Date()) {
     const multiplierMap = {
          seconds: 1,
          minutes: 60,
          hours: 3600,
          days: 86400,
     };

     const multiplier = multiplierMap[unit.toLowerCase()];
     if (!multiplier) {
          throw new Error(`Invalid unit: ${unit}. Use 'seconds', 'minutes', 'hours', or 'days'.`);
     }

     const addedSeconds = amount * multiplier;
     const unixTimestamp = Math.floor(date.getTime() / 1000) + addedSeconds;

     // Convert from Unix Epoch (1970) to Ripple Epoch (2000)
     const rippleEpoch = unixTimestamp - 946684800;
     return rippleEpoch;
}

async function main() {
     const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233');
     await client.connect();

     for (let i = 0; i < WALLET_COUNT; i++) {
          try {
               await createAndDrainWallet(client, i);
          } catch (err) {
               console.error(`Error on wallet ${i + 1}:`, err);
          }
     }

     await client.disconnect();
     // console.log('Seconds: ' + convertXRPLTime(802276515));
     // console.log('Seconds: ' + convertXRPLTime(addTime(10, 'seconds')));
     // console.log('Mins: ' + convertXRPLTime(802276623));
     // console.log('Hours: ' + convertXRPLTime(802283161));
     // console.log('Days: ' + convertXRPLTime(802362361));
     console.log('\n All done.');
}

main().catch(console.error);

// const DESTINATION_ADDRESS = 'rNh6WUEkBPsggrp8cmW3g6A89fs4e65Trq';

// async function main() {
//   const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233');
//   await client.connect();

//   // Create new funded testnet wallet
//   console.log("Generating funded wallet");
//   const fundResult = await client.fundWallet();
//   const wallet = fundResult.wallet;

//   console.log("Wallet created:");
//   console.log("Address:", wallet.address);
//   console.log("Seed:", wallet.seed);

//   // Fetch balance
//   const balance = await client.getXrpBalance(wallet.address);
//   console.log("XRP Balance:", balance);

//   // Calculate amount to send (minus fee buffer)
//   const fee = "1200000"; // drops
//   const dropsToSend = (parseFloat(balance) * 1_000_000 - parseInt(fee)).toFixed(0); // in drops

//   // Prepare payment transaction
//   const tx = {
//     TransactionType: "Payment",
//     Account: wallet.address,
//     Destination: DESTINATION_ADDRESS,
//     Amount: dropsToSend.toString(),
//     Fee: fee,
//   };

//   const prepared = await client.autofill(tx);
//   const signed = wallet.sign(prepared);
//   const result = await client.submitAndWait(signed.tx_blob);

//   console.log("Transaction result:", result.result.meta.TransactionResult);
//   console.log("Explorer link:", `https://testnet.xrpl.org/transactions/${signed.hash}`);

//   await client.disconnect();
// }

// main().catch(console.error);
