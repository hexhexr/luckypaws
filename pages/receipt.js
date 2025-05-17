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
      if (!doc.exists) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const data = doc.data();
      if (data.status === 'paid') {
        setOrder(data);
        setNotFound(false);
      } else {
        setNotFound(true);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  const shorten = str => str ? `${str.slice(0, 8)}…${str.slice(-6)}` : '';

  if (loading) return <div className="container text-center mt-lg">Loading...</div>;
  if (notFound || !order) {
    return <div className="container text-center mt-lg"><p className="alert alert-danger">Payment not found or not yet confirmed.</p></div>;
  }

  return (
    <div className="container mt-lg">
      <div className="modal receipt-modal">
        <h2 className="receipt-header">✅ Payment Received</h2>
        <div className="receipt-amounts">
          <p className="usd-amount"><strong>${order.amount}</strong> USD</p>
          <p className="btc-amount">{order.btc || '0.00000000'} BTC</p>
        </div>
        <div className="receipt-details">
          <p><strong>Username:</strong> {order.username}</p>
          <p><strong>Game:</strong> {order.game}</p>
          <p><strong>Order ID:</strong> {order.orderId}</p>
          <p><strong>Short Invoice:</strong></p>
          <div className="scroll-box short-invoice">{shorten(order.invoice || order.address)}</div>
        </div>
        <div className="text-center mt-md">
          <button className="btn btn-primary" onClick={() => router.push('/')}>Done</button>
        </div>
      </div>
    </div>
  );
}
