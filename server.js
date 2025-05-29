// server.js
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();

app.use(cors({ origin: 'http://localhost:5173' })); // allow Vite dev server
app.use(express.json());

// Endpoint to get a new funded wallet
// https://faucet.devnet.rippletest.net/accounts
// https://faucet.altnet.rippletest.net/accounts
app.post('/api/fund-wallet', async (req, res) => {
     try {
          const response = await fetch('https://faucet.devnet.rippletest.net/accounts', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
          });

          const data = await response.json();
          res.status(200).json(data);
     } catch (error) {
          console.error('Error contacting Ripple faucet:', error);
          res.status(500).json({ error: 'Failed to get funded wallet' });
     }
});

app.listen(3001, () => {
     console.log('Server running on http://localhost:3001');
});
