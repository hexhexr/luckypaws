// src/pages/admin/dashboard.js
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { db, auth as firebaseAuth } from '../../lib/firebaseClient'; // Import db and firebaseAuth
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, getDocs, doc, deleteDoc, updateDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from 'firebase/auth'; // Import onAuthStateChanged
import { getDoc } from 'firebase/firestore'; // Import getDoc for single document retrieval

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
                <h3>Order Details: {order.username}</h3>
                <p><strong>Amount:</strong> ${parseFloat(order.amount || 0).toFixed(2)}</p>
                <p><strong>Status:</strong> {order.status}</p>
                <p><strong>Payment Gateway ID:</strong> {order.paymentGatewayId || 'N/A'}</p>
                <p><strong>Created:</strong> {order.created ? new Date(order.created).toLocaleString() : 'N/A'}</p>
                <p><strong>Invoice:</strong> <textarea readOnly value={order.invoice} rows="5" className="input"></textarea></p>
                <p><strong>Read:</strong> {order.read ? 'Yes' : 'No'}</p>
                {order.error && <p className="text-danger"><strong>Error:</strong> {order.error}</p>}
                {order.archivedBy && <p><strong>Archived By:</strong> {order.archivedBy}</p>}
                {order.archivedAt && <p><strong>Archived At:</strong> {new Date(order.archivedAt.seconds * 1000).toLocaleString()}</p>}
                <button className="btn btn-secondary mt-md" onClick={onClose}>Close</button>
            </div>
        </div>
    );
};


export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false); // New state to track admin status
  const [recentOrders, setRecentOrders] = useState([]);
  const [dailyStats, setDailyStats] = useState({
    totalNewOrders: 0,
    totalPaidOrders: 0,
    totalRevenue: 0,
    totalCashouts: 0 // New stat
  });
  const [modalOrder, setModalOrder] = useState(null);

  // Authentication and Role Check
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


  // Data fetching logic (only runs if isAdmin is true)
  useEffect(() => {
    if (!isAdmin) return; // Only proceed if user is confirmed admin

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    // Real-time listener for recent orders (last 50)
    const ordersQuery = query(collection(db, 'orders'), orderBy('created', 'desc'), where('status', '!=', 'archived'));
    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecentOrders(orders);
    }, (error) => {
      console.error("Error fetching recent orders:", error);
      // Handle error, e.g., show an alert
    });

    // Real-time listener for daily stats
    const dailyStatsQuery = query(collection(db, 'orders'), where('created', '>=', today.toISOString()), where('status', '!=', 'archived'));
    const unsubscribeStats = onSnapshot(dailyStatsQuery, (snapshot) => {
      let totalNew = 0;
      let totalPaid = 0;
      let totalRevenue = 0;

      snapshot.docs.forEach(doc => {
        const order = doc.data();
        totalNew++;
        if (order.status === 'paid') {
          totalPaid++;
          totalRevenue += parseFloat(order.amount || 0);
        }
      });

      // Fetch total cashouts for today
      const cashoutsQuery = query(collection(db, 'cashouts'), where('time', '>=', today.toISOString()));
      getDocs(cashoutsQuery)
        .then(cashoutSnapshot => {
          let totalCashouts = 0;
          cashoutSnapshot.docs.forEach(doc => {
            const cashout = doc.data();
            totalCashouts += parseFloat(cashout.amountUSD || 0);
          });
          setDailyStats({
            totalNewOrders: totalNew,
            totalPaidOrders: totalPaid,
            totalRevenue: totalRevenue,
            totalCashouts: totalCashouts // Update cashouts
          });
        })
        .catch(error => {
          console.error("Error fetching daily cashouts:", error);
        });

    }, (error) => {
      console.error("Error fetching daily stats:", error);
    });

    // Cleanup listeners on component unmount
    return () => {
      unsubscribeOrders();
      unsubscribeStats();
    };
  }, [isAdmin]); // Re-run effect when isAdmin changes

  const viewOrderDetails = (orderId) => {
    const order = recentOrders.find(o => o.id === orderId);
    setModalOrder(order);
  };

  const markAsRead = async (orderId) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, { read: true });
      console.log(`Order ${orderId} marked as read.`);
    } catch (error) {
      console.error("Error marking order as read:", error);
      alert('Failed to mark order as read.');
    }
  };

  const archiveOrder = async (orderId) => {
    const confirmArchive = window.confirm("Are you sure you want to archive this order?");
    if (!confirmArchive) return;

    try {
      const orderRef = doc(db, 'orders', orderId);
      // Update status to 'archived' and record who/when
      await updateDoc(orderRef, {
        status: 'archived',
        archivedAt: serverTimestamp(), // Use serverTimestamp for precise time
        archivedBy: firebaseAuth.currentUser?.email || 'unknown' // Record who archived it
      });
      console.log(`Order ${orderId} archived.`);
    } catch (error) {
      console.error("Error archiving order:", error);
      alert('Failed to archive order.');
    }
  };


  const logout = useCallback(async () => {
    try {
      await firebaseAuth.signOut();
      // No need to clear localStorage('admin_auth') anymore
      router.push('/admin');
    } catch (err) {
      console.error("Logout error:", err);
      alert('Failed to logout. Please try again.');
    }
  }, [router]);

  if (loading) {
    return (
      <div className="container mt-lg text-center">
        <p>Loading admin dashboard...</p>
      </div>
    );
  }

  if (!isAdmin) {
    // This state should theoretically not be reached due to the initial redirect,
    // but as a fallback, we show a message.
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

      <main className="admin-main">
        <section className="dashboard-summary">
          <h2>Daily Summary</h2>
          <div className="stat-cards">
            <StatCard
              title="New Orders (Today)"
              value={dailyStats.totalNewOrders}
              icon="🆕"
              color="#007bff"
            />
            <StatCard
              title="Paid Orders (Today)"
              value={dailyStats.totalPaidOrders}
              icon="✅"
              color="#28a745"
            />
            <StatCard
              title="Revenue (Today)"
              value={`$${dailyStats.totalRevenue.toFixed(2)}`}
              icon="💰"
              color="#6f42c1"
            />
            <StatCard
              title="Cashouts (Today)"
              value={`$${dailyStats.totalCashouts.toFixed(2)}`}
              icon="💸"
              color="#dc3545"
            />
          </div>
        </section>

        <section className="recent-orders mt-lg">
          <h2>Recent Orders</h2>
          <div className="card table-card">
            {recentOrders.length === 0 ? (
                <p className="text-center">No recent orders.</p>
            ) : (
                <div className="table-responsive">
                <table>
                    <thead>
                    <tr>
                        <th>Username</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {recentOrders.map(order => (
                        <tr key={order.id} className={order.read ? 'order-read' : 'order-unread'}>
                        <td>{order.username}</td>
                        <td>${parseFloat(order.amount || 0).toFixed(2)}</td>
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