import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { db } from '../lib/firebaseClient';

export default function Receipt() {
  const router = useRouter();
  const { id } = router.query;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;

    const unsubscribe = db.collection('orders').doc(id).onSnapshot(doc => {
      if (doc.exists) {
        const data = doc.data();
        if (data.status === 'paid') {
          setOrder(data);
        } else {
          setNotFound(true);
        }
      } else {
        setNotFound(true);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  if (loading) return <div className="container text-center mt-lg">Loading...</div>;
  if (notFound || !order) return <div className="container text-center mt-lg"><p className="alert alert-danger">Receipt not found or not yet paid.</p></div>;

  return (
    <div className="container mt-lg">
      <div className="receipt-modal">
        <h2 className="receipt-header">✅ Payment Received</h2>

        <div className="receipt-amounts">
          <div className="usd-amount">${order.amount}</div>
          <div className="btc-amount">({order.btc} BTC)</div>
        </div>

        <div className="receipt-details">
          <p><strong>Username:</strong> {order.username}</p>
          <p><strong>Game:</strong> {order.game}</p>
          <p><strong>Order ID:</strong> {order.orderId}</p>
          <p><strong>Method:</strong> {order.method}</p>
          <p><strong>Date:</strong> {new Date(order.created).toLocaleString()}</p>
        </div>

        <div className="scroll-box short-invoice">
          {order.invoice
            ? `Invoice: ${order.invoice.slice(0, 8)}...${order.invoice.slice(-8)}`
            : `Address: ${order.address.slice(0, 8)}...${order.address.slice(-8)}`}
        </div>

        <div className="text-center mt-md">
          <button className="btn btn-primary" onClick={() => router.push('/')}>Done</button>
        </div>
      </div>
    </div>
  );
}
