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
    // Increased icon opacity, added hover effect for slight lift and transition
    <div className="bg-white rounded-xl shadow-lg p-6 relative overflow-hidden border-t-4 hover:shadow-xl transition-all duration-300 ease-in-out transform hover:-translate-y-1" style={{ borderColor: color }}>
        <h4 className="text-lg font-semibold mb-2" style={{ color }}>{title}</h4>
        <h2 className="text-4xl font-bold text-gray-800">{value}</h2>
        {/* Increased icon opacity */}
        <span className="absolute right-5 top-5 text-6xl opacity-20" style={{ color }}>{icon}</span>
    </div>
);

const OrderDetailModal = ({ order, onClose }) => {
    if (!order) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl p-7 w-full max-w-lg relative animate-fadeIn" onClick={e => e.stopPropagation()}>
                {/* Enhanced close button */}
                <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-3xl leading-none transition-colors duration-200" onClick={onClose}>&times;</button>
                <h3 className="text-2xl font-bold mb-6 text-gray-800">Order Details: <span className="text-blue-600 font-semibold">{order.id}</span></h3>
                <div className="space-y-3 text-gray-700 text-sm">
                    <p><strong className="font-medium text-gray-600">Username:</strong> {order.username}</p>
                    <p><strong className="font-medium text-gray-600">Amount:</strong> <span className="font-semibold text-green-600">${parseFloat(order.amount || 0).toFixed(2)}</span></p>
                    <p><strong className="font-medium text-gray-600">Status:</strong> <span className={`font-semibold px-2.5 py-1 rounded-full text-xs ${
                        order.status === 'paid' ? 'bg-green-100 text-green-700' :
                        order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        order.status === 'archived' ? 'bg-gray-200 text-gray-700' :
                        'bg-gray-100 text-gray-500'
                    }`}>{order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : 'N/A'}</span></p>
                    <p><strong className="font-medium text-gray-600">Created:</strong> {order.created ? new Date(order.created).toLocaleString() : 'N/A'}</p>
                    {order.pageCode && <p><strong className="font-medium text-gray-600">Page Code:</strong> {order.pageCode}</p>}
                    {order.read !== undefined && <p><strong className="font-medium text-gray-600">Read:</strong> {order.read ? <span className="text-green-600 font-medium">Yes</span> : <span className="text-red-600 font-medium">No</span>}</p>}
                </div>
                <div className="mt-8 text-right">
                    <button className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400 font-medium text-sm" onClick={onClose}>Close</button>
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
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl p-7 w-full max-w-md relative animate-fadeIn" onClick={e => e.stopPropagation()}>
                <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-3xl leading-none transition-colors duration-200" onClick={onClose}>&times;</button>
                <h3 className="text-2xl font-bold mb-6 text-gray-800">Edit Agent: <span className="text-blue-600">{agent.name}</span></h3>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label htmlFor="agentName" className="block text-sm font-medium text-gray-700 mb-1.5">Name:</label>
                        <input
                            type="text"
                            id="agentName"
                            className="p-3 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            disabled={isSaving}
                        />
                    </div>
                    <div>
                        <label htmlFor="agentEmail" className="block text-sm font-medium text-gray-700 mb-1.5">Email:</label>
                        <input
                            type="email"
                            id="agentEmail"
                            className="p-3 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={isSaving}
                        />
                    </div>
                    <div className="mt-8 text-right space-x-3 pt-2">
                        <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-md font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 text-sm" disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button type="button" className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400 font-medium text-sm" onClick={onClose} disabled={isSaving}>Cancel</button>
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
  const [totalCashouts, setTotalCashouts] = useState(0);
  const [netProfit, setNetProfit] = useState(0);
  const [modalOrder, setModalOrder] = useState(null);

  const [agentName, setAgentName] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [agentPassword, setAgentPassword] = useState('');
  const [createAgentMessage, setCreateAgentMessage] = useState({ text: '', type: '' });
  const [agents, setAgents] = useState([]);
  const [agentWorkHours, setAgentWorkHours] = useState({});
  const [agentLeaves, setAgentLeaves] = useState({});
  const [selectedAgentForDetails, setSelectedAgentForDetails] = useState(null);
  const [selectedAgentForEdit, setSelectedAgentForEdit] = useState(null);
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveDays, setLeaveDays] = useState(''); // Changed to string for input field
  const [selectedAgentForLeave, setSelectedAgentForLeave] = useState(null);

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
      } else {
        localStorage.removeItem('admin_auth');
        router.replace('/admin');
      }
    });
    return () => unsubscribe();
  }, [router]);

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
    }, (error) => console.error("Error fetching orders:", error));
    return () => unsubscribe();
  }, [isAuthenticated, firebaseUser]);

  useEffect(() => {
    if (!isAuthenticated || !firebaseUser) return;
    const q = query(collection(db, 'cashouts'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let totalCashoutsAmt = 0;
      snapshot.forEach(doc => {
        totalCashoutsAmt += parseFloat(doc.data().amount || 0);
      });
      setTotalCashouts(totalCashoutsAmt);
    }, (error) => console.error("Error fetching cashouts:", error));
    return () => unsubscribe();
  }, [isAuthenticated, firebaseUser]);

  useEffect(() => {
    setNetProfit(totalEarnings - totalCashouts);
  }, [totalEarnings, totalCashouts]);

  useEffect(() => {
    if (!isAuthenticated || !firebaseUser) return;

    const agentsQuery = query(collection(db, 'users'), where('role', '==', 'agent'));
    const unsubscribeAgents = onSnapshot(agentsQuery, (snapshot) => {
      setAgents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Error fetching agents:", error));

    const workHoursQuery = query(collection(db, 'workHours'));
    const unsubscribeWorkHours = onSnapshot(workHoursQuery, (snapshot) => {
        const hoursData = {};
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.agentId) {
                if (!hoursData[data.agentId]) hoursData[data.agentId] = [];
                hoursData[data.agentId].push({id: doc.id, ...data});
            }
        });
        setAgentWorkHours(hoursData);
    }, (error) => console.error("Error fetching work hours:", error));

    const leavesQuery = query(collection(db, 'leaves'));
    const unsubscribeLeaves = onSnapshot(leavesQuery, (snapshot) => {
        const leavesData = {};
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.agentId) {
                if (!leavesData[data.agentId]) leavesData[data.agentId] = [];
                leavesData[data.agentId].push({ id: doc.id, ...data });
            }
        });
        setAgentLeaves(leavesData);
    }, (error) => console.error("Error fetching leave requests:", error));

    return () => {
        unsubscribeAgents();
        unsubscribeWorkHours();
        unsubscribeLeaves();
    };
  }, [isAuthenticated, firebaseUser]);

  const viewOrderDetails = (orderId) => setModalOrder(orders.find(o => o.id === orderId));

  const markAsRead = async (orderId) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { read: true });
    } catch (error) {
      console.error('Error marking order as read:', error);
      alert('Failed to mark order as read: ' + error.message);
    }
  };

  const archiveOrder = async (orderId) => {
    if (window.confirm(`Are you sure you want to archive this order?`)) {
        try {
            await updateDoc(doc(db, 'orders', orderId), { status: 'archived' });
        } catch (error) {
            console.error('Error archiving order:', error);
            alert('Failed to archive order: ' + error.message);
        }
    }
  };

  const handleCreateAgent = async (e) => {
    e.preventDefault();
    setCreateAgentMessage({ text: '', type: '' });
    if (!agentName || !agentEmail || !agentPassword) {
      setCreateAgentMessage({ text: 'All fields are required.', type: 'error' });
      return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, agentEmail, agentPassword);
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        name: agentName, email: agentEmail, role: 'agent', createdAt: serverTimestamp(),
      });
      setCreateAgentMessage({ text: 'Agent created successfully!', type: 'success' });
      setAgentName(''); setAgentEmail(''); setAgentPassword('');
    } catch (error) {
      console.error('Error creating agent:', error);
      let msg = 'Failed to create agent.';
      if (error.code === 'auth/email-already-in-use') msg = 'Email already in use.';
      else if (error.code === 'auth/weak-password') msg = 'Password should be at least 6 characters.';
      setCreateAgentMessage({ text: msg, type: 'error' });
    }
  };

  const handleDeleteAgent = async (agentId) => {
    if (window.confirm('Delete this agent? This removes their work hours and leave records permanently.')) {
        try {
            await deleteDoc(doc(db, 'users', agentId));
            const relatedDocsQuery = (coll, field) => query(collection(db, coll), where(field, '==', agentId));
            
            (await getDocs(relatedDocsQuery('workHours', 'agentId'))).forEach(d => deleteDoc(d.ref));
            (await getDocs(relatedDocsQuery('leaves', 'agentId'))).forEach(d => deleteDoc(d.ref));

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
    const totalMs = hours.reduce((sum, entry) => {
        if (entry.loginTime && entry.logoutTime) {
            const login = entry.loginTime?.toDate ? entry.loginTime.toDate() : new Date(entry.loginTime);
            const logout = entry.logoutTime?.toDate ? entry.logoutTime.toDate() : new Date(entry.logoutTime);
            if (!isNaN(login.getTime()) && !isNaN(logout.getTime())) return sum + (logout.getTime() - login.getTime());
        }
        return sum;
    }, 0);
    return (totalMs / (1000 * 60 * 60)).toFixed(2);
  }, [agentWorkHours]);

  const updateLeaveStatus = async (leaveId, status) => {
    try {
        await updateDoc(doc(db, 'leaves', leaveId), { status });
    } catch (error) {
        console.error(`Error updating leave to ${status}:`, error);
        alert(`Failed to update leave: ${error.message}`);
    }
  };
  const approveLeave = (leaveId) => updateLeaveStatus(leaveId, 'approved');
  const rejectLeave = (leaveId) => updateLeaveStatus(leaveId, 'rejected');

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    const numLeaveDays = parseInt(leaveDays, 10);
    if (!selectedAgentForLeave || !leaveReason || isNaN(numLeaveDays) || numLeaveDays <= 0) {
        alert('Select agent, provide reason, and specify positive number of days.');
        return;
    }
    try {
        await addDoc(collection(db, 'leaves'), {
            agentId: selectedAgentForLeave.id, agentName: selectedAgentForLeave.name,
            reason: leaveReason, days: numLeaveDays, status: 'pending', requestedAt: serverTimestamp(),
        });
        alert('Leave request submitted!');
        setLeaveReason(''); setLeaveDays(''); setSelectedAgentForLeave(null);
    } catch (error) {
        console.error('Error applying for leave:', error);
        alert('Failed to submit leave request: ' + error.message);
    }
  };

  const handleLogout = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin_auth');
      await firebaseAuth.signOut().catch(err => console.error("Logout Error: ", err));
      router.push('/admin');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-lg bg-slate-100 text-slate-700">
        Loading Admin Dashboard or Redirecting...
      </div>
    );
  }

  const tableButtonBase = "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ease-in-out transform hover:shadow-md focus:outline-none focus:ring-2 focus:ring-opacity-60";
  const actionButtonStyles = {
    view: `${tableButtonBase} bg-sky-500 text-white hover:bg-sky-600 focus:ring-sky-400`,
    edit: `${tableButtonBase} bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-400`,
    applyLeave: `${tableButtonBase} bg-indigo-500 text-white hover:bg-indigo-600 focus:ring-indigo-400`,
    delete: `${tableButtonBase} bg-rose-500 text-white hover:bg-rose-600 focus:ring-rose-400`,
    markRead: `${tableButtonBase} bg-emerald-500 text-white hover:bg-emerald-600 focus:ring-emerald-400`,
    archive: `${tableButtonBase} bg-slate-500 text-white hover:bg-slate-600 focus:ring-slate-400`,
    approve: `${tableButtonBase} !px-3 !py-1 bg-green-500 text-white hover:bg-green-600 focus:ring-green-400`,
    reject: `${tableButtonBase} !px-3 !py-1 bg-red-500 text-white hover:bg-red-600 focus:ring-red-400`,
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8 font-inter selection:bg-blue-100 selection:text-blue-700">
      <Head>
        <title>Admin Dashboard</title>
        <meta name="description" content="Admin dashboard for managing orders and agents" />
        <link rel="icon" href="/favicon.ico" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <header className="flex flex-col sm:flex-row justify-between items-center bg-white p-5 rounded-xl shadow-lg mb-8 sticky top-4 z-40">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-4 sm:mb-0">Admin Dashboard</h1>
        <nav className="flex flex-wrap items-center gap-3 sm:gap-4">
          {[
            { label: 'Dashboard', action: () => router.push('/admin/dashboard'), color: 'blue' },
            { label: 'Agent Login', action: () => router.push('/agent/login'), color: 'indigo' },
            { label: 'Logout', action: handleLogout, color: 'red' },
          ].map(btn => (
            <button key={btn.label} onClick={btn.action}
              className={`px-5 py-2.5 bg-${btn.color}-600 text-white rounded-lg hover:bg-${btn.color}-700 transition-colors duration-200 shadow-md hover:shadow-lg font-medium focus:outline-none focus:ring-2 focus:ring-${btn.color}-500 focus:ring-opacity-50 text-sm`}>
              {btn.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-full mx-auto space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          <StatCard title="Total Orders" value={totalOrders} icon="📦" color="#0ea5e9" /> {/* sky-500 */}
          <StatCard title="Pending Orders" value={unpaidOrders} icon="⏳" color="#f59e0b" /> {/* amber-500 */}
          <StatCard title="Paid Orders" value={paidOrders} icon="✅" color="#22c55e" /> {/* green-500 */}
          <StatCard title="Total Earnings" value={`$${totalEarnings.toFixed(2)}`} icon="💰" color="#8b5cf6" /> {/* violet-500 */}
          <StatCard title="Total Cashouts" value={`$${totalCashouts.toFixed(2)}`} icon="💸" color="#f97316" /> {/* orange-500 */}
          <StatCard title="Net Profit" value={`$${netProfit.toFixed(2)}`} icon="📈" color="#10b981" /> {/* emerald-500 */}
        </div>

        <div className="bg-white rounded-xl shadow-xl p-6 sm:p-7">
          <h2 className="text-2xl font-bold mb-6 text-slate-800 border-b border-slate-200 pb-4">Agent Management</h2>
          
          <div className="mb-10 p-5 border border-slate-200 rounded-xl bg-slate-50 shadow-sm">
            <h3 className="text-xl font-semibold mb-5 text-blue-700">Create New Agent</h3>
            <form onSubmit={handleCreateAgent} className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5 items-end">
              {[
                { name: 'agentName', type: 'text', placeholder: 'Agent Name', value: agentName, setter: setAgentName },
                { name: 'agentEmail', type: 'email', placeholder: 'Agent Email', value: agentEmail, setter: setAgentEmail },
                { name: 'agentPassword', type: 'password', placeholder: 'Password (min 6 chars)', value: agentPassword, setter: setAgentPassword },
              ].map(field => (
                <input key={field.name} id={field.name} type={field.type} placeholder={field.placeholder} value={field.value} onChange={(e) => field.setter(e.target.value)} required
                  className="p-3.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm placeholder-slate-400 text-sm" />
              ))}
              <button type="submit" className="md:col-span-3 w-full mt-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-md hover:shadow-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 text-sm">Create Agent</button>
            </form>
            {createAgentMessage.text && (
              <div className={`mt-5 p-3.5 rounded-lg text-sm font-medium ${createAgentMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {createAgentMessage.text}
              </div>
            )}
          </div>

          <h3 className="text-xl font-semibold mb-4 text-slate-700">Registered Agents</h3>
          {agents.length === 0 ? (
            <p className="text-slate-600 py-4 italic text-center">No agents registered yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl shadow-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-100">
                  <tr>
                    {['Name', 'Email', 'Total Hours', 'Leaves (Pending/Approved)', 'Actions'].map(header => (
                      <th key={header} scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {agents.map(agent => (
                    <tr key={agent.id} className="hover:bg-slate-50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{agent.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{agent.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{calculateTotalHours(agent.id)} hrs</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        <span className="font-semibold">{agentLeaves[agent.id]?.filter(l => l.status === 'pending').length || 0}</span> Pending / {' '}
                        <span className="font-semibold text-green-600">{agentLeaves[agent.id]?.filter(l => l.status === 'approved').length || 0}</span> Approved
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex flex-wrap gap-2.5">
                          <button className={actionButtonStyles.view} onClick={() => setSelectedAgentForDetails(agent)}>Details</button>
                          <button className={actionButtonStyles.edit} onClick={() => setSelectedAgentForEdit(agent)}>Edit</button>
                          <button className={actionButtonStyles.applyLeave} onClick={() => setSelectedAgentForLeave(agent)}>Apply Leave</button>
                          <button className={actionButtonStyles.delete} onClick={() => handleDeleteAgent(agent.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedAgentForDetails && (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedAgentForDetails(null)}>
              <div className="bg-white rounded-xl shadow-2xl p-7 w-full max-w-3xl relative max-h-[90vh] flex flex-col animate-fadeIn" onClick={e => e.stopPropagation()}>
                <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-3xl leading-none z-10 transition-colors duration-200" onClick={() => setSelectedAgentForDetails(null)}>&times;</button>
                <h3 className="text-2xl font-bold mb-2 text-slate-800">Agent Records: <span className="text-blue-600">{selectedAgentForDetails.name}</span></h3>
                <p className="text-slate-600 mb-6 text-sm border-b border-slate-200 pb-3.5"><strong className="font-medium">Email:</strong> {selectedAgentForDetails.email}</p>
                
                <div className="overflow-y-auto space-y-7 pr-2 flex-grow">
                    {[
                        { title: 'Work History', data: agentWorkHours[selectedAgentForDetails.id], emptyMsg: 'No work history recorded.',
                          headers: ['Login Time', 'Logout Time', 'Duration'],
                          renderRow: (log, index) => {
                            const loginTime = log.loginTime?.toDate ? log.loginTime.toDate() : (log.loginTime ? new Date(log.loginTime) : null);
                            const logoutTime = log.logoutTime?.toDate ? log.logoutTime.toDate() : (log.logoutTime ? new Date(log.logoutTime) : null);
                            const duration = (logoutTime && loginTime && !isNaN(loginTime.getTime()) && !isNaN(logoutTime.getTime())) ? ((logoutTime.getTime() - loginTime.getTime()) / (1000 * 60 * 60)).toFixed(2) : 'N/A';
                            return (
                                <tr key={log.id || index}>
                                    <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600">{loginTime && !isNaN(loginTime.getTime()) ? loginTime.toLocaleString() : 'N/A'}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600">{logoutTime && !isNaN(logoutTime.getTime()) ? logoutTime.toLocaleString() : <span className="italic text-slate-400">In Progress</span>}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-slate-700">{duration !== 'N/A' ? `${duration} hrs` : duration}</td>
                                </tr>
                            );
                          }
                        },
                        { title: 'Leave Requests', data: agentLeaves[selectedAgentForDetails.id], emptyMsg: 'No leave requests found.',
                          headers: ['Reason', 'Days', 'Status', 'Requested', 'Actions'],
                          renderRow: (leave) => (
                            <tr key={leave.id}>
                                <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600 max-w-xs truncate" title={leave.reason}>{leave.reason}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600 text-center">{leave.days}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-xs font-semibold">
                                    <span className={`px-2 py-0.5 inline-flex text-[11px] leading-4 font-semibold rounded-full ${
                                        leave.status === 'approved' ? 'bg-green-100 text-green-800' :
                                        leave.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                        'bg-yellow-100 text-yellow-800'
                                    }`}>{leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}</span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600">{leave.requestedAt?.toDate ? leave.requestedAt.toDate().toLocaleDateString() : (leave.requestedAt ? new Date(leave.requestedAt).toLocaleDateString() : 'N/A')}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-xs font-medium">
                                    {leave.status === 'pending' && (
                                        <div className="flex gap-2">
                                            <button className={actionButtonStyles.approve} onClick={() => approveLeave(leave.id)}>Approve</button>
                                            <button className={actionButtonStyles.reject} onClick={() => rejectLeave(leave.id)}>Reject</button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                          )
                        }
                    ].map(section => (
                        <div key={section.title}>
                            <h4 className="text-lg font-semibold mb-3 text-blue-700">{section.title}</h4>
                            {(section.data && section.data.length > 0) ? (
                                <div className="overflow-x-auto rounded-lg shadow-md border border-slate-200 max-h-60">
                                    <table className="min-w-full divide-y divide-slate-200">
                                        <thead className="bg-slate-100 sticky top-0 z-10">
                                            <tr>
                                                {section.headers.map(h => <th key={h} scope="col" className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-slate-200">
                                            {section.data.map(section.renderRow)}
                                        </tbody>
                                    </table>
                                </div>
                            ) : <p className="text-slate-500 italic text-sm">{section.emptyMsg}</p>}
                        </div>
                    ))}
                </div>
                
                <div className="mt-auto pt-7 text-right border-t border-slate-200">
                    <button className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-slate-400 font-medium text-sm" onClick={() => setSelectedAgentForDetails(null)}>Close</button>
                </div>
              </div>
            </div>
          )}

          {selectedAgentForEdit && (
              <AgentEditModal
                  agent={selectedAgentForEdit}
                  onClose={() => setSelectedAgentForEdit(null)}
                  onSave={handleEditAgent}
              />
          )}

          {selectedAgentForLeave && (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedAgentForLeave(null)}>
                <div className="bg-white rounded-xl shadow-2xl p-7 w-full max-w-md relative animate-fadeIn" onClick={e => e.stopPropagation()}>
                    <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-3xl leading-none transition-colors duration-200" onClick={() => setSelectedAgentForLeave(null)}>&times;</button>
                    <h3 className="text-2xl font-bold mb-6 text-slate-800">Apply Leave for <span className="text-blue-600">{selectedAgentForLeave.name}</span></h3>
                    <form onSubmit={handleApplyLeave} className="space-y-5">
                        <div>
                            <label htmlFor="leaveReason" className="block text-sm font-medium text-gray-700 mb-1.5">Reason:</label>
                            <input type="text" id="leaveReason" value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} required placeholder="e.g., Vacation, Sick Leave"
                                className="p-3.5 border border-slate-300 rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm text-sm" />
                        </div>
                        <div>
                            <label htmlFor="leaveDays" className="block text-sm font-medium text-gray-700 mb-1.5">Number of Days:</label>
                            <input type="number" id="leaveDays" value={leaveDays} onChange={(e) => setLeaveDays(e.target.value)} min="1" required placeholder="e.g., 3"
                                className="p-3.5 border border-slate-300 rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm text-sm" />
                        </div>
                        <div className="mt-8 text-right space-x-3 pt-2">
                            <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-md font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 text-sm">Submit Request</button>
                            <button type="button" className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400 font-medium text-sm" onClick={() => setSelectedAgentForLeave(null)}>Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-xl p-6 sm:p-7">
          <h2 className="text-2xl font-bold mb-6 text-slate-800 border-b border-slate-200 pb-4">All Orders</h2>
          <div className="overflow-x-auto rounded-xl shadow-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-100">
                <tr>
                  {['Username', 'Status', 'Amount', 'Created At', 'Actions'].map(header => (
                      <th key={header} scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-10 whitespace-nowrap text-sm text-slate-500 text-center italic">No orders found.</td>
                  </tr>
                ) : (
                  orders.map(order => (
                    <tr key={order.id} className={`transition-colors duration-150 
                                                  ${!order.read && order.status === 'paid' ? 'bg-yellow-50 hover:bg-yellow-100 border-l-4 border-yellow-500' 
                                                                                          : 'hover:bg-slate-50'}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{order.username}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2.5 py-1 inline-flex text-xs leading-4 font-semibold rounded-full ${
                          order.status === 'paid' ? 'bg-green-100 text-green-800' :
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          order.status === 'archived' ? 'bg-slate-200 text-slate-700' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">${parseFloat(order.amount || 0).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {order.created ? new Date(order.created).toLocaleString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex flex-wrap gap-2.5">
                          <button className={actionButtonStyles.view} onClick={() => viewOrderDetails(order.id)}>Details</button>
                          {order.status === 'paid' && !order.read && (
                            <button className={actionButtonStyles.markRead} onClick={() => markAsRead(order.id)}>Mark Read</button>
                          )}
                           {order.status !== 'archived' && (
                                <button className={actionButtonStyles.archive} onClick={() => archiveOrder(order.id)}>Archive</button>
                           )}
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
      <style jsx global>{`
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}