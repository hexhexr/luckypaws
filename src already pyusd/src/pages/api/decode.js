// pages/api/decode.js
import { withAuth } from '../../lib/authMiddleware'; // BUG FIX: Import and apply admin authentication

const handler = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { bolt11 } = req.body;

  if (!bolt11) {
    return res.status(400).json({ message: "Missing invoice" });
  }

  // This endpoint is now protected, so we can be confident the caller is an admin.
  const SPEED_API_KEY = process.env.SPEED_SECRET_KEY;
  const SPEED_API_URL = process.env.SPEED_API_BASE_URL || 'https://api.tryspeed.com';


  try {
    // Using the v1 endpoint for decoding, which uses Basic Auth with the secret key.
    const authHeader = Buffer.from(`${SPEED_API_KEY}:`).toString('base64');
    const response = await fetch(`${SPEED_API_URL}/invoices/decode`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/json",
        Accept: 'application/json',
        'speed-version': '2022-10-15',
      },
      body: JSON.stringify({ payment_request: bolt11 }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Forward the error message from the Speed API for better debugging
      return res.status(response.status).json({ message: data.message || "Failed to decode invoice" });
    }

    // The decoded amount is in satoshis
    res.status(200).json({ amount: data.amount_in_satoshis });
  } catch (error) {
    console.error("Error decoding invoice:", error);
    res.status(500).json({ message: "Internal server error while decoding invoice" });
  }
}

// BUG FIX: Secure the endpoint by wrapping it with admin authentication.
export default withAuth(handler);