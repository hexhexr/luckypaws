// pages/admin/dashboard.js
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { db } from '../../lib/firebaseClient'; // ASSUMPTION: Client-side firebase is configured
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";

// --- Reusable UI Components ---

const StatCard = ({ title, value, icon, color }) => (
  <div className="stat-card" style={{ borderLeft: `5px solid ${color}` }}>
    <div><p style={{ color }}>{title}</p><h3>{value}</h3></div>
    <div className="stat-card-icon">{icon}</div>
  </div>
);

const OrderDetailModal = ({ order, onClose }) => {
    if (!order) return null;
    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h2>Order Details: {order.id}</h2>
                <ul>
                    {Object.entries(order).map(([key, value]) => (
                        <li key={key}><strong>{key}:</strong> {JSON.stringify(value)}</li>
                    ))}
                </ul>
                <button className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
        </div>
    );
};

const Notification = ({ message, type, onDismiss }) => {
    if (!message) return null;
    return (
        <div className={`notification notification-${type}`}>
            {message}
            <button onClick={onDismiss}>&times;</button>
        </div>
    );
};


// --- Main Dashboard Component ---

export default function AdminDashboard() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ message: '', type: '' });
  
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // --- Real-time Data Fetching ---
  useEffect(() => {
    // Ensure client-side Firebase is available before trying to use it
    if (typeof window === 'undefined' || !db) {
        setNotification({message: 'Firebase client not available.', type: 'error'});
        return;
    }

    const q = query(
      collection(db, "orders"), 
      where("status", "in", ["pending", "paid"]), 
      orderBy("created", "desc")
    );

    // onSnapshot creates a real-time listener
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const ordersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(ordersData);
      setLoading(false);
    }, (error) => {
      console.error("Real-time listener failed:", error);
      setNotification({ message: `Failed to connect to real-time data. ${error.message}`, type: 'error' });
      setLoading(false);
    });

    // Cleanup subscription on component unmount
    return () => unsubscribe();
  }, []);

  const dismissNotification = () => setNotification({ message: '', type: '' });

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => dismissNotification(), 5000);
  };
  
  // --- Order Actions ---

  const handleAction = async (apiPath, body, successMessage) => {
    try {
        const res = await fetch(apiPath, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'API request failed');
        showNotification(successMessage, 'success');
    } catch (err) {
        console.error(`Action failed at ${apiPath}:`, err);
        showNotification(err.message, 'error');
    }
  };

  const markAsRead = (id) => handleAction('/api/orders/update', { id, update: { read: true } }, `Order ${id} marked as read.`);
  const archiveOrder = (id) => {
    if (window.confirm(`Are you sure you want to archive order ${id}? It will be hidden from the dashboard.`)) {
        handleAction('/api/orders/archive', { id }, `Order ${id} has been archived.`);
    }
  }

  // --- Modal Logic ---
  const viewOrderDetails = async (id) => {
    try {
        const res = await fetch(`/api/orders?id=${id}`);
        if (!res.ok) throw new Error('Failed to fetch order details.');
        const data = await res.json();
        setSelectedOrder(data);
        setIsModalOpen(true);
    } catch (err) {
        showNotification(err.message, 'error');
    }
  };
  
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedOrder(null);
  };

  // --- Render Logic ---
  const summary = {
    pending: orders.filter(o => o.status === 'pending').length,
    paid: orders.filter(o => o.status === 'paid').length,
    revenue: orders.filter(o => o.status === 'paid').reduce((sum, o) => sum + parseFloat(o.amount || 0), 0).toFixed(2)
  };

  return (
    <div className="admin-dashboard">
        <style jsx global>{`
            /* All styles from previous response are assumed here, plus new modal/notification styles */
            .notification { position: fixed; top: 20px; right: 20px; padding: 1rem 1.5rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 1000; display: flex; align-items: center; gap: 1rem; }
            .notification-success { background: #2ecc71; color: white; }
            .notification-error { background: #e74c3c; color: white; }
            .notification button { background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer; }
            .modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 999; }
            .modal-content { background: white; padding: 2rem; border-radius: 12px; width: 90%; max-width: 600px; max-height: 80vh; overflow-y: auto; }
            .modal-content h2 { margin-top: 0; }
            .modal-content ul { list-style: none; padding: 0; }
            .modal-content li { background: #f4f7fa; padding: 0.5rem; border-radius: 4px; margin-bottom: 0.5rem; }
            .action-buttons { display: flex; gap: 0.5rem; }
        `}</style>
      
      <Notification message={notification.message} type={notification.type} onDismiss={dismissNotification} />
      <OrderDetailModal order={selectedOrder} onClose={closeModal} />

      {/* Sidebar remains the same */}
      <div className="sidebar">
          <h1>Lucky Paw Admin</h1>
          {/* ... nav buttons ... */}
      </div>

      <div className="main-content">
        <div className="dashboard-header"><h1>Dashboard</h1></div>

        {loading ? <p>Loading real-time data...</p> : (
            <>
                <div className="stat-cards-grid">
                    <StatCard title="Total Revenue (Paid)" value={`$${summary.revenue}`} icon="💵" color="#3498db" />
                    <StatCard title="Live Pending Orders" value={summary.pending} icon="⏳" color="#f39c12" />
                    <StatCard title="Total Paid Orders" value={summary.paid} icon="✔️" color="#2ecc71" />
                </div>
                
                <div className="card orders-table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>Status</th>
                                <th>Amount</th>
                                <th>Created At</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map(order => (
                                <tr key={order.id} className={!order.read && order.status === 'paid' ? 'unread' : ''}>
                                    <td>{order.username}</td>
                                    <td><span className={`status-pill status-${order.status}`}>{order.status}</span></td>
                                    <td>${parseFloat(order.amount || 0).toFixed(2)}</td>
                                    <td>{new Date(order.created).toLocaleString()}</td>
                                    <td className="action-buttons">
                                        <button className="btn btn-sm btn-secondary" onClick={() => viewOrderDetails(order.id)}>Details</button>
                                        {order.status === 'paid' && !order.read && (
                                            <button className="btn btn-sm btn-primary" onClick={() => markAsRead(order.id)}>Mark Read</button>
                                        )}
                                        <button className="btn btn-sm btn-danger" onClick={() => archiveOrder(order.id)}>Archive</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </>
        )}
      </div>
    </div>
  );
}