// src/pages/admin/dashboard.js
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { db } from '../../lib/firebaseClient';
import { auth as firebaseAuth } from '../../lib/firebaseClient';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, getDocs, doc, deleteDoc, updateDoc, setDoc, limit } from "firebase/firestore";
import { createUserWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth'; // createUserWithEmailAndPassword is unused.

// --- Helper Components ---

const StatCard = ({ title, value, icon, color }) => (
    // Uses .card as a base but keeps specific styling for layout and dynamic color
    <div className="card stat-card" style={{ borderColor: color }}> {/* Added explicit shadow matching .card */}
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
            <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={onClose}>&times;</button>
                <h2>Order Details</h2>
                {order && (
                    <div className="modal-content">
                        <p><strong>Order ID:</strong> {order.id}</p>
                        <p><strong>Username:</strong> {order.username}</p>
                        <p><strong>Amount:</strong> ${order.amount ? parseFloat(order.amount).toFixed(2) : 'N/A'}</p>
                        <p><strong>Status:</strong> {order.status}</p>
                        <p><strong>Created:</strong> {order.created ? new Date(order.created).toLocaleString() : 'N/A'}</p>
                        <p><strong>Gateway ID:</strong> {order.paymentGatewayId || 'N/A'}</p>
                        {order.usdAmount && <p><strong>USD Amount:</strong> ${parseFloat(order.usdAmount).toFixed(2)}</p>}
                        {order.btcAmount && <p><strong>BTC Amount:</strong> {parseFloat(order.btcAmount).toFixed(8)} BTC</p>}
                        {order.lightningInvoice && <p><strong>Lightning Invoice:</strong> <code>{order.lightningInvoice}</code></p>}
                        {order.customerNotes && <p><strong>Customer Notes:</strong> {order.customerNotes}</p>}
                        {order.adminNotes && <p><strong>Admin Notes:</strong> {order.adminNotes}</p>}
                        {order.email && <p><strong>Email:</strong> {order.email}</p>}
                        {order.phoneNumber && <p><strong>Phone Number:</strong> {order.phoneNumber}</p>}
                    </div>
                )}
                {/* Add actions here if needed, e.g., mark as completed, refund */}
            </div>
        </div>
    );
};

export default function AdminDashboard() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0); // You might define 'active' based on recent activity
  const [totalDeposits, setTotalDeposits] = useState(0);
  const [totalCashouts, setTotalCashouts] = useState(0);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [error, setError] = useState('');
  const [modalOrder, setModalOrder] = useState(null); // State for modal order details

  // Authentication Check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        router.replace('/admin');
        return;
      }
      try {
        const idTokenResult = await user.getIdTokenResult(true);
        if (idTokenResult.claims.admin) {
          setIsAdmin(true);
          console.log("User ID Token Claims:", idTokenResult.claims); // For debugging claims
        } else {
          router.replace('/admin'); // Redirect if not admin
        }
      } catch (e) {
        console.error("Error checking admin claims:", e);
        router.replace('/admin');
      } finally {
        setLoadingAuth(false);
      }
    });

    return () => unsubscribe();
  }, [router]);


  // Fetch Dashboard Data
  const fetchDashboardData = useCallback(async () => {
    if (!isAdmin) return; // Only fetch if admin is confirmed

    setError('');
    // Fetch total users
    try {
        const usersSnap = await db.collection('users').get();
        setTotalUsers(usersSnap.size);
        // You might define logic for active users here
        setActiveUsers(usersSnap.docs.filter(doc => doc.data().lastLogin && (new Date() - new Date(doc.data().lastLogin.toDate())) / (1000 * 60 * 60 * 24) < 30).length); // Example: active in last 30 days
    } catch (err) {
        console.error('Error fetching user data:', err);
        setError('Failed to load user data.');
    }

    // Fetch total deposits and cashouts
    try {
        const ordersSnap = await db.collection('orders').where('status', '==', 'paid').get();
        const deposits = ordersSnap.docs.reduce((sum, doc) => sum + (parseFloat(doc.data().amount) || 0), 0);
        setTotalDeposits(deposits);

        const cashoutsSnap = await db.collection('cashouts').where('status', '==', 'completed').get(); // Assuming 'completed' status
        const cashouts = cashoutsSnap.docs.reduce((sum, doc) => sum + (parseFloat(doc.data().amountUSD) || 0), 0); // Assuming amountUSD
        setTotalCashouts(cashouts);
    } catch (err) {
        console.error('Error fetching financial data:', err);
        setError(prev => prev + ' Failed to load financial data.');
    }

    // Fetch recent orders (e.g., last 10 paid orders)
    setLoadingOrders(true);
    try {
        const q = query(collection(db, 'orders'), orderBy('created', 'desc'), limit(10));
        const recentOrdersSnap = await getDocs(q);
        const ordersList = recentOrdersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setRecentOrders(ordersList);
    } catch (err) {
        console.error('Error fetching recent orders:', err);
        setError(prev => prev + ' Failed to load recent orders.');
    } finally {
        setLoadingOrders(false);
    }
  }, [isAdmin]); // Depend on isAdmin to re-fetch when authentication status changes

  useEffect(() => {
    if (isAdmin) {
      console.log("Admin user recognized. Fetching dashboard data...");
      fetchDashboardData();
    }
  }, [isAdmin, fetchDashboardData]);


  const viewOrderDetails = (orderId) => {
    const order = recentOrders.find(o => o.id === orderId);
    if (order) {
        setModalOrder(order);
    }
  };

  const markAsRead = async (orderId) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { read: true });
      // Update local state or re-fetch to reflect change
      setRecentOrders(prev => prev.map(order => order.id === orderId ? { ...order, read: true } : order));
    } catch (err) {
      console.error('Error marking order as read:', err);
      setError('Failed to mark order as read.');
    }
  };

  const archiveOrder = async (orderId) => {
    try {
        // You might want to move it to an 'archived_orders' collection or just update status
        await updateDoc(doc(db, 'orders', orderId), { status: 'archived' });
        // Remove from recent orders display or update status
        setRecentOrders(prev => prev.filter(order => order.id !== orderId)); // Or update status to 'archived'
    } catch (err) {
      console.error('Error archiving order:', err);
      setError('Failed to archive order.');
    }
  };

  if (loadingAuth) {
    return <div className="container mt-md"><p>Loading authentication...</p></div>;
  }

  if (!isAdmin) {
    return <div className="container mt-md"><p>Access Denied. Redirecting to login...</p></div>;
  }

  return (
    // This top-level div mimics the structure seen in your dashboard.js for overall admin layout
    <div className="admin-dashboard-layout"> {/* Assumed class name for your layout */}
      <Head>
        <title>Admin Dashboard - LuckyPaw</title>
      </Head>

      {/* Placeholder for your Admin Navigation Component */}
      {/* For example, if you have a Sidebar or AdminHeader component, render it here */}

      <main className="admin-main-content"> {/* Adjust class name if different in your CSS */}
        <div className="container mt-md">
          <h1 className="card-header">Dashboard Overview</h1>

          {error && <div className="alert alert-danger">{error}</div>}

          <section className="dashboard-stats mb-lg">
            <StatCard title="Total Users" value={totalUsers} icon="👤" color="var(--primary-blue)" />
            <StatCard title="Active Users" value={activeUsers} icon="⚡" color="var(--primary-green)" />
            <StatCard title="Total Deposits" value={`$${totalDeposits.toFixed(2)}`} icon="💰" color="var(--primary-green)" />
            <StatCard title="Total Cashouts" value={`$${totalCashouts.toFixed(2)}`} icon="💸" color="var(--red-alert)" />
          </section>

          <section className="recent-orders-section section-card">
            <div className="section-header">
                <h2>Recent Orders</h2>
                <button className="btn btn-primary btn-small" onClick={() => router.push('/admin/orders')}>View All Orders</button>
            </div>
            {loadingOrders ? (
                <p>Loading recent orders...</p>
            ) : (
                <div className="table-responsive">
                <table className="table table-hover">
                    <thead>
                    <tr>
                        <th>Order ID</th>
                        <th>Username</th>
                        <th>Status</th>
                        <th>Amount</th>
                        <th>Time</th>
                        <th>Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {recentOrders.length === 0 ? (
                        <tr>
                            <td colSpan="6" className="text-center">No recent orders found.</td>
                        </tr>
                    ) : (
                    recentOrders.map((order) => (
                        <tr key={order.id} className={order.read ? 'order-read' : 'order-unread'}>
                        <td>{order.id.substring(0, 8)}...</td>
                        <td>{order.username}</td>
                        <td>
                            <span className={`status-badge status-${order.status}`}>
                               {order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : 'N/A'}
                            </span>
                        </td>
                        <td className="text-bold">${parseFloat(order.amount || 0).toFixed(2)}</td>
                        <td>{order.created ? new Date(order.created).toLocaleString() : 'N/A'}</td>
                        <td>
                            <div className="action-buttons">
                                <button className="btn btn-info btn-small" onClick={() => viewOrderDetails(order.id)}>Details</button>
                                {order.status === 'paid' && !order.read && (
                                <button className="btn btn-success btn-small" onClick={() => markAsRead(order.id)}>Mark Read</button>
                                )}
                                {order.status !== 'archived' && (
                                    <button className="btn btn-secondary btn-small" onClick={() => archiveOrder(order.id)}>Archive</button>
                                )}
                            </div>
                        </td>
                        </tr>
                    ))
                    )}
                    </tbody>
                </table>
                </div>
            )}
            {/* Removed the extra </div> here */}
        </section>

        {modalOrder && <OrderDetailModal order={modalOrder} onClose={() => setModalOrder(null)} />}
      </main>
    </div>
  );
}