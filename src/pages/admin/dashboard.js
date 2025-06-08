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
            <h2 className="stat-card-value">H: {value}</h2>
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
                <h3>Order Details: {order.orderId}</h3>
                <p><strong>Username:</strong> {order.username}</p>
                <p><strong>Game:</strong> {order.game}</p>
                <p><strong>Amount:</strong> ${parseFloat(order.amount).toFixed(2)}</p>
                <p><strong>Status:</strong> {order.status}</p>
                <p><strong>Created At:</strong> {new Date(order.created).toLocaleString()}</p>
                {order.read && <p><strong>Read By Admin:</strong> Yes (at {new Date(order.readAt).toLocaleString()})</p>}
                {order.cancelledManually && <p><strong>Cancelled Manually:</strong> Yes</p>}
                {/* Add more details as needed */}
            </div>
        </div>
    );
};


export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [orders, setOrders] = useState([]);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [agents, setAgents] = useState([]);
  const [cashouts, setCashouts] = useState([]);
  const [totalAgents, setTotalAgents] = useState(0);
  const [totalPendingCashouts, setTotalPendingCashouts] = useState(0);
  const [totalPendingOrders, setTotalPendingOrders] = useState(0);
  const [modalOrder, setModalOrder] = useState(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false); // New state for tracking login
  const [workHours, setWorkHours] = useState([]);
  const [leaves, setLeaves] = useState([]);


  // Agent Management States
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [agentForm, setAgentForm] = useState({
    id: null, username: '', password: '', pageCode: '', role: 'agent',
    agentId: '', date: '', hours: '', type: 'full-day' // for work hours and leaves
  });


  // --- Authentication Check ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        // User is signed in, check if they are an admin
        // This requires a custom claim or a lookup in Firestore
        // For now, we'll assume any logged-in user here is an admin based on the login page's intent
        setIsAdminLoggedIn(true);
        // Optionally, you might fetch user's custom claims to verify role
        user.getIdTokenResult().then((idTokenResult) => {
          if (!idTokenResult.claims.admin) { // Check for custom admin claim
            console.log("User is not an admin, redirecting.");
            router.replace('/admin'); // Redirect if not admin
          }
        }).catch(error => {
          console.error("Error getting ID token result:", error);
          router.replace('/admin');
        });
      } else {
        // No user is signed in.
        setIsAdminLoggedIn(false);
        router.replace('/admin'); // Redirect to login page
      }
    });

    return () => unsubscribe(); // Clean up the listener
  }, [router]);


  // --- Real-time Data Fetching ---
  useEffect(() => {
    if (!isAdminLoggedIn) return;

    // Orders Listener
    const qOrders = query(collection(db, "orders"), orderBy("created", "desc"));
    const unsubscribeOrders = onSnapshot(qOrders, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(ordersData);
      setPendingOrdersCount(ordersData.filter(order => order.status === 'pending').length);
    });

    // Agents Listener
    const qAgents = query(collection(db, "users"), where("role", "==", "agent")); // Assuming agents are users with role 'agent'
    const unsubscribeAgents = onSnapshot(qAgents, (snapshot) => {
      const agentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAgents(agentsData);
      setTotalAgents(agentsData.length);
    });

    // Cashouts Listener
    const qCashouts = query(collection(db, "cashouts"), orderBy("createdAt", "desc"));
    const unsubscribeCashouts = onSnapshot(qCashouts, (snapshot) => {
      const cashoutsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCashouts(cashoutsData);
      setTotalPendingCashouts(cashoutsData.filter(cashout => cashout.status === 'pending').length);
    });

    // Work Hours Listener
    const qWorkHours = query(collection(db, "workHours"), orderBy("date", "desc"));
    const unsubscribeWorkHours = onSnapshot(qWorkHours, (snapshot) => {
      setWorkHours(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Leaves Listener
    const qLeaves = query(collection(db, "leaves"), orderBy("date", "desc"));
    const unsubscribeLeaves = onSnapshot(qLeaves, (snapshot) => {
      setLeaves(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });


    return () => {
      unsubscribeOrders();
      unsubscribeAgents();
      unsubscribeCashouts();
      unsubscribeWorkHours();
      unsubscribeLeaves();
    };
  }, [isAdminLoggedIn]);


  // --- Handlers for Agent Management ---
  const handleCreateAgent = async () => {
    try {
      // 1. Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, agentForm.username, agentForm.password);
      const user = userCredential.user;

      // 2. Add user data to Firestore 'users' collection
      await setDoc(doc(db, "users", user.uid), {
        username: agentForm.username,
        pageCode: agentForm.pageCode,
        role: agentForm.role,
        createdAt: serverTimestamp(),
      });
      alert('Agent created successfully!');
      setShowAgentModal(false);
      setAgentForm({ id: null, username: '', password: '', pageCode: '', role: 'agent' }); // Reset form
    } catch (error) {
      console.error("Error creating agent:", error);
      alert(`Error creating agent: ${error.message}`);
    }
  };

  const handleEditAgent = async () => {
    try {
      if (!agentForm.id) throw new Error("Agent ID is missing for edit.");
      const agentRef = doc(db, "users", agentForm.id); // Assuming agent ID is the user's UID
      const updateData = {
        username: agentForm.username,
        pageCode: agentForm.pageCode,
        role: agentForm.role,
      };
      // Only update password if it's provided (i.e., user wants to change it)
      if (agentForm.password) {
        // In a real app, you'd re-authenticate the user before changing password
        // and use admin SDK on backend to update password if agent is not currently logged in.
        // For client-side: firebaseAuth.currentUser.updatePassword(agentForm.password);
        // This direct client-side password update is generally for the currently logged-in user.
        // For admin changing other user's passwords, it should go through a secure API route.
        alert('Password cannot be changed directly from here for existing agents. Please use Firebase Console or a secure API.');
        return;
      }

      await updateDoc(agentRef, updateData);
      alert('Agent updated successfully!');
      setShowAgentModal(false);
      setAgentForm({ id: null, username: '', password: '', pageCode: '', role: 'agent' });
    } catch (error) {
      console.error("Error editing agent:", error);
      alert(`Error editing agent: ${error.message}`);
    }
  };

  const handleDeleteAgent = async (id) => {
    if (confirm('Are you sure you want to delete this agent? This action is irreversible.')) {
      try {
        await deleteDoc(doc(db, "users", id)); // Assuming agent ID is the user's UID
        // In a real app, you'd also delete the user from Firebase Authentication via Admin SDK on backend
        alert('Agent deleted successfully!');
      } catch (error) {
        console.error("Error deleting agent:", error);
        alert(`Error deleting agent: ${error.message}`);
      }
    }
  };


  const handleAddWorkHours = async () => {
    try {
      await addDoc(collection(db, "workHours"), {
        agentId: agentForm.agentId,
        date: agentForm.date,
        hours: parseFloat(agentForm.hours),
        createdAt: serverTimestamp(),
      });
      alert('Work hours added successfully!');
      setAgentForm({ ...agentForm, agentId: '', date: '', hours: '' });
    } catch (error) {
      console.error("Error adding work hours:", error);
      alert(`Error adding work hours: ${error.message}`);
    }
  };

  const handleAddLeave = async () => {
    try {
      await addDoc(collection(db, "leaves"), {
        agentId: agentForm.agentId,
        date: agentForm.date,
        type: agentForm.type, // 'full-day' or 'half-day'
        createdAt: serverTimestamp(),
      });
      alert('Leave added successfully!');
      setAgentForm({ ...agentForm, agentId: '', date: '', type: 'full-day' });
    } catch (error) {
      console.error("Error adding leave:", error);
      alert(`Error adding leave: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    try {
      await firebaseAuth.signOut();
      localStorage.removeItem('admin_auth'); // Clean up local storage flag
      router.replace('/admin');
    } catch (error) {
      console.error("Error during logout:", error);
      alert(`Logout failed: ${error.message}`);
    }
  };

  const viewOrderDetails = (orderId) => {
    const order = orders.find(o => o.id === orderId);
    setModalOrder(order);
  };

  const markAsRead = async (orderId) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        read: true,
        readAt: new Date().toISOString(),
      });
      alert('Order marked as read!');
    } catch (error) {
      console.error("Error marking order as read:", error);
      alert(`Failed to mark order as read: ${error.message}`);
    }
  };

  const archiveOrder = async (orderId) => {
    if (confirm('Are you sure you want to archive this order?')) {
        try {
            const orderRef = doc(db, "orders", orderId);
            await updateDoc(orderRef, {
                status: 'archived',
                archivedAt: new Date().toISOString()
            });
            alert('Order archived successfully!');
        } catch (error) {
            console.error("Error archiving order:", error);
            alert(`Failed to archive order: ${error.message}`);
        }
    }
  };


  if (!isAdminLoggedIn) {
    return <div>Loading or redirecting to login...</div>;
  }

  return (
    <div className="admin-dashboard">
      <Head>
        <title>Admin Dashboard</title>
      </Head>

      <header className="admin-header">
        <h1 className="logo">Admin Panel</h1>
        <nav className="admin-nav">
          <button onClick={() => setActiveTab('dashboard')} className={activeTab === 'dashboard' ? 'active' : ''}>Dashboard</button>
          <button onClick={() => setActiveTab('orders')} className={activeTab === 'orders' ? 'active' : ''}>Orders</button>
          <button onClick={() => setActiveTab('agents')} className={activeTab === 'agents' ? 'active' : ''}>Agents</button>
          <button onClick={() => setActiveTab('cashouts')} className={activeTab === 'cashouts' ? 'active' : ''}>Cashouts</button>
          <button onClick={() => setActiveTab('work-hours')} className={activeTab === 'work-hours' ? 'active' : ''}>Work Hours</button>
          <button onClick={() => setActiveTab('leaves')} className={activeTab === 'leaves' ? 'active' : ''}>Leaves</button>
          <Link href="/admin/games" className="btn btn-secondary">
            Manage Games
          </Link>
          <button onClick={handleLogout} className="btn btn-danger">Logout</button>
        </nav>
      </header>

      <main className="admin-main">
        {activeTab === 'dashboard' && (
          <section className="dashboard-overview">
            <h2>Overview</h2>
            <div className="stats-grid">
              <StatCard title="Total Orders" value={orders.length} icon="📋" color="#3498db" />
              <StatCard title="Pending Orders" value={pendingOrdersCount} icon="⏳" color="#f39c12" />
              <StatCard title="Total Agents" value={totalAgents} icon="👥" color="#27ae60" />
              <StatCard title="Pending Cashouts" value={totalPendingCashouts} icon="💸" color="#e74c3c" />
            </div>
          </section>
        )}

        {activeTab === 'orders' && (
            <section className="admin-section">
            <h2>Orders Management</h2>
            <div className="table-responsive">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Order ID</th>
                            <th>Username</th>
                            <th>Game</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Created At</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                    {orders.map(order => (
                        <tr key={order.id}>
                        <td>{order.orderId}</td>
                        <td>{order.username}</td>
                        <td>{order.game}</td>
                        <td className="text-bold">${parseFloat(order.amount || 0).toFixed(2)}</td>
                        <td>
                            <span className={`status-badge status-${order.status.toLowerCase()}`}>
                            {order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : 'N/A'}
                            </span>
                        </td>
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
            </section>
        )}


        {activeTab === 'agents' && (
          <section className="admin-section">
            <h2>Agent Management</h2>
            <button className="btn btn-primary mb-md" onClick={() => { setShowAgentModal(true); setAgentForm({ id: null, username: '', password: '', pageCode: '', role: 'agent' }); }}>Add New Agent</button>

            {showAgentModal && (
              <div className="modal-overlay" onClick={() => setShowAgentModal(false)}>
                <div className="modal" onClick={e => e.stopPropagation()}>
                  <h3>{agentForm.id ? 'Edit Agent' : 'Add Agent'}</h3>
                  <div className="form-group">
                    <label>Username:</label>
                    <input type="text" className="input" value={agentForm.username} onChange={e => setAgentForm({ ...agentForm, username: e.target.value })} />
                  </div>
                  {!agentForm.id && ( // Only show password field for new agents
                    <div className="form-group">
                      <label>Password:</label>
                      <input type="password" className="input" value={agentForm.password} onChange={e => setAgentForm({ ...agentForm, password: e.target.value })} />
                    </div>
                  )}
                  <div className="form-group">
                    <label>Page Code:</label>
                    <input type="text" className="input" value={agentForm.pageCode} onChange={e => setAgentForm({ ...agentForm, pageCode: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Role:</label>
                    <select className="select" value={agentForm.role} onChange={e => setAgentForm({ ...agentForm, role: e.target.value })}>
                      <option value="agent">Agent</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="form-actions">
                    <button className="btn btn-primary" onClick={agentForm.id ? handleEditAgent : handleCreateAgent}>
                      {agentForm.id ? 'Update Agent' : 'Create Agent'}
                    </button>
                    <button className="btn btn-secondary" onClick={() => setShowAgentModal(false)}>Cancel</button>
                  </div>
                </div>
              </div>
            )}

            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Page Code</th>
                    <th>Role</th>
                    <th>Created At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map(agent => (
                    <tr key={agent.id}>
                      <td>{agent.username}</td>
                      <td>{agent.pageCode}</td>
                      <td>{agent.role}</td>
                      <td>{agent.createdAt ? new Date(agent.createdAt.toDate()).toLocaleString() : 'N/A'}</td>
                      <td>
                        <button className="btn btn-info btn-small mr-sm" onClick={() => {
                          setAgentForm({ id: agent.id, username: agent.username, password: '', pageCode: agent.pageCode, role: agent.role });
                          setShowAgentModal(true);
                        }}>Edit</button>
                        <button className="btn btn-danger btn-small" onClick={() => handleDeleteAgent(agent.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'cashouts' && (
          <section className="admin-section">
            <h2>Cashout Requests</h2>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Details</th>
                    <th>Status</th>
                    <th>Requested At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cashouts.map(cashout => (
                    <tr key={cashout.id}>
                      <td>{agents.find(a => a.id === cashout.agentId)?.username || 'N/A'}</td>
                      <td>${parseFloat(cashout.amount).toFixed(2)}</td>
                      <td>{cashout.method}</td>
                      <td>{cashout.details}</td>
                      <td>
                        <span className={`status-badge status-${cashout.status.toLowerCase()}`}>
                          {cashout.status}
                        </span>
                      </td>
                      <td>{cashout.createdAt ? new Date(cashout.createdAt.toDate()).toLocaleString() : 'N/A'}</td>
                      <td>
                        {cashout.status === 'pending' && (
                          <button className="btn btn-success btn-small" onClick={async () => {
                            if(confirm('Mark this cashout as complete?')) {
                              await updateDoc(doc(db, "cashouts", cashout.id), { status: 'completed', completedAt: serverTimestamp() });
                            }
                          }}>Complete</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'work-hours' && (
          <section className="admin-section">
            <h2>Agent Work Hours</h2>
            <div className="form-group">
              <label>Agent:</label>
              <select className="select" value={agentForm.agentId} onChange={e => setAgentForm({ ...agentForm, agentId: e.target.value })}>
                <option value="">Select Agent</option>
                {agents.map(agent => (
                  <option key={agent.id} value={agent.id}>{agent.username}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Date:</label>
              <input type="date" className="input" value={agentForm.date} onChange={e => setAgentForm({ ...agentForm, date: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Hours:</label>
              <input type="number" className="input" value={agentForm.hours} onChange={e => setAgentForm({ ...agentForm, hours: e.target.value })} />
            </div>
            <button className="btn btn-primary" onClick={handleAddWorkHours}>Add Hours</button>

            <div className="table-responsive mt-md">
              <table className="table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Date</th>
                    <th>Hours</th>
                    <th>Added At</th>
                  </tr>
                </thead>
                <tbody>
                  {workHours.map(wh => (
                    <tr key={wh.id}>
                      <td>{agents.find(a => a.id === wh.agentId)?.username || 'N/A'}</td>
                      <td>{wh.date}</td>
                      <td>{wh.hours}</td>
                      <td>{wh.createdAt ? new Date(wh.createdAt.toDate()).toLocaleString() : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'leaves' && (
          <section className="admin-section">
            <h2>Agent Leaves</h2>
            <div className="form-group">
              <label>Agent:</label>
              <select className="select" value={agentForm.agentId} onChange={e => setAgentForm({ ...agentForm, agentId: e.target.value })}>
                <option value="">Select Agent</option>
                {agents.map(agent => (
                  <option key={agent.id} value={agent.id}>{agent.username}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Date:</label>
              <input type="date" className="input" value={agentForm.date} onChange={e => setAgentForm({ ...agentForm, date: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Type:</label>
              <select className="select" value={agentForm.type} onChange={e => setAgentForm({ ...agentForm, type: e.target.value })}>
                <option value="full-day">Full Day</option>
                <option value="half-day">Half Day</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={handleAddLeave}>Add Leave</button>

            <div className="table-responsive mt-md">
              <table className="table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Added At</th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.map(leave => (
                    <tr key={leave.id}>
                      <td>{agents.find(a => a.id === leave.agentId)?.username || 'N/A'}</td>
                      <td>{leave.date}</td>
                      <td>{leave.type}</td>
                      <td>{leave.createdAt ? new Date(leave.createdAt.toDate()).toLocaleString() : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {modalOrder && <OrderDetailModal order={modalOrder} onClose={() => setModalOrder(null)} />}
      </main>
    </div>
  );
}