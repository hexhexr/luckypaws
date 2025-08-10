// src/pages/coinbase/receipt.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import ReceiptModal from '../../components/ReceiptModal';

export default function CoinbaseReceiptPage() {
  const router = useRouter();
  const { orderId } = router.query;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId) return;

    const fetchOrderDetails = async () => {
      try {
        const res = await fetch(`/api/orders?id=${orderId}`);
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.message || 'Could not fetch order.');
        setOrder(data);
        
      } catch (err) {
        setError('An error occurred while fetching your order. Please contact support.');
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [orderId]);

  if (loading) {
    return <div className="loading-screen"><p>Loading your receipt...</p></div>;
  }

  return (
    <>
      <Head>
        <title>{order ? 'Payment Confirmed' : 'Payment Status'}</title>
      </Head>
      <Header />
      <main className="container main-content" style={{ maxWidth: '600px', paddingTop: '5rem' }}>
        {error && !order && <div className="alert alert-danger">{error}</div>}
        {order && (
            <ReceiptModal order={order} resetModals={() => router.push('/')} />
        )}
      </main>
      <Footer />
    </>
  );
}