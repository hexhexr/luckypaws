import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function Receipt() {
  const router = useRouter();
  const { id } = router.query;
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/check-status?id=${id}`)
      .then(res => res.json())
      .then(data => {
        if (data?.status === 'paid') setReceipt(data);
        else setError('Payment not confirmed or expired.');
      })
      .catch(() => setError('Failed to fetch receipt.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-center mt-lg">Loading receipt...</p>;
  if (error) return <div className="alert alert-danger mt-lg text-center">{error}</div>;

  return (
    <div className="container mt-lg">
      <div className="card">
        <h1 className="card-header text-center">Payment Receipt</h1>
        <div className="card-body">
          <p><strong>Order ID:</strong> {receipt.orderId}</p>
          <p><strong>Username:</strong> {receipt.username}</p>
          <p><strong>Game:</strong> {receipt.game}</p>
          <p><strong>USD Paid:</strong> ${receipt.amount}</p>
          <p><strong>BTC:</strong> {receipt.btc}</p>
          <p><strong>Short Invoice:</strong></p>
          <div className="scroll-box">
            {receipt.invoice
              ? `${receipt.invoice.slice(0, 12)}...${receipt.invoice.slice(-12)}`
              : `${receipt.address.slice(0, 12)}...${receipt.address.slice(-12)}`}
          </div>
          <p className="text-center mt-md">
            <button className="btn btn-primary" onClick={() => router.push('/')}>Back to Home</button>
          </p>
        </div>
      </div>
    </div>
  );
}
