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
     'create-nft.html': 'NFTs',
};

fetch('navbar.html')
     .then(res => res.text())
     .then(html => {
          document.getElementById('navbar-container').innerHTML = html;
          loadInputValues();
     });

export function loadInputValues() {
     console.log('Entering loadInputValues');

     const networkButton = document.getElementById('networkDropdownButton');
     const dropdownMenu = document.querySelector('.network .dropdown-menu');
     const navbar = document.getElementById('navbar');

     // Load saved network (default: 'devnet')
     const savedNetwork = localStorage.getItem('selectedNetwork') || 'devnet';
     updateNetwork(savedNetwork);

     // Handle network selection
     dropdownMenu.addEventListener('click', function (e) {
          e.preventDefault();
          const target = e.target.closest('.dropdown-item[data-network]');
          if (!target) return; // Skip if not a network item

          const network = target.getAttribute('data-network');
          updateNetwork(network);
          localStorage.setItem('selectedNetwork', network);
     });

     // Update UI based on selected network
     function updateNetwork(network) {
          // Update button text
          const displayName = network.charAt(0).toUpperCase() + network.slice(1).replace('_', ' ');
          networkButton.querySelector('.dropdown-toggle-text').textContent = displayName;

          // Highlight active network in dropdown (optional)
          document.querySelectorAll('.dropdown-item[data-network]').forEach(item => {
               item.classList.toggle('active', item.getAttribute('data-network') === network);
          });

          // Example: Change navbar color based on network
          const colors = {
               devnet: 'rgb(56 113 69)',
               testnet: '#ff6719',
               mainnet: 'rgb(115 49 55)',
          };

          // navbar.style.backgroundColor = colors[network] || '#1a1c21';
          navbar.style.backgroundColor = '#1a1c21';
          networkButton.style.backgroundColor = colors[network] || '#1a1c21';

          // You can add more UI updates here
          console.log(`Switched to ${network}`);
          localStorage.setItem('selectedNetwork', network);
          if (network === 'devnet') {
               localStorage.setItem('server', 'wss://s.devnet.rippletest.net:51233');
          } else if (network === 'testnet') {
               localStorage.setItem('server', 'wss://s.altnet.rippletest.net:51233');
          } else if (network === 'mainnet') {
               localStorage.setItem('server', 'wss://s1.ripple.com_not');
          } else {
               localStorage.setItem('server', 'wss://s.altnet.rippletest.net:51233');
          }
     }

     inputIds.forEach(id => {
          const value = localStorage.getItem(id);
          const element = document.getElementById(id);
          if (element && value !== null) {
               element.value = value;
          }
     });

     // Get all navbar links (excluding dropdown toggles)
     const navLinks = document.querySelectorAll('.navbar-links > a:not(.dropdown-toggle)');

     // Function to set and save active navbar link
     function setActiveLink(link) {
          // Remove 'active' class from all navbar links
          navLinks.forEach(item => {
               item.classList.remove('active');
          });
          // Remove 'active' class from Escrows dropdown header and items
          const escrowsHeader = document.querySelector('.dropdown:nth-of-type(1) .dropdown-toggle');
          const escrowsDropdownLinks = document.querySelectorAll('.dropdown:nth-of-type(1) .dropdown-menu a');
          if (escrowsHeader) {
               escrowsHeader.classList.remove('active');
          }
          escrowsDropdownLinks.forEach(item => {
               item.classList.remove('active');
          });
          // Clear activeEscrowLink from localStorage
          localStorage.removeItem('activeEscrowLink');
          // Add 'active' class to the clicked link
          link.classList.add('active');
          // Save the active link's href to localStorage
          localStorage.setItem('activeNavLink', link.getAttribute('href'));
     }

     // Function to restore active link from localStorage
     function restoreActiveLink() {
          const activeHref = localStorage.getItem('activeNavLink');
          if (activeHref) {
               const activeLink = document.querySelector(`.navbar-links > a[href="${activeHref}"]`);
               if (activeLink) {
                    setActiveLink(activeLink);
               }
          }
     }

     // Add click event to each navbar link
     navLinks.forEach(link => {
          link.addEventListener('click', function (e) {
               e.preventDefault(); // Prevent default link behavior
               setActiveLink(this);
               // Navigate to the page after styling
               setTimeout(() => {
                    window.location.href = this.href;
               }, 300);
          });
     });

     // Set initial active navbar link based on current page
     const currentPage = window.location.pathname.split('/').pop();
     navLinks.forEach(link => {
          if (link.getAttribute('href') === currentPage) {
               setActiveLink(link);
          }
     });

     // Handle Utils dropdown links
     const utilsDropdown = document.querySelector('.utils-dropdown .dropdown-menu');
     // const utilsDropdown = document.querySelector('.dropdown:last-of-type .dropdown-menu'); // Target Utils dropdown
     const utilsDropdownLinks = utilsDropdown ? utilsDropdown.querySelectorAll('a[onclick]') : [];
     utilsDropdownLinks.forEach(link => {
          link.addEventListener('click', function (e) {
               e.preventDefault();
               const onclickFunction = link.getAttribute('onclick');
               if (onclickFunction && window[onclickFunction.replace('()', '')]) {
                    window[onclickFunction.replace('()', '')]();
               }
               restoreActiveLink();
          });
     });

     // Handle Escrows dropdown links
     const escrowsDropdown = document.querySelector('.escrows-dropdown .dropdown-menu');
     const escrowsDropdownLinks = escrowsDropdown ? escrowsDropdown.querySelectorAll('a') : [];
     escrowsDropdownLinks.forEach(link => {
          link.addEventListener('click', function (e) {
               e.preventDefault();
               // Remove active class from all navbar links
               navLinks.forEach(item => {
                    item.classList.remove('active');
               });
               localStorage.removeItem('activeNavLink');
               // Remove active class from all escrow dropdown items
               escrowsDropdownLinks.forEach(item => {
                    item.classList.remove('active');
               });
               // Add active class to clicked escrow item
               this.classList.add('active');
               // Add active class to Escrows dropdown header
               const escrowsHeader = document.querySelector('.dropdown:nth-of-type(1) .dropdown-toggle');
               if (escrowsHeader) {
                    escrowsHeader.classList.add('active');
               }
               // Save active escrow link
               localStorage.setItem('activeEscrowLink', this.getAttribute('href'));
               // Navigate to the page
               setTimeout(() => {
                    window.location.href = this.href;
               }, 300);
          });
     });

     // Restore active Escrows dropdown state on page load
     const activeEscrowHref = localStorage.getItem('activeEscrowLink');
     if (activeEscrowHref) {
          const activeEscrowLink = escrowsDropdown ? escrowsDropdown.querySelector(`a[href="${activeEscrowHref}"]`) : null;
          if (activeEscrowLink) {
               // Clear active navbar links
               navLinks.forEach(item => {
                    item.classList.remove('active');
               });
               localStorage.removeItem('activeNavLink');
               // Set active escrow link and header
               activeEscrowLink.classList.add('active');
               const escrowsHeader = document.querySelector('.dropdown:nth-of-type(1) .dropdown-toggle');
               if (escrowsHeader) {
                    escrowsHeader.classList.add('active');
               }
          }
     }

     const page = window.location.pathname.split('/').pop();
     const titleElement = document.querySelector('.navbar-title');
     if (titleElement && pageTitles[page]) {
          titleElement.textContent = pageTitles[page];
     }

     console.log('Leaving loadInputValues');
}

export function saveInputValues() {
     console.log('Entering saveInputValues');
     inputIds.forEach(id => {
          const el = document.getElementById(id);
          console.log('id:' + id + ' el.value: ' + el.value);
          if (el) localStorage.setItem(id, el.value || '');
     });
     console.log('Leaving saveInputValues');
}

document.addEventListener('DOMContentLoaded', () => {
     console.log('DOM fully loaded at', new Date().toISOString());
});

document.getElementById('transactionField')?.addEventListener('keydown', function (event) {
     if (event.key === 'Enter') {
          event.preventDefault(); // Optional: prevent form submission or newline
          getTransaction();
     }
});

// export function addInputListener(elementId, eventType, callback) {
//      const element = document.getElementById(elementId);
//      if (element) {
//           element.addEventListener(eventType, callback);
//      }
// }

// inputIds.forEach(id => addInputListener(id, 'input', saveInputValues));
