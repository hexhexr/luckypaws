// pages/api/check-status.js
import { db } from '../../lib/firebaseAdmin'; // Assuming firebaseAdmin is set up correctly

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { id } = req.query; // This 'id' is your orderId/payment.id
  if (!id) {
    return res.status(400).json({ message: 'Missing order ID' });
  }

  const apiUrl = process.env.SPEED_API_BASE_URL || 'https://api.tryspeed.com';
  const url = `${apiUrl}/payments/${id}`; // Endpoint to get a specific payment's details
  const authHeader = Buffer.from(`${process.env.SPEED_SECRET_KEY}:`).toString('base64');

  try {
    // 1. Fetch current payment status from Speed API
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
      console.error(`Speed API Error for order ${id}:`, errorData);
      // If payment not found on Speed API (e.g., 404), it might be expired or invalid
      if (response.status === 404) {
        // Option: Mark as expired in Firebase if not found on Speed API
        await db.collection('orders').doc(id).update({ status: 'expired' });
        return res.status(200).json({ status: 'expired', message: 'Payment not found on Speed API, marked as expired.' });
      }
      return res.status(response.status).json({ message: 'Failed to fetch payment status from Speed API', error: errorData });
    }

    const payment = await response.json();
    const speedApiStatus = payment.status; // Get status from Speed API response

    // 2. Fetch current status from Firebase
    const orderDoc = await db.collection('orders').doc(id).get();
    if (!orderDoc.exists) {
      return res.status(404).json({ message: 'Order not found in database.' });
    }
    const currentOrderStatus = orderDoc.data().status;

    // 3. Compare and Update Status in Firebase
    let newStatus = currentOrderStatus; // Start with current status from Firebase

    if (speedApiStatus === 'paid' && currentOrderStatus !== 'paid') {
      newStatus = 'paid';
      await db.collection('orders').doc(id).update({ status: newStatus });
      console.log(`Order ${id} status updated to PAID in Firebase.`);
    } else if (speedApiStatus === 'expired' && currentOrderStatus !== 'expired') {
      newStatus = 'expired';
      await db.collection('orders').doc(id).update({ status: newStatus });
      console.log(`Order ${id} status updated to EXPIRED in Firebase.`);
    } else if (speedApiStatus === 'unpaid' || speedApiStatus === 'pending') {
      // If Speed API still reports it as unpaid/pending, ensure Firebase is also 'pending'
      // No need to update Firebase if it's already 'pending'
      if (currentOrderStatus !== 'pending') {
         newStatus = 'pending';
         await db.collection('orders').doc(id).update({ status: newStatus });
         console.log(`Order ${id} status updated to PENDING in Firebase from Speed API check.`);
      }
    }

    // 4. Return the determined status to the frontend
    return res.status(200).json({ status: newStatus });

  } catch (err) {
    console.error(`Error checking payment status for order ${id}:`, err.message || err);
    return res.status(500).json({ message: 'Internal server error while checking status.' });
  }
}