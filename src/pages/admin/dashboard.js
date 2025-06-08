// src/pages/admin/dashboard.js
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { db } from '../../lib/firebaseClient';
import { auth as firebaseAuth } from '../../lib/firebaseClient';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, getDocs, doc, deleteDoc, updateDoc, setDoc, limit } from "firebase/firestore";
import { onAuthStateChanged } from 'firebase/auth'; // Explicitly import onAuthStateChanged for clarity
import axios from 'axios';

// --- Helper Components (Remain unchanged unless specified) ---
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
                <p><strong>Amount:</strong> ${Number(order.amount).toFixed(2)}</p>
                <p><strong>BTC:</strong> {Number(order.btc).toFixed(8)}</p>
                <p><strong>Status:</strong> {order.status}</p>
                <p><strong>Created:</strong> {new Date(order.created).toLocaleString()}</p>
                {order.invoice && (
                    <>
                        <p className="mt-2"><strong>Lightning Invoice:</strong></p>
                        <textarea readOnly className="w-full p-2 border rounded-md resize-none" rows="3" value={order.invoice}></textarea>
                    </>
                )}
                <button onClick={onClose} className="btn btn-secondary mt-4">Close</button>
            </div>
        </div>
    );
};

export default function AdminDashboard() {
  const router = useRouter();
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [totalAgents, setTotalAgents] = useState(0);
  const [totalDepositsToday, setTotalDepositsToday] = useState(0);
  const [pendingCashouts, setPendingCashouts] = useState([]);
  const [newAgentUsername, setNewAgentUsername] = useState('');
  const [newAgentPassword, setNewAgentPassword] = useState('');
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [customers, setCustomers] = useState([]); // State for customers (for real-time listener)
  const [agents, setAgents] = useState([]); // State for agents (for real-time listener)
  const [orders, setOrders] = useState([]); // State for orders (for real-time listener)
  const [totalDepositAllTime, setTotalDepositAllTime] = useState(0);
  const [totalCashoutAllTime, setTotalCashoutAllTime] = useState(0);
  const [overallProfit, setOverallProfit] = useState(0);
  const [modalOrder, setModalOrder] = useState(null);
  const [loading, setLoading] = useState(true); // Loading state for initial auth/data fetch
  const [error, setError] = useState(''); // For displaying errors

  // Authentication and Authorization Check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        // No user is signed in, redirect to login page
        router.replace('/admin');
      } else {
        // User is signed in. IMPORTANT: Implement role-based access control here.
        // Example: Check custom claims set on the user object in Firebase Admin SDK.
        // const idTokenResult = await user.getIdTokenResult();
        // if (!idTokenResult.claims.admin) {
        //   router.replace('/unauthorized'); // Redirect unauthorized users
        //   return;
        // }
        setLoading(false); // Authentication successful, stop loading
        fetchDashboardData();
        setupRealtimeListeners();
      }
    });

    return () => unsubscribe(); // Clean up auth listener on component unmount
  }, [router]);

  // Initial Data Fetch (one-time on load after authentication)
  const fetchDashboardData = useCallback(async () => {
    try {
      // Fetch total customers
      const customersSnap = await getDocs(collection(db, 'customers'));
      setTotalCustomers(customersSnap.size);

      // Fetch total agents
      const agentsSnap = await getDocs(collection(db, 'agents'));
      setTotalAgents(agentsSnap.size);

      // Fetch total deposits today
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of today
      const depositsSnap = await getDocs(query(
        collection(db, 'orders'), // Assuming 'orders' contains deposit info with 'paid' status
        where('created', '>=', today.toISOString()),
        where('status', '==', 'paid')
      ));
      const totalToday = depositsSnap.docs.reduce((sum, doc) => sum + (Number(doc.data().amount) || 0), 0);
      setTotalDepositsToday(totalToday);

      // Fetch overall stats (total deposit, cashout, profit)
      const allOrdersSnap = await getDocs(query(collection(db, 'orders'), where('status', 'in', ['paid', 'pending'])));
      let currentTotalDepositAllTime = 0;
      allOrdersSnap.forEach(doc => {
          if (doc.data().status === 'paid') {
              currentTotalDepositAllTime += Number(doc.data().amount || 0);
          }
      });
      setTotalDepositAllTime(currentTotalDepositAllTime);

      const allCashoutsSnap = await getDocs(collection(db, 'cashouts'));
      let currentTotalCashoutAllTime = 0;
      allCashoutsSnap.forEach(doc => {
          currentTotalCashoutAllTime += Number(doc.data().amount || 0);
      });
      setTotalCashoutAllTime(currentTotalCashoutAllTime);
      setOverallProfit(currentTotalDepositAllTime - currentTotalCashoutAllTime);

    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
      setError('Failed to load dashboard initial data.');
    }
  }, []);

  // Real-time listeners for continuous updates
  const setupRealtimeListeners = useCallback(() => {
    // Listener for Customers for live count
    const unsubscribeCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setTotalCustomers(snapshot.size); // Update total count directly
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); // Also keep full list if needed for other parts
    }, (err) => console.error("Customer listener error:", err));

    // Listener for Agents for live count
    const unsubscribeAgents = onSnapshot(collection(db, 'agents'), (snapshot) => {
      setTotalAgents(snapshot.size); // Update total count directly
      setAgents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); // Also keep full list if needed
    }, (err) => console.error("Agent listener error:", err));

    // Listener for Orders to update deposits and overall profit/loss
    const unsubscribeOrders = onSnapshot(query(collection(db, 'orders'), orderBy('created', 'desc')), (snapshot) => {
      const updatedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(updatedOrders); // Update the list of orders

      // Recalculate totals based on latest orders
      let currentTotalDeposit = 0;
      updatedOrders.forEach(order => {
          if (order.status === 'paid') {
              currentTotalDeposit += Number(order.amount || 0);
          }
      });
      setTotalDepositAllTime(currentTotalDeposit);
      setOverallProfit(currentTotalDeposit - totalCashoutAllTime); // Recalculate profit

      // Update deposits today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayDeposits = updatedOrders.filter(order =>
          order.status === 'paid' && new Date(order.created) >= today
      ).reduce((sum, order) => sum + Number(order.amount || 0), 0);
      setTotalDepositsToday(todayDeposits);

    }, (err) => console.error("Orders listener error:", err));

    // Listener for Cashouts to update pending cashouts and overall profit/loss
    const unsubscribeCashouts = onSnapshot(query(collection(db, 'cashouts'), orderBy('requestedAt', 'desc')), (snapshot) => {
        const allCashouts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        let currentTotalCashout = 0;
        let currentPendingCashouts = [];
        allCashouts.forEach(cashout => {
            currentTotalCashout += Number(cashout.amount || 0);
            if (cashout.status === 'pending') {
                currentPendingCashouts.push(cashout);
            }
        });
        setTotalCashoutAllTime(currentTotalCashout);
        setPendingCashouts(currentPendingCashouts);
        setOverallProfit(totalDepositAllTime - currentTotalCashout); // Recalculate profit
    }, (err) => console.error("Cashouts listener error:", err));

    // Return a cleanup function
    return () => {
      unsubscribeCustomers();
      unsubscribeAgents();
      unsubscribeOrders();
      unsubscribeCashouts();
    };
  }, [totalDepositAllTime, totalCashoutAllTime]); // Dependencies to recalculate profit correctly

  // Helper function for currency formatting
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Agent Management Handlers
  const handleAddAgent = async () => {
    if (!newAgentUsername || !newAgentPassword) {
      alert('Username and password are required!');
      return;
    }
    try {
      const response = await axios.post('/api/admin/create-agent', {
        username: newAgentUsername,
        password: newAgentPassword,
        email: `${newAgentUsername}@example.com`, // Placeholder or derive as needed
        name: `Agent ${newAgentUsername}` // Placeholder or derive as needed
      });
      if (response.data.success) {
        alert('Agent added successfully!');
        setNewAgentUsername('');
        setNewAgentPassword('');
      } else {
        alert(response.data.message || 'Failed to add agent.');
      }
    } catch (err) {
      console.error('Error adding agent:', err.response?.data || err);
      alert('Failed to add agent. Check console for details.');
    }
  };

  const deleteOrder = async (orderId) => {
    if (confirm('Are you sure you want to delete this order? This action is irreversible.')) {
      try {
        await deleteDoc(doc(db, 'orders', orderId));
        console.log(`Order ${orderId} deleted successfully.`);
        // UI will update via real-time listener
      } catch (err) {
        console.error('Error deleting order:', err);
        alert('Failed to delete order. Ensure Firebase Security Rules allow this operation.');
      }
    }
  };

  const archiveOrder = async (orderId) => {
    if (confirm('Are you sure you want to archive this order? It will no longer appear in active lists.')) {
      try {
        await axios.post('/api/archive', { id: orderId }); // Using your existing API route for archiving
        console.log(`Order ${orderId} archived successfully via API.`);
        // UI will update via real-time listener
      } catch (err) {
        console.error('Error archiving order:', err);
        alert('Failed to archive order.');
      }
    }
  };

  const markCashoutAsSent = async (cashoutId) => {
    if (confirm('Mark this cashout as sent?')) {
        try {
            await axios.post('/api/admin/cashouts/send', { id: cashoutId }); // Assuming an API route for this
            alert('Cashout marked as sent!');
        } catch (err) {
            console.error('Error marking cashout as sent:', err);
            alert('Failed to mark cashout as sent.');
        }
    }
  };

  const markCashoutAsFailed = async (cashoutId) => {
    if (confirm('Mark this cashout as failed?')) {
        try {
            await axios.post('/api/admin/cashouts/fail', { id: cashoutId }); // Assuming an API route for this
            alert('Cashout marked as failed!');
        } catch (err) {
            console.error('Error marking cashout as failed:', err);
            alert('Failed to mark cashout as failed.');
        }
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-700 text-lg">Loading dashboard and verifying authentication...</p>
      </div>
    );
  }

  return (
    <div className="ml-72 p-4">
      <Head>
        <title>Admin Dashboard</title>
      </Head>
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
      </header>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</div>}

      {/* Stats Overview */}
      <section className="stat-cards-grid grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard title="Total Customers" value={totalCustomers} icon="👥" color="#00C853" />
        <StatCard title="Total Agents" value={totalAgents} icon="👨‍💼" color="#1DE9B6" />
        <StatCard title="Deposits Today" value={formatCurrency(totalDepositsToday)} icon="💰" color="#008F3A" />
      </section>

      {/* Overall Financial Summary */}
      <section className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold mb-4">Overall Financial Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard title="Total Deposits (All Time)" value={formatCurrency(totalDepositAllTime)} icon="💸" color="#00C853" />
              <StatCard title="Total Cashouts (All Time)" value={formatCurrency(totalCashoutAllTime)} icon="💳" color="#FF5252" />
              <StatCard title="Overall Profit" value={formatCurrency(overallProfit)} icon="📈" color={overallProfit >= 0 ? '#00C853' : '#FF5252'} />
          </div>
      </section>

      {/* Pending Cashouts */}
      <section className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-4">Pending Customer Cashouts</h2>
        {pendingCashouts.length === 0 ? (
          <p className="text-gray-600">No pending cashouts at the moment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Username</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested At</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingCashouts.map((cashout) => (
                  <tr key={cashout.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{cashout.customerUsername}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatCurrency(cashout.amount)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{new Date(cashout.requestedAt?.seconds * 1000 || cashout.requestedAt).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-green-600 hover:text-green-900 mr-2" onClick={() => markCashoutAsSent(cashout.id)}>Approve</button>
                      <button className="text-red-600 hover:text-red-900" onClick={() => markCashoutAsFailed(cashout.id)}>Reject</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent Orders */}
        <section className="bg-white p-6 rounded-lg shadow mb-6">
            <h2 className="text-lg font-semibold mb-4">Recent Customer Orders</h2>
            {orders.length === 0 ? (
                <p>No recent orders found.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Game</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount (USD)</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">BTC</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {orders.map((order) => (
                                <tr key={order.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.id}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{order.username}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{order.game}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">{formatCurrency(order.amount)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{order.btc}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            order.status === 'paid' ? 'bg-green-100 text-green-800' :
                                            order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-red-100 text-red-800'
                                        }`}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{new Date(order.created).toLocaleString()}</td>
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

      {/* Add New Agent Section */}
      <section className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center justify-between">
          <span>Manage Agents</span>
          <button
            className="text-blue-600 hover:underline"
            onClick={() => setShowAddAgent(!showAddAgent)}
          >
            {showAddAgent ? 'Hide Add Agent' : 'Add New Agent'}
          </button>
        </h2>
        {showAddAgent && (
          <div className="mt-4">
            <div className="mb-3">
              <label htmlFor="newAgentUsername" className="block text-sm font-medium text-gray-700">Username</label>
              <input
                type="text"
                id="newAgentUsername"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                value={newAgentUsername}
                onChange={(e) => setNewAgentUsername(e.target.value)}
                placeholder="Enter new agent username"
              />
            </div>
            <div className="mb-3">
              <label htmlFor="newAgentPassword" className="block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                id="newAgentPassword"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                value={newAgentPassword}
                onChange={(e) => setNewAgentPassword(e.target.value)}
                placeholder="Enter new agent password"
              />
            </div>
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              onClick={handleAddAgent}
            >
              Create Agent
            </button>
          </div>
        )}

        {/* Display existing agents (simple list) */}
        <h3 className="text-lg font-semibold mt-6 mb-3">Existing Agents ({agents.length})</h3>
        {agents.length === 0 ? (
          <p className="text-gray-600">No agents found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                  {/* Add more fields if available in agent data */}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {agents.map(agent => (
                  <tr key={agent.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{agent.username}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{agent.email || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{agent.createdAt ? new Date(agent.createdAt).toLocaleDateString() : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Order Detail Modal */}
      {modalOrder && <OrderDetailModal order={modalOrder} onClose={() => setModalOrder(null)} />}
    </div>
  );
}