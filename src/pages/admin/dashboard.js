// pages/admin/dashboard.js
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { db } from '../../lib/firebaseClient'; // Client-side Firestore instance
import { auth as firebaseAuth } from '../../lib/firebaseClient'; // Client-side Firebase Auth instance
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, getDocs, doc, deleteDoc, updateDoc, setDoc, limit } from "firebase/firestore";
import { onAuthStateChanged } from 'firebase/auth'; // Explicitly import onAuthStateChanged for clarity
import axios from 'axios';

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

const OrderDetailModal = ({ order, onClose, onUpdateOrder }) => {
  const [editedOrder, setEditedOrder] = useState(order);
  const [isEditing, setIsEditing] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');

  useEffect(() => {
    setEditedOrder(order);
    setUpdateMessage('');
    setIsEditing(false); // Reset editing state when order changes
  }, [order]);

  if (!order) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditedOrder(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setUpdateMessage('');
    try {
      await onUpdateOrder(editedOrder.id, editedOrder);
      setUpdateMessage('Order updated successfully!');
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving order details:', error);
      setUpdateMessage(`Failed to update order: ${error.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-4">Order Details (ID: {order.id})</h3>
        {isEditing ? (
          <>
            <label>Username:</label>
            <input type="text" name="username" value={editedOrder.username} onChange={handleChange} className="input mb-2" />

            <label>Game:</label>
            <input type="text" name="game" value={editedOrder.game} onChange={handleChange} className="input mb-2" />

            <label>Amount:</label>
            <input type="number" name="amount" value={editedOrder.amount} onChange={handleChange} className="input mb-2" />

            <label>Status:</label>
            <select name="status" value={editedOrder.status} onChange={handleChange} className="input mb-2">
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="archived">Archived</option>
            </select>

            <label>Notes:</label>
            <textarea name="notes" value={editedOrder.notes || ''} onChange={handleChange} className="input mb-2"></textarea>

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={handleSave} className="btn btn-primary">Save Changes</button>
              <button onClick={() => setIsEditing(false)} className="btn btn-secondary">Cancel</button>
            </div>
            {updateMessage && <p className="mt-2 text-sm text-center" style={{ color: updateMessage.includes('successfully') ? 'green' : 'red' }}>{updateMessage}</p>}
          </>
        ) : (
          <>
            <p><strong>Username:</strong> {order.username}</p>
            <p><strong>Game:</strong> {order.game}</p>
            <p><strong>Amount:</strong> ${order.amount}</p>
            <p><strong>Status:</strong> <span className={`status-badge ${order.status}`}>{order.status}</span></p>
            <p><strong>Created:</strong> {new Date(order.created).toLocaleString()}</p>
            {order.notes && <p><strong>Notes:</strong> {order.notes}</p>}
            <p><strong>Agent:</strong> {order.agentName || 'N/A'}</p>
            <p><strong>Customer:</strong> {order.customerName || 'N/A'}</p> {/* Assuming you have customerName in order data */}

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setIsEditing(true)} className="btn btn-secondary">Edit Order</button>
              <button onClick={onClose} className="btn btn-primary">Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};


export default function AdminDashboard() {
  const router = useRouter();
  const [loadingAuth, setLoadingAuth] = useState(true); // Separate loading for auth
  const [loadingData, setLoadingData] = useState(true); // Loading for data fetch
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ totalOrders: 0, totalAmount: 0, pendingOrders: 0, paidOrders: 0 });
  const [error, setError] = useState('');
  const [modalOrder, setModalOrder] = useState(null); // State for the order details modal

  // Function to get the ID token from the current Firebase user
  const getIdToken = useCallback(async () => {
    const user = firebaseAuth.currentUser;
    if (user) {
      return await user.getIdToken();
    }
    return null; // Return null if no user is signed in
  }, []); // Memoize to prevent unnecessary re-renders

  // Authentication check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, user => {
      if (!user) {
        // No user is signed in, redirect to admin login
        router.replace('/admin');
      } else {
        // User is signed in, proceed to fetch data
        fetchOrders();
        // Setup real-time listener for orders
        const q = query(collection(db, 'orders'), orderBy('created', 'desc'), where('status', 'in', ['pending', 'paid']));
        const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
          const fetchedOrders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            created: doc.data().created?.toDate ? doc.data().created.toDate().toISOString() : doc.data().created, // Convert Timestamp to ISO string if exists
          }));
          setOrders(fetchedOrders);
          updateStats(fetchedOrders);
          setLoadingData(false); // Data loading complete
        }, (error) => {
          console.error("Error listening to orders:", error);
          setError("Failed to listen to orders. Please try refreshing.");
          setLoadingData(false);
        });
        return () => unsubscribeSnapshot(); // Cleanup real-time listener
      }
      setLoadingAuth(false); // Auth check complete
    });

    return () => unsubscribe(); // Cleanup auth listener
  }, [router, getIdToken]); // Include getIdToken in dependency array

  const updateStats = useCallback((currentOrders) => {
    const totalOrders = currentOrders.length;
    const totalAmount = currentOrders.reduce((sum, order) => sum + (order.amount || 0), 0);
    const pendingOrders = currentOrders.filter(order => order.status === 'pending').length;
    const paidOrders = currentOrders.filter(order => order.status === 'paid').length;
    setStats({ totalOrders, totalAmount, pendingOrders, paidOrders });
  }, []);

  // Initial fetch of orders (used for initial load or manual refresh)
  const fetchOrders = useCallback(async () => {
    setError('');
    setLoadingData(true);
    try {
      const token = await getIdToken(); // Get the ID token
      if (!token) {
        router.replace('/admin'); // Should ideally be caught by onAuthStateChanged
        return;
      }

      const res = await axios.get('/api/admin/orders', {
        headers: {
          Authorization: `Bearer ${token}` // Include the token
        }
      });
      // The onSnapshot listener will ultimately update the state, but this initial fetch ensures data if listener is slow
      // setOrders(res.data.map(order => ({ ...order, created: order.created?.toDate ? order.created.toDate().toISOString() : order.created })));
      // updateStats(res.data);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      setError(`Failed to load orders: ${err.response?.data?.message || err.message}`);
    } finally {
      // The onSnapshot listener will set loadingData to false, so no finally block here for it.
    }
  }, [router, getIdToken, updateStats]);

  const archiveOrder = async (orderId) => {
    if (!confirm('Are you sure you want to archive this order?')) return;
    try {
      const token = await getIdToken();
      if (!token) {
        router.replace('/admin');
        return;
      }
      await axios.post('/api/admin/archive', { id: orderId }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      // UI update is handled by the onSnapshot listener after Firestore update
      console.log(`Order ${orderId} archived.`);
    } catch (err) {
      console.error('Failed to archive order:', err);
      alert(`Failed to archive order: ${err.response?.data?.message || err.message}`);
    }
  };

  const deleteOrder = async (orderId) => {
    if (!confirm('Are you sure you want to delete this order? This action cannot be undone.')) return;
    try {
      const token = await getIdToken();
      if (!token) {
        router.replace('/admin');
        return;
      }
      // Assuming you have an API route for deleting orders: /api/admin/delete-order
      await axios.delete(`/api/admin/delete-order`, { // Using DELETE method
        headers: {
          Authorization: `Bearer ${token}`
        },
        data: { id: orderId } // DELETE requests can have a body in axios
      });
      // UI update is handled by the onSnapshot listener after Firestore delete
      console.log(`Order ${orderId} deleted.`);
    } catch (err) {
      console.error('Failed to delete order:', err);
      alert(`Failed to delete order: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleUpdateOrder = async (orderId, updates) => {
    try {
      const token = await getIdToken();
      if (!token) {
        router.replace('/admin');
        throw new Error('Authentication required.');
      }
      await axios.post('/api/admin/update', { id: orderId, update: updates }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      // UI update is handled by the onSnapshot listener after Firestore update
      console.log(`Order ${orderId} updated.`);
    } catch (err) {
      console.error('Failed to update order:', err);
      throw new Error(`Failed to update order: ${err.response?.data?.message || err.message}`);
    }
  };


  if (loadingAuth || loadingData) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
        <div className="alert alert-danger mt-4">{error}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Head>
        <title>Admin Dashboard</title>
      </Head>

      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      {/* Statistics Section */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Orders" value={stats.totalOrders} icon="📦" color="#4F46E5" />
        <StatCard title="Total Amount" value={`$${stats.totalAmount.toFixed(2)}`} icon="💰" color="#10B981" />
        <StatCard title="Pending Orders" value={stats.pendingOrders} icon="⏳" color="#F59E0B" />
        <StatCard title="Paid Orders" value={stats.paidOrders} icon="✅" color="#EF4444" />
      </section>

      {/* Recent Orders Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Recent Orders (Pending & Paid)</h2>
        {orders.length === 0 ? (
          <p>No recent orders found.</p>
        ) : (
          <div className="overflow-x-auto bg-white shadow rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Game</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.username}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.game}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${order.amount?.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`status-badge ${order.status}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(order.created).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
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
                      {/* You might want a separate API for deletion if it's permanent */}
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

      <OrderDetailModal
        order={modalOrder}
        onClose={() => setModalOrder(null)}
        onUpdateOrder={handleUpdateOrder}
      />

      {/* Basic Styles (consider moving to a global CSS file or Tailwind config) */}
      <style jsx global>{`
        .container {
          max-width: 1200px;
        }
        .card {
          background-color: #fff;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          padding: 1.5rem;
        }
        .stat-card {
          border-left: 5px solid;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .stat-card-title {
          font-size: 0.9rem;
          text-transform: uppercase;
          color: #6B7280; /* gray-500 */
        }
        .stat-card-value {
          font-size: 1.8rem;
          font-weight: bold;
          color: #1F2937; /* gray-900 */
        }
        .stat-card-icon {
          font-size: 2.5rem;
        }

        .status-badge {
          display: inline-flex;
          padding: 0.25em 0.5em;
          border-radius: 9999px; /* Tailwind 'rounded-full' */
          font-size: 0.75rem; /* Tailwind 'text-xs' */
          font-weight: 500;
          line-height: 1;
          align-items: center;
          justify-content: center;
          text-transform: capitalize;
        }

        .status-badge.pending {
          background-color: #FEF3C7; /* yellow-100 */
          color: #B45309; /* yellow-800 */
        }

        .status-badge.paid {
          background-color: #D1FAE5; /* green-100 */
          color: #065F46; /* green-800 */
        }

        .status-badge.archived {
          background-color: #E5E7EB; /* gray-200 */
          color: #4B5563; /* gray-600 */
        }
        
        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }
        .modal-content {
          background: white;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
          max-width: 500px;
          width: 90%;
          position: relative;
        }
        .input {
          display: block;
          width: 100%;
          padding: 0.5rem 0.75rem;
          margin-bottom: 1rem;
          border: 1px solid #D1D5DB; /* gray-300 */
          border-radius: 0.375rem; /* rounded-md */
          font-size: 1rem;
        }
        .btn {
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s ease-in-out;
        }
        .btn-primary {
          background-color: #4F46E5; /* indigo-600 */
          color: white;
        }
        .btn-primary:hover {
          background-color: #4338CA; /* indigo-700 */
        }
        .btn-secondary {
          background-color: #E5E7EB; /* gray-200 */
          color: #1F2937; /* gray-900 */
        }
        .btn-secondary:hover {
          background-color: #D1D5DB; /* gray-300 */
        }
        /* Basic utilities for spacing and text */
        .mb-2 { margin-bottom: 0.5rem; }
        .mb-4 { margin-bottom: 1rem; }
        .mb-8 { margin-bottom: 2rem; }
        .mt-2 { margin-top: 0.5rem; }
        .mt-4 { margin-top: 1rem; }
        .text-sm { font-size: 0.875rem; }
        .text-center { text-align: center; }
        .flex { display: flex; }
        .justify-end { justify-content: flex-end; }
        .gap-2 { gap: 0.5rem; }
        .grid { display: grid; }
        .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
        @media (min-width: 768px) { .md\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (min-width: 1024px) { .lg\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
        .px-4 { padding-left: 1rem; padding-right: 1rem; }
        .py-8 { padding-top: 2rem; padding-bottom: 2rem; }
        .mx-auto { margin-left: auto; margin-right: auto; }
        .font-bold { font-weight: 700; }
        .font-semibold { font-weight: 600; }
        .text-2xl { font-size: 1.5rem; }
        .text-xl { font-size: 1.25rem; }
        .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
        .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
        .whitespace-nowrap { white-space: nowrap; }
        .text-left { text-align: left; }
        .text-right { text-align: right; }
        .text-xs { font-size: 0.75rem; }
        .uppercase { text-transform: uppercase; }
        .tracking-wider { letter-spacing: 0.05em; }
        .divide-y > :not([hidden]) ~ :not([hidden]) { border-top-width: 1px; }
        .divide-gray-200 { border-color: #E5E7EB; }
        .bg-gray-50 { background-color: #F9FAFB; }
        .bg-white { background-color: #FFFFFF; }
        .shadow { box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06); }
        .rounded-lg { border-radius: 0.5rem; }
        .text-gray-500 { color: #6B7280; }
        .text-gray-900 { color: #1F2937; }
        .text-indigo-600 { color: #4F46E5; }
        .hover\:text-indigo-900:hover { color: #3730A3; }
        .text-red-600 { color: #DC2626; }
        .hover\:text-red-900:hover { color: #7F1D1D; }
        .text-gray-600 { color: #4B5563; }
        .hover\:text-gray-900:hover { color: #1F2937; }
        .alert {
            padding: 1rem;
            border-radius: 0.25rem;
            margin-bottom: 1rem;
        }
        .alert-danger {
            background-color: #FEE2E2; /* red-100 */
            color: #991B1B; /* red-800 */
            border: 1px solid #FCA5A5; /* red-300 */
        }
      `}</style>
    </div>
  );
}