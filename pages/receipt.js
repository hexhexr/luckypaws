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

    const load = async () => {
      try {
        const res = await fetch(`/api/orders?id=${id}`);
        const data = await res.json();
        if (!res.ok || !data?.orderId) throw new Error('Order not found');

        if (data.status === 'paid') {
          setOrder(data);
        } else {
          const check = await fetch(`/api/check-status?id=${id}`);
          const updated = await check.json();
          if (updated.status === 'paid') {
            const latest = await fetch(`/api/orders?id=${id}`);
            const refreshed = await latest.json();
            setOrder(refreshed);
          } else {
            throw new Error('Payment is still pending.');
          }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const shorten = str => str ? `${str.slice(0, 8)}…${str.slice(-6)}` : '';

  if (loading) return <p className="text-center mt-lg">Loading receipt...</p>;
  if (error) return <div className="alert alert-danger mt-lg text-center">{error}</div>;

  return (
    <div className="container mt-lg">
      <div className="card receipt-modal">
        <h2 className="receipt-header">✅ Payment Received</h2>
        <div className="receipt-amounts">
          <p className="usd-amount">${order.amount}</p>
          <p className="btc-amount">{order.btc || '0.00000000'} BTC</p>
        </div>
        <div className="receipt-details">
          <p><strong>Username:</strong> {order.username}</p>
          <p><strong>Game:</strong> {order.game}</p>
          <p><strong>Order ID:</strong> {order.orderId}</p>
          <p><strong>Invoice:</strong></p>
          <div className="scroll-box short-invoice">{shorten(order.invoice || order.address)}</div>
        </div>
        <p className="text-center" style={{ fontSize: '0.85rem', color: '#888', marginTop: '1rem' }}>
          Your payment has been verified. This receipt is official and can be used as proof.
        </p>
      </div>
    </div>
  );
}
