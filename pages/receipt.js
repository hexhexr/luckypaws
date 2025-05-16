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

    const fetchOrder = async () => {
      try {
        // Step 1: Load order from Firebase
        const res = await fetch(`/api/orders?id=${id}`);
        const data = await res.json();

        if (!res.ok || !data?.status) {
          throw new Error(data.message || 'Order not found');
        }

        // Step 2: If not paid, check Speed API to sync
        if (data.status !== 'paid') {
          const check = await fetch(`/api/check-payment-status?id=${id}`);
          const checkRes = await check.json();

          if (checkRes.status === 'paid') {
            // Re-fetch updated order
            const updated = await fetch(`/api/orders?id=${id}`);
            const updatedData = await updated.json();
            setOrder(updatedData);
          } else {
            throw new Error('⏳ Payment not received yet. Please wait or refresh.');
          }
        } else {
          setOrder(data);
        }
      } catch (err) {
        setError(err.message || 'Unable to load receipt');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
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
