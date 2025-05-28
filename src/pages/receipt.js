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
        const res = await fetch(`/api/orders?id=${id}`);
        const data = await res.json();

        if (!res.ok || !data?.orderId) throw new Error('Order not found');
        if (data.status === 'paid') {
          setOrder(data);
          setLoading(false);
          return;
        }

        const checkRes = await fetch(`/api/check-payment-status?id=${id}`);
        const checkData = await checkRes.json();

        if (checkData.status === 'paid') {
          const refetched = await fetch(`/api/orders?id=${id}`);
          const updatedOrder = await refetched.json();
          setOrder(updatedOrder);
        } else {
          // This path means it's pending but not yet paid, keep polling
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

  if (loading) return <p className="text-center mt-xl">Loading receipt...</p>;
  if (error) return <div className="alert alert-danger container mt-xl">{error}</div>;

  return (
    <div className="container">
      <div className="card">
        <h1 className="card-header">✅ Payment Received</h1>
        <div className="card-body">
          <div className="amount-display mb-lg">
            <span className="usd-amount"><strong>${order.amount}</strong> USD</span>
            <span className="btc-amount">{order.btc} BTC</span>
          </div>

          <div className="info-section"> {/* Re-using for consistent look */}
            <p><strong>Game:</strong> <span>{order.game}</span></p>
            <p><strong>Username:</strong> <span>{order.username}</span></p>
            <p><strong>Order ID:</strong> <span>{order.orderId}</span></p>
            {/* Removed "Paid Manually" from here */}
          </div>
          {order.invoice && (
            <div className="short-invoice-display">
                <strong>Full Invoice:</strong> {order.invoice}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}