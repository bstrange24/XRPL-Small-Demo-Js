import * as xrpl from 'xrpl';

async function main() {
    const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233/")
    await client.connect()
    console.log("Connected to XRPL Testnet")
  
    // Cold wallet (issuer)
    const cold_wallet = xrpl.Wallet.fromSeed("sni3iUX4GuCGA2GhdhQszDcBEg1wB", { algorithm: 'secp256k1' })
    console.log("Cold wallet address:", cold_wallet.address)
  
    // Hot wallet (receiver/seller of BOB)
    const hot_wallet = (await client.fundWallet()).wallet;
    console.log("Hot wallet address:", hot_wallet.address)
    console.log("Hot wallet seed:", hot_wallet.seed)
  
    // Enable default ripple on cold wallet
    const settingsTx = {
      "TransactionType": "AccountSet",
      "Account": cold_wallet.address,
      "SetFlag": xrpl.AccountSetAsfFlags.asfDefaultRipple
    }
    await client.submitAndWait(settingsTx, { wallet: cold_wallet })
  
    // Set trustline from hot wallet
    const trustSetTx = {
      "TransactionType": "TrustSet",
      "Account": hot_wallet.address,
      "LimitAmount": {
        "currency": "BOB",
        "issuer": cold_wallet.address,
        "value": "1000000"
      }
    }
    await client.submitAndWait(trustSetTx, { wallet: hot_wallet })
  
    // Issue BOB from cold to hot wallet
    const paymentTx = {
      "TransactionType": "Payment",
      "Account": cold_wallet.address,
      "Destination": hot_wallet.address,
      "Amount": {
        "currency": "BOB",
        "issuer": cold_wallet.address,
        "value": "1000000"
      }
    }
    await client.submitAndWait(paymentTx, { wallet: cold_wallet })
    console.log("Issued 1,000,000 BOB to hot wallet.")
  
    // Place multiple sell offers at different BOB/XRP prices
    console.log("Placing sell offers at multiple price tiers...")
    const amountBOB = 100
    const minPrice = 0.1
    const maxPrice = 2.0
    const step = 0.1
  
    for (let price = minPrice; price <= maxPrice; price += step) {
      const takerGets = {
        currency: "BOB",
        value: amountBOB.toFixed(0),
        issuer: cold_wallet.address
      }
      const takerPays = xrpl.xrpToDrops((amountBOB / price).toFixed(6)) // convert to drops
  
      const offerTx = {
        TransactionType: "OfferCreate",
        Account: hot_wallet.address,
        TakerGets: takerGets,
        TakerPays: takerPays,
        Flags: 0
      }
  
      const response = await client.submitAndWait(offerTx, { wallet: hot_wallet })
      const txResult = response.result.meta.TransactionResult
      console.log(`Placed offer: Sell ${amountBOB} BOB @ ${price.toFixed(1)} BOB/XRP — Result: ${txResult}`)
    }
  
    await client.disconnect()
    console.log("Done.")
  }
  
  main().catch(console.error)