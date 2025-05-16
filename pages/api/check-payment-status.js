import { db } from '../../lib/firebaseAdmin.js';

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing order ID' });

  try {
    const ref = db.collection('orders').doc(id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Order not found' });

    const order = doc.data();
    const apiUrl = process.env.SPEED_API_BASE_URL || 'https://api.tryspeed.com';
    const authHeader = Buffer.from(`${process.env.SPEED_SECRET_KEY}:`).toString('base64');

    const response = await fetch(`${apiUrl}/payments/${id}`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'speed-version': '2022-10-15',
      },
    });

    const speedData = await response.json();
    const speedStatus = speedData?.status;

    if (speedStatus === 'paid' && order.status !== 'paid') {
      await ref.update({ status: 'paid', paidManually: false });
    }

    res.status(200).json({ status: speedStatus });
  } catch (err) {
    console.error('Error in check-payment-status:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
