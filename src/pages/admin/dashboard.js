// src/pages/admin/dashboard.js
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { db } from '../../lib/firebaseClient'; // Using the import path that works for your setup
import { auth as firebaseAuth } from '../../lib/firebaseClient'; // Using the import path that works for your setup
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, getDocs, doc, deleteDoc, updateDoc, setDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';

// --- Helper Components (using Tailwind CSS classes) ---

const StatCard = ({ title, value, icon, color }) => (
    <div className="bg-white rounded-lg shadow-md p-6 relative overflow-hidden border-t-4" style={{ borderColor: color }}>
        <h4 className="text-lg font-semibold mb-2" style={{ color }}>{title}</h4>
        <h2 className="text-4xl font-bold text-gray-800">{value}</h2>
        <span className="absolute right-4 top-4 text-5xl opacity-10" style={{ color }}>{icon}</span>
    </div>
);

const OrderDetailModal = ({ order, onClose }) => {
    if (!order) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-lg relative" onClick={e => e.stopPropagation()}>
                <button className="absolute top-4 right-4 text-gray-600 hover:text-gray-900 text-2xl" onClick={onClose}>&times;</button>
                <h3 className="text-2xl font-bold mb-4 text-gray-800">Order Details: <span className="text-blue-600">{order.id}</span></h3>
                <div className="space-y-2 text-gray-700">
                    <p><strong>Username:</strong> {order.username}</p>
                    <p><strong>Amount:</strong> <span className="font-semibold text-green-600">${parseFloat(order.amount || 0).toFixed(2)}</span></p>
                    <p><strong>Status:</strong> <span className={`font-semibold ${order.status === 'paid' ? 'text-green-500' : order.status === 'pending' ? 'text-yellow-500' : 'text-gray-500'}`}>{order.status}</span></p>
                    <p><strong>Created:</strong> {new Date(order.created).toLocaleString()}</p>
                    {order.pageCode && <p><strong>Page Code:</strong> {order.pageCode}</p>}
                    {order.read !== undefined && <p><strong>Read:</strong> {order.read ? 'Yes' : 'No'}</p>}
                </div>
                <div className="mt-6 text-right">
                    <button className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

const AgentEditModal = ({ agent, onClose, onSave }) => {
    const [name, setName] = useState(agent.name || '');
    const [email, setEmail] = useState(agent.email || '');
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        await onSave(agent.id, { name, email });
        setIsSaving(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md relative" onClick={e => e.stopPropagation()}>
                <button className="absolute top-4 right-4 text-gray-600 hover:text-gray-900 text-2xl" onClick={onClose}>&times;</button>
                <h3 className="text-2xl font-bold mb-4 text-gray-800">Edit Agent: {agent.name}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="agentName" className="block text-sm font-medium text-gray-700 mb-1">Name:</label>
                        <input
                            type="text"
                            id="agentName"
                            className="p-3 border border-gray-300 rounded-md w-full focus:ring-blue-500 focus:border-blue-500"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            disabled={isSaving}
                        />
                    </div>
                    <div>
                        <label htmlFor="agentEmail" className="block text-sm font-medium text-gray-700 mb-1">Email:</label>
                        <input
                            type="email"
                            id="agentEmail"
                            className="p-3 border border-gray-300 rounded-md w-full focus:ring-blue-500 focus:border-blue-500"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={isSaving}
                        />
                    </div>
                    <div className="mt-6 text-right space-x-3">
                        <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-md font-semibold" disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button type="button" className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors" onClick={onClose} disabled={isSaving}>Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    );
};


// Main Admin Dashboard Component
export default function AdminDashboard() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState(null);

  const [orders, setOrders] = useState([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [unpaidOrders, setUnpaidOrders] = useState(0);
  const [paidOrders, setPaidOrders] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [totalCashouts, setTotalCashouts] = useState(0); // New state for total cashouts
  const [netProfit, setNetProfit] = useState(0); // New state for net profit
  const [modalOrder, setModalOrder] = useState(null);

  const [agentName, setAgentName] = useState('');
  const [agentEmail, setAgentEmail] = '';
  const [agentPassword, setAgentPassword] = useState('');
  const [createAgentMessage, setCreateAgentMessage] = useState({ text: '', type: '' });
  const [agents, setAgents] = useState([]);
  const [agentWorkHours, setAgentWorkHours] = useState({});
  const [agentLeaves, setAgentLeaves] = useState({}); // Corrected initialization
  const [selectedAgentForDetails, setSelectedAgentForDetails] = useState(null);
  const [selectedAgentForEdit, setSelectedAgentForEdit] = useState(null); // New state for editing agent
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveDays, setLeaveDays] = useState(0);
  const [selectedAgentForLeave, setSelectedAgentForLeave] = useState(null);

  // --- Authentication Check (Vercel-based Admin Login + Firebase Auth) ---
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const adminAuth = localStorage.getItem('admin_auth');
    if (adminAuth !== '1') {
      router.replace('/admin');
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        setFirebaseUser(user);
        setIsAuthenticated(true);
        console.log('Firebase user (admin) is signed in for admin dashboard.');
      } else {
        console.log('Firebase user not found. Redirecting to admin login.');
        localStorage.removeItem('admin_auth');
        router.replace('/admin');
      }
    });

    return () => unsubscribe();
  }, [router]);

  // --- Real-time Order Data Fetching ---
  useEffect(() => {
    if (!isAuthenticated || !firebaseUser) return;

    const q = query(collection(db, 'orders'), orderBy('created', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created: doc.data().created?.toDate ? doc.data().created.toDate().toISOString() : new Date(doc.data().created).toISOString(),
      }));

      const pending = fetchedOrders.filter(order => order.status === 'pending').length;
      const paid = fetchedOrders.filter(order => order.status === 'paid').length;
      const totalEarn = fetchedOrders.filter(order => order.status === 'paid')
                                     .reduce((sum, order) => sum + parseFloat(order.amount || 0), 0);

      setOrders(fetchedOrders);
      setTotalOrders(fetchedOrders.length);
      setUnpaidOrders(pending);
      setPaidOrders(paid);
      setTotalEarnings(totalEarn);
    }, (error) => {
      console.error("Error fetching orders:", error);
      // alert('Error fetching orders: ' + error.message + '. Check Firestore Rules or Indexes.'); // Re-enable for debugging
    });

    return () => unsubscribe();
  }, [isAuthenticated, firebaseUser]);

  // --- Real-time Cashout Data Fetching for Profit Calculation ---
  useEffect(() => {
    if (!isAuthenticated || !firebaseUser) return;

    const q = query(collection(db, 'cashouts')); // Assuming all cashouts are relevant for total
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let totalCashoutsAmt = 0;
      snapshot.forEach(doc => {
        const data = doc.data();
        totalCashoutsAmt += parseFloat(data.amount || 0);
      });
      setTotalCashouts(totalCashoutsAmt);
    }, (error) => {
      console.error("Error fetching cashouts for profit calculation:", error);
      // alert('Error fetching cashouts: ' + error.message);
    });

    return () => unsubscribe();
  }, [isAuthenticated, firebaseUser]);

  // --- Calculate Net Profit ---
  useEffect(() => {
    setNetProfit(totalEarnings - totalCashouts);
  }, [totalEarnings, totalCashouts]);

  // --- Agent Management: Fetch Agents, Work Hours, Leaves ---
  useEffect(() => {
    if (!isAuthenticated || !firebaseUser) return;

    const agentsQuery = query(collection(db, 'users'), where('role', '==', 'agent'));
    const unsubscribeAgents = onSnapshot(agentsQuery, (snapshot) => {
      const fetchedAgents = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAgents(fetchedAgents);
    }, (error) => {
      console.error("Error fetching agents:", error);
      // alert('Error fetching agents: ' + error.message + '. Check Firestore Rules or Indexes.'); // Re-enable for debugging
    });

    const workHoursQuery = query(collection(db, 'workHours'));
    const unsubscribeWorkHours = onSnapshot(workHoursQuery, (snapshot) => {
        const hoursData = {};
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const agentId = data.agentId;
            if (agentId) {
                if (!hoursData[agentId]) {
                    hoursData[agentId] = [];
                }
                hoursData[agentId].push(data);
            }
        });
        setAgentWorkHours(hoursData);
    }, (error) => {
        console.error("Error fetching work hours:", error);
        // alert('Error fetching work hours: ' + error.message + '. Check Firestore Rules or Indexes.'); // Re-enable for debugging
    });

    const leavesQuery = query(collection(db, 'leaves'));
    const unsubscribeLeaves = onSnapshot(leavesQuery, (snapshot) => {
        const leavesData = {};
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const agentId = data.agentId;
            if (agentId) {
                if (!leavesData[agentId]) {
                    leavesData[agentId] = [];
                }
                leavesData[agentId].push(data);
            }
        });
        setAgentLeaves(leavesData);
    }, (error) => {
        console.error("Error fetching leave requests:", error);
        // alert('Error fetching leave requests: ' + error.message + '. Check Firestore Rules or Indexes.'); // Re-enable for debugging
    });

    return () => {
        unsubscribeAgents();
        unsubscribeWorkHours();
        unsubscribeLeaves();
    };
  }, [isAuthenticated, firebaseUser]);

  // --- Order Actions ---
  const viewOrderDetails = (orderId) => {
    const order = orders.find(o => o.id === orderId);
    setModalOrder(order);
  };

  const markAsRead = async (orderId) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { read: true });
      console.log(`Order ${orderId} marked as read.`);
    } catch (error) {
      console.error('Error marking order as read:', error);
      alert('Failed to mark order as read: ' + error.message);
    }
  };

  const archiveOrder = async (orderId) => {
    if (window.confirm(`Are you sure you want to archive this order?`)) {
        try {
            await updateDoc(doc(db, 'orders', orderId), { status: 'archived' });
            console.log(`Order ${orderId} archived.`);
        } catch (error) {
            console.error('Error archiving order:', error);
            alert('Failed to archive order: ' + error.message);
        }
    }
  };

  // --- Agent Creation Logic ---
  const handleCreateAgent = async (e) => {
    e.preventDefault();
    setCreateAgentMessage({ text: '', type: '' });

    if (!agentName || !agentEmail || !agentPassword) {
      setCreateAgentMessage({ text: 'All fields are required.', type: 'error' });
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, agentEmail, agentPassword);
      const user = userCredential.user;

      await setDoc(doc(db, 'users', user.uid), {
        name: agentName,
        email: agentEmail,
        role: 'agent',
        createdAt: serverTimestamp(),
      });

      setCreateAgentMessage({ text: 'Agent created successfully!', type: 'success' });
      setAgentName('');
      setAgentEmail('');
      setAgentPassword('');
    } catch (error) {
      console.error('Error creating agent:', error);
      let errorMessage = 'Failed to create agent.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'The email address is already in use by another account.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password should be at least 6 characters.';
      }
      setCreateAgentMessage({ text: errorMessage, type: 'error' });
    }
  };

  const handleDeleteAgent = async (agentId) => {
    if (window.confirm('Are you sure you want to delete this agent? This action cannot be undone.')) {
        try {
            await deleteDoc(doc(db, 'users', agentId));

            const workHoursSnapshot = await getDocs(query(collection(db, 'workHours'), where('agentId', '==', agentId)));
            workHoursSnapshot.forEach(async (d) => await deleteDoc(d.ref));

            const leavesSnapshot = await getDocs(query(collection(db, 'leaves'), where('agentId', '==', agentId)));
            leavesSnapshot.forEach(async (d) => await deleteDoc(d.ref));

            console.log(`Agent ${agentId} and associated records deleted from Firestore.`);
            setCreateAgentMessage({ text: 'Agent deleted successfully!', type: 'success' });
        } catch (error) {
            console.error('Error deleting agent:', error);
            setCreateAgentMessage({ text: `Error deleting agent: ${error.message}`, type: 'error' });
        }
    }
  };

  const handleEditAgent = async (agentId, updatedData) => {
    try {
        await updateDoc(doc(db, 'users', agentId), updatedData);
        setCreateAgentMessage({ text: 'Agent updated successfully!', type: 'success' });
    } catch (error) {
        console.error('Error updating agent:', error);
        setCreateAgentMessage({ text: `Error updating agent: ${error.message}`, type: 'error' });
    }
  };

  const calculateTotalHours = useCallback((agentId) => {
    const hours = agentWorkHours[agentId] || [];
    let totalDurationMs = 0;
    hours.forEach(entry => {
        if (entry.loginTime && entry.logoutTime) {
            const login = new Date(entry.loginTime);
            const logout = new Date(entry.logoutTime);
            totalDurationMs += (logout.getTime() - login.getTime());
        }
    });
    const totalHours = totalDurationMs / (1000 * 60 * 60);
    return totalHours.toFixed(2);
  }, [agentWorkHours]);

  const approveLeave = async (leaveId) => {
    try {
        await updateDoc(doc(db, 'leaves', leaveId), { status: 'approved' });
        console.log(`Leave request ${leaveId} approved.`);
    } catch (error) {
        console.error('Error approving leave:', error);
        alert('Failed to approve leave: ' + error.message);
    }
  };

  const rejectLeave = async (leaveId) => {
    try {
        await updateDoc(doc(db, 'leaves', leaveId), { status: 'rejected' });
        console.log(`Leave request ${leaveId} rejected.`);
    } catch (error) {
        console.error('Error rejecting leave:', error);
        alert('Failed to reject leave: ' + error.message);
    }
  };

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    if (!selectedAgentForLeave || !leaveReason || !leaveDays) {
        alert('Please select an agent, provide a reason, and specify days.');
        return;
    }

    try {
        await addDoc(collection(db, 'leaves'), {
            agentId: selectedAgentForLeave.id,
            agentName: selectedAgentForLeave.name,
            reason: leaveReason,
            days: parseInt(leaveDays, 10),
            status: 'pending',
            requestedAt: serverTimestamp(),
        });
        alert('Leave request submitted successfully!');
        setLeaveReason('');
        setLeaveDays(0);
        setSelectedAgentForLeave(null);
    } catch (error) {
        console.error('Error applying for leave:', error);
        alert('Failed to submit leave request: ' + error.message);
    }
  };

  const handleLogout = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin_auth');
      await firebaseAuth.signOut().catch(console.error);
      router.push('/admin');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-lg bg-gray-100">
        Loading or Redirecting to Admin Login...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 font-inter">
      {/* Tailwind CSS CDN script - IMPORTANT: Ensure this is loaded in your _document.js or layout if not already */}
      <script src="https://cdn.tailwindcss.com"></script>
      <Head>
        <title>Admin Dashboard</title>
        <meta name="description" content="Admin dashboard for managing orders and agents" />
        <link rel="icon" href="/favicon.ico" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
      </Head>

      <header className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-lg shadow-md mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-4 sm:mb-0">Admin Dashboard</h1>
        <nav className="flex flex-wrap gap-2 sm:gap-4">
          <button
            onClick={() => router.push('/admin/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm"
          >
            Dashboard
          </button>
          <button
            onClick={() => router.push('/agent/login')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors shadow-sm"
          >
            Agent Login
          </button>
          {/* Add more menu items here if needed */}
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors shadow-sm"
          >
            Logout
          </button>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard title="Total Orders" value={totalOrders} icon="📦" color="#007bff" />
          <StatCard title="Pending Orders" value={unpaidOrders} icon="⏳" color="#ffc107" />
          <StatCard title="Paid Orders" value={paidOrders} icon="✅" color="#28a745" />
          <StatCard title="Total Earnings" value={`$${totalEarnings.toFixed(2)}`} icon="💰" color="#6f42c1" />
          <StatCard title="Total Cashouts" value={`$${totalCashouts.toFixed(2)}`} icon="💸" color="#fd7e14" />
          <StatCard title="Net Profit" value={`$${netProfit.toFixed(2)}`} icon="📈" color="#20c997" />
        </div>

        {/* Agent Management Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Agent Management</h2>
          
          {/* Create New Agent Form */}
          <div className="mb-8 p-4 border border-gray-200 rounded-md bg-gray-50">
            <h3 className="text-xl font-semibold mb-3 text-blue-600">Create New Agent</h3>
            <form onSubmit={handleCreateAgent} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                className="p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                type="text"
                placeholder="Agent Name"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                required
              />
              <input
                className="p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                type="email"
                placeholder="Agent Email"
                value={agentEmail}
                onChange={(e) => setAgentEmail(e.target.value)}
                required
              />
              <input
                className="p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                type="password"
                placeholder="Agent Password"
                value={agentPassword}
                onChange={(e) => setAgentPassword(e.target.value)}
                required
              />
              <button type="submit" className="md:col-span-3 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-md font-semibold">Create Agent</button>
            </form>
            {createAgentMessage.text && (
              <div className={`mt-4 p-3 rounded-md ${createAgentMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {createAgentMessage.text}
              </div>
            )}
          </div>

          {/* Registered Agents Table */}
          <h3 className="text-xl font-semibold mb-3 text-gray-800">Registered Agents</h3>
          {agents.length === 0 ? (
            <p className="text-gray-600">No agents registered yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg shadow-sm border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Hours</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leaves (Pending/Approved)</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {agents.map(agent => (
                    <tr key={agent.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{agent.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{agent.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{calculateTotalHours(agent.id)} hrs</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {agentLeaves[agent.id]?.filter(l => l.status === 'pending').length || 0} Pending / {' '}
                        {agentLeaves[agent.id]?.filter(l => l.status === 'approved').length || 0} Approved
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex flex-wrap gap-2">
                          <button className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-xs" onClick={() => setSelectedAgentForDetails(agent)}>View Details</button>
                          <button className="px-3 py-1 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors text-xs" onClick={() => setSelectedAgentForEdit(agent)}>Edit</button>
                          <button className="px-3 py-1 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 transition-colors text-xs" onClick={() => setSelectedAgentForLeave(agent)}>Apply Leave</button>
                          <button className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors text-xs" onClick={() => handleDeleteAgent(agent.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Agent Details / Record View Modal */}
          {selectedAgentForDetails && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={() => setSelectedAgentForDetails(null)}>
              <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-2xl relative" onClick={e => e.stopPropagation()}>
                <button className="absolute top-4 right-4 text-gray-600 hover:text-gray-900 text-2xl" onClick={() => setSelectedAgentForDetails(null)}>&times;</button>
                <h3 className="text-2xl font-bold mb-4 text-gray-800">Agent Records: {selectedAgentForDetails.name}</h3>
                <p className="text-gray-700 mb-4"><strong>Email:</strong> {selectedAgentForDetails.email}</p>

                {/* Work History */}
                <h4 className="text-xl font-semibold mb-3 text-blue-600">Work History</h4>
                {agentWorkHours[selectedAgentForDetails.id] && agentWorkHours[selectedAgentForDetails.id].length > 0 ? (
                    <div className="overflow-x-auto rounded-lg shadow-sm border border-gray-200 mb-6" style={{ maxHeight: '200px' }}>
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Login Time</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Logout Time</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                { /* FIX: Ensure agentWorkHours[selectedAgentForDetails.id] is an array */ }
                                {(agentWorkHours[selectedAgentForDetails.id] || []).map((log, index) => {
                                    const loginTime = log.loginTime ? (log.loginTime.toDate ? log.loginTime.toDate() : new Date(log.loginTime)) : null;
                                    const logoutTime = log.logoutTime ? (log.logoutTime.toDate ? log.logoutTime.toDate() : new Date(log.logoutTime)) : null;
                                    const duration = (logoutTime && loginTime) ? ((logoutTime.getTime() - loginTime.getTime()) / (1000 * 60 * 60)).toFixed(2) : 'N/A';
                                    return (
                                        <tr key={index}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{loginTime ? loginTime.toLocaleString() : 'N/A'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{logoutTime ? logoutTime.toLocaleString() : 'N/A'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-800">{duration} hrs</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : <p className="text-gray-600 mb-6">No work history recorded.</p>}

                {/* Leave Requests */}
                <h4 className="text-xl font-semibold mb-3 text-blue-600">Leave Requests</h4>
                {agentLeaves[selectedAgentForDetails.id] && agentLeaves[selectedAgentForDetails.id].length > 0 ? (
                    <div className="overflow-x-auto rounded-lg shadow-sm border border-gray-200 mb-6" style={{ maxHeight: '200px' }}>
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested At</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                { /* FIX: Ensure agentLeaves[selectedAgentForDetails.id] is an array */ }
                                {(agentLeaves[selectedAgentForDetails.id] || []).map((leave) => (
                                    <tr key={leave.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{leave.reason}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{leave.days}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                leave.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                leave.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                                'bg-yellow-100 text-yellow-800'
                                            }`}>
                                                {leave.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{leave.requestedAt?.toDate ? leave.requestedAt.toDate().toLocaleString() : (new Date(leave.requestedAt)).toLocaleString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            {leave.status === 'pending' && (
                                                <div className="flex gap-2">
                                                    <button className="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors text-xs" onClick={() => approveLeave(leave.id)}>Approve</button>
                                                    <button className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors text-xs" onClick={() => rejectLeave(leave.id)}>Reject</button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : <p className="text-gray-600 mb-6">No leave requests.</p>}
                
                <div className="mt-6 text-right">
                    <button className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors" onClick={() => setSelectedAgentForDetails(null)}>Close</button>
                </div>
              </div>
            </div>
          )}

          {/* Agent Edit Modal */}
          {selectedAgentForEdit && (
              <AgentEditModal
                  agent={selectedAgentForEdit}
                  onClose={() => setSelectedAgentForEdit(null)}
                  onSave={handleEditAgent}
              />
          )}

          {/* Apply Leave Form Modal */}
          {selectedAgentForLeave && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={() => setSelectedAgentForLeave(null)}>
                <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md relative" onClick={e => e.stopPropagation()}>
                    <button className="absolute top-4 right-4 text-gray-600 hover:text-gray-900 text-2xl" onClick={() => setSelectedAgentForLeave(null)}>&times;</button>
                    <h3 className="text-2xl font-bold mb-4 text-gray-800">Apply Leave for {selectedAgentForLeave.name}</h3>
                    <form onSubmit={handleApplyLeave} className="space-y-4">
                        <div>
                            <label htmlFor="leaveReason" className="block text-sm font-medium text-gray-700 mb-1">Reason:</label>
                            <input
                                type="text"
                                id="leaveReason"
                                className="p-3 border border-gray-300 rounded-md w-full focus:ring-blue-500 focus:border-blue-500"
                                value={leaveReason}
                                onChange={(e) => setLeaveReason(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="leaveDays" className="block text-sm font-medium text-gray-700 mb-1">Days:</label>
                            <input
                                type="number"
                                id="leaveDays"
                                className="p-3 border border-gray-300 rounded-md w-full focus:ring-blue-500 focus:border-blue-500"
                                value={leaveDays}
                                onChange={(e) => setLeaveDays(parseInt(e.target.value, 10))}
                                min="1"
                                required
                            />
                        </div>
                        <div className="mt-6 text-right space-x-3">
                            <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-md font-semibold">Submit Request</button>
                            <button type="button" className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors" onClick={() => setSelectedAgentForLeave(null)}>Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
          )}
        </div>

        {/* Orders Table Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">All Orders</h2>
          <div className="overflow-x-auto rounded-lg shadow-sm border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">No orders found.</td>
                  </tr>
                ) : (
                  orders.map(order => (
                    <tr key={order.id} className={`${!order.read && order.status === 'paid' ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.username}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          order.status === 'paid' ? 'bg-green-100 text-green-800' :
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${parseFloat(order.amount || 0).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {order.created ? new Date(order.created).toLocaleString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex flex-wrap gap-2">
                          <button className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-xs" onClick={() => viewOrderDetails(order.id)}>Details</button>
                          {order.status === 'paid' && !order.read && (
                            <button className="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors text-xs" onClick={() => markAsRead(order.id)}>Mark Read</button>
                          )}
                          <button className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors text-xs" onClick={() => archiveOrder(order.id)}>Archive</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {modalOrder && <OrderDetailModal order={modalOrder} onClose={() => setModalOrder(null)} />}
        </div>
      </main>
    </div>
  );
}