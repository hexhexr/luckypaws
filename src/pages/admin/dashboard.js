// src/pages/admin/dashboard.js
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { db } from '../../lib/firebaseClient'; // Make sure this path is correct for client-side Firebase
// Assuming auth for client-side is imported from firebaseClient.js
import { auth as firebaseAuth } from '../../lib/firebaseClient';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, getDocs, doc, deleteDoc, updateDoc, setDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth'; // Keep if you use this for client-side admin auth
import axios from 'axios'; // Import axios for API calls

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
                <h3 className="text-xl font-bold mb-4">Order Details</h3>
                <div className="grid grid-cols-2 gap-4 text-left">
                    <p><strong>Order ID:</strong> {order.id}</p>
                    <p><strong>Customer:</strong> {order.username}</p>
                    <p><strong>Amount:</strong> ${parseFloat(order.amount || 0).toFixed(2)}</p>
                    <p><strong>Status:</strong> <span className={`status-${order.status}`}>{order.status}</span></p>
                    <p><strong>Created:</strong> {order.created ? new Date(order.created).toLocaleString() : 'N/A'}</p>
                    <p><strong>Last Updated:</strong> {order.updatedAt ? new Date(order.updatedAt).toLocaleString() : 'N/A'}</p>
                    <p className="col-span-2"><strong>Notes:</strong> {order.notes || 'No notes'}</p>
                </div>
                <div className="modal-actions mt-6">
                    <button className="btn btn-secondary" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};


export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null); // State for authenticated admin user
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [modalOrder, setModalOrder] = useState(null);
  const [orderSummary, setOrderSummary] = useState({ paid: 0, pending: 0, archived: 0 });
  const [totalDeposits, setTotalDeposits] = useState(0);
  const [totalCashouts, setTotalCashouts] = useState(0); // Assuming you'll add cashout tracking
  const [last10Deposits, setLast10Deposits] = useState([]); // For displaying recent deposits
  const [agentCashoutRequests, setAgentCashoutRequests] = useState([]); // For agent's own cashouts

  // --- New State for Agent Creation ---
  const [newAgentUsername, setNewAgentUsername] = useState('');
  const [newAgentEmail, setNewAgentEmail] = useState('');
  const [newAgentPassword, setNewAgentPassword] = useState('');
  const [newAgentName, setNewAgentName] = useState('');
  const [agentCreationMessage, setAgentCreationMessage] = useState({ text: '', type: '' });
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  // --- End New State for Agent Creation ---

  // Authentication Check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (currentUser) => {
      if (!currentUser) {
        // No admin user logged in, redirect to admin login
        router.push('/admin/login');
      } else {
        setUser(currentUser);
        setLoading(false);
        // Optionally, check if the user has an 'admin' role in Firestore
        // const userDocRef = doc(db, "admins", currentUser.uid);
        // onSnapshot(userDocRef, (docSnap) => {
        //   if (docSnap.exists() && docSnap.data().role === 'admin') {
        //     setUser(currentUser);
        //     setLoading(false);
        //   } else {
        //     router.push('/admin/login'); // Not an admin
        //   }
        // });
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Fetch Orders and Deposits (Real-time or on mount/refresh)
  useEffect(() => {
    if (!user) return; // Only fetch if admin is authenticated

    // Fetch orders for summary and display
    const ordersQuery = query(collection(db, "orders"), orderBy("created", "desc"));
    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      let paid = 0;
      let pending = 0;
      let archived = 0;
      const fetchedOrders = snapshot.docs.map(doc => {
        const data = doc.data();
        if (data.status === 'paid') paid++;
        if (data.status === 'pending') pending++;
        if (data.status === 'archived') archived++;
        return { id: doc.id, ...data };
      });
      setOrders(fetchedOrders);
      setOrderSummary({ paid, pending, archived });
    });

    // Fetch all paid deposits for total calculation
    const depositsQuery = query(collection(db, "orders"), where("status", "==", "paid"));
    const unsubscribeDeposits = onSnapshot(depositsQuery, (snapshot) => {
      let total = 0;
      const fetchedDeposits = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        total += parseFloat(data.amount || 0);
        fetchedDeposits.push({ id: doc.id, ...data });
      });
      setTotalDeposits(total);
      // Sort and get last 10 for display in a specific section if needed
      setLast10Deposits(fetchedDeposits.sort((a,b) => b.createdAt - a.createdAt).slice(0, 10));
    });

    // Fetch agent cashout requests (assuming a collection named 'agentCashoutRequests')
    const agentCashoutQuery = query(collection(db, "agentCashoutRequests"), orderBy("requestedAt", "desc"));
    const unsubscribeAgentCashouts = onSnapshot(agentCashoutQuery, (snapshot) => {
        const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAgentCashoutRequests(requests);
    });

    // Cleanup subscriptions on unmount
    return () => {
      unsubscribeOrders();
      unsubscribeDeposits();
      unsubscribeAgentCashouts();
    };
  }, [user]); // Re-run if user status changes

  // Order Actions
  const viewOrderDetails = (orderId) => {
    const order = orders.find(o => o.id === orderId);
    setModalOrder(order);
  };

  const markAsRead = async (orderId) => {
    try {
      await axios.post('/api/admin/update', { id: orderId, update: { read: true, status: 'paid' } });
      console.log('Order marked as read and status set to paid:', orderId);
    } catch (error) {
      console.error('Error marking order as read:', error);
      alert('Failed to mark order as read.');
    }
  };

  const archiveOrder = async (orderId) => {
    if (!confirm('Are you sure you want to archive this order?')) return;
    try {
      await axios.post('/api/admin/archive', { id: orderId });
      console.log('Order archived:', orderId);
    } catch (error) {
      console.error('Error archiving order:', error);
      alert('Failed to archive order.');
    }
  };

  // --- New Function for Agent Creation ---
  const handleCreateAgent = async (e) => {
    e.preventDefault();
    setIsCreatingAgent(true);
    setAgentCreationMessage({ text: '', type: '' });

    try {
      const response = await fetch('/api/admin/create-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: newAgentUsername,
          email: newAgentEmail,
          password: newAgentPassword,
          name: newAgentName,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setAgentCreationMessage({ text: data.message, type: 'success' });
        // Clear form fields
        setNewAgentUsername('');
        setNewAgentEmail('');
        setNewAgentPassword('');
        setNewAgentName('');
      } else {
        setAgentCreationMessage({ text: data.message || 'Failed to create agent.', type: 'error' });
      }
    } catch (error) {
      console.error('Error creating agent:', error);
      setAgentCreationMessage({ text: 'An unexpected error occurred.', type: 'error' });
    } finally {
      setIsCreatingAgent(false);
    }
  };
  // --- End New Function for Agent Creation ---


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-700">Loading admin dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <Head>
        <title>Admin Dashboard</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className="bg-white shadow p-4 flex justify-between items-center">
        <h1 className="text-3xl font-semibold text-gray-800">Admin Dashboard</h1>
        {user && (
          <div className="flex items-center space-x-4">
            <span className="text-gray-700">Welcome, Admin! ({user.email})</span>
            <button
              onClick={async () => {
                await firebaseAuth.signOut();
                router.push('/admin/login');
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        )}
      </header>

      <main className="p-8">
        {/* Stat Cards Section */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard title="Total Paid Deposits" value={`$${totalDeposits.toFixed(2)}`} icon="💰" color="#10B981" />
            <StatCard title="Pending Orders" value={orderSummary.pending} icon="⏳" color="#F59E0B" />
            <StatCard title="Completed Orders" value={orderSummary.paid} icon="✅" color="#3B82F6" />
            <StatCard title="Archived Orders" value={orderSummary.archived} icon="🗄️" color="#6B7280" />
            {/* You can add more stat cards here, e.g., for total cashouts, active agents */}
        </section>

        {/* Agent Creation Section */}
        <section className="card mb-8 p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4 text-gray-800 card-title">Create New Agent</h2>
            <form onSubmit={handleCreateAgent} className="space-y-4">
                <div>
                    <label htmlFor="agentUsername" className="block text-sm font-medium text-gray-700 mb-1">Username:</label>
                    <input
                        type="text"
                        id="agentUsername"
                        value={newAgentUsername}
                        onChange={(e) => setNewAgentUsername(e.target.value)}
                        placeholder="e.g., agent_john"
                        className="p-3 border border-gray-300 rounded-md w-full focus:ring-blue-500 focus:border-blue-500"
                        required
                        disabled={isCreatingAgent}
                    />
                </div>
                <div>
                    <label htmlFor="agentEmail" className="block text-sm font-medium text-gray-700 mb-1">Email:</label>
                    <input
                        type="email"
                        id="agentEmail"
                        value={newAgentEmail}
                        onChange={(e) => setNewAgentEmail(e.target.value)}
                        placeholder="e.g., agent@example.com"
                        className="p-3 border border-gray-300 rounded-md w-full focus:ring-blue-500 focus:border-blue-500"
                        required
                        disabled={isCreatingAgent}
                    />
                </div>
                <div>
                    <label htmlFor="agentPassword" className="block text-sm font-medium text-gray-700 mb-1">Password:</label>
                    <input
                        type="password"
                        id="agentPassword"
                        value={newAgentPassword}
                        onChange={(e) => setNewAgentPassword(e.target.value)}
                        placeholder="Enter a strong password"
                        className="p-3 border border-gray-300 rounded-md w-full focus:ring-blue-500 focus:border-blue-500"
                        required
                        disabled={isCreatingAgent}
                    />
                </div>
                <div>
                    <label htmlFor="agentName" className="block text-sm font-medium text-gray-700 mb-1">Agent's Full Name:</label>
                    <input
                        type="text"
                        id="agentName"
                        value={newAgentName}
                        onChange={(e) => setNewAgentName(e.target.value)}
                        placeholder="e.g., John Doe"
                        className="p-3 border border-gray-300 rounded-md w-full focus:ring-blue-500 focus:border-blue-500"
                        required
                        disabled={isCreatingAgent}
                    />
                </div>
                <button
                    type="submit"
                    className={`px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-md font-semibold ${isCreatingAgent ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={isCreatingAgent}
                >
                    {isCreatingAgent ? 'Creating Agent...' : 'Create Agent'}
                </button>
            </form>
            {agentCreationMessage.text && (
                <p className={`mt-4 p-3 rounded-md ${agentCreationMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {agentCreationMessage.text}
                </p>
            )}
        </section>

        {/* Live Deposits - You can consider integrating this with your existing deposits.js */}
        {/* For now, displaying last 10 from the general orders collection with status paid */}
        <section className="card mb-8 p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4 text-gray-800 card-title">Recent Paid Deposits</h2>
            {last10Deposits.length === 0 ? (
                <p className="text-gray-600">No recent paid deposits to display.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {last10Deposits.map((deposit) => (
                                <tr key={deposit.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{deposit.username}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">${parseFloat(deposit.amount).toFixed(2)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{deposit.createdAt ? new Date(deposit.createdAt).toLocaleString() : 'N/A'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>

        {/* Order Management Section */}
        <section className="card mb-8 p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4 text-gray-800 card-title">Order Management</h2>
            {orders.length === 0 ? (
                <p className="text-gray-600">No orders to display.</p>
            ) : (
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                    {orders.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{order.username}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full status-${order.status}`}>
                               {order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : 'N/A'}
                            </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">${parseFloat(order.amount || 0).toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.created ? new Date(order.created).toLocaleString() : 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                                <button
                                    className="text-blue-600 hover:text-blue-900"
                                    onClick={() => viewOrderDetails(order.id)}
                                >
                                    Details
                                </button>
                                {order.status === 'paid' && !order.read && (
                                <button
                                    className="text-green-600 hover:text-green-900"
                                    onClick={() => markAsRead(order.id)}
                                >
                                    Mark Read
                                </button>
                                )}
                                {order.status !== 'archived' && (
                                    <button
                                        className="text-yellow-600 hover:text-yellow-900"
                                        onClick={() => archiveOrder(order.id)}
                                    >
                                        Archive
                                    </button>
                                )}
                            </div>
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                </div>
            )}
        </section>

        {/* Agent Cashout Requests Section */}
        <section className="card mb-8 p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4 text-gray-800 card-title">Agent Cashout Requests</h2>
            {agentCashoutRequests.length === 0 ? (
                <p className="text-gray-600">No agent cashout requests to display.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agent Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested At</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {agentCashoutRequests.map((request) => (
                                <tr key={request.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{request.agentName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">${parseFloat(request.amount).toFixed(2)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : request.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{request.requestedAt ? new Date(request.requestedAt.toDate()).toLocaleString() : 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        {request.status === 'pending' && (
                                            <div className="flex space-x-2">
                                                <button
                                                    className="text-green-600 hover:text-green-900"
                                                    onClick={() => {/* Implement approve logic */ alert('Approve not yet implemented');}}
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    className="text-red-600 hover:text-red-900"
                                                    onClick={() => {/* Implement reject logic */ alert('Reject not yet implemented');}}
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
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