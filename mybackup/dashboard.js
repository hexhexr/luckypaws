
// src/pages/admin/dashboard.js
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
                <div className="modal-header">
                    Order Details: <span className="text-[var(--primary-color)] font-semibold">{order.id}</span>
                </div>
                <div className="modal-body modal-body-spaced text-sm">
                    <p><strong className="text-bold text-secondary-color">Username:</strong> {order.username}</p>
                    <p><strong className="text-bold text-secondary-color">Amount:</strong> <span className="text-success">${parseFloat(order.amount || 0).toFixed(2)}</span></p>
                    <p><strong className="text-bold text-secondary-color">Status:</strong>
                        <span className={`status-badge status-${order.status}`}>{order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : 'N/A'}</span>
                    </p>
                    <p><strong className="text-bold text-secondary-color">Created:</strong> {order.created ? new Date(order.created).toLocaleString() : 'N/A'}</p>
                    {order.pageCode && <p><strong className="text-bold text-secondary-color">Page Code:</strong> {order.pageCode}</p>}
                    {order.read !== undefined && <p><strong className="text-bold text-secondary-color">Read:</strong> {order.read ? <span className="text-success">Yes</span> : <span className="text-danger">No</span>}</p>}
                </div>
                <div className="modal-footer">
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
            <div className="modal modal-md" onClick={e => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={onClose}>&times;</button>
                <div className="modal-header">
                    Edit Agent: <span className="text-[var(--primary-color)]">{agent.name}</span>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body modal-body-spaced">
                        <div>
                            <label htmlFor="agentNameEdit">Name:</label>
                            <input type="text" id="agentNameEdit" className="input" value={name} onChange={(e) => setName(e.target.value)} required disabled={isSaving} />
                        </div>
                        <div>
                            <label htmlFor="agentEmailEdit">Email:</label>
                            <input type="email" id="agentEmailEdit" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isSaving} />
                        </div>
                    </div>
                    <div className="modal-footer">
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
  const [agentEmail, setAgentEmail] = useState(''); // Corrected: useState('')
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

  const handleLogout = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin_auth');
      await firebaseAuth.signOut().catch(console.error);
      router.push('/admin');
    }
  };

  if (!isAuthenticated) {
    return <div className="loading-screen">Loading or Redirecting...</div>;
  }

  return (
    <div className="dashboard-container"> {/* Body background from globals.css */}
      <Head>
        <title>Admin Dashboard</title>
        <meta name="description" content="Admin dashboard for managing orders and agents" />
        <link rel="icon" href="/favicon.ico" />
        {/* Font is in globals.css, but keeping this for explicitness if needed */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>
      <header className="dashboard-header">
        <h1 className="dashboard-title">Admin Dashboard</h1>
        <nav className="dashboard-nav">
          <button onClick={() => router.push('/admin/dashboard')} className="btn btn-primary">Dashboard</button>
          <button onClick={() => router.push('/agent/login')} className="btn btn-secondary">Agent Login</button>
          <button onClick={handleLogout} className="btn btn-danger">Logout</button>
        </nav>
      </header>
      <main className="dashboard-main">
        <div className="stats-grid">
          <StatCard title="Total Orders" value={totalOrders} icon="📦" color="var(--accent-color)" />
          <StatCard title="Pending Orders" value={unpaidOrders} icon="⏳" color="var(--warning-color)" />
          <StatCard title="Paid Orders" value={paidOrders} icon="✅" color="var(--primary-color)" /> {/* Using primary for paid */}
          <StatCard title="Total Earnings" value={`$${totalEarnings.toFixed(2)}`} icon="💰" color="var(--primary-green)" />
          <StatCard title="Total Cashouts" value={`$${totalCashouts.toFixed(2)}`} icon="💸" color="var(--red-alert)" />
          <StatCard title="Net Profit" value={`$${netProfit.toFixed(2)}`} icon="📈" color="var(--green-dark)" />
        </div>

        <section className="card-section">
          <div className="card-header">Create New Agent</div>
          <div className="card-body">
            <form onSubmit={handleCreateAgent} className="form-grid">
              <div>
                <label htmlFor="agentName">Name:</label>
                <input type="text" id="agentName" className="input" value={agentName} onChange={(e) => setAgentName(e.target.value)} required />
              </div>
              <div>
                <label htmlFor="agentEmail">Email:</label>
                <input type="email" id="agentEmail" className="input" value={agentEmail} onChange={(e) => setAgentEmail(e.target.value)} required />
              </div>
              <div>
                <label htmlFor="agentPassword">Password:</label>
                <input type="password" id="agentPassword" className="input" value={agentPassword} onChange={(e) => setAgentPassword(e.target.value)} required />
              </div>
              <div className="form-full-width">
                <button type="submit" className="btn btn-primary btn-full-width">Create Agent</button>
              </div>
            </form>
            {createAgentMessage.text && (
              <p className={`alert ${createAgentMessage.type === 'error' ? 'alert-danger' : 'alert-success'} mt-md`}>
                {createAgentMessage.text}
              </p>
            )}
          </div>
        </section>

        <section className="card-section">
          <div className="card-header">All Agents</div>
          <div className="card-body">
            {agents.length === 0 ? (
              <p className="text-center text-light">No agents found.</p>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Work Hours</th>
                      <th>Leaves</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map(agent => (
                      <tr key={agent.id}>
                        <td>{agent.name}</td>
                        <td>{agent.email}</td>
                        <td>{calculateTotalHours(agent.id)} hrs</td>
                        <td>{(agentLeaves[agent.id] || []).filter(l => l.status === 'pending').length} pending</td>
                        <td>
                          <div className="action-buttons">
                            <button className="btn btn-secondary btn-small" onClick={() => setSelectedAgentForEdit(agent)}>Edit</button>
                            <button className="btn btn-danger btn-small" onClick={() => handleDeleteAgent(agent.id)}>Delete</button>
                            <button className="btn btn-primary btn-small" onClick={() => setSelectedAgentForLeave(agent)}>Apply Leave</button>
                            <button className="btn btn-info btn-small" onClick={() => setSelectedAgentForDetails(agent)}>Details</button>
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

        {/* Agent Details Modal */}
        {selectedAgentForDetails && (
            <div className="modal-overlay" onClick={() => setSelectedAgentForDetails(null)}>
                <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                    <button className="modal-close-btn" onClick={() => setSelectedAgentForDetails(null)}>&times;</button>
                    <div className="modal-header">Agent Details: {selectedAgentForDetails.name}</div>
                    <div className="modal-body modal-body-spaced">
                        <p><strong className="text-bold text-secondary-color">Name:</strong> {selectedAgentForDetails.name}</p>
                        <p><strong className="text-bold text-secondary-color">Email:</strong> {selectedAgentForDetails.email}</p>

                        <h4 className="modal-section-title">Work Hours:</h4>
                        {agentWorkHours[selectedAgentForDetails.id] && agentWorkHours[selectedAgentForDetails.id].length > 0 ? (
                            <ul className="modal-list">
                                {agentWorkHours[selectedAgentForDetails.id].map((entry, index) => (
                                    <li key={index}>
                                        <span className="modal-list-item-label">Login:</span> {entry.loginTime ? new Date(entry.loginTime.toDate()).toLocaleString() : 'N/A'}
                                        <span className="modal-list-item-label">Logout:</span> {entry.logoutTime ? new Date(entry.logoutTime.toDate()).toLocaleString() : 'N/A'}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-center text-light">No work hour records.</p>
                        )}

                        <h4 className="modal-section-title">Leave Requests:</h4>
                        {agentLeaves[selectedAgentForDetails.id] && agentLeaves[selectedAgentForDetails.id].length > 0 ? (
                            <div className="table-responsive">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Reason</th>
                                            <th>Days</th>
                                            <th>Status</th>
                                            <th>Requested</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {agentLeaves[selectedAgentForDetails.id].map((leave, index) => (
                                            <tr key={index}>
                                                <td>{leave.reason}</td>
                                                <td>{leave.days}</td>
                                                <td>
                                                    <span className={`status-badge status-${leave.status}`}>
                                                        {leave.status}
                                                    </span>
                                                </td>
                                                <td>{leave.requestedAt ? new Date(leave.requestedAt.toDate()).toLocaleString() : 'N/A'}</td>
                                                <td>
                                                    <div className="action-buttons">
                                                        {leave.status === 'pending' && (
                                                            <>
                                                                <button className="btn btn-success btn-xsmall" onClick={() => approveLeave(leave.id)}>Approve</button>
                                                                <button className="btn btn-danger btn-xsmall" onClick={() => rejectLeave(leave.id)}>Reject</button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-center text-light">No leave requests.</p>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-secondary btn-sm" onClick={() => setSelectedAgentForDetails(null)}>Close</button>
                    </div>
                </div>
            </div>
        )}

        {/* Agent Edit Modal */}
        {selectedAgentForEdit && (
          <AgentEditModal agent={selectedAgentForEdit} onClose={() => setSelectedAgentForEdit(null)} onSave={handleEditAgent} />
        )}

        {/* Apply Leave Modal */}
        {selectedAgentForLeave && (
            <div className="modal-overlay" onClick={() => setSelectedAgentForLeave(null)}>
                <div className="modal modal-md" onClick={e => e.stopPropagation()}>
                    <button className="modal-close-btn" onClick={() => setSelectedAgentForLeave(null)}>&times;</button>
                    <div className="modal-header">Apply Leave for {selectedAgentForLeave.name}</div>
                    <form onSubmit={handleApplyLeave}>
                        <div className="modal-body modal-body-spaced">
                            <div>
                                <label htmlFor="leaveReason">Reason:</label>
                                <input type="text" id="leaveReason" className="input" value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} required />
                            </div>
                            <div>
                                <label htmlFor="leaveDays">Number of Days:</label>
                                <input type="number" id="leaveDays" className="input" value={leaveDays} onChange={(e) => setLeaveDays(e.target.value)} min="1" required />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedAgentForLeave(null)}>Cancel</button>
                            <button type="submit" className="btn btn-primary btn-sm">Submit Request</button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        <section className="card-section">
            <div className="card-header">Recent Orders</div>
            <div className="card-body">
            {orders.length === 0 ? (
                <p className="text-center text-light">No orders found.</p>
            ) : (
                <div className="table-responsive">
                <table className="data-table">
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
                    {orders.map((order) => (
                        <tr key={order.id}>
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