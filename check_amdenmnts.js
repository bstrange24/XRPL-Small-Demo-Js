import * as xrpl from 'xrpl';

async function checkAmendment(amendmentId) {
     try {
          // Connect to the XRPL Devnet
          const client = new xrpl.Client('wss://s.devnet.rippletest.net:51233');
          await client.connect();

          // Request server_info
          console.log('Fetching server_info...');
          const serverInfo = await client.request({
               command: 'server_info',
          });
          const amendments = serverInfo.result.info.validated_ledger?.amendments || [];
          const ledgerIndex = serverInfo.result.info.validated_ledger?.ledger_index;
          console.log('Server Info - Amendments:', amendments.length > 0 ? amendments : 'No amendments active');
          console.log('Server Info - Validated Ledger Index:', ledgerIndex || 'undefined');
          console.log('Server Version:', serverInfo.result.info.build_version);

          // Request ledger for additional confirmation
          console.log('\nFetching current ledger...');
          const ledgerInfo = await client.request({
               command: 'ledger',
               ledger_index: 'current',
               expand: true,
          });
          const ledgerAmendments = ledgerInfo.result.ledger.amendments || [];
          console.log('Ledger - Amendments:', ledgerAmendments.length > 0 ? ledgerAmendments : 'No amendments active');
          console.log('Ledger - Index:', ledgerInfo.result.ledger.ledger_index);

          // Disconnect
          await client.disconnect();
     } catch (error) {
          console.error('Error:', error);
     }
}

// Example: Check for a specific amendment (replace with actual amendment ID)
const amendmentId = '157D2D480E006395B76F0377D1C3A714A5995B23C9FD3A830B4E3D7C43A8B376'; // Example amendment ID
checkAmendment(amendmentId);
