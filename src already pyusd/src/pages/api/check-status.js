// pages/api/check-status.js
import { db } from '../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ message: 'Missing order ID' });
  }

  const apiUrl = process.env.SPEED_API_BASE_URL || 'https://api.tryspeed.com';
  const url = `${apiUrl}/payments/${id}`;
  const authHeader = Buffer.from(`${process.env.SPEED_SECRET_KEY}:`).toString('base64');

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'speed-version': '2022-10-15',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      if (response.status === 404) {
        await db.collection('orders').doc(id).update({ status: 'expired' });
        return res.status(200).json({ status: 'expired' });
      }
      return res.status(response.status).json({ message: 'Failed to fetch payment status from Speed API', error: errorData });
    }

    const payment = await response.json();
    const speedApiStatus = payment.status;

    const orderDoc = await db.collection('orders').doc(id).get();
    if (!orderDoc.exists) {
      return res.status(404).json({ message: 'Order not found in database.' });
    }
    const currentOrderStatus = orderDoc.data().status;

    let newStatus = currentOrderStatus;

    if (speedApiStatus === 'paid' && currentOrderStatus !== 'paid') {
      newStatus = 'paid';
      await db.collection('orders').doc(id).update({ status: newStatus });
    } else if (speedApiStatus === 'expired' && currentOrderStatus !== 'expired') {
      newStatus = 'expired';
      await db.collection('orders').doc(id).update({ status: newStatus });
    } else if (currentOrderStatus !== 'pending' && (speedApiStatus === 'unpaid' || speedApiStatus === 'pending')) {
        newStatus = 'pending';
        await db.collection('orders').doc(id).update({ status: newStatus });
    }

    return res.status(200).json({ status: newStatus });

  } catch (err) {
    console.error(`Error checking payment status for order ${id}:`, err);
    return res.status(500).json({ message: 'Internal server error while checking status.' });
  }
}