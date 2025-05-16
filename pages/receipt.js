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
        const res = await fetch(`/api/orders?id=${id}`);
        const data = await res.json();

        if (!res.ok || !data || !data.status) {
          throw new Error(data?.message || 'Order not found');
        }

        if (data.status !== 'paid') {
          setError('Payment is still pending. Please refresh once paid.');
        } else {
          setOrder(data);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [id]);

  if (loading) return <p>Loading receipt…</p>;
  if (error) return <div className="alert">{error}</div>;

  return (
    <div className="receipt-page">
      <h1>✅ Payment Received</h1>
      <div className="receipt-box">
        <p><strong>Username:</strong> {order.username}</p>
        <p><strong>Game:</strong> {order.game}</p>
        <p><strong>Amount:</strong> ${order.amount}</p>
        <p><strong>BTC:</strong> {order.btc}</p>
        <p><strong>Order ID:</strong> {order.orderId}</p>
        <p><strong>Paid Manually:</strong> {order.paidManually ? 'Yes' : 'No'}</p>
      </div>
    </div>
  );
}
