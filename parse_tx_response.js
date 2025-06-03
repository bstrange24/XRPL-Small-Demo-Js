#!/usr/bin/env node

const formatXRPLAmount = value => {
     if (typeof value === 'object' && value.currency && value.value) {
          return `${value.value} ${value.currency}${value.issuer ? ` (Issuer: ${value.issuer})` : ''}`;
     }
     return `${(parseInt(value) / 1000000).toFixed(6)} XRP`;
};

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

export function convertToEstTime(UtcDataTime) {
     const utcDate = new Date(UtcDataTime);
     const formatter = dateFormatter();
     console.log(utcDate);
     return formatter.format(utcDate);
}

// Decode hex string to ASCII
const decodeHex = hex => {
     try {
          return Buffer.from(hex, 'hex').toString('ascii');
     } catch (error) {
          console.error(`Error decoding hex: ${hex}`, error);
          return hex; // Return raw hex if decoding fails
     }
};

const convertXRPLTime = rippleTime => {
     const rippleEpoch = 946684800; // Jan 1, 2000 in Unix time
     const date = new Date((rippleTime + rippleEpoch) * 1000);
     const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York', // EST/EDT
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true, // Use 24-hour format; set to true for 12-hour with AM/PM
          timeZoneName: 'short', // Includes EST or EDT
     });

     return formatter.format(date);
};

// Comprehensive mapping of LedgerEntryType to relevant fields and their formatting
// const ledgerEntryTypeFields_Printing_NA = {
//      AccountRoot: {
//           fields: [
//                { key: 'Account', format: v => v || 'N/A' },
//                { key: 'Balance', format: v => formatXRPLAmount(v || '0') },
//                { key: 'Sequence', format: v => v || 'N/A' },
//                { key: 'OwnerCount', format: v => v || '0' },
//                { key: 'PreviousTxnID', format: v => v || 'N/A' },
//                { key: 'PreviousTxnLgrSeq', format: v => v || 'N/A' },
//                { key: 'Domain', format: v => v || 'N/A' },
//                { key: 'EmailHash', format: v => v || 'N/A' },
//                { key: 'Index', format: v => v || 'N/A' },
//           ],
//           label: 'Account',
//           pluralLabel: 'Accounts',
//      },
//      Escrow: {
//           fields: [
//                { key: 'Account', format: v => v || 'N/A' },
//                { key: 'Amount', format: v => formatXRPLAmount(v || '0') },
//                { key: 'Destination', format: v => v || 'N/A' },
//                { key: 'CancelAfter', format: v => (v ? convertXRPLTime(v) : 'N/A') },
//                { key: 'FinishAfter', format: v => (v ? convertXRPLTime(v) : 'N/A') },
//                { key: 'Condition', format: v => v || 'N/A' },
//                { key: 'PreviousTxnID', format: v => v || 'N/A' },
//                { key: 'PreviousTxnLgrSeq', format: v => v || 'N/A' },
//                { key: 'Index', format: v => v || 'N/A' },
//           ],
//           label: 'Escrow',
//           pluralLabel: 'Escrows',
//      },
//      Offer: {
//           fields: [
//                { key: 'Account', format: v => v || 'N/A' },
//                { key: 'TakerPays', format: v => (typeof v === 'object' ? `${v.value} ${v.currency}` : formatXRPLAmount(v || '0')) },
//                { key: 'TakerGets', format: v => (typeof v === 'object' ? `${v.value} ${v.currency}` : formatXRPLAmount(v || '0')) },
//                { key: 'Expiration', format: v => (v ? convertXRPLTime(v) : 'N/A') },
//                { key: 'OfferSequence', format: v => v || 'N/A' },
//                { key: 'PreviousTxnID', format: v => v || 'N/A' },
//                { key: 'PreviousTxnLgrSeq', format: v => v || 'N/A' },
//                { key: 'Index', format: v => v || 'N/A' },
//           ],
//           label: 'Offer',
//           pluralLabel: 'Offers',
//      },
//      RippleState: {
//           fields: [
//                { key: 'Balance', format: v => (typeof v === 'object' ? formatXRPLAmount(v) : v || 'N/A') },
//                { key: 'Flags', format: v => v || '0' },
//                { key: 'HighLimit', format: v => (typeof v === 'object' ? formatXRPLAmount(v) : v || 'N/A') },
//                { key: 'HighNode', format: v => v || 'N/A' },
//                { key: 'LedgerEntryType', format: v => v || 'N/A' },
//                { key: 'LowLimit', format: v => (typeof v === 'object' ? formatXRPLAmount(v) : v || 'N/A') },
//                { key: 'LowNode', format: v => v || 'N/A' },
//                { key: 'PreviousTxnID', format: v => v || 'N/A' },
//                { key: 'PreviousTxnLgrSeq', format: v => v || 'N/A' },
//                { key: 'Index', format: v => v || 'N/A' },
//           ],
//           label: 'RippleState',
//           pluralLabel: 'RippleStates',
//      },
//      PayChannel: {
//           fields: [
//                { key: 'Account', format: v => v || 'N/A' },
//                { key: 'Destination', format: v => v || 'N/A' },
//                { key: 'Amount', format: v => formatXRPLAmount(v || '0') },
//                { key: 'Balance', format: v => formatXRPLAmount(v || '0') },
//                { key: 'SettleDelay', format: v => v || 'N/A' },
//                { key: 'Expiration', format: v => (v ? convertXRPLTime(v) : 'N/A') },
//                { key: 'CancelAfter', format: v => (v ? convertXRPLTime(v) : 'N/A') },
//                { key: 'PreviousTxnID', format: v => v || 'N/A' },
//                { key: 'PreviousTxnLgrSeq', format: v => v || 'N/A' },
//                { key: 'Index', format: v => v || 'N/A' },
//           ],
//           label: 'Payment Channel',
//           pluralLabel: 'Payment Channels',
//      },
//      Check: {
//           fields: [
//                { key: 'Account', format: v => v || 'N/A' },
//                { key: 'Destination', format: v => v || 'N/A' },
//                { key: 'SendMax', format: v => (typeof v === 'object' ? `${v.value} ${v.currency}` : formatXRPLAmount(v || '0')) },
//                { key: 'Sequence', format: v => v || 'N/A' },
//                { key: 'PreviousTxnID', format: v => v || 'N/A' },
//                { key: 'PreviousTxnLgrSeq', format: v => v || 'N/A' },
//                { key: 'Index', format: v => v || 'N/A' },
//           ],
//           label: 'Check',
//           pluralLabel: 'Checks',
//      },
//      DepositPreauth: {
//           fields: [
//                { key: 'Account', format: v => v || 'N/A' },
//                { key: 'Authorize', format: v => v || 'N/A' },
//                { key: 'PreviousTxnID', format: v => v || 'N/A' },
//                { key: 'PreviousTxnLgrSeq', format: v => v || 'N/A' },
//                { key: 'Index', format: v => v || 'N/A' },
//           ],
//           label: 'Deposit Preauthorization',
//           pluralLabel: 'Deposit Preauthorizations',
//      },
//      Ticket: {
//           fields: [
//                { key: 'Account', format: v => v || 'N/A' },
//                { key: 'TicketSequence', format: v => v || 'N/A' },
//                { key: 'PreviousTxnID', format: v => v || 'N/A' },
//                { key: 'PreviousTxnLgrSeq', format: v => v || 'N/A' },
//                { key: 'Index', format: v => v || 'N/A' },
//           ],
//           label: 'Ticket',
//           pluralLabel: 'Tickets',
//      },
//      DirectoryNode: {
//           fields: [
//                { key: 'Owner', format: v => v || 'N/A' },
//                { key: 'Indexes', format: v => (Array.isArray(v) ? v.join(', ') : v || 'N/A') },
//                { key: 'PreviousTxnID', format: v => v || 'N/A' },
//                { key: 'PreviousTxnLgrSeq', format: v => v || 'N/A' },
//                { key: 'Index', format: v => v || 'N/A' },
//           ],
//           label: 'Directory',
//           pluralLabel: 'Directories',
//      },
//      AMM: {
//           fields: [
//                { key: 'Asset1', format: v => `${v.currency} (Issuer: ${v.issuer || 'N/A'})` },
//                { key: 'Asset2', format: v => `${v.currency} (Issuer: ${v.issuer || 'N/A'})` },
//                { key: 'LPTokenBalance', format: v => `${v.value} ${v.currency}` },
//                { key: 'TradingFee', format: v => v || 'N/A' },
//                { key: 'PreviousTxnID', format: v => v || 'N/A' },
//                { key: 'PreviousTxnLgrSeq', format: v => v || 'N/A' },
//                { key: 'Index', format: v => v || 'N/A' },
//           ],
//           label: 'Automated Market Maker',
//           pluralLabel: 'Automated Market Makers',
//      },
//      NFTokenPage: {
//           fields: [
//                { key: 'Flags', format: v => v || '0' },
//                { key: 'LedgerEntryType', format: v => v || 'N/A' },
//                { key: 'NFTokens', format: v => (Array.isArray(v) ? v : 'N/A') },
//                { key: 'Index', format: v => v || 'N/A' },
//           ],
//           label: 'NFTokenPage',
//           pluralLabel: 'NFTokenPages',
//      },
//      SignerList: {
//           fields: [
//                { key: 'SignerQuorum', format: v => v || 'N/A' },
//                { key: 'SignerEntries', format: v => (Array.isArray(v) ? v.map(e => e.SignerEntry.Account).join(', ') : 'N/A') },
//                { key: 'PreviousTxnID', format: v => v || 'N/A' },
//                { key: 'PreviousTxnLgrSeq', format: v => v || 'N/A' },
//                { key: 'Index', format: v => v || 'N/A' },
//           ],
//           label: 'Signer List',
//           pluralLabel: 'Signer Lists',
//      },
//      NFT: {
//           fields: [
//                { key: 'Flags', format: v => v || '0' },
//                { key: 'Issuer', format: v => v || 'N/A' },
//                { key: 'NFTokenID', format: v => v || 'N/A' },
//                { key: 'NFTokenTaxon', format: v => (v === 0 ? 'N/A' : v || 'N/A') },
//                { key: 'URI', format: v => v || 'N/A' },
//                { key: 'nft_serial', format: v => v || 'N/A' },
//           ],
//           label: 'NFT',
//           pluralLabel: 'NFTs',
//      },
// };

const ledgerEntryTypeFields = {
     AccountRoot: {
          fields: [
               { key: 'Account', format: v => v || null },
               { key: 'Balance', format: v => formatXRPLAmount(v || '0') },
               { key: 'Sequence', format: v => v || null },
               { key: 'OwnerCount', format: v => v || '0' },
               { key: 'PreviousTxnID', format: v => v || null },
               { key: 'PreviousTxnLgrSeq', format: v => v || null },
               { key: 'Domain', format: v => v || null },
               { key: 'EmailHash', format: v => v || null },
               { key: 'Index', format: v => v || null },
          ],
          label: 'Account',
          pluralLabel: 'Accounts',
     },
     Escrow: {
          fields: [
               { key: 'Account', format: v => v || null },
               { key: 'Amount', format: v => formatXRPLAmount(v || '0') },
               { key: 'Destination', format: v => v || null },
               { key: 'CancelAfter', format: v => (v ? convertXRPLTime(v) : null) },
               { key: 'FinishAfter', format: v => (v ? convertXRPLTime(v) : null) },
               { key: 'Condition', format: v => v || null },
               { key: 'PreviousTxnID', format: v => v || null },
               { key: 'PreviousTxnLgrSeq', format: v => v || null },
               { key: 'Index', format: v => v || null },
          ],
          label: 'Escrow',
          pluralLabel: 'Escrows',
     },
     Offer: {
          fields: [
               { key: 'Account', format: v => v || null },
               { key: 'TakerPays', format: v => (typeof v === 'object' ? `${v.value} ${v.currency}` : formatXRPLAmount(v || '0')) },
               { key: 'TakerGets', format: v => (typeof v === 'object' ? `${v.value} ${v.currency}` : formatXRPLAmount(v || '0')) },
               { key: 'Expiration', format: v => (v ? convertXRPLTime(v) : null) },
               { key: 'OfferSequence', format: v => v || null },
               { key: 'PreviousTxnID', format: v => v || null },
               { key: 'PreviousTxnLgrSeq', format: v => v || null },
               { key: 'Index', format: v => v || null },
          ],
          label: 'Offer',
          pluralLabel: 'Offers',
     },
     RippleState: {
          fields: [
               { key: 'Balance', format: v => (typeof v === 'object' ? formatXRPLAmount(v) : v || null) },
               { key: 'Flags', format: v => v || '0' },
               { key: 'HighLimit', format: v => (typeof v === 'object' ? formatXRPLAmount(v) : v || null) },
               { key: 'HighNode', format: v => v || null },
               { key: 'LedgerEntryType', format: v => v || null },
               { key: 'LowLimit', format: v => (typeof v === 'object' ? formatXRPLAmount(v) : v || null) },
               { key: 'LowNode', format: v => v || null },
               { key: 'PreviousTxnID', format: v => v || null },
               { key: 'PreviousTxnLgrSeq', format: v => v || null },
               { key: 'Index', format: v => v || null },
          ],
          label: 'RippleState',
          pluralLabel: 'RippleStates',
     },
     PayChannel: {
          fields: [
               { key: 'Account', format: v => v || null },
               { key: 'Destination', format: v => v || null },
               { key: 'Amount', format: v => formatXRPLAmount(v || '0') },
               { key: 'Balance', format: v => formatXRPLAmount(v || '0') },
               { key: 'SettleDelay', format: v => v || null },
               { key: 'Expiration', format: v => (v ? convertXRPLTime(v) : null) },
               { key: 'CancelAfter', format: v => (v ? convertXRPLTime(v) : null) },
               { key: 'PreviousTxnID', format: v => v || null },
               { key: 'PreviousTxnLgrSeq', format: v => v || null },
               { key: 'Index', format: v => v || null },
          ],
          label: 'Payment Channel',
          pluralLabel: 'Payment Channels',
     },
     Check: {
          fields: [
               { key: 'Account', format: v => v || null },
               { key: 'Destination', format: v => v || null },
               { key: 'SendMax', format: v => (typeof v === 'object' ? `${v.value} ${v.currency}` : formatXRPLAmount(v || '0')) },
               { key: 'Sequence', format: v => v || null },
               { key: 'PreviousTxnID', format: v => v || null },
               { key: 'PreviousTxnLgrSeq', format: v => v || null },
               { key: 'Index', format: v => v || null },
          ],
          label: 'Check',
          pluralLabel: 'Checks',
     },
     DepositPreauth: {
          fields: [
               { key: 'Account', format: v => v || null },
               { key: 'Authorize', format: v => v || null },
               { key: 'PreviousTxnID', format: v => v || null },
               { key: 'PreviousTxnLgrSeq', format: v => v || null },
               { key: 'Index', format: v => v || null },
          ],
          label: 'Deposit Preauthorization',
          pluralLabel: 'Deposit Preauthorizations',
     },
     Ticket: {
          fields: [
               { key: 'Account', format: v => v || null },
               { key: 'TicketSequence', format: v => v || null },
               { key: 'PreviousTxnID', format: v => v || null },
               { key: 'PreviousTxnLgrSeq', format: v => v || null },
               { key: 'Index', format: v => v || null },
          ],
          label: 'Ticket',
          pluralLabel: 'Tickets',
     },
     DirectoryNode: {
          fields: [
               { key: 'Owner', format: v => v || null },
               { key: 'Indexes', format: v => (Array.isArray(v) ? v.join(', ') : v || null) },
               { key: 'PreviousTxnID', format: v => v || null },
               { key: 'PreviousTxnLgrSeq', format: v => v || null },
               { key: 'Index', format: v => v || null },
          ],
          label: 'Directory',
          pluralLabel: 'Directories',
     },
     AMM: {
          fields: [
               { key: 'Asset1', format: v => `${v.currency} (Issuer: ${v.issuer || null})` },
               { key: 'Asset2', format: v => `${v.currency} (Issuer: ${v.issuer || null})` },
               { key: 'LPTokenBalance', format: v => `${v.value} ${v.currency}` },
               { key: 'TradingFee', format: v => v || null },
               { key: 'PreviousTxnID', format: v => v || null },
               { key: 'PreviousTxnLgrSeq', format: v => v || null },
               { key: 'Index', format: v => v || null },
          ],
          label: 'Automated Market Maker',
          pluralLabel: 'Automated Market Makers',
     },
     NFTokenPage: {
          fields: [
               { key: 'Flags', format: v => v || '0' },
               { key: 'LedgerEntryType', format: v => v || null },
               { key: 'NFTokens', format: v => (Array.isArray(v) ? v : null) },
               { key: 'Index', format: v => v || null },
          ],
          label: 'NFTokenPage',
          pluralLabel: 'NFTokenPages',
     },
     SignerList: {
          fields: [
               { key: 'SignerQuorum', format: v => v || null },
               { key: 'SignerEntries', format: v => (Array.isArray(v) ? v.map(e => e.SignerEntry.Account).join(', ') : null) },
               { key: 'PreviousTxnID', format: v => v || null },
               { key: 'PreviousTxnLgrSeq', format: v => v || null },
               { key: 'Index', format: v => v || null },
          ],
          label: 'Signer List',
          pluralLabel: 'Signer Lists',
     },
     NFT: {
          fields: [
               { key: 'Flags', format: v => v || '0' },
               { key: 'Issuer', format: v => v || null },
               { key: 'NFTokenID', format: v => v || null },
               { key: 'NFTokenTaxon', format: v => (v === 0 ? null : v || null) },
               { key: 'URI', format: v => v || null },
               { key: 'nft_serial', format: v => v || null },
          ],
          label: 'NFT',
          pluralLabel: 'NFTs',
     },
};

// function parseXRPLResponse_PrintNA(response) {
//      try {
//           // Initialize output array
//           const output = [];

//           // Extract general metadata
//           const ledgerIndex = response.ledger_index || response.ledger_current_index || 'N/A';
//           const ledgerHash = response.ledger_hash || 'N/A';
//           const validated = response.validated || false;

//           // Identify all array fields (e.g., account_objects, account_nfts, affected_nodes)
//           const arrayFields = Object.keys(response).filter(key => Array.isArray(response[key]));
//           console.log(`Array Fields Found: ${arrayFields.join(', ')}`);

//           // Process each array field
//           arrayFields.forEach(field => {
//                const objects = response[field] || [];
//                console.log(`Processing ${field}:`, objects);

//                // Use appropriate header based on field
//                const header = field === 'account_nfts' ? 'Account NFTs' : 'Account Objects';
//                output.push(header);

//                // Group objects by LedgerEntryType
//                const groupedObjects = {};
//                objects.forEach(obj => {
//                     let entryType = obj.LedgerEntryType || (field === 'account_nfts' ? 'NFT' : 'Unknown');
//                     if (field === 'AffectedNodes' && obj.ModifiedNode) {
//                          entryType = obj.ModifiedNode.LedgerEntryType || obj.CreatedNode?.LedgerEntryType || 'Unknown';
//                          obj = { ...obj.ModifiedNode?.FinalFields, ...obj.CreatedNode?.NewFields } || obj;
//                     }
//                     if (!groupedObjects[entryType]) {
//                          groupedObjects[entryType] = [];
//                     }
//                     groupedObjects[entryType].push(obj);
//                });

//                // Process grouped objects
//                let groupIndex = 1;
//                Object.entries(groupedObjects).forEach(([entryType, group], groupIdx) => {
//                     const typeConfig = ledgerEntryTypeFields[entryType] || {
//                          fields: Object.keys(group[0]).map(key => ({
//                               key,
//                               format: v => (typeof v === 'object' && v !== null ? JSON.stringify(v) : v || 'N/A'),
//                          })),
//                          label: entryType || 'Unknown',
//                          pluralLabel: `${entryType}s` || 'Unknowns',
//                     };

//                     // Use singular or plural label based on count
//                     const label = group.length > 1 ? typeConfig.pluralLabel : typeConfig.label;
//                     output.push(`${label} ${groupIndex}`);

//                     if (group.length > 1) {
//                          // For multiple objects, add LedgerEntryType and pluralized container
//                          output.push(`    LedgerEntryType: ${entryType === 'NFT' ? 'NFTs' : typeConfig.pluralLabel}`);
//                          output.push(`    ${typeConfig.pluralLabel}:`);
//                          group.forEach((obj, objIndex) => {
//                               output.push(`        ${typeConfig.label}`);
//                               typeConfig.fields.forEach(field => {
//                                    const value = obj[field.key];
//                                    console.log(`Key: ${field.key}, Value: ${value || 'N/A'}`);
//                                    if (typeof value === 'object' && value !== null) {
//                                         output.push(`            ${field.key}:`);
//                                         Object.entries(value).forEach(([subKey, subValue]) => {
//                                              output.push(`                ${subKey}: ${subValue || 'N/A'}`);
//                                         });
//                                    } else {
//                                         output.push(`            ${field.key}: ${field.format(value)}`);
//                                    }
//                               });
//                          });
//                     } else {
//                          // For single object, list fields directly
//                          group.forEach(obj => {
//                               typeConfig.fields.forEach(field => {
//                                    const value = obj[field.key];
//                                    console.log(`Key: ${field.key}, Value: ${value || 'N/A'}`);
//                                    if (field.key === 'NFTokens' && Array.isArray(value)) {
//                                         output.push(`    ${field.key}:`);
//                                         value.forEach((nft, nftIndex) => {
//                                              output.push(`        NFToken`);
//                                              Object.entries(nft.NFToken).forEach(([subKey, subValue]) => {
//                                                   output.push(`            ${subKey}: ${subValue || 'N/A'}`);
//                                              });
//                                         });
//                                    } else if (typeof value === 'object' && value !== null) {
//                                         output.push(`    ${field.key}:`);
//                                         Object.entries(value).forEach(([subKey, subValue]) => {
//                                              output.push(`        ${subKey}: ${subValue || 'N/A'}`);
//                                         });
//                                    } else {
//                                         output.push(`    ${field.key}: ${field.format(value)}`);
//                                    }
//                               });
//                          });
//                     }
//                     groupIndex += 1;
//                });
//           });

//           // Append general metadata
//           if (ledgerHash !== 'N/A') output.push(`ledger_hash: ${ledgerHash}`);
//           output.push(`ledger_${response.ledger_index ? 'index' : 'current_index'}: ${ledgerIndex}`);
//           output.push(`validated: ${validated}`);

//           return output.join('\n');
//      } catch (error) {
//           console.error('Error parsing XRPL response:', error);
//           return `Error: Failed to parse XRPL response\nDetails: ${error.message}`;
//      }
// }

function parseXRPLResponse(response) {
     try {
          // Initialize output array
          const output = [];

          // Extract general metadata
          const ledgerIndex = response.ledger_index || response.ledger_current_index || 'N/A';
          const ledgerHash = response.ledger_hash || 'N/A';
          const validated = response.validated || false;

          // Identify all array fields (e.g., account_objects, account_nfts)
          const arrayFields = Object.keys(response).filter(key => Array.isArray(response[key]));
          console.log(`Array Fields Found: ${arrayFields.join(', ')}`);

          // Process each array field
          arrayFields.forEach(field => {
               const objects = response[field] || [];
               console.log(`Processing ${field}:`, objects);

               // Use appropriate header based on field
               const header = field === 'account_nfts' ? 'Account NFTs' : 'Account Objects';
               output.push(header);

               // Group objects by LedgerEntryType
               const groupedObjects = {};
               objects.forEach(obj => {
                    let entryType = obj.LedgerEntryType || (field === 'account_nfts' ? 'NFT' : 'Unknown');
                    if (!groupedObjects[entryType]) {
                         groupedObjects[entryType] = [];
                    }
                    groupedObjects[entryType].push(obj);
               });

               // Process grouped objects
               let groupIndex = 1;
               Object.entries(groupedObjects).forEach(([entryType, group]) => {
                    const typeConfig = ledgerEntryTypeFields[entryType] || {
                         fields: Object.keys(group[0]).map(key => ({
                              key,
                              format: v => (typeof v === 'object' && v !== null ? JSON.stringify(v) : v || null),
                         })),
                         label: entryType || 'Unknown',
                         pluralLabel: `${entryType}s` || 'Unknowns',
                    };

                    // Use singular or plural label based on count
                    const label = group.length > 1 ? typeConfig.pluralLabel : typeConfig.label;
                    output.push(`${label} ${groupIndex}`);

                    if (group.length > 1) {
                         // For multiple objects, add LedgerEntryType and pluralized container
                         output.push(`    LedgerEntryType: ${entryType === 'NFT' ? 'NFTs' : typeConfig.pluralLabel}`);
                         output.push(`    ${typeConfig.pluralLabel}:`);
                         group.forEach(obj => {
                              output.push(`        ${typeConfig.label}`);
                              typeConfig.fields.forEach(field => {
                                   const value = obj[field.key];
                                   const formattedValue = field.format(value);
                                   if (formattedValue !== null && formattedValue !== undefined) {
                                        console.log(`Key: ${field.key}, Value: ${value || 'N/A'}`);
                                        if (typeof value === 'object' && value !== null) {
                                             output.push(`            ${field.key}:`);
                                             Object.entries(value).forEach(([subKey, subValue]) => {
                                                  if (subValue !== null && subValue !== undefined) {
                                                       output.push(`                ${subKey}: ${subValue}`);
                                                  }
                                             });
                                        } else {
                                             output.push(`            ${field.key}: ${formattedValue}`);
                                        }
                                   }
                              });
                         });
                    } else {
                         // For single object, list fields directly
                         group.forEach(obj => {
                              typeConfig.fields.forEach(field => {
                                   const value = obj[field.key];
                                   const formattedValue = field.format(value);
                                   if (formattedValue !== null && formattedValue !== undefined) {
                                        console.log(`Key: ${field.key}, Value: ${value || 'N/A'}`);
                                        if (field.key === 'NFTokens' && Array.isArray(value)) {
                                             output.push(`    ${field.key}:`);
                                             value.forEach(nft => {
                                                  output.push(`        NFToken`);
                                                  Object.entries(nft.NFToken).forEach(([subKey, subValue]) => {
                                                       if (subValue !== null && subValue !== undefined) {
                                                            output.push(`            ${subKey}: ${subValue}`);
                                                       }
                                                  });
                                             });
                                        } else if (typeof value === 'object' && value !== null) {
                                             output.push(`    ${field.key}:`);
                                             Object.entries(value).forEach(([subKey, subValue]) => {
                                                  if (subValue !== null && subValue !== undefined) {
                                                       output.push(`        ${subKey}: ${subValue}`);
                                                  }
                                             });
                                        } else {
                                             output.push(`    ${field.key}: ${formattedValue}`);
                                        }
                                   }
                              });
                         });
                    }
                    groupIndex += 1;
               });
          });

          // Append general metadata
          if (ledgerHash !== 'N/A') output.push(`ledger_hash: ${ledgerHash}`);
          output.push(`ledger_${response.ledger_index ? 'index' : 'current_index'}: ${ledgerIndex}`);
          output.push(`validated: ${validated}`);

          return output.join('\n');
     } catch (error) {
          console.error('Error parsing XRPL response:', error);
          return `Error: Failed to parse XRPL response\nDetails: ${error.message}`;
     }
}

// Parse XRPL transaction response
// function parseXRPLTransaction_PrintNA(response) {
//      try {
//           // Initialize output array
//           const output = [];

//           // Extract root-level fields
//           const result = response.result || {};
//           const closeTimeIso = result.close_time_iso || 'N/A';
//           const ctid = result.ctid || 'N/A';
//           const hash = result.hash || 'N/A';
//           const ledgerHash = result.ledger_hash || 'N/A';
//           const ledgerIndex = result.ledger_index || 'N/A';
//           const validated = result.validated || false;

//           // Extract transaction details (tx_json)
//           const txJson = result.tx_json || {};
//           output.push('Transaction Details:');
//           Object.entries(txJson).forEach(([key, value]) => {
//                if (key === 'date') {
//                     output.push(`    ${key}: ${convertXRPLTime(value)}`);
//                } else if (key === 'Fee' || key === 'SendMax') {
//                     output.push(`    ${key}: ${formatXRPLAmount(value || '0')}`);
//                } else if (typeof value === 'object' && value !== null) {
//                     output.push(`    ${key}:`);
//                     Object.entries(value).forEach(([subKey, subValue]) => {
//                          output.push(`        ${subKey}: ${subValue || 'N/A'}`);
//                     });
//                } else {
//                     output.push(`    ${key}: ${value || 'N/A'}`);
//                }
//           });

//           // Extract metadata
//           const meta = result.meta || {};
//           output.push('\nMetadata:');
//           output.push(`    TransactionResult: ${meta.TransactionResult || 'N/A'}`);
//           output.push(`    TransactionIndex: ${meta.TransactionIndex || 'N/A'}`);
//           if (meta.nftoken_id) {
//                output.push(`    nftoken_id: ${meta.nftoken_id}`);
//           }

//           // Process AffectedNodes
//           const affectedNodes = meta.AffectedNodes || [];
//           output.push('\nAffected Nodes:');
//           affectedNodes.forEach((node, nodeIndex) => {
//                output.push(`    Node ${nodeIndex + 1}:`);

//                // Handle ModifiedNode, CreatedNode, or DeletedNode
//                ['ModifiedNode', 'CreatedNode', 'DeletedNode'].forEach(nodeType => {
//                     if (node[nodeType]) {
//                          const nodeData = node[nodeType];
//                          const entryType = nodeData.LedgerEntryType || 'Unknown';
//                          const typeConfig = ledgerEntryTypeFields[entryType] || {
//                               fields: Object.keys(nodeData.FinalFields || nodeData.NewFields || {}).map(key => ({
//                                    key,
//                                    format: v => (typeof v === 'object' && v !== null ? JSON.stringify(v) : v || 'N/A'),
//                               })),
//                               label: entryType,
//                          };

//                          output.push(`        ${nodeType}:`);
//                          output.push(`            LedgerEntryType: ${entryType}`);
//                          output.push(`            LedgerIndex: ${nodeData.LedgerIndex || 'N/A'}`);

//                          // Process FinalFields or NewFields
//                          const fields = nodeData.FinalFields || nodeData.NewFields || {};
//                          output.push(`            FinalFields:`);
//                          typeConfig.fields.forEach(field => {
//                               const value = fields[field.key];
//                               console.log(`Key: ${field.key}, Value: ${value || 'N/A'}`);
//                               if (field.key === 'NFTokens' && Array.isArray(value)) {
//                                    output.push(`                ${field.key}:`);
//                                    value.forEach(nft => {
//                                         output.push(`                    NFToken`);
//                                         Object.entries(nft.NFToken).forEach(([subKey, subValue]) => {
//                                              output.push(`                        ${subKey}: ${subValue || 'N/A'}`);
//                                         });
//                                    });
//                               } else if (typeof value === 'object' && value !== null) {
//                                    output.push(`                ${field.key}:`);
//                                    Object.entries(value).forEach(([subKey, subValue]) => {
//                                         output.push(`                    ${subKey}: ${subValue || 'N/A'}`);
//                                    });
//                               } else {
//                                    output.push(`                ${field.key}: ${field.format ? field.format(value) : value || 'N/A'}`);
//                               }
//                          });

//                          // Process PreviousFields (for ModifiedNode)
//                          if (nodeData.PreviousFields) {
//                               output.push(`            PreviousFields:`);
//                               Object.entries(nodeData.PreviousFields).forEach(([key, value]) => {
//                                    if (key === 'NFTokens' && Array.isArray(value)) {
//                                         output.push(`                ${key}:`);
//                                         value.forEach(nft => {
//                                              output.push(`                    NFToken`);
//                                              Object.entries(nft.NFToken).forEach(([subKey, subValue]) => {
//                                                   output.push(`                        ${subKey}: ${subValue || 'N/A'}`);
//                                              });
//                                         });
//                                    } else if (typeof value === 'object' && value !== null) {
//                                         output.push(`                ${key}:`);
//                                         Object.entries(value).forEach(([subKey, subValue]) => {
//                                              output.push(`                    ${subKey}: ${subValue || 'N/A'}`);
//                                         });
//                                    } else {
//                                         output.push(`                ${key}: ${value || 'N/A'}`);
//                                    }
//                               });
//                          }

//                          // PreviousTxnID and PreviousTxnLgrSeq
//                          output.push(`            PreviousTxnID: ${nodeData.PreviousTxnID || 'N/A'}`);
//                          output.push(`            PreviousTxnLgrSeq: ${nodeData.PreviousTxnLgrSeq || 'N/A'}`);
//                     }
//                });
//           });

//           // Append general metadata
//           output.push('\nGeneral Metadata:');
//           output.push(`    close_time_iso: ${closeTimeIso}`);
//           output.push(`    ctid: ${ctid}`);
//           output.push(`    hash: ${hash}`);
//           output.push(`    ledger_hash: ${ledgerHash}`);
//           output.push(`    ledger_index: ${ledgerIndex}`);
//           output.push(`    validated: ${validated}`);

//           return output.join('\n');
//      } catch (error) {
//           console.error('Error parsing XRPL transaction:', error);
//           return `Error: Failed to parse XRPL transaction\nDetails: ${error.message}`;
//      }
// }

function parseXRPLTransaction(response) {
     try {
          // Initialize output array
          const output = [];

          // Extract root-level fields
          const result = response.result || {};
          const closeTimeIso = result.close_time_iso || null;
          const ctid = result.ctid || null;
          const hash = result.hash || null;
          const ledgerHash = result.ledger_hash || null;
          const ledgerIndex = result.ledger_index || null;
          const validated = result.validated !== undefined ? result.validated : null;

          // Extract transaction details (tx_json)
          const txJson = result.tx_json || {};
          output.push('Transaction Details:');
          Object.entries(txJson).forEach(([key, value]) => {
               if (value !== null && value !== undefined) {
                    let formattedValue;
                    if (key === 'date') {
                         formattedValue = convertXRPLTime(value);
                    } else if (key === 'Fee' || key === 'Amount') {
                         formattedValue = formatXRPLAmount(value || '0');
                    } else if (key === 'CancelAfter' || key === 'FinishAfter') {
                         formattedValue = value ? convertXRPLTime(value) : null;
                    } else if (key === 'Memos' && Array.isArray(value)) {
                         output.push(`    ${key}:`);
                         value.forEach((memoObj, index) => {
                              if (memoObj.Memo) {
                                   const memoType = memoObj.Memo.MemoType ? decodeHex(memoObj.Memo.MemoType) : 'N/A';
                                   const memoData = memoObj.Memo.MemoData ? decodeHex(memoObj.Memo.MemoData) : 'N/A';
                                   output.push(`        Memo ${index + 1}:`);
                                   output.push(`            Type: ${memoType}`);
                                   output.push(`            Data: ${memoData}`);
                              }
                         });
                         return; // Skip adding formattedValue for Memos
                    } else {
                         formattedValue = value;
                    }
                    if (formattedValue !== null && formattedValue !== undefined) {
                         if (typeof value === 'object' && value !== null) {
                              output.push(`    ${key}:`);
                              Object.entries(value).forEach(([subKey, subValue]) => {
                                   if (subValue !== null && subValue !== undefined) {
                                        output.push(`        ${subKey}: ${subValue}`);
                                   }
                              });
                         } else {
                              output.push(`    ${key}: ${formattedValue}`);
                         }
                    }
               }
          });

          // Extract metadata
          const meta = result.meta || {};
          output.push('\nMetadata:');
          if (meta.TransactionResult) output.push(`    TransactionResult: ${meta.TransactionResult}`);
          if (meta.TransactionIndex !== undefined) output.push(`    TransactionIndex: ${meta.TransactionIndex}`);
          if (meta.nftoken_id) output.push(`    nftoken_id: ${meta.nftoken_id}`);

          // Process AffectedNodes
          const affectedNodes = meta.AffectedNodes || [];
          if (affectedNodes.length > 0) {
               output.push('\nAffected Nodes:');
               affectedNodes.forEach((node, nodeIndex) => {
                    output.push(`    Node ${nodeIndex + 1}:`);

                    // Handle ModifiedNode, CreatedNode, or DeletedNode
                    ['ModifiedNode', 'CreatedNode', 'DeletedNode'].forEach(nodeType => {
                         if (node[nodeType]) {
                              const nodeData = node[nodeType];
                              const entryType = nodeData.LedgerEntryType || 'Unknown';
                              const typeConfig = ledgerEntryTypeFields[entryType] || {
                                   fields: Object.keys(nodeData.FinalFields || nodeData.NewFields || {}).map(key => ({
                                        key,
                                        format: v => (typeof v === 'object' && v !== null ? JSON.stringify(v) : v || null),
                                   })),
                                   label: entryType,
                              };

                              output.push(`        ${nodeType}:`);
                              output.push(`            LedgerEntryType: ${entryType}`);
                              if (nodeData.LedgerIndex) output.push(`            LedgerIndex: ${nodeData.LedgerIndex}`);

                              // Process FinalFields or NewFields based on node type
                              let fields;
                              let fieldsLabel = 'FinalFields';
                              if (nodeType === 'CreatedNode' && nodeData.NewFields) {
                                   fields = nodeData.NewFields;
                                   fieldsLabel = 'NewFields';
                              } else if (nodeData.FinalFields) {
                                   fields = nodeData.FinalFields;
                              }
                              if (fields) {
                                   output.push(`            ${fieldsLabel}:`);
                                   typeConfig.fields.forEach(field => {
                                        const value = fields[field.key];
                                        const formattedValue = field.format(value);
                                        if (formattedValue !== null && formattedValue !== undefined) {
                                             console.log(`Key: ${field.key}, Value: ${value || 'N/A'}`);
                                             if (field.key === 'NFTokens' && Array.isArray(value)) {
                                                  output.push(`                ${field.key}:`);
                                                  value.forEach(nft => {
                                                       output.push(`                    NFToken`);
                                                       Object.entries(nft.NFToken).forEach(([subKey, subValue]) => {
                                                            if (subValue !== null && subValue !== undefined) {
                                                                 output.push(`                        ${subKey}: ${subValue}`);
                                                            }
                                                       });
                                                  });
                                             } else if (typeof value === 'object' && value !== null) {
                                                  output.push(`                ${field.key}:`);
                                                  Object.entries(value).forEach(([subKey, subValue]) => {
                                                       if (subValue !== null && subValue !== undefined) {
                                                            output.push(`                    ${subKey}: ${subValue}`);
                                                       }
                                                  });
                                             } else {
                                                  output.push(`                ${field.key}: ${formattedValue}`);
                                             }
                                        }
                                   });
                              }

                              // Process PreviousFields (for ModifiedNode)
                              if (nodeData.PreviousFields) {
                                   const hasPreviousFields = Object.entries(nodeData.PreviousFields).some(([, value]) => value !== null && value !== undefined);
                                   if (hasPreviousFields) {
                                        output.push(`            PreviousFields:`);
                                        Object.entries(nodeData.PreviousFields).forEach(([key, value]) => {
                                             if (value !== null && value !== undefined) {
                                                  if (key === 'NFTokens' && Array.isArray(value)) {
                                                       output.push(`                ${key}:`);
                                                       value.forEach(nft => {
                                                            output.push(`                    NFToken`);
                                                            Object.entries(nft.NFToken).forEach(([subKey, subValue]) => {
                                                                 if (subValue !== null && subValue !== undefined) {
                                                                      output.push(`                        ${subKey}: ${subValue}`);
                                                                 }
                                                            });
                                                       });
                                                  } else if (typeof value === 'object' && value !== null) {
                                                       output.push(`                ${key}:`);
                                                       Object.entries(value).forEach(([subKey, subValue]) => {
                                                            if (subValue !== null && subValue !== undefined) {
                                                                 output.push(`                    ${subKey}: ${subValue}`);
                                                            }
                                                       });
                                                  } else {
                                                       output.push(`                ${key}: ${value}`);
                                                  }
                                             }
                                        });
                                   }
                              }

                              // PreviousTxnID and PreviousTxnLgrSeq
                              if (nodeData.PreviousTxnID) output.push(`            PreviousTxnID: ${nodeData.PreviousTxnID}`);
                              if (nodeData.PreviousTxnLgrSeq) output.push(`            PreviousTxnLgrSeq: ${nodeData.PreviousTxnLgrSeq}`);
                         }
                    });
               });
          }

          // Append general metadata
          output.push('\nGeneral Metadata:');
          if (closeTimeIso) output.push(`    close_time_iso: ${convertToEstTime(closeTimeIso)}`);
          if (ctid) output.push(`    ctid: ${ctid}`);
          if (hash) output.push(`    hash: ${hash}`);
          if (ledgerHash) output.push(`    ledger_hash: ${ledgerHash}`);
          if (ledgerIndex) output.push(`    ledger_index: ${ledgerIndex}`);
          if (validated !== null) output.push(`    validated: ${validated}`);

          return output.join('\n');
     } catch (error) {
          console.error('Error parsing XRPL transaction:', error);
          return `Error: Failed to parse XRPL transaction\nDetails: ${error.message}`;
     }
}
// Sample XRPL response
const nftResponse = {
     account: 'r445P3SQcDEp9tsBEofCF6s9FG9nb99UxX',
     account_nfts: [
          {
               Flags: 8,
               Issuer: 'r445P3SQcDEp9tsBEofCF6s9FG9nb99UxX',
               NFTokenID: '00080000EA75EB92F92645017A74ABFBB9232F5E7422C4C2513BC6800030C7E5',
               NFTokenTaxon: 0,
               URI: '697066733A2F2F6261667962656964663567656B753637357365726C76757463696263356E35666A6E7A7161637634336D6A666372683475723668636E34786B77342E6D657461646174612E6A736F6E',
               nft_serial: 3196901,
          },
          {
               Flags: 8,
               Issuer: 'r445P3SQcDEp9tsBEofCF6s9FG9nb99UxX',
               NFTokenID: '00080000EA75EB92F92645017A74ABFBB9232F5E7422C4C2682197810030C7E6',
               NFTokenTaxon: 0,
               URI: '697066733A2F2F6261667962656964663567656B753637357365726C76757463696263356E35666A6E7A7161637634336D6A666372683475723668636E34786B77342E6D657461646174612E6A736F6E',
               nft_serial: 3196902,
          },
     ],
     ledger_current_index: 3251385,
     validated: false,
};

const sampleResponse = {
     account: 'rNaeAFEos9TFmMgmTDW6Z5WC1Toxc5Vtnr',
     account_objects: [
          {
               Flags: 0,
               LedgerEntryType: 'NFTokenPage',
               NFTokens: [
                    {
                         NFToken: {
                              NFTokenID: '00080000EA75EB92F92645017A74ABFBB9232F5E7422C4C23A55F57F0030C7E4',
                              URI: '68747470733A2F2F6578616D706C652E636F6D2F6E66742D6D657461646174612E6A736F6E',
                         },
                    },
               ],
               PreviousTxnID: '79CADFE8C40EEDBFF65B0DE36348924A2AC6212F0F9D25590B3E3F4D7D60505A',
               PreviousTxnLgrSeq: 3236232,
               index: '8FAB63D43BC0A8F991B1FF925ED05D99C389F775FFFFFFFFFFFFFFFFFFFFFFFF',
          },
          {
               Flags: 0,
               LedgerEntryType: 'NFTokenPage',
               NFTokens: [
                    {
                         NFToken: {
                              NFTokenID: '00080000EA75EB92F92645017A74ABFBB9232F5E7422C4C23A55F57F0030C7E4',
                              URI: '68747470733A2F2F6578616D706C652E636F6D2F6E66742D6D657461646174612E6A736F6E',
                         },
                    },
               ],
               PreviousTxnID: '79CADFE8C40EEDBFF65B0DE36348924A2AC6212F0F9D25590B3E3F4D7D60505A',
               PreviousTxnLgrSeq: 3236232,
               index: '8FAB63D43BC0A8F991B1FF925ED05D99C389F775FFFFFFFFFFFFFFFFFFFFFFFF',
          },
          {
               Balance: {
                    currency: 'TST',
                    issuer: 'rrrrrrrrrrrrrrrrrrrrBZbvji',
                    value: '885.79',
               },
               Flags: 2293760,
               HighLimit: {
                    currency: 'TST',
                    issuer: 'rEXK4xu5LSAc3SGrfqDQ6byLRD6NHfHFiD',
                    value: '100000',
               },
               HighNode: '0',
               LedgerEntryType: 'RippleState',
               LowLimit: {
                    currency: 'TST',
                    issuer: 'rNaeAFEos9TFmMgmTDW6Z5WC1Toxc5Vtnr',
                    value: '1000000',
               },
               LowNode: '0',
               PreviousTxnID: '03711C0853FF18C0B14DC52E40E387C0E44978016B65F22E3D7443039EEEA1C7',
               PreviousTxnLgrSeq: 3199103,
               index: '2C8CB31EAE571476883E8FD20C02859307DD812745FA6D775AC03B30D024F8FE',
          },
     ],
     ledger_hash: '937CD31C0152492C4A3F3D73A1C6DD90DB25E89847D68A508AE76F91EA97230B',
     ledger_index: 3250892,
     validated: true,
};

const escrowResponse = {
     account: 'r445P3SQcDEp9tsBEofCF6s9FG9nb99UxX',
     account_objects: [
          {
               Account: 'r445P3SQcDEp9tsBEofCF6s9FG9nb99UxX',
               Amount: '1260000',
               CancelAfter: 802039751,
               Destination: 'rNaeAFEos9TFmMgmTDW6Z5WC1Toxc5Vtnr',
               DestinationNode: '0',
               FinishAfter: 802029754,
               Flags: 0,
               LedgerEntryType: 'Escrow',
               OwnerNode: '0',
               PreviousTxnID: '9080852E547F860547B54AE8822BD381D966A978F6F575BC516744A5BD2C50C4',
               PreviousTxnLgrSeq: 3251773,
               index: '6DF1FB52D1009D62C4CE90EEC5A3DCA3F346F28440359B9E5768D8B2EE267197',
          },
          {
               Account: 'r445P3SQcDEp9tsBEofCF6s9FG9nb99UxX',
               Amount: '1230000',
               CancelAfter: 802030415,
               Destination: 'rNaeAFEos9TFmMgmTDW6Z5WC1Toxc5Vtnr',
               DestinationNode: '0',
               FinishAfter: 802029420,
               Flags: 0,
               LedgerEntryType: 'Escrow',
               OwnerNode: '0',
               PreviousTxnID: '50F58CFFEA677BD8BE999CDA0BB8D8F36DE89DE729A1D09840E3ADC61C968EB1',
               PreviousTxnLgrSeq: 3251662,
               index: '744706E1F034823E1FED8E890FE55AE7ECD9262674E97C875E4402A04DD382EF',
          },
     ],
     ledger_hash: '5AB807FC6EDFB13E1A47AEF9DCE089DD2AC102E54E02625BA6BA432153ED3994',
     ledger_index: 3251861,
     validated: true,
};

const multiple = {
     account: 'r445P3SQcDEp9tsBEofCF6s9FG9nb99UxX',
     account_objects: [
          {
               Flags: 0,
               LedgerEntryType: 'NFTokenPage',
               NFTokens: [
                    {
                         NFToken: {
                              NFTokenID: '00080000EA75EB92F92645017A74ABFBB9232F5E7422C4C2513BC6800030C7E5',
                              URI: '697066733A2F2F6261667962656964663567656B753637357365726C76757463696263356E35666A6E7A7161637634336D6A666372683475723668636E34786B77342E6D657461646174612E6A736F6E',
                         },
                    },
                    {
                         NFToken: {
                              NFTokenID: '00080000EA75EB92F92645017A74ABFBB9232F5E7422C4C2682197810030C7E6',
                              URI: '697066733A2F2F6261667962656964663567656B753637357365726C76757463696263356E35666A6E7A7161637634336D6A666372683475723668636E34786B77342E6D657461646174612E6A736F6E',
                         },
                    },
               ],
               PreviousTxnID: '1979816978C5924C5C08BDB77C79DBF001392B17BD52C6AF173E4876B8DA2EA5',
               PreviousTxnLgrSeq: 3236280,
               index: 'EA75EB92F92645017A74ABFBB9232F5E7422C4C2FFFFFFFFFFFFFFFFFFFFFFFF',
          },
          {
               Account: 'r445P3SQcDEp9tsBEofCF6s9FG9nb99UxX',
               Amount: '1260000',
               CancelAfter: 802039751,
               Destination: 'rNaeAFEos9TFmMgmTDW6Z5WC1Toxc5Vtnr',
               DestinationNode: '0',
               FinishAfter: 802029754,
               Flags: 0,
               LedgerEntryType: 'Escrow',
               OwnerNode: '0',
               PreviousTxnID: '9080852E547F860547B54AE8822BD381D966A978F6F575BC516744A5BD2C50C4',
               PreviousTxnLgrSeq: 3251773,
               index: '6DF1FB52D1009D62C4CE90EEC5A3DCA3F346F28440359B9E5768D8B2EE267197',
          },
          {
               Account: 'r445P3SQcDEp9tsBEofCF6s9FG9nb99UxX',
               Amount: '1230000',
               CancelAfter: 802030415,
               Destination: 'rNaeAFEos9TFmMgmTDW6Z5WC1Toxc5Vtnr',
               DestinationNode: '0',
               FinishAfter: 802029420,
               Flags: 0,
               LedgerEntryType: 'Escrow',
               OwnerNode: '0',
               PreviousTxnID: '50F58CFFEA677BD8BE999CDA0BB8D8F36DE89DE729A1D09840E3ADC61C968EB1',
               PreviousTxnLgrSeq: 3251662,
               index: '744706E1F034823E1FED8E890FE55AE7ECD9262674E97C875E4402A04DD382EF',
          },
          {
               Account: 'r445P3SQcDEp9tsBEofCF6s9FG9nb99UxX',
               Destination: 'rNaeAFEos9TFmMgmTDW6Z5WC1Toxc5Vtnr',
               DestinationNode: '0',
               Flags: 0,
               LedgerEntryType: 'Check',
               OwnerNode: '0',
               PreviousTxnID: '3C32D6602C659EA09BC97CFDF4A01A9F7F3200BA22B71999D534119B44C2C28F',
               PreviousTxnLgrSeq: 3251790,
               SendMax: '1320000',
               Sequence: 3196912,
               index: '923ADE4F26DA75671F866C0F9792EEC3A09FC4B37EEDAD6C86903E694DA17CA1',
          },
          {
               Account: 'r445P3SQcDEp9tsBEofCF6s9FG9nb99UxX',
               Destination: 'rNaeAFEos9TFmMgmTDW6Z5WC1Toxc5Vtnr',
               DestinationNode: '0',
               Flags: 0,
               LedgerEntryType: 'Check',
               OwnerNode: '0',
               PreviousTxnID: '3BFB714EF42759E76104110C44E0C7FC1C9369E05D6610A20CC2A8FC5CF5B64A',
               PreviousTxnLgrSeq: 3251796,
               SendMax: '2650000',
               Sequence: 3196913,
               index: 'ACF64561EF1BD6DF1E0D0BD82020BE5D945A42928136C3FCA0ED48EF631988D2',
          },
     ],
     ledger_hash: '5DE757911C971C18F98F21A7FCD827E4837BF408920045FD7D9A1C064B4E45AB',
     ledger_index: 3252910,
     validated: true,
};

const tx = {
     result: {
          close_time_iso: '2025-05-31T04:21:50Z',
          ctid: 'C03161B800000002',
          hash: '1979816978C5924C5C08BDB77C79DBF001392B17BD52C6AF173E4876B8DA2EA5',
          ledger_hash: 'B3A3C46F686B47BD6CFACF51A414EC0B8735E163959F621C2280A979F381D8C7',
          ledger_index: 3236280,
          meta: {
               AffectedNodes: [
                    {
                         ModifiedNode: {
                              FinalFields: {
                                   Account: 'r445P3SQcDEp9tsBEofCF6s9FG9nb99UxX',
                                   Balance: '87649993',
                                   FirstNFTokenSequence: 3196900,
                                   Flags: 8388608,
                                   MintedNFTokens: 3,
                                   OwnerCount: 1,
                                   Sequence: 3196905,
                              },
                              LedgerEntryType: 'AccountRoot',
                              LedgerIndex: 'A2BEF10B887702870F84F83BF298D0654C4FC66ACBB683619696FECD4E4DB515',
                              PreviousFields: {
                                   Balance: '87649994',
                                   MintedNFTokens: 2,
                                   Sequence: 3196904,
                              },
                              PreviousTxnID: '7AA72C6D79B8626823E8664696AB08F13A9BC08CAE7EF8C5283F4E13ADC7986C',
                              PreviousTxnLgrSeq: 3236250,
                         },
                    },
                    {
                         ModifiedNode: {
                              FinalFields: {
                                   Flags: 0,
                                   NFTokens: [
                                        {
                                             NFToken: {
                                                  NFTokenID: '00080000EA75EB92F92645017A74ABFBB9232F5E7422C4C2513BC6800030C7E5',
                                                  URI: '697066733A2F2F6261667962656964663567656B753637357365726C76757463696263356E35666A6E7A7161637634336D6A666372683475723668636E34786B77342E6D657461646174612E6A736F6E',
                                             },
                                        },
                                        {
                                             NFToken: {
                                                  NFTokenID: '00080000EA75EB92F92645017A74ABFBB9232F5E7422C4C2682197810030C7E6',
                                                  URI: '697066733A2F2F6261667962656964663567656B753637357365726C76757463696263356E35666A6E7A7161637634336D6A666372683475723668636E34786B77342E6D657461646174612E6A736F6E',
                                             },
                                        },
                                   ],
                              },
                              LedgerEntryType: 'NFTokenPage',
                              LedgerIndex: 'EA75EB92F92645017A74ABFBB9232F5E7422C4C2FFFFFFFFFFFFFFFFFFFFFFFF',
                              PreviousFields: {
                                   NFTokens: [
                                        {
                                             NFToken: {
                                                  NFTokenID: '00080000EA75EB92F92645017A74ABFBB9232F5E7422C4C2513BC6800030C7E5',
                                                  URI: '697066733A2F2F6261667962656964663567656B753637357365726C76757463696263356E35666A6E7A7161637634336D6A666372683475723668636E34786B77342E6D657461646174612E6A736F6E',
                                             },
                                        },
                                   ],
                              },
                              PreviousTxnID: '7AA72C6D79B8626823E8664696AB08F13A9BC08CAE7EF8C5283F4E13ADC7986C',
                              PreviousTxnLgrSeq: 3236250,
                         },
                    },
               ],
               TransactionIndex: 0,
               TransactionResult: 'tesSUCCESS',
               nftoken_id: '00080000EA75EB92F92645017A74ABFBB9232F5E7422C4C2682197810030C7E6',
          },
          tx_json: {
               Account: 'r445P3SQcDEp9tsBEofCF6s9FG9nb99UxX',
               Fee: '1',
               Flags: 8,
               LastLedgerSequence: 3236298,
               NFTokenTaxon: 0,
               Sequence: 3196904,
               SigningPubKey: '032F8EEC4BA0DC4A0F581DDC3E579AD6A6D61975FB0DEF03E3FB6CBB9DE9CF0D7A',
               TransactionType: 'NFTokenMint',
               TxnSignature: '3044022026440C98791CE9810E4370C1592B69B1060D664216E5EF345FD40D16325CC8200220482C8640D1F9C176D7B3EF11BB05C163FBFFD5EE2A87B1116DAC45B69FD14406',
               URI: '697066733A2F2F6261667962656964663567656B753637357365726C76757463696263356E35666A6E7A7161637634336D6A666372683475723668636E34786B77342E6D657461646174612E6A736F6E',
               date: 801980510,
               ledger_index: 3236280,
          },
          validated: true,
     },
     type: 'response',
};

const tx1 = {
     result: {
          close_time_iso: '2025-05-31T19:37:43Z',
          ctid: 'C031A5A300000002',
          hash: 'FA0883143AD671776258FC28B99397DC5E7908C7C8F7A48943297C6997C9CED1',
          ledger_hash: 'B387E971A8A5707B1A5981498A5B2932DA6533DB9108CDCE19093A7C649033B1',
          ledger_index: 3253667,
          meta: {
               AffectedNodes: [
                    {
                         ModifiedNode: {
                              FinalFields: {
                                   Account: 'rNaeAFEos9TFmMgmTDW6Z5WC1Toxc5Vtnr',
                                   Balance: '94319982',
                                   Flags: 8388608,
                                   OwnerCount: 2,
                                   Sequence: 3196916,
                              },
                              LedgerEntryType: 'AccountRoot',
                              LedgerIndex: '0337F85655DCD9F5E36F050E184D681A52431214D8A4B4DBC1FD42BC6B33C9F7',
                              PreviousFields: {
                                   Balance: '93959982',
                              },
                              PreviousTxnID: '253EEFCBD214D72BAA7DE437A76693ABBBB88CA665DC99801BB87A7107A690D6',
                              PreviousTxnLgrSeq: 3253418,
                         },
                    },
                    {
                         ModifiedNode: {
                              FinalFields: {
                                   Account: 'r445P3SQcDEp9tsBEofCF6s9FG9nb99UxX',
                                   Balance: '83189982',
                                   FirstNFTokenSequence: 3196900,
                                   Flags: 8388608,
                                   MintedNFTokens: 3,
                                   OwnerCount: 5,
                                   Sequence: 3196916,
                              },
                              LedgerEntryType: 'AccountRoot',
                              LedgerIndex: 'A2BEF10B887702870F84F83BF298D0654C4FC66ACBB683619696FECD4E4DB515',
                              PreviousFields: {
                                   Balance: '83549983',
                                   Sequence: 3196915,
                              },
                              PreviousTxnID: '253EEFCBD214D72BAA7DE437A76693ABBBB88CA665DC99801BB87A7107A690D6',
                              PreviousTxnLgrSeq: 3253418,
                         },
                    },
               ],
               TransactionIndex: 0,
               TransactionResult: 'tesSUCCESS',
               delivered_amount: '360000',
          },
          tx_json: {
               Account: 'r445P3SQcDEp9tsBEofCF6s9FG9nb99UxX',
               DeliverMax: '360000',
               Destination: 'rNaeAFEos9TFmMgmTDW6Z5WC1Toxc5Vtnr',
               Fee: '1',
               Flags: 0,
               LastLedgerSequence: 3253685,
               Sequence: 3196915,
               SigningPubKey: '032F8EEC4BA0DC4A0F581DDC3E579AD6A6D61975FB0DEF03E3FB6CBB9DE9CF0D7A',
               TransactionType: 'Payment',
               TxnSignature: '304502210085CE387E0843AC7CF70ABC354A02132559284254C58B0566EBC6970C2065DE750220275CFECDCDDE1F96D270511A8F711A2FFE9BDBE04B9EB02EFD0A4B89F1A9ED86',
               ctid: 'C031A5A300000002',
               date: 802035463,
               ledger_index: 3253667,
          },
          validated: true,
     },
     type: 'response',
};

const offer = {
     result: {
          account: 'rhuaX1t5XP4mSzW5pXSUbpVoqUjadV3HcH',
          ledger_hash: '86778A9EAEAB76663662F3C3038EC7F65B95AB9BFABA11F5420CCCC52264866C',
          ledger_index: 7805935,
          offers: [
               {
                    flags: 0,
                    quality: '0.000003333333333333334',
                    seq: 7805146,
                    taker_gets: '3000000',
                    taker_pays: {
                         currency: 'DOG',
                         issuer: 'rETbLUGdjTo2PScLT5xCUZ8ov7B9zHnRqo',
                         value: '10',
                    },
               },
               {
                    flags: 0,
                    quality: '700000',
                    seq: 7805145,
                    taker_gets: {
                         currency: 'DOG',
                         issuer: 'rETbLUGdjTo2PScLT5xCUZ8ov7B9zHnRqo',
                         value: '10',
                    },
                    taker_pays: '7000000',
               },
               {
                    flags: 0,
                    quality: '900000',
                    seq: 7805144,
                    taker_gets: {
                         currency: 'DOG',
                         issuer: 'rETbLUGdjTo2PScLT5xCUZ8ov7B9zHnRqo',
                         value: '10',
                    },
                    taker_pays: '9000000',
               },
          ],
          validated: true,
     },
     type: 'response',
};

const escrow = {
     result: {
          close_time_iso: '2025-05-31T17:57:01Z',
          ctid: 'C0319DCE00000002',
          hash: '50F58CFFEA677BD8BE999CDA0BB8D8F36DE89DE729A1D09840E3ADC61C968EB1',
          ledger_hash: 'C42FE2D79F99378E649AE66EB2066BAF3B31BD60706E68C7ECE2B06A2F05B49C',
          ledger_index: 3251662,
          meta: {
               AffectedNodes: [
                    {
                         ModifiedNode: {
                              LedgerEntryType: 'AccountRoot',
                              LedgerIndex: '0337F85655DCD9F5E36F050E184D681A52431214D8A4B4DBC1FD42BC6B33C9F7',
                              PreviousTxnID: 'EE10FC9DC16D236FA3F60B30ABEB948C870C72A0942A0A02475367DD3DD948DA',
                              PreviousTxnLgrSeq: 3251618,
                         },
                    },
                    {
                         ModifiedNode: {
                              FinalFields: {
                                   Flags: 0,
                                   Owner: 'rNaeAFEos9TFmMgmTDW6Z5WC1Toxc5Vtnr',
                                   RootIndex: '5727718A6C1662ABAB36CFE5DCAB40D6FE3C366D60333102F8203ED231A0B010',
                              },
                              LedgerEntryType: 'DirectoryNode',
                              LedgerIndex: '5727718A6C1662ABAB36CFE5DCAB40D6FE3C366D60333102F8203ED231A0B010',
                              PreviousTxnID: 'E2F9CE3482CEDD6680AC16226A96AFF53C1BEC25EE5D70D874D8A77F640C7667',
                              PreviousTxnLgrSeq: 3199064,
                         },
                    },
                    {
                         CreatedNode: {
                              LedgerEntryType: 'Escrow',
                              LedgerIndex: '744706E1F034823E1FED8E890FE55AE7ECD9262674E97C875E4402A04DD382EF',
                              NewFields: {
                                   Account: 'r445P3SQcDEp9tsBEofCF6s9FG9nb99UxX',
                                   Amount: '1230000',
                                   CancelAfter: 802030415,
                                   Destination: 'rNaeAFEos9TFmMgmTDW6Z5WC1Toxc5Vtnr',
                                   FinishAfter: 802029420,
                              },
                         },
                    },
                    {
                         ModifiedNode: {
                              FinalFields: {
                                   Account: 'r445P3SQcDEp9tsBEofCF6s9FG9nb99UxX',
                                   Balance: '85059987',
                                   FirstNFTokenSequence: 3196900,
                                   Flags: 8388608,
                                   MintedNFTokens: 3,
                                   OwnerCount: 2,
                                   Sequence: 3196911,
                              },
                              LedgerEntryType: 'AccountRoot',
                              LedgerIndex: 'A2BEF10B887702870F84F83BF298D0654C4FC66ACBB683619696FECD4E4DB515',
                              PreviousFields: {
                                   Balance: '86289988',
                                   OwnerCount: 1,
                                   Sequence: 3196910,
                              },
                              PreviousTxnID: 'EE10FC9DC16D236FA3F60B30ABEB948C870C72A0942A0A02475367DD3DD948DA',
                              PreviousTxnLgrSeq: 3251618,
                         },
                    },
                    {
                         CreatedNode: {
                              LedgerEntryType: 'DirectoryNode',
                              LedgerIndex: 'DA2C7DA5A410526AB6C02BE0EF3FA3E30DAECA184133125652436B8C6139D8A0',
                              NewFields: {
                                   Owner: 'r445P3SQcDEp9tsBEofCF6s9FG9nb99UxX',
                                   RootIndex: 'DA2C7DA5A410526AB6C02BE0EF3FA3E30DAECA184133125652436B8C6139D8A0',
                              },
                         },
                    },
               ],
               TransactionIndex: 0,
               TransactionResult: 'tesSUCCESS',
          },
          tx_json: {
               Account: 'r445P3SQcDEp9tsBEofCF6s9FG9nb99UxX',
               Amount: '1230000',
               CancelAfter: 802030415,
               Destination: 'rNaeAFEos9TFmMgmTDW6Z5WC1Toxc5Vtnr',
               Fee: '1',
               FinishAfter: 802029420,
               Flags: 0,
               LastLedgerSequence: 3251680,
               Sequence: 3196910,
               SigningPubKey: '032F8EEC4BA0DC4A0F581DDC3E579AD6A6D61975FB0DEF03E3FB6CBB9DE9CF0D7A',
               TransactionType: 'EscrowCreate',
               TxnSignature: '3045022100DB2FEC711DAC47FC3DDE34467F8CD2BD1CD12CB71457EB4F711DE0F7B23309890220399FA050151E8C1C6EC9FEDA6F90279CBE8F853334A874762EB373A189138070',
               date: 802029421,
               ledger_index: 3251662,
          },
          validated: true,
     },
};

// Main function to run the script
function main() {
     // let response = sampleResponse;
     // let response = nftResponse;
     // let response = escrowResponse;
     // let response = multiple;
     // let response = tx;
     // let response = tx1;
     // let response = escrow;
     let response = offer;

     // Check if a JSON file or string was provided via command-line arguments
     // if (process.argv.length > 2) {
     //      try {
     //           const input = process.argv[2];
     //           // Try parsing as JSON string or file path
     //           if (input.endsWith('.json')) {
     //                const fs = require('fs');
     //                response = JSON.parse(fs.readFileSync(input, 'utf8'));
     //           } else {
     //                response = JSON.parse(input);
     //           }
     //      } catch (error) {
     //           console.error('Error: Invalid JSON input or file not found.');
     //           console.error('Usage: node parse_xrpl.js [path/to/response.json | JSON_string]');
     //           console.error('Using sample response instead.');
     //           response = sampleResponse;
     //      }
     // } else {
     //      console.log('No input provided. Using sample response.');
     //      response = sampleResponse;
     // }

     // Parse and display the response
     // const parsedResponse = parseXRPLResponse(response);
     const parsedResponse = parseXRPLTransaction(response);
     console.log(parsedResponse);
}

// Run the script
main();
