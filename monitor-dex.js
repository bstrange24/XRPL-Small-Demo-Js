import * as xrpl from 'xrpl';

const NET = 'wss://s.altnet.rippletest.net:51233/';
const CURRENCY = 'DOG';
const ISSUER = 'rETbLUGdjTo2PScLT5xCUZ8ov7B9zHnRqo';
const WALLET_ADDRESS = 'rDTzDGqWyh5myV9Y9mmjhzpc1F5xLBDTSN';
// RLUSD Test net Ripple Issuer
// const RIPPLE_RLUSD_ISSUER = 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV';
// RLUSD Main net Ripple Issuer
const RIPPLE_RLUSD_ISSUER = 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De';

async function main() {
     const client = new xrpl.Client(NET);

     // Handle connection events
     client.on('error', error => {
          console.error('WebSocket error:', error);
     });
     client.on('disconnected', async () => {
          console.log('WebSocket disconnected, reconnecting in 5s...');
          setTimeout(async () => {
               try {
                    await client.connect();
                    console.log('Reconnected to XRPL Testnet');
                    await subscribe();
               } catch (err) {
                    console.error('Reconnection failed:', err);
               }
          }, 5000);
     });
     client.on('connected', () => {
          console.log('Client connected');
     });

     // Subscribe to order books and account
     async function subscribe() {
          try {
               // const response = await client.request({
               // command: 'subscribe',
               // books: [{ taker_gets: { currency: 'XRP' }, taker_pays: { currency: 'RLUSD', issuer: RIPPLE_RLUSD_ISSUER } }],
               // accounts: [hot_wallet.address],
               // });

               const response = await client.request({
                    command: 'subscribe',
                    books: [
                         { taker_gets: { currency: 'DOG', issuer: ISSUER }, taker_pays: { currency: 'XRP' } }, // DOG/XRP
                         { taker_gets: { currency: 'XRP' }, taker_pays: { currency: 'DOG', issuer: ISSUER } }, // XRP/DOG
                    ],
                    accounts: [WALLET_ADDRESS],
               });
               console.log('Subscription response:', response.result);
          } catch (err) {
               console.error('Subscription failed:', err);
          }
     }

     await client.connect();
     console.log('Connected to XRPL Testnet');
     await subscribe();

     // Log raw WebSocket messages
     client.on('message', msg => {
          console.log('Raw WebSocket message:', JSON.stringify(msg, null, 2));
     });

     // Listen for transaction events
     client.on('transaction', tx => {
          // Use tx.tx_json if tx.transaction is undefined
          const transaction = tx.tx_json || tx.transaction;
          if (tx.validated && transaction) {
               const txType = transaction.TransactionType;
               console.log(`[${tx.ledger_index}] ${txType} Transaction:`, {
                    account: transaction.Account,
                    validated: tx.validated,
                    sequence: transaction.Sequence,
                    hash: transaction.hash || tx.hash,
                    details: transaction,
                    meta: tx.meta,
               });

               if (transaction.Account === WALLET_ADDRESS) {
                    if (txType === 'OfferCreate') {
                         console.log('Your OfferCreate:', {
                              sequence: transaction.Sequence,
                              takerGets: transaction.TakerGets,
                              takerPays: transaction.TakerPays,
                              quality: typeof transaction.TakerPays === 'string' ? parseFloat(transaction.TakerPays) / 1_000_000 / parseFloat(transaction.TakerGets.value) : parseFloat(transaction.TakerPays.value) / parseFloat(transaction.TakerGets),
                         });
                         // console.log('Order book update:', {
                         // orderBook: transaction.TakerGets.currency === 'XRP' ? 'XRP/RLUSD' : 'RLUSD/XRP',
                         // price: typeof transaction.TakerPays === 'string' ? parseFloat(transaction.TakerPays) / 1e6 / parseFloat(transaction.TakerGets.value) : parseFloat(transaction.TakerPays.value) / parseFloat(transaction.TakerGets),
                         // amount: parseFloat(transaction.TakerGets.value || xrpl.dropsToXrp(transaction.TakerGets)),
                         // });
                    } else if (txType === 'OfferCancel') {
                         console.log('Your OfferCancel:', {
                              offerSequence: transaction.OfferSequence,
                              hash: transaction.hash || tx.hash,
                              ledger: tx.ledger_index,
                         });
                    }
               }

               // Check order book modifications
               if (tx.meta && tx.meta.AffectedNodes) {
                    tx.meta.AffectedNodes.forEach(node => {
                         const entryType = node.ModifiedNode?.LedgerEntryType || node.DeletedNode?.LedgerEntryType;
                         if (entryType === 'Offer') {
                              console.log('Order book modified:', node);
                         }
                    });
               }
          } else {
               console.log('Unexpected transaction event:', {
                    validated: tx.validated,
                    hasTx: !!transaction,
                    tx: tx,
               });
          }
     });

     // Listen for ledger closes
     client.on('ledgerClosed', ledger => {
          console.log(`Ledger closed: ${ledger.ledger_index}`);
     });

     // Fetch initial state
     try {
          const dogXrpBook = await client.request({
               command: 'book_offers',
               taker_gets: { currency: 'DOG', issuer: ISSUER },
               taker_pays: { currency: 'XRP' },
          });
          console.log('Initial DOG/XRP order book:', dogXrpBook.result.offers);

          const xrpDogBook = await client.request({
               command: 'book_offers',
               taker_gets: { currency: 'XRP' },
               taker_pays: { currency: 'DOG', issuer: ISSUER },
          });
          console.log('Initial XRP/DOG order book:', xrpDogBook.result.offers);

          const accountOffers = await client.request({
               command: 'account_offers',
               account: WALLET_ADDRESS,
          });
          console.log(`Initial open offers for ${WALLET_ADDRESS}:`, accountOffers.result.offers);
     } catch (err) {
          console.error('Error fetching initial state:', err);
     }

     // Log current ledger
     const ledger = await client.request({ command: 'ledger_current' });
     console.log('Current ledger:', ledger.result.ledger_current_index);

     console.log('Listening for order book and account updates... Press Ctrl+C to exit.');
     process.on('SIGINT', async () => {
          console.log('Disconnecting...');
          await client.disconnect();
          console.log('All done.');
          process.exit(0);
     });
}

main().catch(console.error);
