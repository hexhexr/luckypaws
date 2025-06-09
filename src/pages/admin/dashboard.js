// pages/admin/dashboard.js
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
// Removed direct Firestore imports as data fetching moves to API routes
// import { db } from '../../lib/firebaseClient';
// import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, getDocs, doc, deleteDoc, updateDoc, setDoc, limit } from "firebase/firestore";

// Keep client-side auth for redirection purposes if needed, but not for data fetching
import { auth as firebaseAuth } from '../../lib/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth'; // Explicitly import onAuthStateChanged for clarity
import axios from 'axios'; // Import axios for making API requests

// --- Helper Components ---
const StatCard = ({ title, value, icon, color }) => (
  <div className="card stat-card" style={{ borderColor: color }}>
    <div>
      <h4 className="stat-card-title" style={{ color }}>{title}</h4>
      <h2 className="stat-card-value">{value}</h2>
    </div>
    <span className="stat-card-icon" style={{ color }}>{icon}</span>
  </div>
);

const OrderDetailModal = ({ order, onClose }) => {
  if (!order) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-4">Order Details (ID: {order.id})</h3>
        <p><strong>Username:</strong> {order.username}</p>
        <p><strong>Game:</strong> {order.game}</p>
        <p><strong>Amount:</strong> ${order.amount}</p>
        <p><strong>Status:</strong> {order.status}</p>
        <p><strong>Created:</strong> {order.created ? new Date(order.created?.toDate ? order.created.toDate() : order.created).toLocaleString() : 'N/A'}</p>
        <button onClick={onClose} className="btn btn-primary mt-4">Close</button>
      </div>
    </div>
  );
};

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orders, setOrders] = useState([]);
  const [totalOrders, setTotalOrders] = useState(0); 
  const [pendingOrders, setPendingOrders] = useState(0); 
  const [modalOrder, setModalOrder] = useState(null);

  // Authentication check: Redirect if not logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, user => {
      if (!user) {
        router.replace('/admin'); // Redirect to admin login if no user
      }
      setLoading(false); // Auth check complete
    });
    return () => unsubscribe(); // Clean up listener
  }, [router]);

  // Function to fetch orders from the API route
  const fetchOrders = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const response = await axios.get('/api/admin/orders'); // Fetch from your API route
      setOrders(response.data);
      setTotalOrders(response.data.length);
      setPendingOrders(response.data.filter(order => order.status === 'pending').length);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Failed to load orders. Please try again.');
      setOrders([]); // Clear orders on error
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch orders on component mount and whenever auth state changes
  useEffect(() => {
    if (!loading && firebaseAuth.currentUser) {
      fetchOrders();
    }
  }, [loading, firebaseAuth.currentUser, fetchOrders]); 

  // Handle order archiving (update status to 'archived' via API)
  const archiveOrder = async (orderId) => {
    try {
      await axios.post('/api/admin/orders/archive', { id: orderId });
      fetchOrders(); // Re-fetch orders to update the list after archiving
    } catch (err) {
      console.error('Error archiving order:', err);
      setError('Failed to archive order.');
    }
  };

  // Handle order deletion (remove via API)
  const deleteOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to delete this order? This action cannot be undone.')) {
      return;
    }
    try {
      await axios.delete(`/api/admin/orders?id=${orderId}`); // Assuming DELETE method for deletion
      fetchOrders(); // Re-fetch orders to update the list after deletion
    } catch (err) {
      console.error('Error deleting order:', err);
      setError('Failed to delete order.');
    }
  };

  if (loading) {
    return <p>Loading dashboard...</p>;
  }

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <Head>
        <title>Admin Dashboard</title>
      </Head>

      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      <section className="dashboard-stats grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard title="Total Orders" value={totalOrders} icon="📦" color="#3b82f6" />
        <StatCard title="Pending Orders" value={pendingOrders} icon="⏳" color="#f59e0b" />
        {/* Add more stat cards as needed, e.g., Total Revenue, New Users */}
      </section>

      <section className="orders-section">
        <h2 className="text-2xl font-semibold mb-4">Recent Orders</h2>
        {orders.length === 0 ? (
          <p>No orders to display.</p>
        ) : (
            <div className="overflow-x-auto bg-white shadow-md rounded-lg">
                <table className="min-w-full leading-normal">
                    <thead>
                        <tr>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                Order ID
                            </th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                Username
                            </th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                Game
                            </th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                Amount
                            </th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                Status
                            </th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                Date
                            </th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.map((order) => (
                            <tr key={order.id}>
                                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{order.id}</td>
                                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{order.username}</td>
                                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{order.game}</td>
                                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">${order.amount}</td>
                                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                    <span className={`relative inline-block px-3 py-1 font-semibold leading-tight ${
                                        order.status === 'pending' ? 'text-yellow-900' :
                                        order.status === 'paid' ? 'text-green-900' : 'text-gray-900'
                                    }`}>
                                        <span aria-hidden="true" className={`absolute inset-0 opacity-50 rounded-full ${
                                            order.status === 'pending' ? 'bg-yellow-200' :
                                            order.status === 'paid' ? 'bg-green-200' : 'bg-gray-200'
                                        }`}></span>
                                        <span className="relative">{order.status}</span>
                                    </span>
                                </td>
                                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                    {order.created ? new Date(order.created?.toDate ? order.created.toDate() : order.created).toLocaleString() : 'N/A'}
                                </td>
                                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                    <button
                                        className="text-indigo-600 hover:text-indigo-900 mr-2"
                                        onClick={() => setModalOrder(order)} // Show details in modal
                                    >
                                        Details
                                    </button>
                                    {order.status !== 'archived' && (
                                        <button
                                            className="text-red-600 hover:text-red-900"
                                            onClick={() => archiveOrder(order.id)}
                                        >
                                            Archive
                                        </button>
                                    )}
                                    <button
                                        className="text-gray-600 hover:text-gray-900 ml-2"
                                        onClick={() => deleteOrder(order.id)}
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
      </section>

      <OrderDetailModal order={modalOrder} onClose={() => setModalOrder(null)} />
    </div>
  );
}