// src/pages/coinbase/receipt.js
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import ReceiptModal from '../../components/ReceiptModal'; // Re-using the existing modal

export default function CoinbaseReceiptPage() {
  const router = useRouter();
  const { orderId } = router.query;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pollingRef = useRef(null);

  useEffect(() => {
    if (!orderId) return;

    const stopPolling = () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };

    const fetchOrderDetails = async () => {
      try {
        const res = await fetch(`/api/orders?id=${orderId}`);
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.message || 'Could not fetch order.');

        if (data.status === 'paid') {
          stopPolling();
          setOrder(data);
          setError('');
        } else if (data.status === 'pending') {
          setError('⏳ Payment is pending... We will update this page automatically upon confirmation.');
          if (!pollingRef.current) {
             pollingRef.current = setInterval(fetchOrderDetails, 4000); // Poll every 4 seconds
          }
        } else {
            stopPolling();
            setError('This payment could not be confirmed or has failed.');
        }
      } catch (err) {
        stopPolling();
        setError('An error occurred while fetching your order. Please contact support.');
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
    return () => stopPolling();
  }, [orderId]);

  if (loading) {
    return <div className="loading-screen"><p>Finalizing your payment, please wait...</p></div>;
  }

  return (
    <>
      <Head>
        <title>{order ? 'Payment Confirmed' : 'Payment Status'}</title>
      </Head>
      <Header />
      <main className="container main-content" style={{ maxWidth: '600px', paddingTop: '5rem' }}>
        {error && !order && <div className="alert alert-info">{error}</div>}
        {order && (
            <ReceiptModal order={order} resetModals={() => router.push('/')} />
        )}
      </main>
      <Footer />
    </>
  );
}