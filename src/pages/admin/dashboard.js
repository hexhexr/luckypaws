// pages/admin/dashboard.js
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link'; // Import Link component
import { db } from '../../lib/firebaseClient';
import { auth as firebaseAuth } from '../../lib/firebaseClient';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, getDocs, doc, deleteDoc, updateDoc, setDoc, limit } from "firebase/firestore";
import { onAuthStateChanged } from 'firebase/auth';
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

export default function Dashboard() {
  const router = useRouter();
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [totalAgents, setTotalAgents] = useState(0);
  const [totalDepositsToday, setTotalDepositsToday] = useState(0);
  const [pendingCashouts, setPendingCashouts] = useState([]);
  const [newAgentUsername, setNewAgentUsername] = useState('');
  const [newAgentPassword, setNewAgentPassword] = useState('');
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [agents, setAgents] = useState([]);
  const [orders, setOrders] = useState([]);
  const [totalDepositAllTime, setTotalDepositAllTime] = useState(0);
  const [totalCashoutAllTime, setTotalCashoutAllTime] = useState(0);
  const [overallProfit, setOverallProfit] = useState(0);
  const [modalOrder, setModalOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        router.replace('/admin');
      } else {
        setLoading(false);
        fetchDashboardData();
        setupRealtimeListeners();
      }
    });

    return () => unsubscribe();
  }, [router]);

  const fetchDashboardData = useCallback(async () => {
    try {
      const customersSnap = await getDocs(collection(db, 'customers'));
      setTotalCustomers(customersSnap.size);

      const agentsSnap = await getDocs(collection(db, 'agents'));
      setTotalAgents(agentsSnap.size);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const depositsSnap = await getDocs(query(
        collection(db, 'orders'),
        where('created', '>=', today.toISOString()),
        where('status', '==', 'paid')
      ));
      const totalToday = depositsSnap.docs.reduce((sum, doc) => sum + (Number(doc.data().amount) || 0), 0);
      setTotalDepositsToday(totalToday);

      const allOrdersSnap = await getDocs(query(collection(db, 'orders'), where('status', 'in', ['paid', 'cashout'])));
      const allOrders = allOrdersSnap.docs.map(doc => doc.data());

      const totalDeposit = allOrders.filter(order => order.status === 'paid').reduce((sum, order) => sum + (Number(order.amount) || 0), 0);
      const totalCashout = allOrders.filter(order => order.status === 'cashout').reduce((sum, order) => sum + (Number(order.amount) || 0), 0);

      setTotalDepositAllTime(totalDeposit);
      setTotalCashoutAllTime(totalCashout);
      setOverallProfit(totalDeposit - totalCashout);

      const pendingCashoutsSnap = await getDocs(query(collection(db, 'cashouts'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'), limit(5)));
      setPendingCashouts(pendingCashoutsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError('Failed to load dashboard data.');
    }
  }, []);

  const setupRealtimeListeners = () => {
    // Listen for customer changes
    const customersQuery = query(collection(db, 'customers'));
    const unsubscribeCustomers = onSnapshot(customersQuery, (snapshot) => {
      setTotalCustomers(snapshot.size);
    });

    // Listen for agent changes
    const agentsQuery = query(collection(db, 'agents'));
    const unsubscribeAgents = onSnapshot(agentsQuery, (snapshot) => {
      setTotalAgents(snapshot.size);
    });

    // Listen for new orders (deposits) or status changes for pending cashouts
    const ordersQuery = query(collection(db, 'orders'), orderBy('created', 'desc'));
    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      const updatedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(updatedOrders); // Update overall orders state
      // Recalculate totals
      const totalDeposit = updatedOrders.filter(order => order.status === 'paid').reduce((sum, order) => sum + (Number(order.amount) || 0), 0);
      const totalCashout = updatedOrders.filter(order => order.status === 'cashout').reduce((sum, order) => sum + (Number(order.amount) || 0), 0);
      setTotalDepositAllTime(totalDeposit);
      setTotalCashoutAllTime(totalCashout);
      setOverallProfit(totalDeposit - totalCashout);
    });

    const cashoutsQuery = query(collection(db, 'cashouts'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'), limit(5));
    const unsubscribeCashouts = onSnapshot(cashoutsQuery, (snapshot) => {
      setPendingCashouts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });


    return () => {
      unsubscribeCustomers();
      unsubscribeAgents();
      unsubscribeOrders();
      unsubscribeCashouts();
    };
  };

  const archiveOrder = async (orderId) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'archived'
      });
      console.log('Order archived successfully');
    } catch (error) {
      console.error('Error archiving order:', error);
      setError('Failed to archive order.');
    }
  };

  const deleteOrder = async (orderId) => {
    try {
      await deleteDoc(doc(db, 'orders', orderId));
      console.log('Order deleted successfully');
      setOrders(orders.filter(order => order.id !== orderId)); // Optimistic update
    } catch (error) {
      console.error('Error deleting order:', error);
      setError('Failed to delete order.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Head>
        <title>Admin Dashboard</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className="bg-white shadow-sm p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
        <nav>
          <ul className="flex space-x-4">
            <li><Link href="/admin/dashboard" className="text-blue-600 hover:text-blue-800">Dashboard</Link></li>
            <li><Link href="/admin/agents" className="text-blue-600 hover:text-blue-800">Agents</Link></li>
            <li><Link href="/admin/agent-management" className="text-blue-600 hover:text-blue-800">Agent Management</Link></li>
            <li><Link href="/admin/customers" className="text-blue-600 hover:text-blue-800">Customers</Link></li>
            <li><Link href="/admin/deposits" className="text-blue-600 hover:text-blue-800">Deposits</Link></li>
            <li><Link href="/admin/cashouts" className="text-blue-600 hover:text-blue-800">Cashouts</Link></li>
            <li><Link href="/admin/games" className="text-blue-600 hover:text-blue-800">Games</Link></li>
            <li><Link href="/admin/profit-loss" className="text-blue-600 hover:text-blue-800">Profit/Loss</Link></li>
            {/* Add more links as needed */}
          </ul>
        </nav>
        <button
          onClick={() => {
            firebaseAuth.signOut();
            router.push('/admin');
          }}
          className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
        >
          Logout
        </button>
      </header>

      <main className="p-4">
        {loading && <p className="text-center text-gray-600">Loading dashboard...</p>}
        {error && <p className="text-center text-red-500">{error}</p>}

        {!loading && !error && (
          <>
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard title="Total Customers" value={totalCustomers} icon="👥" color="#4F46E5" />
              <StatCard title="Total Agents" value={totalAgents} icon="👤" color="#10B981" />
              <StatCard title="Deposits Today" value={`$${totalDepositsToday.toFixed(2)}`} icon="💰" color="#F59E0B" />
              <StatCard title="Overall Profit" value={`$${overallProfit.toFixed(2)}`} icon="📈" color={overallProfit >= 0 ? "#10B981" : "#EF4444"} />
            </section>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Overall Financial Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h4 className="text-lg font-medium text-gray-700">Total Deposit (All Time)</h4>
                  <p className="text-2xl font-bold text-green-600">${totalDepositAllTime.toFixed(2)}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h4 className="text-lg font-medium text-gray-700">Total Cashout (All Time)</h4>
                  <p className="text-2xl font-bold text-red-600">${totalCashoutAllTime.toFixed(2)}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h4 className="text-lg font-medium text-gray-700">Net Profit/Loss</h4>
                  <p className={`text-2xl font-bold ${overallProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>${overallProfit.toFixed(2)}</p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Pending Cashouts (Last 5)</h3>
              {pendingCashouts.length === 0 ? (
                <p className="text-gray-600">No pending cashouts.</p>
              ) : (
                <div className="bg-white shadow-md rounded-lg overflow-hidden">
                  <table className="min-w-full leading-normal">
                    <thead>
                      <tr>
                        <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Username
                        </th>
                        <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingCashouts.map((cashout) => (
                        <tr key={cashout.id}>
                          <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                            <p className="text-gray-900 whitespace-no-wrap">{cashout.username}</p>
                          </td>
                          <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                            <p className="text-gray-900 whitespace-no-wrap">${cashout.amount.toFixed(2)}</p>
                          </td>
                          <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                            <p className="text-gray-900 whitespace-no-wrap">{new Date(cashout.createdAt).toLocaleString()}</p>
                          </td>
                          <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                            <span className="relative inline-block px-3 py-1 font-semibold text-yellow-900 leading-tight">
                              <span aria-hidden="true" className="absolute inset-0 bg-yellow-200 opacity-50 rounded-full"></span>
                              <span className="relative">{cashout.status}</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Recent Orders</h3>
              {orders.length === 0 ? (
                <p className="text-gray-600">No orders found.</p>
              ) : (
                <div className="bg-white shadow-md rounded-lg overflow-hidden">
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
                                  Created
                              </th>
                              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                  Actions
                              </th>
                          </tr>
                      </thead>
                      <tbody>
                          {orders.map((order) => (
                              <tr key={order.id}>
                                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                      {order.id}
                                  </td>
                                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                      {order.username}
                                  </td>
                                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                      {order.game}
                                  </td>
                                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                      ${Number(order.amount).toFixed(2)}
                                  </td>
                                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                      <span
                                          className={`relative inline-block px-3 py-1 font-semibold leading-tight ${
                                              order.status === 'paid' ? 'text-green-900' :
                                              order.status === 'pending' ? 'text-yellow-900' :
                                              'text-red-900'
                                          }`}
                                      >
                                          <span
                                              aria-hidden="true"
                                              className={`absolute inset-0 ${
                                                  order.status === 'paid' ? 'bg-green-200' :
                                                  order.status === 'pending' ? 'bg-yellow-200' :
                                                  'bg-red-200'
                                              } opacity-50 rounded-full`}
                                          ></span>
                                          <span className="relative">{order.status}</span>
                                      </span>
                                  </td>
                                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                      {new Date(order.created).toLocaleString()}
                                  </td>
                                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm font-medium">
                                      <button
                                          className="text-indigo-600 hover:text-indigo-900 mr-2"
                                          onClick={() => setModalOrder(order)}
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
      {modalOrder && <OrderDetailModal order={modalOrder} onClose={() => setModalOrder(null)} />}
          </>
        )}
      </main>
    </div>
  );
}