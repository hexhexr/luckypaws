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
    if (!id) {
        setLoading(false);
        setError("No order ID provided.");
        return;
    };

    const stopPolling = () => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    }

    const loadReceipt = async () => {
        try {
            // This API now only returns minimal, safe data for a public receipt
            const res = await fetch(`/api/orders?id=${id}`);
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || 'Could not fetch order details.');
            }
            const data = await res.json();
            
            if (data.status === 'paid' || data.status === 'completed') {
                setOrder(data);
                setError('');
                setLoading(false);
                stopPolling();
            } else if (data.status === 'expired' || data.status === 'failed') {
                setError('This payment has expired or failed. Please create a new one.');
                setLoading(false);
                stopPolling();
            } else {
                // Status is likely 'pending', start polling
                setLoading(false); // We are no longer loading, we are waiting
                setError('⏳ Payment is pending. Waiting for confirmation...');
                
                if (!pollingRef.current) { // Start polling only if not already running
                    pollingRef.current = setInterval(async () => {
                        console.log("Polling for status...");
                        const checkRes = await fetch(`/api/check-status?id=${id}`);
                        const checkData = await checkRes.json();
                        if (checkData.status === 'paid' || checkData.status === 'completed') {
                            stopPolling();
                            loadReceipt(); // Re-fetch the full data now that it's paid
                        } else if (checkData.status === 'expired' || checkData.status === 'failed') {
                            stopPolling();
                            setError('This payment has expired or failed. Please create a new one.');
                        }
                    }, 5000); // Poll every 5 seconds
                }
            }
        } catch (err) {
            setError(err.message);
            setLoading(false);
            stopPolling();
        }
    };

    loadReceipt();

    return () => stopPolling(); // Cleanup on unmount

  }, [id]);

  if (loading) return <p className="text-center mt-xl">Loading receipt...</p>;

  return (
    <>
    <Head>
        <title>{order ? `Receipt for Order ${order.orderId}` : 'Payment Status'}</title>
    </Head>
    <Header />
    <main className="container mt-xl">
      <div className="card">
        {order ? (
            <>
            <h1 className="card-header text-success">✅ Payment Received</h1>
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
                    <strong>Invoice:</strong> {order.invoice}
                </div>
              )}
               <button className="btn btn-primary mt-lg" onClick={() => router.push('/')}>Done</button>
            </div>
            </>
        ) : (
            <div className="card-body text-center">
                <h1 className="card-header">{error.includes('pending') ? 'Waiting for Payment' : 'Error'}</h1>
                <p className={`alert ${error.includes('pending') ? 'alert-info' : 'alert-danger'} mt-md`}>{error}</p>
                {error.includes('pending') && <p className="text-light">This page will update automatically once payment is confirmed.</p>}
            </div>
        )}
      </div>
    </main>
    <Footer />
    </>
  );
}