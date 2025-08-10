// src/pages/api/orders/check-status.js
import { db } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  const { id } = req.query;
  const allowedOrigin = process.env.CHECKOUT_WEBSITE_URL;

  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  if (!id) {
    return res.status(400).json({ message: 'Missing order ID' });
  }

  try {
    const orderRef = db.collection('orders').doc(id);
    const doc = await orderRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    const data = doc.data();
    return res.status(200).json({ status: data.status });

  } catch (err) {
    console.error(`Error checking status for order ${id}:`, err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
}