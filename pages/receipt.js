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

    const fetchOrder = async () => {
      try {
        const doc = await db.collection('orders').doc(id).get();
        if (!doc.exists) {
          setNotFound(true);
          return;
        }
        const data = doc.data();
        if (data.status !== 'paid') {
          setNotFound(true);
          return;
        }
        setOrder(data);
      } catch (err) {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [id]);

  const shorten = (str) => {
    if (!str) return '';
    return str.length <= 12 ? str : `${str.slice(0, 5)}...${str.slice(-5)}`;
  };

  return (
    <div className="container mt-lg">
      {loading ? (
        <div className="text-center mt-lg">Loading receipt...</div>
      ) : notFound ? (
        <div className="alert alert-warning text-center">Waiting for payment confirmation...</div>
      ) : (
        <div className="card" style={{ maxWidth: 500, margin: '0 auto', padding: '2rem' }}>
          <div className="text-center">
            <div style={{ fontSize: '2.5rem', color: '#27ae60' }}>✅</div>
            <h2 className="mt-sm">Payment Received</h2>
            <p className="mt-sm" style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
              ${order.amount}
            </p>
            <p style={{ fontSize: '0.95rem' }}>{order.btc} BTC</p>
            <div className="mt-md" style={{ fontSize: '0.85rem', color: '#666' }}>
              <p><strong>Game:</strong> {order.game}</p>
              <p><strong>Username:</strong> {order.username}</p>
              <p><strong>Order ID:</strong> {shorten(order.orderId)}</p>
              <p><strong>Paid:</strong> {new Date(order.created).toLocaleString()}</p>
            </div>
            <button className="btn btn-primary mt-md" onClick={() => router.push('/')}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
