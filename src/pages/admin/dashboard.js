// src/pages/admin/dashboard.js
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { db } from '../../lib/firebaseClient';
import { auth as firebaseAuth } from '../../lib/firebaseClient';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, getDocs, doc, deleteDoc, updateDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from 'firebase/auth';

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
            <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={onClose}>&times;</button>
                <h3>Order Details: {order.id}</h3>
                <p><strong>Username:</strong> {order.username}</p>
                <p><strong>Amount:</strong> ${parseFloat(order.amount || 0).toFixed(2)}</p>
                <p><strong>Status:</strong> {order.status}</p>
                <p><strong>Created:</strong> {order.created ? new Date(order.created).toLocaleString() : 'N/A'}</p>
                <p><strong>Invoice ID:</strong> {order.invoiceId}</p>
                <p><strong>Payment Hash:</strong> {order.paymentHash}</p>
                <p><strong>Gateway Response:</strong> {order.gatewayResponse || 'N/A'}</p>
                <p><strong>Gateway ID:</strong> {order.paymentGatewayId || 'N/A'}</p>
            </div>
        </div>
    );
};


export default function AdminDashboard() {
  const router = useRouter();

  // --- AUTHENTICATION & LOADING STATES ---
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState('');

  // --- DASHBOARD DATA STATES ---
  const [recentOrders, setRecentOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  const [dailyDeposits, setDailyDeposits] = useState(0);
  const [dailyCashouts, setDailyCashouts] = useState(0);
  const [dailyProfit, setDailyProfit] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);

  const [modalOrder, setModalOrder] = useState(null); // State to hold order details for modal

  // --- FUNCTIONS ---

  const logout = useCallback(async () => {
    try {
      await firebaseAuth.signOut();
      if (typeof window !== 'undefined') {
        localStorage.removeItem('admin_auth');
      }
      router.replace('/admin'); // Redirect to admin login page
    } catch (err) {
      console.error("Logout failed:", err);
      setError("Failed to log out. Please try again.");
    }
  }, [router]);

  const viewOrderDetails = useCallback((orderId) => {
    const order = recentOrders.find(o => o.id === orderId);
    setModalOrder(order);
  }, [recentOrders]);

  const markAsRead = useCallback(async (orderId) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, { read: true });
      // UI will automatically update via onSnapshot listener
      console.log(`Order ${orderId} marked as read.`);
    } catch (error) {
      console.error("Error marking order as read:", error);
      setError("Failed to mark order as read.");
    }
  }, []);

  const archiveOrder = useCallback(async (orderId) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, { status: 'archived' });
      // UI will automatically update via onSnapshot listener
      console.log(`Order ${orderId} archived.`);
    } catch (error) {
      console.error("Error archiving order:", error);
      setError("Failed to archive order.");
    }
  }, []);

  // Fetch recent orders
  const fetchRecentOrders = useCallback(() => {
    setLoadingOrders(true);
    try {
      // IMPORTANT: Ensure 'orders' collection is used here
      const q = query(
        collection(db, 'orders'),
        orderBy('created', 'desc'),
        limit(10) // Fetch top 10 recent orders
      );
      // onSnapshot provides real-time updates
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const ordersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setRecentOrders(ordersList);
        setLoadingOrders(false);
      }, (error) => {
        console.error("Error fetching recent orders:", error);
        setError("Error fetching recent orders: " + error.message);
        setLoadingOrders(false);
      });
      return () => unsubscribe(); // Return unsubscribe function for cleanup
    } catch (error) {
      console.error("Error fetching recent orders (catch block):", error);
      setError("Error fetching recent orders: " + error.message);
      setLoadingOrders(false);
    }
  }, []); // No dependencies for this useCallback, as db and collection are stable

  // Fetch daily stats (total profit, cashouts, deposits)
  const fetchDailyStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Fetch all orders within the last 24 hours that are 'paid' (deposits)
      const qDeposits = query(
        collection(db, 'orders'),
        where('status', '==', 'paid'),
        where('created', '>=', twentyFourHoursAgo)
      );
      const depositsSnap = await getDocs(qDeposits);
      const totalDeposits = depositsSnap.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);
      setDailyDeposits(totalDeposits);

      // Fetch all cashouts within the last 24 hours that are 'completed'
      // IMPORTANT: Using 'profitLoss' collection based on previous changes
      const qCashouts = query(
        collection(db, 'profitLoss'), // Confirmed to be 'profitLoss'
        where('time', '>=', twentyFourHoursAgo), // Assuming 'time' field for cashouts
        where('status', '==', 'completed')
      );
      const cashoutsSnap = await getDocs(qCashouts);
      const totalCashouts = cashoutsSnap.docs.reduce((sum, doc) => sum + (doc.data().amountUSD || 0), 0);
      setDailyCashouts(totalCashouts);

      const calculatedProfit = totalDeposits - totalCashouts;
      setDailyProfit(calculatedProfit);

      setLoadingStats(false);
    } catch (error) {
      console.error("Error fetching daily stats:", error);
      setError("Error fetching daily stats: " + error.message);
      setLoadingStats(false);
    }
  }, []); // No dependencies for this useCallback

  // --- AUTHENTICATION & DATA LOADING EFFECT ---
  useEffect(() => {
    const unsubscribe = firebaseAuth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          // Force refresh of ID token and claims to ensure 'admin' claim is up-to-date
          const idTokenResult = await user.getIdTokenResult(true);
          console.log("User ID Token Claims:", idTokenResult.claims); // LOGGING CLAIMS FOR DEBUGGING

          const isAdminUser = idTokenResult.claims.admin;
          setIsAdmin(isAdminUser);

          if (!isAdminUser) {
            console.warn("User is authenticated but not an admin. Redirecting.");
            router.replace('/admin'); // Redirect if not admin
          } else {
            console.log("Admin user recognized. Fetching dashboard data...");
            // Only fetch data if the user is confirmed as admin
            fetchDailyStats();
            // onSnapshot for recent orders will be set up by fetchRecentOrders,
            // which returns an unsubscribe function that needs to be handled.
            const unsubscribeOrders = fetchRecentOrders();
            return () => unsubscribeOrders(); // Cleanup on unmount
          }
        } catch (error) {
          console.error("Error getting ID token result or verifying admin role:", error);
          setError("Authentication error: Could not verify admin role. Please try logging in again.");
          firebaseAuth.signOut(); // Force logout on token verification failure
          router.replace('/admin');
        } finally {
          setLoading(false); // Set loading to false once auth check is complete
        }
      } else {
        console.log("No user signed in. Redirecting to admin login.");
        setLoading(false);
        router.replace('/admin');
      }
    });

    return () => unsubscribe(); // Clean up auth listener on component unmount
  }, [router, fetchDailyStats, fetchRecentOrders]); // Dependencies for useEffect

  // --- RENDER LOGIC ---
  if (loading) {
    return (
      <div className="container mt-lg text-center">
        <Head><title>Loading...</title></Head>
        <h2>Loading Dashboard...</h2>
        <p>Please wait while we verify your access.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-lg">
        <Head><title>Error</title></Head>
        <div className="alert alert-danger">
          <h3>Error:</h3>
          <p>{error}</p>
          <button onClick={() => setError('')} className="btn btn-secondary mt-md">Clear Error</button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    // This block should ideally not be reached if the redirect works,
    // but acts as a fallback for non-admin authenticated users.
    return (
      <div className="container mt-lg text-center">
        <Head><title>Access Denied</title></Head>
        <h2>Access Denied</h2>
        <p>You do not have administrative privileges to view this page.</p>
        <button onClick={logout} className="btn btn-primary mt-md">Logout</button>
      </div>
    );
  }

  // Actual dashboard content for authenticated admins
  return (
    <div className="admin-dashboard-container">
      <Head>
        <title>Admin Dashboard</title>
      </Head>
      <header className="admin-header">
        <h1>Admin Dashboard</h1>
        <button onClick={logout} className="btn btn-danger">Logout</button>
      </header>

      <main className="admin-content">
        <section className="dashboard-stats">
          <h2>Daily Overview (Last 24 Hrs)</h2>
          {loadingStats ? (
            <p>Loading daily stats...</p>
          ) : (
            <div className="stat-cards-grid">
              <StatCard title="Total Deposits" value={`$${dailyDeposits.toFixed(2)}`} icon="💰" color="#4CAF50" />
              <StatCard title="Total Cashouts" value={`$${dailyCashouts.toFixed(2)}`} icon="💸" color="#F44336" />
              <StatCard title="Net Profit/Loss" value={`$${dailyProfit.toFixed(2)}`} icon={dailyProfit >= 0 ? "📈" : "📉"} color={dailyProfit >= 0 ? "#2196F3" : "#FFC107"} />
            </div>
          )}
        </section>

        <section className="dashboard-orders">
          <h2>Recent Orders</h2>
          {loadingOrders ? (
            <p>Loading recent orders...</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Username</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Time</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.length === 0 ? (
                    <tr><td colSpan="6" className="text-center">No recent orders found.</td></tr>
                  ) : (
                    recentOrders.map((order) => (
                      <tr key={order.id} className={!order.read ? 'un-read' : ''}>
                        <td>{order.id.substring(0, 6)}...</td>
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
        </section>

        {modalOrder && <OrderDetailModal order={modalOrder} onClose={() => setModalOrder(null)} />}
      </main>
    </div>
  );
}