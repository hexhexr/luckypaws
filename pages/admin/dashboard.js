import { useEffect, useState } from 'react';

export default function AdminDashboard() {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusCheckResult, setStatusCheckResult] = useState(null);

  useEffect(() => {
    const fetchOrders = async () => {
      const res = await fetch('/api/orders');
      const data = await res.json();
      setOrders(data);
      setLoading(false);
    };
    fetchOrders();
  }, []);

  const checkStatus = async (orderId) => {
    try {
      const res = await fetch(`/api/admin/check-status?id=${orderId}`);
      const data = await res.json();
      setStatusCheckResult({ id: orderId, status: data.status || 'unknown' });
    } catch (err) {
      console.error('Error checking order status:', err);
      setStatusCheckResult({ id: orderId, status: 'error' });
    }
  };

  if (loading) return <p className="text-center mt-lg">Loading orders...</p>;

  return (
    <div className="container mt-lg">
      <h1 className="text-center">📊 Admin Dashboard</h1>
      <table className="table mt-md">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>User</th>
            <th>Game</th>
            <th>Amount</th>
            <th>Method</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.orderId}>
              <td>{o.orderId}</td>
              <td>{o.username}</td>
              <td>{o.game}</td>
              <td>${o.amount}</td>
              <td>{o.method}</td>
              <td>{o.status}</td>
              <td>{new Date(o.created).toLocaleString()}</td>
              <td>
                <button className="btn btn-sm btn-primary" onClick={() => checkStatus(o.orderId)}>
                  Check Status
                </button>
                {statusCheckResult?.id === o.orderId && (
                  <p className="mt-sm"><strong>Status:</strong> {statusCheckResult.status}</p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
