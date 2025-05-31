// pages/admin/dashboard.js
import { useEffect, useState, useCallback } from 'react'; // Added useCallback
import { useRouter } from 'next/router';
import { db } from '../../lib/firebaseClient';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, getDocs, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { auth as firebaseAuth } from '../../lib/firebaseClient'; // Import auth from firebaseClient for client-side Firebase Auth functions
import { createUserWithEmailAndPassword } from 'firebase/auth'; // Import for creating agent users

// --- Helper Components using classes from globals.css ---

const StatCard = ({ title, value, icon, color }) => (
    // Uses .card and .text-light from globals.css
    <div className="card" style={{ borderTop: `4px solid ${color}` }}>
        <div className="card-body">
            <h4 style={{ color }}>{title}</h4>
            <h2>{value}</h2>
            <span style={{ fontSize: '2.5rem', position: 'absolute', right: '20px', top: '25px', opacity: 0.2 }}>{icon}</span>
        </div>
    </div>
);

const OrderDetailModal = ({ order, onClose }) => {
    if (!order) return null;
    return (
        // Uses .modal-overlay and .modal classes from globals.css
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{textAlign: 'left', maxWidth: '600px'}} onClick={e => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={onClose}>&times;</button>
                <h3 className="modal-title">Order Details: {order.id}</h3>
                <p><strong>Username:</strong> {order.username}</p>
                <p><strong>Amount:</strong> ${parseFloat(order.amount || 0).toFixed(2)}</p>
                <p><strong>Status:</strong> {order.status}</p>
                <p><strong>Created:</strong> {new Date(order.created).toLocaleString()}</p>
                {order.pageCode && <p><strong>Page Code:</strong> {order.pageCode}</p>}
                {order.read !== undefined && <p><strong>Read:</strong> {order.read ? 'Yes' : 'No'}</p>}
                {/* Add more details as needed */}
                <div style={{marginTop: '20px', textAlign: 'right'}}>
                    <button className="btn btn-secondary" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};


// Main Admin Dashboard Component
export default function AdminDashboard() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false); // State to manage admin authentication
  const [orders, setOrders] = useState([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [unpaidOrders, setUnpaidOrders] = useState(0);
  const [paidOrders, setPaidOrders] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [modalOrder, setModalOrder] = useState(null); // State for modal details
  const [agentName, setAgentName] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [agentPassword, setAgentPassword] = useState('');
  const [createAgentMessage, setCreateAgentMessage] = useState({ text: '', type: '' });
  const [agents, setAgents] = useState([]); // State to hold list of agents
  const [agentWorkHours, setAgentWorkHours] = useState({}); // To store work hours per agent
  const [agentLeaves, setAgentLeaves] = useState({}); // To store leave requests per agent
  const [selectedAgentForDetails, setSelectedAgentForDetails] = useState(null); // For agent details modal/section
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveDays, setLeaveDays] = useState(0);
  const [selectedAgentForLeave, setSelectedAgentForLeave] = useState(null); // For applying leave

  // --- Authentication Check (Modified for localStorage) ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const adminAuth = localStorage.getItem('admin_auth');
      if (adminAuth === '1') {
        setIsAuthenticated(true);
      } else {
        router.replace('/admin'); // Redirect to login if not authenticated
      }
    }
  }, [router]);

  // --- Real-time Order Data Fetching ---
  useEffect(() => {
    if (!isAuthenticated) return; // Only fetch if authenticated

    const q = query(collection(db, 'orders'), orderBy('created', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created: doc.data().created?.toDate ? doc.data().created.toDate().toISOString() : new Date(doc.data().created).toISOString(), // Ensure ISO string
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
      // Handle error, maybe show a message to the admin
    });

    return () => unsubscribe(); // Cleanup listener on unmount
  }, [isAuthenticated]); // Rerun when authentication status changes

  // --- Agent Management: Fetch Agents, Work Hours, Leaves ---
  useEffect(() => {
    if (!isAuthenticated) return;

    // Fetch agents
    const agentsQuery = query(collection(db, 'users'), where('role', '==', 'agent'));
    const unsubscribeAgents = onSnapshot(agentsQuery, (snapshot) => {
      const fetchedAgents = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAgents(fetchedAgents);
    }, (error) => {
      console.error("Error fetching agents:", error);
    });

    // Fetch work hours for all agents (this might need to be optimized if many agents)
    const workHoursQuery = query(collection(db, 'workHours'));
    const unsubscribeWorkHours = onSnapshot(workHoursQuery, (snapshot) => {
        const hoursData = {};
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const agentId = data.agentId; // Assuming 'agentId' field exists in workHours documents
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
    });

    // Fetch leave requests for all agents
    const leavesQuery = query(collection(db, 'leaves'));
    const unsubscribeLeaves = onSnapshot(leavesQuery, (snapshot) => {
        const leavesData = {};
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const agentId = data.agentId; // Assuming 'agentId' field exists in leaves documents
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
    });

    return () => {
        unsubscribeAgents();
        unsubscribeWorkHours();
        unsubscribeLeaves();
    };
  }, [isAuthenticated]);

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
      // Handle error feedback to admin
    }
  };

  const archiveOrder = async (orderId) => {
    // This example changes status to 'archived'. You might delete or move to a different collection.
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: 'archived' });
      console.log(`Order ${orderId} archived.`);
    } catch (error) {
      console.error('Error archiving order:', error);
      // Handle error feedback to admin
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
      // 1. Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, agentEmail, agentPassword);
      const user = userCredential.user;

      // 2. Store agent details and role in Firestore 'users' collection
      await setDoc(doc(db, 'users', user.uid), { // Using setDoc to create/overwrite document for the user UID
        name: agentName,
        email: agentEmail,
        role: 'agent', // Assign 'agent' role
        createdAt: serverTimestamp(),
        // Add any other default agent properties here
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
            // Optional: Delete user from Firebase Authentication as well
            // This requires an Admin SDK call from a backend function/API route,
            // as client-side SDK cannot delete other users directly.
            // For now, we'll just remove them from Firestore's 'users' collection.
            await deleteDoc(doc(db, 'users', agentId));

            // Also delete their work hours and leave records if desired
            const workHoursSnapshot = await getDocs(query(collection(db, 'workHours'), where('agentId', '==', agentId)));
            workHoursSnapshot.forEach(async (d) => await deleteDoc(d.ref));

            const leavesSnapshot = await getDocs(query(collection(db, 'leaves'), where('agentId', '==', agentId)));
            leavesSnapshot.forEach(async (d) => await deleteDoc(d.ref));

            console.log(`Agent ${agentId} and associated records deleted.`);
            setCreateAgentMessage({ text: 'Agent deleted successfully!', type: 'success' }); // Reuse message state
        } catch (error) {
            console.error('Error deleting agent:', error);
            setCreateAgentMessage({ text: `Error deleting agent: ${error.message}`, type: 'error' });
        }
    }
  };

  const calculateTotalHours = useCallback((agentId) => {
    const hours = agentWorkHours[agentId] || [];
    // Assuming each workHour entry has 'startTime' and 'endTime' (timestamps)
    // For simplicity, let's just count number of entries for now, or calculate actual duration
    // For actual duration:
    let totalDurationMs = 0;
    hours.forEach(entry => {
        if (entry.startTime && entry.endTime) {
            const start = entry.startTime.toDate ? entry.startTime.toDate() : new Date(entry.startTime);
            const end = entry.endTime.toDate ? entry.endTime.toDate() : new Date(entry.endTime);
            totalDurationMs += (end.getTime() - start.getTime());
        }
    });
    const totalHours = totalDurationMs / (1000 * 60 * 60); // Convert ms to hours
    return totalHours.toFixed(2); // Display with 2 decimal places
  }, [agentWorkHours]);

  const approveLeave = async (leaveId) => {
    try {
        await updateDoc(doc(db, 'leaves', leaveId), { status: 'approved' });
        console.log(`Leave request ${leaveId} approved.`);
    } catch (error) {
        console.error('Error approving leave:', error);
    }
  };

  const rejectLeave = async (leaveId) => {
    try {
        await updateDoc(doc(db, 'leaves', leaveId), { status: 'rejected' });
        console.log(`Leave request ${leaveId} rejected.`);
    } catch (error) {
        console.error('Error rejecting leave:', error);
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
            status: 'pending', // Initial status
            requestedAt: serverTimestamp(),
        });
        alert('Leave request submitted successfully!');
        setLeaveReason('');
        setLeaveDays(0);
        setSelectedAgentForLeave(null); // Close the form
    } catch (error) {
        console.error('Error applying for leave:', error);
        alert('Failed to submit leave request: ' + error.message);
    }
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin_auth'); // Clear local storage flag
      router.push('/admin'); // Redirect to admin login page
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '1.2rem' }}>
        Loading or Redirecting...
      </div>
    );
  }

  return (
    <>
      <div className="admin-dashboard-container">
        <header className="admin-header">
          <h1>Admin Dashboard</h1>
          <button className="btn btn-danger" onClick={handleLogout}>Logout</button>
        </header>

        <main className="admin-main">
          <div className="stats-grid">
            <StatCard title="Total Orders" value={totalOrders} icon="📦" color="#007bff" />
            <StatCard title="Pending Orders" value={unpaidOrders} icon="⏳" color="#ffc107" />
            <StatCard title="Paid Orders" value={paidOrders} icon="✅" color="#28a745" />
            <StatCard title="Total Earnings" value={`$${totalEarnings.toFixed(2)}`} icon="💰" color="#6f42c1" />
          </div>

          {/* Agent Management Section */}
          <div className="card mt-lg">
            <h2 className="card-header">Agent Management</h2>
            <div className="card-body">
              <h3>Create New Agent</h3>
              <form onSubmit={handleCreateAgent} className="form-grid">
                <input
                  className="input"
                  type="text"
                  placeholder="Agent Name"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  required
                />
                <input
                  className="input"
                  type="email"
                  placeholder="Agent Email"
                  value={agentEmail}
                  onChange={(e) => setAgentEmail(e.target.value)}
                  required
                />
                <input
                  className="input"
                  type="password"
                  placeholder="Agent Password"
                  value={agentPassword}
                  onChange={(e) => setAgentPassword(e.target.value)}
                  required
                />
                <button type="submit" className="btn btn-primary">Create Agent</button>
              </form>
              {createAgentMessage.text && (
                <div className={`alert ${createAgentMessage.type === 'success' ? 'alert-success' : 'alert-danger'} mt-md`}>
                  {createAgentMessage.text}
                </div>
              )}

              <h3 className="mt-lg">Registered Agents</h3>
              {agents.length === 0 ? (
                <p>No agents registered yet.</p>
              ) : (
                <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Total Hours</th>
                        <th>Leaves (Pending/Approved)</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agents.map(agent => (
                        <tr key={agent.id}>
                          <td>{agent.name}</td>
                          <td>{agent.email}</td>
                          <td>{calculateTotalHours(agent.id)} hrs</td>
                          <td>
                            {agentLeaves[agent.id]?.filter(l => l.status === 'pending').length || 0} Pending / {' '}
                            {agentLeaves[agent.id]?.filter(l => l.status === 'approved').length || 0} Approved
                          </td>
                          <td className="action-buttons">
                            <button className="btn btn-info btn-small" onClick={() => setSelectedAgentForDetails(agent)}>View Details</button>
                            <button className="btn btn-secondary btn-small" onClick={() => setSelectedAgentForLeave(agent)}>Apply Leave</button>
                            <button className="btn btn-danger btn-small" onClick={() => handleDeleteAgent(agent.id)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Agent Details Modal/Section */}
              {selectedAgentForDetails && (
                <div className="modal-overlay" onClick={() => setSelectedAgentForDetails(null)}>
                  <div className="modal" onClick={e => e.stopPropagation()}>
                    <button className="modal-close-btn" onClick={() => setSelectedAgentForDetails(null)}>&times;</button>
                    <h3>Agent Details: {selectedAgentForDetails.name}</h3>
                    <p><strong>Email:</strong> {selectedAgentForDetails.email}</p>
                    <h4>Work History</h4>
                    {agentWorkHours[selectedAgentForDetails.id] && agentWorkHours[selectedAgentForDetails.id].length > 0 ? (
                        <div className="table-responsive" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                            <table className="table table-sm">
                                <thead>
                                    <tr>
                                        <th>Start Time</th>
                                        <th>End Time</th>
                                        <th>Duration</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {agentWorkHours[selectedAgentForDetails.id].map((log, index) => {
                                        const startTime = log.startTime?.toDate ? log.startTime.toDate() : new Date(log.startTime);
                                        const endTime = log.endTime?.toDate ? log.endTime.toDate() : new Date(log.endTime);
                                        const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60); // in hours
                                        return (
                                            <tr key={index}>
                                                <td>{startTime.toLocaleString()}</td>
                                                <td>{endTime.toLocaleString()}</td>
                                                <td>{duration.toFixed(2)} hrs</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : <p>No work history recorded.</p>}

                    <h4 className="mt-md">Leave Requests</h4>
                    {agentLeaves[selectedAgentForDetails.id] && agentLeaves[selectedAgentForDetails.id].length > 0 ? (
                        <div className="table-responsive" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                            <table className="table table-sm">
                                <thead>
                                    <tr>
                                        <th>Reason</th>
                                        <th>Days</th>
                                        <th>Status</th>
                                        <th>Requested At</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {agentLeaves[selectedAgentForDetails.id].map((leave) => (
                                        <tr key={leave.id}>
                                            <td>{leave.reason}</td>
                                            <td>{leave.days}</td>
                                            <td>{leave.status}</td>
                                            <td>{leave.requestedAt?.toDate ? leave.requestedAt.toDate().toLocaleString() : new Date(leave.requestedAt).toLocaleString()}</td>
                                            <td>
                                                {leave.status === 'pending' && (
                                                    <>
                                                        <button className="btn btn-success btn-small" onClick={() => approveLeave(leave.id)}>Approve</button>
                                                        <button className="btn btn-danger btn-small ml-sm" onClick={() => rejectLeave(leave.id)}>Reject</button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : <p>No leave requests.</p>}
                    <div style={{marginTop: '20px', textAlign: 'right'}}>
                        <button className="btn btn-secondary" onClick={() => setSelectedAgentForDetails(null)}>Close</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Apply Leave Form */}
              {selectedAgentForLeave && (
                <div className="modal-overlay" onClick={() => setSelectedAgentForLeave(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <button className="modal-close-btn" onClick={() => setSelectedAgentForLeave(null)}>&times;</button>
                        <h3>Apply Leave for {selectedAgentForLeave.name}</h3>
                        <form onSubmit={handleApplyLeave}>
                            <label>Reason:</label>
                            <input
                                className="input"
                                type="text"
                                value={leaveReason}
                                onChange={(e) => setLeaveReason(e.target.value)}
                                required
                            />
                            <label>Days:</label>
                            <input
                                className="input"
                                type="number"
                                value={leaveDays}
                                onChange={(e) => setLeaveDays(parseInt(e.target.value, 10))}
                                min="1"
                                required
                            />
                            <div style={{marginTop: '20px', textAlign: 'right'}}>
                                <button type="submit" className="btn btn-primary">Submit Leave Request</button>
                                <button type="button" className="btn btn-secondary ml-sm" onClick={() => setSelectedAgentForLeave(null)}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
              )}

            </div>
          </div>

          {/* Orders Table Section */}
          <div className="card mt-lg">
            <h2 className="card-header">All Orders</h2>
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Status</th>
                      <th>Amount</th>
                      <th>Created At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center">No orders found.</td>
                      </tr>
                    ) : (
                      orders.map(order => (
                        // Highlight new paid orders not yet marked as read
                        <tr key={order.id} style={{fontFamily: 'var(--font-title)', background: !order.read && order.status === 'paid' ? 'var(--yellow-light)' : 'transparent'}}>
                          <td style={{padding: 'var(--spacing-md)'}}>{order.username}</td>
                          <td style={{padding: 'var(--spacing-md)'}}>{order.status}</td>
                          <td style={{padding: 'var(--spacing-md)'}}>${parseFloat(order.amount || 0).toFixed(2)}</td>
                          <td style={{padding: 'var(--spacing-md)'}}>{new Date(order.created).toLocaleString()}</td>
                          <td style={{padding: 'var(--spacing-md)'}}>
                            <div className="action-buttons">
                              <button className="btn btn-secondary btn-small" onClick={() => viewOrderDetails(order.id)}>Details</button>
                              {order.status === 'paid' && !order.read && (
                                <button className="btn btn-success btn-small" onClick={() => markAsRead(order.id)}>Mark Read</button>
                              )}
                              <button className="btn btn-danger btn-small" onClick={() => archiveOrder(order.id)}>Archive</button>
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
        </main>
      </div>
    </>
  );
}
