// src/pages/admin/dashboard.js
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { db } from '../../lib/firebaseClient';
import { auth as firebaseAuth } from '../../lib/firebaseClient';
// Corrected import: Added limit to the import list from 'firebase/firestore'
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, getDocs, doc, deleteDoc, updateDoc, setDoc, getDoc, limit } from "firebase/firestore";
import { createUserWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';

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
                <h3>Order Details: {order.id}</h3>
                <div className="modal-content-grid">
                    <p><strong>Username:</strong> {order.username}</p>
                    <p><strong>Amount:</strong> ${parseFloat(order.amount || 0).toFixed(2)}</p>
                    <p><strong>Status:</strong> {order.status}</p>
                    <p><strong>Created:</strong> {order.created ? new Date(order.created).toLocaleString() : 'N/A'}</p>
                    <p><strong>Method:</strong> {order.method || 'N/A'}</p>
                    <p><strong>Transaction ID:</strong> {order.transactionId || 'N/A'}</p>
                    <p><strong>Lightning Invoice:</strong> {order.lightningInvoice || 'N/A'}</p>
                    <p><strong>Gateway ID:</strong> {order.paymentGatewayId || 'N/A'}</p>
                    <p><strong>Read:</strong> {order.read ? 'Yes' : 'No'}</p>
                </div>
            </div>
        </div>
    );
};


export default function AdminDashboard() {
  const router = useRouter();

  // --- AUTHENTICATION STATES ---
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // --- DASHBOARD DATA STATES ---
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalPaidOrders, setTotalPaidOrders] = useState(0);
  const [totalPendingOrders, setTotalPendingOrders] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalCashouts, setTotalCashouts] = useState(0); // New state for total cashouts
  const [recentOrders, setRecentOrders] = useState([]);
  const [error, setError] = useState('');
  const [modalOrder, setModalOrder] = useState(null); // State for modal order details

  // --- AUTHENTICATION AND ROLE CHECK ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (user) {
        // User is signed in, now check their role in Firestore
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists() && userDocSnap.data()?.isAdmin) {
            setIsAdmin(true);
            setLoading(false);
          } else {
            // User is signed in but not an admin
            console.log('User is not an admin. Redirecting.');
            await firebaseAuth.signOut(); // Sign them out
            router.replace('/admin');
          }
        } catch (e) {
          console.error("Error checking admin role:", e);
          await firebaseAuth.signOut(); // Sign out on error
          router.replace('/admin');
        }
      } else {
        // No user is signed in
        console.log('No user signed in. Redirecting to admin login.');
        router.replace('/admin');
      }
    });

    return () => unsubscribe(); // Clean up auth listener
  }, [router]);

  // --- LOGOUT FUNCTION ---
  const logout = useCallback(async () => {
    try {
      await firebaseAuth.signOut();
      router.push('/admin');
    } catch (err) {
      console.error("Logout error:", err);
      alert('Failed to logout. Please try again.');
    }
  }, [router]);

  // --- DATA FETCHING ---
  useEffect(() => {
    if (!isAdmin) return; // Only fetch data if user is confirmed admin

    setError(''); // Clear previous errors

    // Fetch total number of orders in real-time
    const unsubscribeTotalOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      setTotalOrders(snapshot.size);
    }, (error) => {
      console.error("Error fetching total orders count:", error);
      setError("Failed to load total orders count.");
    });


    // Fetch recent orders and calculate stats in real-time
    const ordersQuery = query(collection(db, 'orders'), orderBy('created', 'desc'), limit(10)); // Fetch recent 10 orders
    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      let paid = 0;
      let pending = 0;
      let revenue = 0;

      const orders = snapshot.docs.map(doc => {
        const data = doc.data();
        if (data.status === 'paid') {
          paid++;
          revenue += parseFloat(data.amount || 0); // Assuming amount is in USD
        } else if (data.status === 'pending') {
          pending++;
        }
        return { id: doc.id, ...data, created: data.created?.toDate ? data.created.toDate().toISOString() : data.created };
      });
      setRecentOrders(orders);
      setTotalPaidOrders(paid);
      setTotalPendingOrders(pending);
      setTotalRevenue(revenue);
    }, (error) => {
      console.error("Error fetching recent orders:", error);
      setError("Failed to load recent orders.");
    });

    // Fetch total users
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setTotalUsers(snapshot.size);
    }, (error) => {
      console.error("Error fetching users count:", error);
      setError("Failed to load users count.");
    });

    // Fetch total cashouts from the 'cashouts' collection (New functionality)
    const cashoutsQuery = query(collection(db, 'cashouts'), where('status', '==', 'completed')); // Assuming 'completed' status for successful cashouts
    const unsubscribeCashouts = onSnapshot(cashoutsQuery, (snapshot) => {
      let totalCashoutsValue = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        totalCashoutsValue += parseFloat(data.amountUSD || data.amount || 0); // Summing amountUSD or amount from cashout documents
      });
      setTotalCashouts(totalCashoutsValue);
    }, (error) => {
      console.error("Error fetching total cashouts:", error);
      setError("Failed to load total cashouts.");
    });


    // Cleanup function for all listeners
    return () => {
      unsubscribeTotalOrders();
      unsubscribeOrders();
      unsubscribeUsers();
      unsubscribeCashouts(); // Clean up cashouts listener
    };
  }, [isAdmin]); // Depend on isAdmin

  // --- ORDER ACTIONS ---
  const viewOrderDetails = (orderId) => {
    const order = recentOrders.find(o => o.id === orderId);
    setModalOrder(order);
  };

  const markAsRead = async (orderId) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, { read: true });
      // UI will update automatically due to onSnapshot
    } catch (err) {
      console.error("Error marking order as read:", err);
      alert('Failed to mark order as read.');
    }
  };

  const archiveOrder = async (orderId) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, { status: 'archived' }); // Or move to a separate 'archivedOrders' collection
      // UI will update automatically due to onSnapshot
    } catch (err) {
      console.error("Error archiving order:", err);
      alert('Failed to archive order.');
    }
  };

  // --- CONDITIONAL RENDERING FOR LOADING/ACCESS ---
  if (loading) {
    return (
      <div className="container mt-lg text-center">
        <p>Loading admin panel...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container mt-lg text-center">
        <p>Access Denied. You are not authorized to view this page.</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-container">
      <Head>
        <title>Admin Dashboard</title>
      </Head>
      <header className="admin-header">
        <h1>Admin Dashboard</h1>
        <nav>
          <ul className="admin-nav">
            <li><a href="/admin/dashboard" className={router.pathname === "/admin/dashboard" ? "active" : ""}>Dashboard</a></li>
            <li><a href="/admin/cashouts" className={router.pathname === "/admin/cashouts" ? "active" : ""}>Cashouts</a></li>
            <li><a href="/admin/games" className={router.pathname === "/admin/games" ? "active" : ""}>Games</a></li>
            <li><a href="/admin/profit-loss" className={router.pathname === "/admin/profit-loss" ? "active" : ""}>Profit/Loss</a></li>
            <li><button onClick={logout} className="btn btn-secondary">Logout</button></li>
          </ul>
        </nav>
      </header>

      <main className="admin-main-content">
        {error && <div className="alert alert-danger mb-lg">{error}</div>}

        <section className="stats-grid">
          <StatCard
            title="Total Orders"
            value={totalOrders}
            icon="📦"
            color="var(--blue)"
          />
          <StatCard
            title="Paid Orders"
            value={totalPaidOrders}
            icon="✅"
            color="var(--primary-green)"
          />
          <StatCard
            title="Pending Orders"
            value={totalPendingOrders}
            icon="⏳"
            color="var(--orange)"
          />
          <StatCard
            title="Total Users"
            value={totalUsers}
            icon="👥"
            color="var(--purple)"
          />
          <StatCard
            title="Total Revenue"
            value={`$${parseFloat(totalRevenue).toFixed(2)}`}
            icon="💰"
            color="var(--primary-green)"
          />
          <StatCard
            title="Total Cashouts"
            value={`$${parseFloat(totalCashouts).toFixed(2)}`}
            icon="💸"
            color="var(--red-alert)"
          />
        </section>

        <section className="recent-orders-section mt-lg">
            <h2>Recent Orders</h2>
            <div className="card table-card">
            {recentOrders.length === 0 ? (
                <p className="text-center">No recent orders to display.</p>
            ) : (
                <div className="table-responsive">
                <table>
                    <thead>
                    <tr>
                        <th>Order ID</th>
                        <th>Username</th>
                        <th>Status</th>
                        <th>Amount</th>
                        <th>Created</th>
                        <th>Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {recentOrders.map((order) => (
                        <tr key={order.id} className={order.read ? 'order-read' : 'order-unread'}>
                        <td>{order.id}</td>
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
                    ))}
                    </tbody>
                </table>
                </div>
            )}
            </div>
        </section>

        {modalOrder && <OrderDetailModal order={modalOrder} onClose={() => setModalOrder(null)} />}
      </main>
    </div>
  );
}