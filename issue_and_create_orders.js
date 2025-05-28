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
     const cold_wallet = xrpl.Wallet.fromSeed("ss17VgF7xf6qt3JSPodNZwBhL8i8N", { algorithm: 'secp256k1' })
     console.log("Cold wallet address:", cold_wallet.address)

     // Static hot wallet (buyer)
     const hot_wallet = xrpl.Wallet.fromSeed("ssBUTCsCNhpknBjTGaWPrjBsvU1TJ", { algorithm: 'secp256k1' })
     console.log("Hot wallet address:", hot_wallet.address)

     // // Ensure trustline exists
     // const trustSetTx = {
     // TransactionType: "TrustSet",
     // Account: hot_wallet.address,
     //      LimitAmount: {
     //           currency: "BOB",
     //           issuer: cold_wallet.address,
     //           value: "1000000"
     //      }
     // }
     // await client.submitAndWait(trustSetTx, { wallet: hot_wallet })
     // console.log("Trustline set.")

     // // Issue 100000 BOB from cold to hot wallet so we can place sell offers
     // const payment = {
     //      TransactionType: "Payment",
     //      Account: cold_wallet.address,
     //      Destination: hot_wallet.address,
     //      Amount: {
     //           currency: "BOB",
     //           issuer: cold_wallet.address,
     //           value: "100000"
     //      }
     // }
     // const result = await client.submitAndWait(payment, { wallet: cold_wallet })
     // console.log("Issued 100000 BOB to hot wallet:", result.result.meta.TransactionResult)
     // await sleep(1000)

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

          const hotWalletOffers = await client.request({
               command: "account_offers",
               account: hot_wallet.address
          })
          console.log("Offers placed by hot wallet:", hotWalletOffers.result.offers)

          const coldWalletOffers = await client.request({
               command: "account_offers",
               account: cold_wallet.address
          })
          console.log("Offers placed by cold wallet:", coldWalletOffers.result.offers)

          await client.disconnect()
          console.log("All done.")
}

main().catch(console.error)
