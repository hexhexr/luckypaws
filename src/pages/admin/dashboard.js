// src/pages/admin/dashboard.js
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { db } from '../../lib/firebaseClient';
import { auth as firebaseAuth } from '../../lib/firebaseClient';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, getDocs, doc, deleteDoc, updateDoc, setDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';

// --- Helper Components ---

const StatCard = ({ title, value, icon, color }) => (
    // Uses .card as a base and integrates global CSS variables
    <div className="card p-lg relative overflow-hidden border-t-4 flex flex-col justify-between" style={{ borderColor: color }}>
        <div>
            <h4 className="text-lg font-semibold mb-sm" style={{ color }}>{title}</h4>
            <h2 className="text-4xl font-bold text-text-dark">{value}</h2> {/* Use text-dark */}
        </div>
        <span className="absolute right-md top-md text-6xl opacity-20 pointer-events-none" style={{ color }}>{icon}</span>
    </div>
);

const OrderDetailModal = ({ order, onClose }) => {
    if (!order) return null;
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={onClose}>&times;</button>
                <div className="modal-title mb-md"> {/* Use modal-title, adjust margin */}
                    Order Details: <span className="text-primary-green">{order.id}</span> {/* Use primary-green */}
                </div>
                <div className="modal-body space-y-md text-sm text-text-dark"> {/* Use text-dark, space-y-md */}
                    <p><strong>Username:</strong> {order.username}</p>
                    <p><strong>Amount:</strong> <span className="font-semibold text-primary-green">${parseFloat(order.amount || 0).toFixed(2)}</span></p> {/* Use primary-green */}
                    <p><strong>Status:</strong>
                        <span className={`ml-2 font-semibold px-2.5 py-1 rounded-full text-xs ${
                            order.status === 'paid' ? 'bg-green-light text-primary-green' : // Use global vars
                            order.status === 'pending' ? 'bg-yellow-light text-yellow-warning' : // Use global vars
                            order.status === 'archived' ? 'bg-bg-medium-light text-text-light' : // Use global vars
                            'bg-gray-100 text-gray-500' // Keep fallback if no global var
                        }`}>{order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : 'N/A'}</span>
                    </p>
                    <p><strong>Created:</strong> {order.created ? new Date(order.created).toLocaleString() : 'N/A'}</p>
                    {order.pageCode && <p><strong>Page Code:</strong> {order.pageCode}</p>}
                    {order.read !== undefined && <p><strong>Read:</strong> {order.read ? <span className="text-primary-green">Yes</span> : <span className="text-red-alert">No</span>}</p>} {/* Use global vars */}
                </div>
                <div className="modal-footer mt-lg"> {/* Add margin top */}
                    <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
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
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={onClose}>&times;</button>
                <div className="modal-title mb-md"> {/* Use modal-title, adjust margin */}
                    Edit Agent: <span className="text-primary-green">{agent.name}</span>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body space-y-md"> {/* Use space-y-md */}
                        <div className="form-group"> {/* Use form-group */}
                            <label htmlFor="agentNameEdit">Name:</label>
                            <input type="text" id="agentNameEdit" className="input-field" value={name} onChange={(e) => setName(e.target.value)} required disabled={isSaving} />
                        </div>
                        <div className="form-group"> {/* Use form-group */}
                            <label htmlFor="agentEmailEdit">Email:</label>
                            <input type="email" id="agentEmailEdit" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isSaving} />
                        </div>
                    </div>
                    <div className="modal-footer mt-lg"> {/* Add margin top */}
                        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={isSaving}>Cancel</button>
                        <button type="submit" className="btn btn-primary btn-sm" disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
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
  const [leaveDays, setLeaveDays] = useState('');
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
    return () => { unsubscribeAgents(); unsubscribeWorkHours(); unsubscribeLeaves(); };
  }, [isAuthenticated, firebaseUser]);

  const viewOrderDetails = (orderId) => setModalOrder(orders.find(o => o.id === orderId));
  const markAsRead = async (orderId) => { try { await updateDoc(doc(db, 'orders', orderId), { read: true }); } catch (e) { console.error(e); alert('Failed to mark as read.'); }};
  const archiveOrder = async (orderId) => { if (window.confirm(`Archive this order?`)) { try { await updateDoc(doc(db, 'orders', orderId), { status: 'archived' }); } catch (e) { console.error(e); alert('Failed to archive.'); }}};

  const handleCreateAgent = async (e) => {
    e.preventDefault();
    setCreateAgentMessage({ text: '', type: '' });
    if (!agentName || !agentEmail || !agentPassword) { setCreateAgentMessage({ text: 'All fields are required.', type: 'error' }); return; }
    try {
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, agentEmail, agentPassword);
      await setDoc(doc(db, 'users', userCredential.user.uid), { name: agentName, email: agentEmail, role: 'agent', createdAt: serverTimestamp() });
      setCreateAgentMessage({ text: 'Agent created successfully!', type: 'success' });
      setAgentName(''); setAgentEmail(''); setAgentPassword('');
    } catch (error) {
      let msg = 'Failed to create agent.';
      if (error.code === 'auth/email-already-in-use') msg = 'Email already in use.';
      else if (error.code === 'auth/weak-password') msg = 'Password (min 6 chars).';
      setCreateAgentMessage({ text: msg, type: 'error' });
    }
  };

  const handleDeleteAgent = async (agentId) => {
    if (window.confirm('Delete agent & their records? This is permanent.')) {
        try {
            await deleteDoc(doc(db, 'users', agentId));
            const relatedDocsQuery = (coll, field) => query(collection(db, coll), where(field, '==', agentId));
            (await getDocs(relatedDocsQuery('workHours', 'agentId'))).forEach(d => deleteDoc(d.ref));
            (await getDocs(relatedDocsQuery('leaves', 'agentId'))).forEach(d => deleteDoc(d.ref));
            setCreateAgentMessage({ text: 'Agent deleted.', type: 'success' });
        } catch (e) { console.error(e); setCreateAgentMessage({ text: `Error: ${e.message}`, type: 'error' }); }
    }
  };
  const handleEditAgent = async (agentId, updatedData) => { try { await updateDoc(doc(db, 'users', agentId), updatedData); setCreateAgentMessage({ text: 'Agent updated.', type: 'success' }); } catch (e) { console.error(e); setCreateAgentMessage({ text: `Error: ${e.message}`, type: 'error' }); }};
  const calculateTotalHours = useCallback((agentId) => ( (agentWorkHours[agentId] || []).reduce((sum, entry) => { if (entry.loginTime && entry.logoutTime) { const login = entry.loginTime?.toDate ? entry.loginTime.toDate() : new Date(entry.loginTime); const logout = entry.logoutTime?.toDate ? entry.logoutTime.toDate() : new Date(entry.logoutTime); if (!isNaN(login.getTime()) && !isNaN(logout.getTime())) return sum + (logout.getTime() - login.getTime()); } return sum; }, 0) / (36e5) ).toFixed(2), [agentWorkHours]);
  const updateLeaveStatus = async (leaveId, status) => { try { await updateDoc(doc(db, 'leaves', leaveId), { status }); } catch (e) { console.error(e); alert(`Failed to update leave.`); }};
  const approveLeave = (leaveId) => updateLeaveStatus(leaveId, 'approved');
  const rejectLeave = (leaveId) => updateLeaveStatus(leaveId, 'rejected');

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    const numLeaveDays = parseInt(leaveDays, 10);
    if (!selectedAgentForLeave || !leaveReason || isNaN(numLeaveDays) || numLeaveDays <= 0) { alert('Valid agent, reason, and positive days required.'); return; }
    try {
        await addDoc(collection(db, 'leaves'), { agentId: selectedAgentForLeave.id, agentName: selectedAgentForLeave.name, reason: leaveReason, days: numLeaveDays, status: 'pending', requestedAt: serverTimestamp() });
        alert('Leave request submitted!');
        setLeaveReason(''); setLeaveDays(''); setSelectedAgentForLeave(null);
    } catch (e) { console.error(e); alert('Failed to submit leave request.'); }
  };
  const handleLogout = async () => { if (typeof window !== 'undefined') { localStorage.removeItem('admin_auth'); await firebaseAuth.signOut().catch(console.error); router.push('/admin'); }};

  if (!isAuthenticated) { return <div className="min-h-screen flex items-center justify-center text-lg">Loading or Redirecting...</div>; }

  const actionButtonBase = "btn btn-sm transition-transform transform hover:scale-105"; // Added transform here

  return (
    <div className="min-h-screen p-md sm:p-lg lg:p-xl font-inter bg-bg-light text-text-dark"> {/* Apply bg-light and text-dark from globals.css */}
      <Head>
        <title>Admin Dashboard</title>
        <meta name="description" content="Admin dashboard for managing orders and agents" />
        <link rel="icon" href="/favicon.ico" />
        {/* Font is in globals.css, but keeping this for explicitness if needed */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <header className="main-header mb-xl"> {/* Use main-header and mb-xl */}
        <div className="header-content"> {/* Use header-content */}
          <h1 className="text-2xl sm:text-3xl mb-md sm:mb-0 text-text-dark">Admin Dashboard</h1> {/* Adjust font size, use text-dark */}
          <nav>
            <ul className="main-nav"> {/* Use main-nav */}
                <li><button onClick={() => router.push('/admin/dashboard')} className="btn btn-primary">Dashboard</button></li>
                <li><button onClick={() => router.push('/agent/login')} className="btn btn-secondary">Agent Login</button></li> {/* Use btn-secondary */}
                <li><button onClick={handleLogout} className="btn btn-danger">Logout</button></li>
            </ul>
          </nav>
        </div>
      </header>

      <main className="container space-y-xl pb-xl"> {/* Use .container for max-width and center, space-y-xl for gaps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-md"> {/* Use gap-md */}
          <StatCard title="Total Orders" value={totalOrders} icon="📦" color="var(--primary-green)" /> {/* Use primary-green */}
          <StatCard title="Pending Orders" value={unpaidOrders} icon="⏳" color="var(--yellow-warning)" /> {/* Use yellow-warning */}
          <StatCard title="Paid Orders" value={paidOrders} icon="✅" color="var(--primary-green)" /> {/* Use primary-green */}
          <StatCard title="Total Earnings" value={`$${totalEarnings.toFixed(2)}`} icon="💰" color="#6f42c1" /> {/* Keep distinct color if intended */}
          <StatCard title="Total Cashouts" value={`$${totalCashouts.toFixed(2)}`} icon="💸" color="#fd7e14" /> {/* Keep distinct color if intended */}
          <StatCard title="Net Profit" value={`$${netProfit.toFixed(2)}`} icon="📈" color="#20c997" /> {/* Keep distinct color if intended */}
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Agent Management</h2>
          </div>
          <div className="card-body space-y-lg"> {/* Use space-y-lg */}
            <div className="card p-lg bg-input-bg"> {/* Use card, p-lg, bg-input-bg */}
              <h3 className="card-subtitle text-primary-green mb-md">Create New Agent</h3> {/* Use card-subtitle, text-primary-green, mb-md */}
              <form onSubmit={handleCreateAgent} className="grid grid-cols-1 md:grid-cols-3 gap-md items-end"> {/* Use gap-md */}
                <input type="text" placeholder="Agent Name" value={agentName} onChange={(e) => setAgentName(e.target.value)} required className="input-field" /> {/* Use input-field */}
                <input type="email" placeholder="Agent Email" value={agentEmail} onChange={(e) => setAgentEmail(e.target.value)} required className="input-field" /> {/* Use input-field */}
                <input type="password" placeholder="Password (min 6 chars)" value={agentPassword} onChange={(e) => setAgentPassword(e.target.value)} required className="input-field" /> {/* Use input-field */}
                <button type="submit" className="btn btn-primary md:col-span-3 mt-md">Create Agent</button> {/* Use mt-md */}
              </form>
              {createAgentMessage.text && (
                <div className={`alert mt-md ${createAgentMessage.type === 'success' ? 'alert-success' : 'alert-danger'}`}> {/* Use mt-md */}
                  {createAgentMessage.text}
                </div>
              )}
            </div>

            <div>
              <h3 className="section-subtitle mb-md">Registered Agents</h3> {/* Use section-subtitle, mb-md */}
              {agents.length === 0 ? (
                <p className="text-center italic py-lg text-text-light">No agents registered yet.</p> {/* Use text-text-light */}
              ) : (
                <div className="overflow-x-auto card"> {/* Use card for table container */}
                  <table className="min-w-full">
                    <thead>
                      <tr>
                        <th>Name</th><th>Email</th><th>Total Hours</th><th>Leaves (Pending/Approved)</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agents.map(agent => (
                        <tr key={agent.id}>
                          <td className="font-medium text-text-dark">{agent.name}</td> {/* Use text-dark */}
                          <td className="text-text-dark">{agent.email}</td> {/* Use text-dark */}
                          <td className="text-text-dark">{calculateTotalHours(agent.id)} hrs</td> {/* Use text-dark */}
                          <td className="text-text-dark"> {/* Use text-dark */}
                            <span className="font-semibold">{agentLeaves[agent.id]?.filter(l => l.status === 'pending').length || 0}</span> Pending / {' '}
                            <span className="font-semibold text-primary-green">{agentLeaves[agent.id]?.filter(l => l.status === 'approved').length || 0}</span> Approved
                          </td>
                          <td>
                            <div className="flex flex-wrap gap-xs"> {/* Use gap-xs */}
                              <button className={`${actionButtonBase} bg-green-light text-text-white hover:bg-green-dark`} onClick={() => setSelectedAgentForDetails(agent)}>Details</button> {/* Use global colors */}
                              <button className={`${actionButtonBase} bg-green-light text-text-white hover:bg-green-dark`} onClick={() => setSelectedAgentForEdit(agent)}>Edit</button> {/* Use global colors */}
                              <button className={`${actionButtonBase} bg-green-light text-text-white hover:bg-green-dark`} onClick={() => setSelectedAgentForLeave(agent)}>Apply Leave</button> {/* Use global colors */}
                              <button className={`${actionButtonBase} btn-danger`} onClick={() => handleDeleteAgent(agent.id)}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {selectedAgentForDetails && (
            <div className="modal-overlay" onClick={() => setSelectedAgentForDetails(null)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={() => setSelectedAgentForDetails(null)}>&times;</button>
                <div className="modal-title mb-md"> {/* Use modal-title, adjust margin */}
                    Agent Records: <span className="text-primary-green">{selectedAgentForDetails.name}</span>
                </div>
                <div className="modal-body space-y-lg pr-xs"> {/* Use space-y-lg, pr-xs */}
                    <p className="text-sm border-b border-border-subtle pb-sm text-text-dark"><strong>Email:</strong> {selectedAgentForDetails.email}</p> {/* Use border-subtle, pb-sm, text-dark */}
                    {[
                        { title: 'Work History', data: agentWorkHours[selectedAgentForDetails.id], emptyMsg: 'No work history recorded.',
                          headers: ['Login Time', 'Logout Time', 'Duration'],
                          renderRow: (log, index) => {
                            const loginTime = log.loginTime?.toDate ? log.loginTime.toDate() : (log.loginTime ? new Date(log.loginTime) : null);
                            const logoutTime = log.logoutTime?.toDate ? log.logoutTime.toDate() : (log.logoutTime ? new Date(log.logoutTime) : null);
                            const duration = (logoutTime && loginTime && !isNaN(loginTime.getTime()) && !isNaN(logoutTime.getTime())) ? ((logoutTime.getTime() - loginTime.getTime()) / (36e5)).toFixed(2) : 'N/A';
                            return (
                                <tr key={log.id || index}>
                                    <td className="text-xs text-text-dark">{loginTime && !isNaN(loginTime.getTime()) ? loginTime.toLocaleString() : 'N/A'}</td> {/* Use text-dark */}
                                    <td className="text-xs text-text-dark">{logoutTime && !isNaN(logoutTime.getTime()) ? logoutTime.toLocaleString() : <span className="italic text-text-light">In Progress</span>}</td> {/* Use text-dark, text-light */}
                                    <td className="text-xs font-semibold text-text-dark">{duration !== 'N/A' ? `${duration} hrs` : duration}</td> {/* Use text-dark */}
                                </tr>
                            );
                          }
                        },
                        { title: 'Leave Requests', data: agentLeaves[selectedAgentForDetails.id], emptyMsg: 'No leave requests found.',
                          headers: ['Reason', 'Days', 'Status', 'Requested', 'Actions'],
                          renderRow: (leave) => (
                            <tr key={leave.id}>
                                <td className="text-xs text-text-dark max-w-xs truncate" title={leave.reason}>{leave.reason}</td> {/* Use text-dark */}
                                <td className="text-xs text-center text-text-dark">{leave.days}</td> {/* Use text-dark */}
                                <td className="text-xs font-semibold">
                                    <span className={`px-2 py-0.5 inline-flex text-[11px] leading-4 font-semibold rounded-full ${
                                        leave.status === 'approved' ? 'bg-green-light text-primary-green' : // Use global vars
                                        leave.status === 'rejected' ? 'bg-red-light text-red-alert' : // Use global vars
                                        'bg-yellow-light text-yellow-warning' // Use global vars
                                    }`}>{leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}</span>
                                </td>
                                <td className="text-xs text-text-dark">{leave.requestedAt?.toDate ? leave.requestedAt.toDate().toLocaleDateString() : (leave.requestedAt ? new Date(leave.requestedAt).toLocaleDateString() : 'N/A')}</td> {/* Use text-dark */}
                                <td>
                                    {leave.status === 'pending' && (
                                        <div className="flex gap-xs"> {/* Use gap-xs */}
                                            <button className={`${actionButtonBase} btn-primary btn-xsmall`} onClick={() => approveLeave(leave.id)}>Approve</button> {/* Use btn-primary, btn-xsmall */}
                                            <button className={`${actionButtonBase} btn-danger btn-xsmall`} onClick={() => rejectLeave(leave.id)}>Reject</button> {/* Use btn-danger, btn-xsmall */}
                                        </div>
                                    )}
                                </td>
                            </tr>
                          )
                        }
                    ].map(section => (
                        <div key={section.title}>
                            <h4 className="card-subtitle text-primary-green mb-sm">{section.title}</h4> {/* Use card-subtitle, text-primary-green, mb-sm */}
                            {(section.data && section.data.length > 0) ? (
                                <div className="overflow-x-auto card"> {/* Use card for table container */}
                                    <table className="min-w-full">
                                        <thead className="sticky top-0 z-10">
                                            <tr>{section.headers.map(h => <th key={h} className="text-xs text-text-dark bg-bg-medium-light">{h}</th>)}</tr> {/* Use text-dark, bg-medium-light */}
                                        </thead>
                                        <tbody>{section.data.map(section.renderRow)}</tbody>
                                    </table>
                                </div>
                            ) : <p className="italic text-sm text-text-light">{section.emptyMsg}</p>} {/* Use text-light */}
                        </div>
                    ))}
                </div>
                <div className="modal-footer mt-lg"> {/* Add margin top */}
                    <button className="btn btn-secondary btn-sm" onClick={() => setSelectedAgentForDetails(null)}>Close</button>
                </div>
              </div>
            </div>
          )}

        {selectedAgentForEdit && <AgentEditModal agent={selectedAgentForEdit} onClose={() => setSelectedAgentForEdit(null)} onSave={handleEditAgent} />}

        {selectedAgentForLeave && (
            <div className="modal-overlay" onClick={() => setSelectedAgentForLeave(null)}>
                <div className="modal" onClick={e => e.stopPropagation()}>
                    <button className="modal-close-btn" onClick={() => setSelectedAgentForLeave(null)}>&times;</button>
                    <div className="modal-title mb-md">Apply Leave for <span className="text-primary-green">{selectedAgentForLeave.name}</span></div> {/* Use modal-title, mb-md, text-primary-green */}
                    <form onSubmit={handleApplyLeave}>
                        <div className="modal-body space-y-md"> {/* Use space-y-md */}
                            <div className="form-group"> {/* Use form-group */}
                                <label htmlFor="leaveReason">Reason:</label>
                                <input type="text" id="leaveReason" value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} required placeholder="e.g., Vacation" className="input-field" /> {/* Use input-field */}
                            </div>
                            <div className="form-group"> {/* Use form-group */}
                                <label htmlFor="leaveDays">Number of Days:</label>
                                <input type="number" id="leaveDays" value={leaveDays} onChange={(e) => setLeaveDays(e.target.value)} min="1" required placeholder="e.g., 3" className="input-field" /> {/* Use input-field */}
                            </div>
                        </div>
                        <div className="modal-footer mt-lg"> {/* Add margin top */}
                             <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedAgentForLeave(null)}>Cancel</button>
                            <button type="submit" className="btn btn-primary btn-sm">Submit Request</button>
                        </div>
                    </form>
                </div>
            </div>
          )}

        <div className="card">
          <div className="card-header"><h2>All Orders</h2></div>
          <div className="card-body">
            <div className="overflow-x-auto card"> {/* Use card for table container */}
              <table className="min-w-full">
                <thead>
                  <tr><th>Username</th><th>Status</th><th>Amount</th><th>Created At</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr><td colSpan="5" className="text-center italic py-lg text-text-light">No orders found.</td></tr> {/* Use py-lg, text-light */}
                  ) : (
                    orders.map(order => (
                      <tr key={order.id} className={`${!order.read && order.status === 'paid' ? 'bg-yellow-light border-l-4 border-yellow-warning' : ''}`}> {/* Use yellow-light, yellow-warning */}
                        <td className="font-medium text-text-dark">{order.username}</td> {/* Use text-dark */}
                        <td>
                          <span className={`font-semibold px-2.5 py-1 rounded-full text-xs ${
                            order.status === 'paid' ? 'bg-green-light text-primary-green' : // Use global vars
                            order.status === 'pending' ? 'bg-yellow-light text-yellow-warning' : // Use global vars
                            order.status === 'archived' ? 'bg-bg-medium-light text-text-light' : // Use global vars
                            'bg-gray-100 text-gray-500'
                          }`}>{order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : 'N/A'}</span>
                        </td>
                        <td className="font-medium text-text-dark">${parseFloat(order.amount || 0).toFixed(2)}</td> {/* Use text-dark */}
                        <td className="text-text-dark">{order.created ? new Date(order.created).toLocaleString() : 'N/A'}</td> {/* Use text-dark */}
                        <td>
                          <div className="flex flex-wrap gap-xs"> {/* Use gap-xs */}
                            <button className={`${actionButtonBase} bg-green-light text-text-white hover:bg-green-dark`} onClick={() => viewOrderDetails(order.id)}>Details</button> {/* Use global colors */}
                            {order.status === 'paid' && !order.read && (
                              <button className={`${actionButtonBase} btn-primary`} onClick={() => markAsRead(order.id)}>Mark Read</button>
                            )}
                            {order.status !== 'archived' && (
                                <button className={`${actionButtonBase} btn-secondary`} onClick={() => archiveOrder(order.id)}>Archive</button> {/* Use btn-secondary */}
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {modalOrder && <OrderDetailModal order={modalOrder} onClose={() => setModalOrder(null)} />}
        </div>
      </main>
    </div>
  );
}