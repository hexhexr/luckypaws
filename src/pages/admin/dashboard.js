// pages/admin/dashboard.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
// ASSUMPTION: You have a client-side firebase config file that exports the 'db' instance.
import { db } from '../../lib/firebaseClient'; 
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";

// --- Helper Components using classes from globals.css ---

const StatCard = ({ title, value, icon, color }) => (
    // Uses .card and .text-light from globals.css
    <div className="card" style={{ borderTop: `4px solid ${color}` }}>
        <div className="card-body">
            <h4 style={{ color }}>{title}</h4>
            <h2>{value}</h2>
            <span style={{ fontSize: '2.5rem', position: 'absolute', right: '20px', top: '25px', opacity: 0.2 }}>{icon}</span>
        </div>
    </div>
);

const OrderDetailModal = ({ order, onClose }) => {
    if (!order) return null;
    return (
        // Uses .modal-overlay and .modal classes from globals.css
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{textAlign: 'left', maxWidth: '600px'}} onClick={e => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={onClose}>&times;</button>
                <h3 className="modal-title">Order Details</h3>
                {/* Uses .info-section for structured data display */}
                <div className="info-section">
                    {Object.entries(order).map(([key, value]) => (
                        <p key={key}>
                            <strong>{key}:</strong>
                            <span>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                        </p>
                    ))}
                </div>
                <button className="btn btn-secondary" style={{width: 'auto'}} onClick={onClose}>Close</button>
            </div>
        </div>
    );
};

const Notification = ({ message, type, onDismiss }) => {
    if (!message) return null;
    // Uses .alert and .alert-danger/alert-success classes
    const alertClass = type === 'error' ? 'alert-danger' : 'alert-success';
    return (
        <div className={`notification alert ${alertClass}`}>
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

  // --- Real-time Data Fetching (Unchanged from previous version) ---
  useEffect(() => {
    if (localStorage.getItem('admin_auth') !== '1') {
      router.replace('/admin');
      return;
    }
    if (typeof window === 'undefined' || !db) return;

    const q = query(
      collection(db, "orders"), 
      where("status", "in", ["pending", "paid"]), 
      orderBy("created", "desc")
    );
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const ordersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(ordersData);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Listener Error:", error);
      // The user will see the index creation error message here
      setNotification({ message: `Database Error: ${error.message}`, type: 'error' });
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);
  
  // --- Action & Notification Handlers ---

  const dismissNotification = () => setNotification({ message: '', type: '' });

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => dismissNotification(), 5000);
  };
  
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
        showNotification(err.message, 'error');
    }
  };

  const markAsRead = (id) => handleAction('/api/orders/update', { id, update: { read: true } }, `Order marked as read.`);
  const archiveOrder = (id) => {
    if (window.confirm(`Are you sure you want to archive this order?`)) {
        handleAction('/api/orders/archive', { id }, `Order has been archived.`);
    }
  }

  // --- Modal Logic ---

  const viewOrderDetails = async (id) => {
    try {
        const res = await fetch(`/api/orders?id=${id}`);
        if (!res.ok) throw new Error((await res.json()).message);
        setSelectedOrder(await res.json());
        setIsModalOpen(true);
    } catch (err) {
        showNotification(err.message, 'error');
    }
  };
  
  const closeModal = () => setIsModalOpen(false);

  // --- Render Logic ---
  
  const summary = {
    pending: orders.filter(o => o.status === 'pending').length,
    paid: orders.filter(o => o.status === 'paid').length,
    revenue: orders.filter(o => o.status === 'paid').reduce((sum, o) => sum + parseFloat(o.amount || 0), 0).toFixed(2)
  };

  if (loading) return <div className="loader">Connecting to Database...</div>;

  return (
    <>
      {/* This new <style jsx> block ONLY contains layout styles not present in globals.css */}
      <style jsx>{`
        .admin-layout {
          display: flex;
          min-height: 100vh;
        }
        .sidebar {
          width: 260px;
          background: #1a202c; /* Dark sidebar for contrast */
          color: #e2e8f0;
          padding: var(--spacing-lg);
          display: flex;
          flex-direction: column;
        }
        .sidebar-header { font-size: 1.5rem; font-weight: 700; margin-bottom: var(--spacing-xl); color: #fff; }
        .nav-btn { background: none; border: none; width: 100%; color: #a0aec0; text-align: left; padding: 0.8rem 1rem; margin-bottom: var(--spacing-sm); border-radius: var(--button-border-radius); font-size: 1rem; cursor: pointer; }
        .nav-btn:hover, .nav-btn.active { background: #2d3748; color: #ffffff; }
        .main-dashboard-content { flex: 1; padding: var(--spacing-xl); }
        .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: var(--spacing-lg); margin-bottom: var(--spacing-xl); }
        .action-buttons { display: flex; gap: var(--spacing-sm); }
        .notification { position: fixed; top: 20px; right: 20px; z-index: 1001; }
        .notification button { background:none; border:none; color:inherit; font-size: 1.2rem; cursor:pointer; margin-left: 1rem; }
      `}</style>

      <div className="admin-layout">
        <Notification message={notification.message} type={notification.type} onDismiss={dismissNotification} />
        {isModalOpen && <OrderDetailModal order={selectedOrder} onClose={closeModal} />}

        <div className="sidebar">
          <h1 className="sidebar-header">Lucky Paw</h1>
          <button className="nav-btn active">📋 Orders</button>
          <button className="nav-btn" onClick={() => router.push('/admin/games')}>🎮 Games</button>
          {/* Add other nav buttons as needed */}
        </div>

        <main className="main-dashboard-content">
          <h1 className="section-title">Dashboard</h1>
          <p className="section-subtitle" style={{textAlign: 'left', marginLeft: 0}}>
            A real-time overview of your store activity.
          </p>

          <div className="stat-grid">
              <StatCard title="Total Revenue (Paid)" value={`$${summary.revenue}`} icon="💵" color="var(--primary-green)" />
              <StatCard title="Live Pending Orders" value={summary.pending} icon="⏳" color="#f39c12" />
              <StatCard title="Total Paid Orders" value={summary.paid} icon="✔️" color="#2962ff" />
          </div>

          <div className="card">
              <div className="card-body">
                {/* We create a simple table structure here */}
                <table style={{width: '100%', borderCollapse: 'collapse'}}>
                  <thead>
                    <tr style={{borderBottom: '1px solid var(--border-color)'}}>
                      <th style={{padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-light)'}}>Username</th>
                      <th style={{padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-light)'}}>Status</th>
                      <th style={{padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-light)'}}>Amount</th>
                      <th style={{padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-light)'}}>Created</th>
                      <th style={{padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-light)'}}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(order => (
                      <tr key={order.id} style={{borderBottom: '1px solid var(--border-subtle)', background: !order.read && order.status === 'paid' ? 'var(--yellow-light)' : 'transparent'}}>
                        <td style={{padding: 'var(--spacing-md)'}}>{order.username}</td>
                        <td style={{padding: 'var(--spacing-md)'}}>{order.status}</td>
                        <td style={{padding: 'var(--spacing-md)'}}>${parseFloat(order.amount || 0).toFixed(2)}</td>
                        <td style={{padding: 'var(--spacing-md)'}}>{new Date(order.created).toLocaleString()}</td>
                        <td style={{padding: 'var(--spacing-md)'}}>
                          <div className="action-buttons">
                            {/* Uses .btn, .btn-small, .btn-secondary from globals.css */}
                            <button className="btn btn-secondary btn-small" onClick={() => viewOrderDetails(order.id)}>Details</button>
                            {order.status === 'paid' && !order.read && (
                              <button className="btn btn-success btn-small" onClick={() => markAsRead(order.id)}>Mark Read</button>
                            )}
                            <button className="btn btn-danger btn-small" onClick={() => archiveOrder(order.id)}>Archive</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          </div>
        </main>
      </div>
    </>
  );
}