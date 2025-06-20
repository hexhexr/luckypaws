import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function ReceiptPage() {
  const router = useRouter();
  const { id } = router.query;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pollingRef = useRef(null);

  useEffect(() => {
    if (!id) return;

    const stopPolling = () => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
        }
    };

    const checkStatus = async () => {
      try {
        // --- FIX: Corrected the API endpoint URL ---
        const res = await fetch(`/api/check-status?id=${id}`);
        const data = await res.json();
        
        if (data.status === 'paid') {
          stopPolling();
          // Refetch the full order details to show the receipt
          const orderRes = await fetch(`/api/orders?id=${id}`);
          const orderData = await orderRes.json();
          setOrder(orderData);
          setError('');
          setLoading(false);
        } else if (data.status === 'expired') {
          stopPolling();
          setError('This payment link has expired.');
          setLoading(false);
        }
        // If still pending, the interval will simply run again
      } catch (err) {
        stopPolling();
        setError('Could not verify payment status. Please contact support.');
        setLoading(false);
      }
    };

    const loadReceipt = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/orders?id=${id}`);
        const data = await res.json();

        if (!res.ok || !data?.orderId) throw new Error('Order not found.');
        
        if (data.status === 'paid') {
          setOrder(data);
          setLoading(false);
        } else if (data.status === 'expired') {
          setError('This payment link has expired.');
          setLoading(false);
        } else {
          // --- FIX: Start polling for pending orders ---
          setError('⏳ Payment is pending... Awaiting confirmation.');
          // Initial check
          checkStatus(); 
          // Set interval for subsequent checks
          pollingRef.current = setInterval(checkStatus, 3000);
        }
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    loadReceipt();

    // Cleanup effect
    return () => stopPolling();
  }, [id]);

  if (loading) return <p className="text-center mt-xl">Loading receipt...</p>;

  return (
    <>
      <Head>
        <title>{order ? 'Payment Confirmed' : 'Payment Status'}</title>
      </Head>
      <Header />
      <main className="container main-content" style={{maxWidth: '600px'}}>
        {error && !order && <div className="alert alert-info">{error}</div>}
        {order && (
          <div className="card">
            <h1 className="card-header">✅ Payment Received</h1>
            <div className="card-body">
              <div className="amount-display mb-lg">
                <span className="usd-amount"><strong>${order.amount}</strong> USD</span>
                <span className="btc-amount">{order.btc} BTC</span>
              </div>
              <div className="info-section">
                <p><strong>Game:</strong> <span>{order.game}</span></p>
                <p><strong>Username:</strong> <span>{order.username}</span></p>
                <p><strong>Order ID:</strong> <span>{order.orderId}</span></p>
              </div>
              {order.invoice && (
                <div className="short-invoice-display mt-md">
                  <strong>Full Invoice:</strong> {order.invoice}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}