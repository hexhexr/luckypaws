// pages/api/decode.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { bolt11 } = req.body;

  if (!bolt11) {
    return res.status(400).json({ message: "Missing invoice" });
  }

  const SPEED_SECRET_KEY = process.env.SPEED_SECRET_KEY;

  try {
    const response = await fetch("https://api.tryspeed.com/v1/invoices/decode", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SPEED_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ invoice: bolt11 }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(400).json({ message: data.message || "Decode failed" });
    }

    res.status(200).json({ amount: data.amount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error decoding invoice" });
  }
}
