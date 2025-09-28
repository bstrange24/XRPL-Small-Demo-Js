import * as xrpl from 'xrpl';

export function getWallets(warm_wallet_seed, hot_wallet_seed, cold_wallet_seed, algo) {
     const cold_wallet = xrpl.Wallet.fromSeed(cold_wallet_seed, { algorithm: algo });
     console.log('Cold wallet address:', cold_wallet.address);

     const hot_wallet = xrpl.Wallet.fromSeed(hot_wallet_seed, { algorithm: algo });
     console.log('Hot wallet address:', hot_wallet.address);

     const warm_wallet = xrpl.Wallet.fromSeed(warm_wallet_seed, { algorithm: algo });
     console.log('Warm wallet address:', warm_wallet.address);
     console.log('\n');
     return { cold_wallet, hot_wallet, warm_wallet };
}
