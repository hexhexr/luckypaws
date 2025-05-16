import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function ReceiptPage() {
  const router = useRouter();
  const { id } = router.query;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;

    const loadReceipt = async () => {
      try {
        // Step 1: Fetch from Firebase
        const res = await fetch(`/api/orders?id=${id}`);
        const data = await res.json();

        if (!res.ok || !data?.orderId) throw new Error('Order not found');
        if (data.status === 'paid') {
          setOrder(data);
          setLoading(false);
          return;
        }

        // Step 2: Try syncing from Speed API
        const checkRes = await fetch(`/api/check-payment-status?id=${id}`);
        const checkData = await checkRes.json();

        if (checkData.status === 'paid') {
          // Re-fetch updated order
          const refetched = await fetch(`/api/orders?id=${id}`);
          const updatedOrder = await refetched.json();
          setOrder(updatedOrder);
        } else {
          throw new Error('⏳ Payment is still pending. Please wait or refresh.');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadReceipt();
  }, [id]);

  if (loading) return <p>Loading receipt...</p>;
  if (error) return <div className="alert">{error}</div>;

  return (
    <div className="receipt-container">
      <h1 className="receipt-header">✅ Payment Received</h1>
      <div className="receipt-box">
        <p><strong>Username:</strong> {order.username}</p>
        <p><strong>Game:</strong> {order.game}</p>
        <p><strong>Amount (USD):</strong> ${order.amount}</p>
        <p><strong>BTC:</strong> {order.btc}</p>
        <p><strong>Order ID:</strong> {order.orderId}</p>
        <p><strong>Paid Manually:</strong> {order.paidManually ? 'Yes' : 'No'}</p>
      </div>
    </div>
  );
}
