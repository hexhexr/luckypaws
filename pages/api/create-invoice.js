// pages/api/create-invoice.js
const orders = [];  // in-memory store (will reset on server restart)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { username, game, amount, method } = req.body;
  // Validate input
  if (!username || !game || !amount || !method) {
    return res.status(400).json({ error: 'Missing required field' });
  }
  try {
    // Prepare Basic Auth header using secret key (no password):contentReference[oaicite:13]{index=13}
    const authHeader = 'Basic ' + Buffer.from(process.env.TRYSPEED_SECRET_KEY + ':').toString('base64');
    let invoice = null, address = null, orderId = null;

    if (method === 'lightning') {
      // Create a payment link for Lightning (target_currency=SATS as example)
      const linkRes = await fetch('https://api.tryspeed.com/payment-links', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `${game} purchase`,
          base_currency: 'USD',
          base_amount: amount,
          target_currency: 'SATS'
        })
      });
      const linkData = await linkRes.json();
      if (!linkRes.ok) throw new Error(linkData.error || 'Speed API error');
      // Assume the API returns an `invoice` field for Lightning
      invoice = linkData.invoice;  // (replace with actual field from API response)
      orderId = linkData.id || Date.now().toString();
    } else {
      // On-chain: create a payment address
      const addrRes = await fetch('https://api.tryspeed.com/payment-addresses', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `${game} purchase`,
          currency: 'BTC'
        })
      });
      const addrData = await addrRes.json();
      if (!addrRes.ok) throw new Error(addrData.error || 'Speed API error');
      address = addrData.address;
      orderId = addrData.id || Date.now().toString();
    }

    // Save order (pending status)
    const order = { username, game, amount, method, invoice, address, orderId, status: 'pending' };
    orders.push(order);

    // Return invoice/address info to client
    return res.status(200).json({ invoice, address, orderId, status: order.status });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
