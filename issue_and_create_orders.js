import * as xrpl from 'xrpl';

// Sleep helper
function sleep(ms) {
     return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
     const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233/")
     await client.connect()
     console.log("Connected to XRPL Testnet")

     // Issuer wallet (cold)
     const cold_wallet = xrpl.Wallet.fromSeed("ss3WP7x2gMFatdLXsfjvLcukKhgbp", { algorithm: 'secp256k1' })
     console.log("Cold wallet address:", cold_wallet.address)

     // Static hot wallet (buyer)
     const hot_wallet = xrpl.Wallet.fromSeed("snZHPr5bnZdTFyaMWGXfRk7VDK1cM", { algorithm: 'secp256k1' })
     console.log("Hot wallet address:", hot_wallet.address)

     // Ensure trustline exists
     const trustSetTx = {
     TransactionType: "TrustSet",
     Account: hot_wallet.address,
          LimitAmount: {
               currency: "BOB",
               issuer: cold_wallet.address,
               value: "1000000"
          }
     }
     await client.submitAndWait(trustSetTx, { wallet: hot_wallet })
     console.log("Trustline set.")

     // 🔄 Issue 1000 BOB from cold to hot wallet so we can place sell offers
     const payment = {
          TransactionType: "Payment",
          Account: cold_wallet.address,
          Destination: hot_wallet.address,
          Amount: {
               currency: "BOB",
               issuer: cold_wallet.address,
               value: "1000"
          }
     }
     const result = await client.submitAndWait(payment, { wallet: cold_wallet })
     console.log("Issued 1000 BOB to hot wallet:", result.result.meta.TransactionResult)
     await sleep(1000)

     const amountBOB = 100
     const minPrice = 0.1
     const maxPrice = 2.0
     const step = 0.2

     console.log(`\n=== Placing BUY Offers (XRP → BOB) ===`)
     for (let price = minPrice; price <= maxPrice; price += step) {
          const totalXRP = (amountBOB * price).toFixed(6)
          const takerGets = xrpl.xrpToDrops(totalXRP)
          const takerPays = {
               currency: "BOB",
               issuer: cold_wallet.address,
               value: amountBOB.toString()
          }

          const offer = {
               TransactionType: "OfferCreate",
               Account: hot_wallet.address,
               TakerGets: takerGets, // Pay XRP
               TakerPays: takerPays, // Receive BOB
               Flags: 0
          }

          try {
               const res = await client.submitAndWait(offer, { wallet: hot_wallet })
               console.log(`Buy: ${amountBOB} BOB @ ${price.toFixed(2)} XRP/BOB → ${res.result.meta.TransactionResult}`)
          } catch (err) {
               console.error(`Buy offer failed at ${price.toFixed(2)} XRP/BOB:`, err.message)
          }
          await sleep(1000)
     }

     console.log(`\n=== Placing SELL Offers (BOB → XRP) ===`)
     for (let price = minPrice; price <= maxPrice; price += step) {
          const takerGets = {
               currency: "BOB",
               issuer: cold_wallet.address,
               value: amountBOB.toString()
          }
          const totalXRP = (amountBOB * price).toFixed(6)
          const takerPays = xrpl.xrpToDrops(totalXRP)

          const offer = {
               TransactionType: "OfferCreate",
               Account: hot_wallet.address,
               TakerGets: takerGets, // Pay BOB
               TakerPays: takerPays, // Receive XRP
               Flags: 0
          }

          try {
               const res = await client.submitAndWait(offer, { wallet: hot_wallet })
               console.log(`Sell: ${amountBOB} BOB @ ${price.toFixed(2)} XRP/BOB → ${res.result.meta.TransactionResult}`)
          } catch (err) {
               console.error(`Sell offer failed at ${price.toFixed(2)} XRP/BOB:`, err.message)
          }
          await sleep(1000)
     }

     await client.disconnect()
     console.log("All done.")
}

main().catch(console.error)


// Attempt 2
// import * as xrpl from 'xrpl';

// // Utility: Delay in milliseconds
// function sleep(ms) {
//   return new Promise(resolve => setTimeout(resolve, ms))
// }

// async function main() {
//   const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233/")
//   await client.connect()
//   console.log("Connected to XRPL Testnet")

//   // Cold wallet (issuer)
//   const cold_wallet = xrpl.Wallet.fromSeed("ssTRuvTNFdi1k9TTZPQMt9uZPAfyh", { algorithm: 'secp256k1' })
//   console.log("Cold wallet address:", cold_wallet.address)

//   // Static hot wallet (buyer)
//   const hot_wallet = xrpl.Wallet.fromSeed("ssmCGumsMuGPcSqhRWLRUk9PAEcxH", { algorithm: 'secp256k1' })
//   console.log("Hot wallet address:", hot_wallet.address)

//   // Ensure trustline exists
//   const trustSetTx = {
//     "TransactionType": "TrustSet",
//     "Account": hot_wallet.address,
//     "LimitAmount": {
//       "currency": "BOB",
//       "issuer": cold_wallet.address,
//       "value": "1000000"
//     }
//   }
//   await client.submitAndWait(trustSetTx, { wallet: hot_wallet })
//   console.log("Trustline set.")

//   // Buy 100 BOB at varying prices (e.g., 0.1 to 2.0 XRP per BOB)
//   const amountBOB = 100
//   const minPrice = 0.1
//   const maxPrice = 2.0
//   const step = 0.2

//   console.log(`Placing buy offers for ${amountBOB} BOB at price range ${minPrice}–${maxPrice} XRP/BOB`)

//   for (let price = minPrice; price <= maxPrice; price += step) {
//     const totalXRP = (amountBOB * price).toFixed(6)
//     const takerPays = {
//       currency: "BOB",
//       value: amountBOB.toString(),
//       issuer: cold_wallet.address
//     }
//     const takerGets = xrpl.xrpToDrops(totalXRP)

//     const offerTx = {
//       TransactionType: "OfferCreate",
//       Account: hot_wallet.address,
//       TakerGets: takerGets, // what you're paying (XRP)
//       TakerPays: takerPays, // what you're receiving (BOB)
//       Flags: 0
//     }

//     try {
//       const response = await client.submitAndWait(offerTx, { wallet: hot_wallet })
//       const txResult = response.result.meta.TransactionResult
//       console.log(`Buy offer: ${amountBOB} BOB @ ${price.toFixed(2)} XRP/BOB — Result: ${txResult}`)
//     } catch (error) {
//       console.error(`Error placing offer at ${price.toFixed(2)} XRP/BOB:`, error.message)
//     }

//     await sleep(1000) // 1 second delay
//   }

//   await client.disconnect()
//   console.log("Finished.")
// }

// main().catch(console.error)


// Attempt 1
// async function main() {
//     const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233/")
//     await client.connect()
//     console.log("Connected to XRPL Testnet")

//     // Cold wallet (issuer)
//     const cold_wallet = xrpl.Wallet.fromSeed("sni3iUX4GuCGA2GhdhQszDcBEg1wB", { algorithm: 'secp256k1' })
//     console.log("Cold wallet address:", cold_wallet.address)

//     // Hot wallet (receiver/seller of BOB)
//     const hot_wallet = xrpl.Wallet.fromSeed("ss6YdnwioE7cs4vSRo8kyxn1oRTB3", { algorithm: 'secp256k1' })
//     console.log("Hot wallet address:", hot_wallet.address)
//     console.log("Hot wallet seed:", hot_wallet.seed)

//     // Enable default ripple on cold wallet
//     const settingsTx = {
//       "TransactionType": "AccountSet",
//       "Account": cold_wallet.address,
//       "SetFlag": xrpl.AccountSetAsfFlags.asfDefaultRipple
//     }
//     await client.submitAndWait(settingsTx, { wallet: cold_wallet })

//     // Set trustline from hot wallet
//     const trustSetTx = {
//       "TransactionType": "TrustSet",
//       "Account": hot_wallet.address,
//       "LimitAmount": {
//         "currency": "BOB",
//         "issuer": cold_wallet.address,
//         "value": "1000000"
//       }
//     }
//     await client.submitAndWait(trustSetTx, { wallet: hot_wallet })

//     // Issue BOB from cold to hot wallet
//     const paymentTx = {
//       "TransactionType": "Payment",
//       "Account": cold_wallet.address,
//       "Destination": hot_wallet.address,
//       "Amount": {
//         "currency": "BOB",
//         "issuer": cold_wallet.address,
//         "value": "1000000"
//       }
//     }
//     await client.submitAndWait(paymentTx, { wallet: cold_wallet })
//     console.log("Issued 1,000,000 BOB to hot wallet.")

//     // Place multiple sell offers at different BOB/XRP prices
//     console.log("Placing sell offers at multiple price tiers...")
//     const amountBOB = 100
//     const minPrice = 0.1
//     const maxPrice = 2.0
//     const step = 0.1

//     for (let price = minPrice; price <= maxPrice; price += step) {
//       const takerGets = {
//         currency: "BOB",
//         value: amountBOB.toFixed(0),
//         issuer: cold_wallet.address
//       }
//       const takerPays = xrpl.xrpToDrops((amountBOB / price).toFixed(6)) // convert to drops

//       const offerTx = {
//         TransactionType: "OfferCreate",
//         Account: hot_wallet.address,
//         TakerGets: takerGets,
//         TakerPays: takerPays,
//         Flags: 0
//       }

//       const response = await client.submitAndWait(offerTx, { wallet: hot_wallet })
//       const txResult = response.result.meta.TransactionResult
//       console.log(`Placed offer: Sell ${amountBOB} BOB @ ${price.toFixed(1)} BOB/XRP — Result: ${txResult}`)
//     }

//     await client.disconnect()
//     console.log("Done.")
//   }

//   main().catch(console.error)