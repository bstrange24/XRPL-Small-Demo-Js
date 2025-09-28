import * as xrpl from 'xrpl';

// function toRippleTime(dateString) {
//      console.log('Raw Input:', dateString);

//      // Hardcode correct Unix timestamp for 2025-12-25T00:00:00Z
//      const unixTimestampMs = dateString === '2025-12-25' ? 1767225600000 : new Date(`${dateString}T00:00:00Z`).getTime();

//      if (isNaN(unixTimestampMs)) {
//           throw new Error(`Invalid date format: ${dateString}. Use YYYY-MM-DD format.`);
//      }

//      const rippleEpochStartMs = new Date('2000-01-01T00:00:00Z').getTime();
//      console.log('Ripple Epoch Start (ms):', rippleEpochStartMs);

//      const rippleEpochTime = Math.floor((unixTimestampMs - rippleEpochStartMs) / 1000);
//      console.log(`Input Date: ${dateString}, Unix Timestamp (ms): ${unixTimestampMs}, Ripple Epoch Time: ${rippleEpochTime}`);
//      return rippleEpochTime;
// }

// console.log('Result:', toRippleTime('2025-12-25'));

// function toRippleTime1(dateString) {
//      console.log('Raw Input:', dateString);

//      // Try creating a Date object
//      const targetDate = new Date(`${dateString}T00:00:00Z`);
//      if (isNaN(targetDate.getTime())) {
//           throw new Error(`Invalid date format: ${dateString}. Use YYYY-MM-DD format.`);
//      }

//      // Log Date object details
//      console.log('Parsed Date:', targetDate.toISOString());
//      console.log('Parsed Date (ms):', targetDate.getTime());

//      // Use xrpl.js utility to convert Date to Ripple Epoch time
//      const rippleTimeFromDate = xrpl.utils.datetime_to_ripple_time(targetDate);
//      console.log('Ripple Time (from Date):', rippleTimeFromDate);

//      // Hardcode POSIX timestamp for 2025-12-25T00:00:00Z as a workaround
//      const hardcodedPosixMs = 1767225600000; // Known correct timestamp
//      const posixSeconds = Math.floor(hardcodedPosixMs / 1000); // Convert to seconds
//      const rippleTimeFromPosix = xrpl.utils.posix_to_ripple_time(posixSeconds);
//      console.log('Ripple Time (from Hardcoded POSIX):', rippleTimeFromPosix);

//      return rippleTimeFromPosix; // Use the hardcoded version for now
// }

// console.log('Result:', toRippleTime1('2025-12-25'));

function toFormattedExpiration(rippleSeconds) {
     // Convert to UNIX epoch seconds
     const unixSeconds = rippleSeconds + 946684800;
     const date = new Date(unixSeconds * 1000);

     const month = String(date.getUTCMonth() + 1).padStart(2, '0'); // Months are 0-based
     const day = String(date.getUTCDate()).padStart(2, '0');
     const year = date.getUTCFullYear();

     const hours = String(date.getUTCHours()).padStart(2, '0');
     const minutes = String(date.getUTCMinutes()).padStart(2, '0');
     const seconds = String(date.getUTCSeconds()).padStart(2, '0');

     return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
}

const NET = 'wss://s.devnet.rippletest.net:51233/';
const client = new xrpl.Client(NET);
await client.connect();

const tx = await client.request({
     command: 'tx',
     transaction: 'F22D9F2A29CC8A9E363141D8D4414D57635ECA40A6033685F40D817B3029A1AA',
});

const rippleExpiration = tx.result.tx_json.Expiration; // 819936000
const unixExpiration = rippleExpiration + 946684800;

const date = new Date(unixExpiration * 1000);

const formatted = toFormattedExpiration(rippleExpiration);

console.log(formatted);

// console.log(new Date(unixExpiration * 1000).toDateString());
// console.log(new Date(unixExpiration * 1000).toISOString());
// console.log(new Date(unixExpiration * 1000).toLocaleDateString());
// console.log(new Date(unixExpiration * 1000).toLocaleDateString() + ' ' + new Date(unixExpiration * 1000).toLocaleTimeString());

await client.disconnect();
