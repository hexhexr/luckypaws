// pages/api/admin/cashouts/quote.js
import { withAuth } from '../../../../lib/authMiddleware'; // Import the authentication middleware

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { amount } = req.query;
  const usdAmount = parseFloat(amount);

  if (isNaN(usdAmount) || usdAmount <= 0) {
    return res.status(400).json({ message: 'Invalid amount provided.' });
  }

  try {
    // This part remains as is, fetching the price from CoinGecko
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    if (!response.ok) {
      throw new Error('Failed to fetch price data.');
    }
    const data = await response.json();
    const btcPrice = data.bitcoin.usd;
    const sats = Math.round((usdAmount / btcPrice) * 100_000_000);

    res.status(200).json({ sats, btcPrice, usdAmount });
  } catch (error) {
    console.error('Quote API Error:', error);
    res.status(500).json({ message: 'Failed to generate quote.' });
  }
};

export default withAuth(handler); // Wrap the handler with the authentication middleware