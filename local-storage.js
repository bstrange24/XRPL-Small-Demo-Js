// Array of input IDs for text fields
const inputIds = [
    "account1name",
    "account2name",
    "issuerName",
    "account1address",
    "account2address",
    "issuerAddress",
    "account1seed",
    "account2seed",
    "issuerSeed",
    "account1mnemonic",
    "account2mnemonic",
    "issuerMnemonic",
    "account1secretNumbers",
    "account2secretNumbers",
    "issuerSecretNumbers",
    "accountNameField",
    "accountAddressField",
    "accountSeedField",
    "xrpBalanceField",
    "amountField",
    "destinationField"
];

// Array of radio button IDs
const serverRadioIds = ["dn", "tn", "mn"];
const accountRadioIds = ["account1", "account2", "accountIssuer"];

// Function to load input values from localStorage
function loadInputValues() {
    console.log("Running loadInputValues");
    inputIds.forEach(id => {
        const value = localStorage.getItem(id);
        // console.log(`Checking ${id}: localStorage value = "${value}"`);
        if (value !== null) {
            const element = document.getElementById(id);
            if (element !== null) {
                element.value = value;
                // console.log(`Set ${id} value to "${value}"`);
            } else {
                console.warn(`Element with ID ${id} not found when loading value`);
            }
        }
    });

    // Load server radio selection, default to Testnet (tn)
    let savedServer = localStorage.getItem("server");
    if (savedServer === null) {
        savedServer = "wss://s.altnet.rippletest.net:51233"; // Default to Testnet
        localStorage.setItem("server", savedServer);
        console.log("Set default server to Testnet");
    }
    const radio = document.querySelector(`input[name="server"][value="${savedServer}"]`);
    if (radio !== null) {
        radio.checked = true;
        updateNavbarColor(radio.id);
        console.log(`Set server radio ${radio.id} to checked (server: ${savedServer})`);
    } else {
        console.warn(`Server radio button with value ${savedServer} not found, defaulting to Testnet`);
        updateNavbarColor("tn"); // Force Testnet color if radio not found
    }
}

// Wait for dynamically loaded elements to appear in the DOM
function initializeWithRetry(attempts = 10, delay = 500) {
    let attempt = 0;
    function tryInitialize() {
        const missingInputs = inputIds.filter(id => document.getElementById(id) === null);
        const missingServerRadios = serverRadioIds.filter(id => document.getElementById(id) === null);
        const missingAccountRadios = accountRadioIds.filter(id => document.getElementById(id) === null);
        const navbar = document.getElementById("navbar");
        const form = document.getElementById("theForm");
        const resultField = document.getElementById("resultField");

        if ( 
            missingInputs.length === 0 &&
            missingServerRadios.length === 0 &&
            missingAccountRadios.length === 0 &&
            navbar !== null &&
            form !== null &&
            resultField !== null
        ) {
            console.log("All required elements found in DOM");
            // Add event listeners for text inputs
            inputIds.forEach(id => addInputListener(id, "input", saveInputValues));
            // Add event listeners for server radio buttons
            serverRadioIds.forEach(id => addInputListener(id, "change", saveInputValues));
            // Add event listeners for account radio buttons
            accountRadioIds.forEach(id => addInputListener(id, "change", saveInputValues));
            // Load initial values
            loadInputValues();
        } else if (attempt < attempts) {
            attempt++;
            console.warn(`Attempt ${attempt}: Waiting for elements`, {
                missingInputs,
                missingServerRadios,
                missingAccountRadios,
                navbar: navbar === null ? "missing" : "found",
                form: form === null ? "missing" : "found",
                resultField: resultField === null ? "missing" : "found"
            });
            setTimeout(tryInitialize, delay);
        } else {
            console.warn("Failed to find all elements after retries", {
                missingInputs,
                missingServerRadios,
                missingAccountRadios,
                navbar: navbar === null ? "missing" : "found",
                form: form === null ? "missing" : "found",
                resultField: resultField === null ? "missing" : "found"
            });
        }
    }
    tryInitialize();
}

const accountRadioButtons1 = document.querySelectorAll('input[name="server"]');
accountRadioButtons1.forEach(radio => {
    radio.addEventListener('change', function () {
        if (this.value === 'wss://s.devnet.rippletest.net:51233') {
            localStorage.setItem("server", this.value);
            updateNavbarColor(this.id);
        } else if (this.value === 'wss://s.altnet.rippletest.net:51233') {
            localStorage.setItem("server", this.value);
            updateNavbarColor(this.id);
        } else if (this.value === 'wss://s1.ripple.com_not') {
            localStorage.setItem("server", this.value);
            updateNavbarColor(this.id);
        }
    });
});

// Function to update navbar color based on server radio selection
function updateNavbarColor(radioId) {
    const navbar = document.getElementById("navbar");
    if (navbar !== null) {
        if (radioId === "dn") {
            navbar.style.backgroundColor = "#28a745"; // Green for Devnet
            localStorage.setItem("server", 'wss://s.devnet.rippletest.net:51233');
            console.log("Navbar color changed to green for Devnet");
        } else if (radioId === "tn") {
            navbar.style.backgroundColor = "#ffc107"; // Yellow for Testnet
            localStorage.setItem("server", 'wss://s.altnet.rippletest.net:51233');
            console.log("Navbar color changed to yellow for Testnet");
        } else if (radioId === "mn") {
            navbar.style.backgroundColor = "#dc3545"; // Red for Mainnet
            localStorage.setItem("server", 'wss://s1.ripple.com_not');
            console.log("Navbar color changed to red for Mainnet");
        } else {
            navbar.style.backgroundColor = "#343a40"; // Default dark gray
            console.log("Navbar color reset to default");
        }
    } else {
        console.warn("Navbar with ID 'navbar' not found");
    }
}

// Function to save input values to localStorage
export function saveInputValues() {
    const account1name = document.getElementById("account1name").value;
    const account2name = document.getElementById("account2name").value;
    let issuerName = document.getElementById("issuerName").value;;
    if(document.getElementById("issuerName")) {
        issuerName = document.getElementById("issuerName").value;
    }
    
    const account1address = document.getElementById("account1address").value;
    const account2address = document.getElementById("account2address").value;
    let issuerAddress;
    if(document.getElementById("issuerAddress")) {
        issuerAddress = document.getElementById("issuerAddress").value;
    }
    
    const account1seed = document.getElementById("account1seed").value;
    const account2seed = document.getElementById("account2seed").value;
    let issuerSeed;
    if(document.getElementById("issuerSeed")) {
        issuerSeed = document.getElementById("issuerSeed").value;
    }

    const account1mnemonic = document.getElementById("account1mnemonic").value;
    const account2mnemonic = document.getElementById("account2mnemonic").value;
    let issuerMnemonic;
    if(document.getElementById("issuerMnemonic")) {
        issuerMnemonic = document.getElementById("issuerMnemonic").value;
    }

    const account1secretNumbers = document.getElementById("account1secretNumbers").value;
    const account2secretNumbers = document.getElementById("account2secretNumbers").value;
    let issuerSecretNumbers;
    if(document.getElementById("issuerSecretNumbers")) {
        issuerSecretNumbers = document.getElementById("issuerSecretNumbers").value;
    }

    localStorage.setItem("account1name", account1name);
    localStorage.setItem("account2name", account2name);
    localStorage.setItem("issuerName", issuerName);

    localStorage.setItem("account1address", account1address);
    localStorage.setItem("account2address", account2address);
    localStorage.setItem("issuerAddress", issuerAddress);

    localStorage.setItem("account1seed", account1seed);
    localStorage.setItem("account2seed", account2seed);
    localStorage.setItem("issuerSeed", issuerSeed);

    localStorage.setItem("account1mnemonic", account1mnemonic);
    localStorage.setItem("account2mnemonic", account2mnemonic);
    localStorage.setItem("issuerMnemonic", issuerMnemonic);

    localStorage.setItem("account1secretNumbers", account1secretNumbers);
    localStorage.setItem("account2secretNumbers", account2secretNumbers);
    localStorage.setItem("issuerSecretNumbers", issuerSecretNumbers);
}

// Run initialization after DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM fully loaded at", new Date().toISOString());
    // initializeWithRetry();
    loadInputValues();
});

// Reusable function to add event listeners
export function addInputListener(elementId, eventType, callback) {
    const element = document.getElementById(elementId);
    if (element) {
        element.addEventListener(eventType, callback);
    }
}

// Add input event listeners to all inputs
inputIds.forEach(id => addInputListener(id, "input", saveInputValues));

// Load input values when page loads
document.addEventListener("DOMContentLoaded", loadInputValues);

// Optional: Save on form submission
const theForm = document.getElementById("theForm");
if (theForm) {
    theForm.addEventListener("submit", (event) => {
        event.preventDefault(); // Prevent default form submission
        saveInputValues();
        // Add your XRPL transaction logic here (e.g., sendCheck)
    });
}
