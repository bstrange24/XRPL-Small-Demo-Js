// Input IDs and config
const inputIds = ['account1name', 'account2name', 'issuerName', 'account1address', 'account2address', 'issuerAddress', 'account1seed', 'account2seed', 'issuerSeed', 'account1mnemonic', 'account2mnemonic', 'issuerMnemonic', 'account1secretNumbers', 'account2secretNumbers', 'issuerSecretNumbers', 'accountNameField', 'accountAddressField', 'accountSeedField', 'xrpBalanceField', 'amountField', 'destinationField'];

const pageTitles = {
     'index.html': 'Send XRP',
     'send-checks.html': 'Send Checks',
     'send-currency.html': 'Send Currency',
     'create-time-escrow.html': 'Create Time Escrow',
     'create-conditional-escrow.html': 'Create Conditional Escrow',
     'account.html': 'Account Info',
     'create-offers.html': 'Create Offers',
     'create-nft.html': 'Manage NFTs',
};

const serverConfigs = {
     dn: { url: 'wss://s.devnet.rippletest.net:51233', color: 'rgb(56 113 69)' },
     tn: { url: 'wss://s.altnet.rippletest.net:51233', color: '#4386a9' },
     // tn: { url: 'wss://s.altnet.rippletest.net:51233', color: '#ff6719' },
     mn: { url: 'wss://s1.ripple.com_not', color: 'rgb(115 49 55)' },
};

fetch('navbar.html')
     .then(res => res.text())
     .then(html => {
          document.getElementById('navbar-container').innerHTML = html;
          loadInputValues();
     });

export function loadInputValues() {
     console.log('Running loadInputValues');

     inputIds.forEach(id => {
          const value = localStorage.getItem(id);
          const element = document.getElementById(id);
          if (element && value !== null) {
               element.value = value;
          }
     });

     let savedServer = localStorage.getItem('server');
     if (!savedServer) {
          savedServer = serverConfigs.tn.url;
          localStorage.setItem('server', savedServer);
          alert('Set default server to Testnet');
     }

     const selectedRadio = Object.entries(serverConfigs).find(([, config]) => config.url === savedServer);
     const radioId = selectedRadio ? selectedRadio[0] : 'tn';
     const radio = document.getElementById(radioId);

     if (radio) {
          radio.checked = true;
          updateNavbarColor(radioId);
     } else {
          alert(`Server radio button with value ${savedServer} not found, defaulting to Testnet`);
          updateNavbarColor('tn');
     }

     const page = window.location.pathname.split('/').pop();
     const titleElement = document.querySelector('.navbar-title');
     if (titleElement && pageTitles[page]) {
          titleElement.textContent = pageTitles[page];
     }
}

// Handle radio button changes
Object.keys(serverConfigs).forEach(id => {
     const radio = document.getElementById(id);
     if (radio) {
          radio.addEventListener('change', () => {
               const config = serverConfigs[radio.id];
               localStorage.setItem('server', config.url);
               updateNavbarColor(radio.id);
          });
     }
});

function updateNavbarColor(radioId) {
     const navbar = document.getElementById('navbar');
     const config = serverConfigs[radioId];
     if (navbar && config) {
          navbar.style.backgroundColor = config.color;
     } else {
          console.warn('Navbar not found or invalid radioId');
     }
}

export function saveInputValues() {
     inputIds.forEach(id => {
          const el = document.getElementById(id);
          if (el) localStorage.setItem(id, el.value || '');
     });
}

document.addEventListener('DOMContentLoaded', () => {
     console.log('DOM fully loaded at', new Date().toISOString());
});

export function addInputListener(elementId, eventType, callback) {
     const element = document.getElementById(elementId);
     if (element) {
          element.addEventListener(eventType, callback);
     }
}

inputIds.forEach(id => addInputListener(id, 'input', saveInputValues));

// // Array of input IDs for text fields
// const inputIds = ['account1name', 'account2name', 'issuerName', 'account1address', 'account2address', 'issuerAddress', 'account1seed', 'account2seed', 'issuerSeed', 'account1mnemonic', 'account2mnemonic', 'issuerMnemonic', 'account1secretNumbers', 'account2secretNumbers', 'issuerSecretNumbers', 'accountNameField', 'accountAddressField', 'accountSeedField', 'xrpBalanceField', 'amountField', 'destinationField'];

// const pageTitles = {
//      'index.html': 'Send XRP',
//      'send-checks.html': 'Send Checks',
//      'send-currency.html': 'Send Currency',
//      'create-time-escrow.html': 'Create Time Escrow',
//      'create-conditional-escrow.html': 'Create Conditional Escrow',
//      'account.html': 'Account Info',
//      'create-offers.html': 'Create Offers',
// };

// // Array of radio button IDs
// const serverRadioIds = ['dn', 'tn', 'mn'];
// const accountRadioIds = ['account1', 'account2', 'accountIssuer'];

// fetch('navbar.html')
//      .then(res => res.text())
//      .then(html => {
//           document.getElementById('navbar-container').innerHTML = html;
//           loadInputValues();
//      });

// // Function to load input values from localStorage
// export function loadInputValues() {
//      console.log('Running loadInputValues');

//      inputIds.forEach(id => {
//           const value = localStorage.getItem(id);
//           console.warn(`Checking ${id}: localStorage value = "${value}"`);
//           if (value !== null) {
//                const element = document.getElementById(id);
//                if (element !== null) {
//                     element.value = value;
//                     console.warn(`Set ${id} value to "${value}"`);
//                } else {
//                     console.warn(`Element with ID ${id} not found when loading value`);
//                }
//           }
//      });

//      // Load server radio selection, default to Testnet (tn)
//      let savedServer = localStorage.getItem('server');
//      if (savedServer === null) {
//           savedServer = 'wss://s.altnet.rippletest.net:51233'; // Default to Testnet
//           localStorage.setItem('server', savedServer);
//           alert('Set default server to Testnet');
//           console.log('Set default server to Testnet');
//      }
//      const radio = document.querySelector(`input[name="server"][value="${savedServer}"]`);
//      if (radio !== null) {
//           radio.checked = true;
//           updateNavbarColor(radio.id);
//           console.log(`Set server radio ${radio.id} to checked (server: ${savedServer})`);
//      } else {
//           console.warn(`Server radio button with value ${savedServer} not found, defaulting to Testnet`);
//           alert(`Server radio button with value ${savedServer} not found, defaulting to Testnet`);
//           updateNavbarColor('tn'); // Force Testnet color if radio not found
//      }

//      // Extract filename from URL
//      const page = window.location.pathname.split('/').pop();

//      // Set navbar title if there's a match
//      const titleElement = document.querySelector('.navbar-title');

//      if (titleElement && pageTitles[page]) {
//           titleElement.textContent = pageTitles[page];
//      }
// }

// const accountRadioButtons1 = document.querySelectorAll('input[name="server"]');
// accountRadioButtons1.forEach(radio => {
//      radio.addEventListener('change', function () {
//           if (this.value === 'wss://s.devnet.rippletest.net:51233') {
//                localStorage.setItem('server', this.value);
//                updateNavbarColor(this.id);
//           } else if (this.value === 'wss://s.altnet.rippletest.net:51233') {
//                localStorage.setItem('server', this.value);
//                updateNavbarColor(this.id);
//           } else if (this.value === 'wss://s1.ripple.com_not') {
//                localStorage.setItem('server', this.value);
//                updateNavbarColor(this.id);
//           }
//      });
// });

// // Function to update navbar color based on server radio selection
// function updateNavbarColor(radioId) {
//      const navbar = document.getElementById('navbar');
//      if (navbar !== null) {
//           if (radioId === 'dn') {
//                navbar.style.backgroundColor = 'rgb(56 113 69)'; // Green for Devnet
//                localStorage.setItem('server', 'wss://s.devnet.rippletest.net:51233');
//                console.log('Navbar color changed to green for Devnet');
//           } else if (radioId === 'tn') {
//                navbar.style.backgroundColor = '#4386a9'; // Yellow for Testnet
//                localStorage.setItem('server', 'wss://s.altnet.rippletest.net:51233');
//                console.log('Navbar color changed to yellow for Testnet');
//           } else if (radioId === 'mn') {
//                navbar.style.backgroundColor = 'rgb(115 49 55)'; // Red for Mainnet
//                localStorage.setItem('server', 'wss://s1.ripple.com_not');
//                console.log('Navbar color changed to red for Mainnet');
//           } else {
//                navbar.style.backgroundColor = 'rgb(145 255 0)'; // Default dark gray
//                console.log('Navbar color reset to default');
//           }
//      } else {
//           console.warn("Navbar with ID 'navbar' not found");
//           alert("Navbar with ID 'navbar' not found");
//      }
// }

// // Function to save input values to localStorage
// export function saveInputValues() {
//      const account1name = document.getElementById('account1name').value;
//      const account2name = document.getElementById('account2name').value;
//      let issuerName = '';
//      if (document.getElementById('issuerName') != null) {
//           issuerName = document.getElementById('issuerName').value;
//      }

//      const account1address = document.getElementById('account1address').value;
//      const account2address = document.getElementById('account2address').value;
//      let issuerAddress = '';
//      if (document.getElementById('issuerAddress') != null) {
//           issuerAddress = document.getElementById('issuerAddress').value;
//      }

//      const account1seed = document.getElementById('account1seed').value;
//      const account2seed = document.getElementById('account2seed').value;
//      let issuerSeed = '';
//      if (document.getElementById('issuerSeed') != null) {
//           issuerSeed = document.getElementById('issuerSeed').value;
//      }

//      const account1mnemonic = document.getElementById('account1mnemonic').value;
//      const account2mnemonic = document.getElementById('account2mnemonic').value;
//      let issuerMnemonic = '';
//      if (document.getElementById('issuerMnemonic') != null) {
//           issuerMnemonic = document.getElementById('issuerMnemonic').value;
//      }

//      const account1secretNumbers = document.getElementById('account1secretNumbers').value;
//      const account2secretNumbers = document.getElementById('account2secretNumbers').value;
//      let issuerSecretNumbers = '';
//      if (document.getElementById('issuerSecretNumbers') != null) {
//           issuerSecretNumbers = document.getElementById('issuerSecretNumbers').value;
//      }

//      localStorage.setItem('account1name', account1name);
//      localStorage.setItem('account2name', account2name);
//      localStorage.setItem('issuerName', issuerName);

//      localStorage.setItem('account1address', account1address);
//      localStorage.setItem('account2address', account2address);
//      localStorage.setItem('issuerAddress', issuerAddress);

//      localStorage.setItem('account1seed', account1seed);
//      localStorage.setItem('account2seed', account2seed);
//      localStorage.setItem('issuerSeed', issuerSeed);

//      localStorage.setItem('account1mnemonic', account1mnemonic);
//      localStorage.setItem('account2mnemonic', account2mnemonic);
//      localStorage.setItem('issuerMnemonic', issuerMnemonic);

//      localStorage.setItem('account1secretNumbers', account1secretNumbers);
//      localStorage.setItem('account2secretNumbers', account2secretNumbers);
//      localStorage.setItem('issuerSecretNumbers', issuerSecretNumbers);
// }

// // Run initialization after DOM is loaded
// document.addEventListener('DOMContentLoaded', () => {
//      console.log('DOM fully loaded at', new Date().toISOString());
// });

// // Reusable function to add event listeners
// export function addInputListener(elementId, eventType, callback) {
//      const element = document.getElementById(elementId);
//      if (element) {
//           element.addEventListener(eventType, callback);
//      }
// }

// // Add input event listeners to all inputs
// inputIds.forEach(id => addInputListener(id, 'input', saveInputValues));
