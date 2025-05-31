// pages/admin/dashboard.js
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { db } from '../../lib/firebaseClient'; // Import db for Firestore
import { auth as firebaseAuth } from '../../lib/firebaseClient'; // Import auth for Firebase Auth client-side
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, getDocs, doc, deleteDoc, updateDoc, setDoc } from "firebase/firestore"; // Added setDoc for creating user roles
import { createUserWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth'; // Removed signInAnonymously

// --- Helper Components (No changes needed, kept for context) ---

const StatCard = ({ title, value, icon, color }) => (
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
  const [isAuthenticated, setIsAuthenticated] = useState(false); // State for Vercel-based admin authentication
  const [firebaseUser, setFirebaseUser] = useState(null); // State for the Firebase authenticated user (now the specific admin user)

  const [orders, setOrders] = useState([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [unpaidOrders, setUnpaidOrders] = useState(0);
  const [paidOrders, setPaidOrders] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [modalOrder, setModalOrder] = useState(null);

  const [agentName, setAgentName] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [agentPassword, setAgentPassword] = useState('');
  const [createAgentMessage, setCreateAgentMessage] = useState({ text: '', type: '' });
  const [agents, setAgents] = useState([]);
  const [agentWorkHours, setAgentWorkHours] = useState({});
  const [agentLeaves, setAgentLeaves] = useState({});
  const [selectedAgentForDetails, setSelectedAgentForDetails] = useState(null);
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveDays, setLeaveDays] = useState(0);
  const [selectedAgentForLeave, setSelectedAgentForLeave] = useState(null);

  // --- Authentication Check (Combined Vercel-based Admin Login + Firebase Auth) ---
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const adminAuth = localStorage.getItem('admin_auth');
    if (adminAuth !== '1') {
      router.replace('/admin'); // Redirect to admin login if Vercel-based auth flag is not set
      return;
    }

    // Now, listen to Firebase Auth state
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        setFirebaseUser(user);
        setIsAuthenticated(true); // Vercel-based auth is 1 AND Firebase user exists
        console.log('Firebase user (admin) is signed in for admin dashboard.');
      } else {
        // If localStorage flag exists but Firebase user doesn't, something went wrong, log out.
        // Or, it means the Firebase session expired/was cleared.
        console.log('Firebase user not found. Redirecting to admin login.');
        localStorage.removeItem('admin_auth'); // Clear Vercel-based flag too
        router.replace('/admin');
      }
    });

    return () => unsubscribe(); // Clean up Firebase Auth listener
  }, [router]);

  // --- Real-time Order Data Fetching ---
  useEffect(() => {
    // Only fetch if both Vercel-based admin is authenticated AND Firebase user is ready
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
      // Handle error, maybe show a message to the admin
      alert('Error fetching orders: ' + error.message + '. Check Firestore Rules or Indexes.');
    });

    return () => unsubscribe();
  }, [isAuthenticated, firebaseUser]); // Rerun when authentication status or Firebase user changes

  // --- Agent Management: Fetch Agents, Work Hours, Leaves ---
  useEffect(() => {
    if (!isAuthenticated || !firebaseUser) return;

    // Fetch agents (users with role 'agent')
    const agentsQuery = query(collection(db, 'users'), where('role', '==', 'agent'));
    const unsubscribeAgents = onSnapshot(agentsQuery, (snapshot) => {
      const fetchedAgents = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAgents(fetchedAgents);
    }, (error) => {
      console.error("Error fetching agents:", error);
      alert('Error fetching agents: ' + error.message + '. Check Firestore Rules or Indexes.');
    });

    // Fetch work hours for all agents
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
        alert('Error fetching work hours: ' + error.message + '. Check Firestore Rules or Indexes.');
    });

    // Fetch leave requests for all agents
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
        alert('Error fetching leave requests: ' + error.message + '. Check Firestore Rules or Indexes.');
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
      // 1. Create user in Firebase Authentication
      // This operation requires a Firebase authenticated user on the client-side (our admin user)
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, agentEmail, agentPassword);
      const user = userCredential.user;

      // 2. Store agent details and role in Firestore 'users' collection
      // This write is subject to Firestore rules, which should allow if isAdmin()
      await setDoc(doc(db, 'users', user.uid), {
        name: agentName,
        email: agentEmail,
        role: 'agent', // Assign 'agent' role
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
            // Delete user document from Firestore's 'users' collection
            await deleteDoc(doc(db, 'users', agentId));

            // Also delete their work hours and leave records if desired
            const workHoursSnapshot = await getDocs(query(collection(db, 'workHours'), where('agentId', '==', agentId)));
            workHoursSnapshot.forEach(async (d) => await deleteDoc(d.ref));

            const leavesSnapshot = await getDocs(query(collection(db, 'leaves'), where('agentId', '==', agentId)));
            leavesSnapshot.forEach(async (d) => await deleteDoc(d.ref));

            // IMPORTANT: Deleting the user from Firebase Authentication itself (auth.deleteUser)
            // must be done from a secure server environment (e.g., a Next.js API route using firebase-admin)
            // as client-side SDK cannot delete other users.
            // For now, this only removes their Firestore data.

            console.log(`Agent ${agentId} and associated records deleted from Firestore.`);
            setCreateAgentMessage({ text: 'Agent deleted successfully!', type: 'success' });
        } catch (error) {
            console.error('Error deleting agent:', error);
            setCreateAgentMessage({ text: `Error deleting agent: ${error.message}`, type: 'error' });
        }
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
    const totalHours = totalDurationMs / (1000 * 60 * 60); // Convert ms to hours
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
      localStorage.removeItem('admin_auth'); // Clear local storage flag for Vercel-based admin
      await firebaseAuth.signOut().catch(console.error); // Sign out the Firebase admin user
      router.push('/admin'); // Redirect to admin login page
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '1.2rem' }}>
        Loading or Redirecting to Admin Login...
      </div>
    );
  }

  return (
    <>
      <style jsx>{`
        .admin-dashboard-container {
          min-height: 100vh;
          padding: 2rem;
          background-color: #f0f2f5;
          font-family: 'Inter', sans-serif;
        }
        .admin-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          padding: 1rem 0;
          border-bottom: 1px solid #e0e0e0;
        }
        .admin-header h1 {
          font-size: 2.5rem;
          color: #333;
          margin: 0;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }
        .card {
          background-color: #ffffff;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          overflow: hidden;
          margin-bottom: 1.5rem;
        }
        .card-header {
          background-color: #0070f3;
          color: white;
          padding: 1rem 1.5rem;
          font-size: 1.5rem;
          font-weight: 600;
        }
        .card-body {
          padding: 1.5rem;
        }
        .form-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
        }
        @media (min-width: 768px) {
          .form-grid {
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          }
        }
        .input {
          width: 100%;
          padding: 0.8rem;
          font-size: 1rem;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        .btn {
          padding: 0.8rem 1.5rem;
          font-size: 1rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s ease-in-out;
        }
        .btn-primary { background-color: #0070f3; color: white; }
        .btn-primary:hover { background-color: #005bb5; }
        .btn-danger { background-color: #dc3545; color: white; }
        .btn-danger:hover { background-color: #c82333; }
        .btn-secondary { background-color: #6c757d; color: white; }
        .btn-secondary:hover { background-color: #5a6268; }
        .btn-info { background-color: #17a2b8; color: white; }
        .btn-info:hover { background-color: #138496; }
        .btn-success { background-color: #28a745; color: white; }
        .btn-success:hover { background-color: #218838; }
        .btn-small { padding: 0.5rem 0.8rem; font-size: 0.85rem; }
        .action-buttons { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .mt-md { margin-top: 1rem; }
        .mt-lg { margin-top: 2rem; }
        .ml-sm { margin-left: 0.5rem; }
        .alert { padding: 1rem; border-radius: 4px; margin-top: 1rem; }
        .alert-success { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .alert-danger { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .table-responsive { width: 100%; overflow-x: auto; }
        .table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
        .table th, .table td { padding: 12px 15px; border: 1px solid #e0e0e0; text-align: left; }
        .table th { background-color: #f8f9fa; font-weight: 600; }
        .table tbody tr:nth-child(even) { background-color: #f2f2f2; }
        .table tbody tr:hover { background-color: #e9ecef; }
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }
        .modal {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
            position: relative;
            max-width: 90%;
            width: 500px;
            max-height: 90vh;
            overflow-y: auto;
        }
        .modal-close-btn {
            position: absolute;
            top: 10px;
            right: 10px;
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: #333;
        }
      `}</style>
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
                                        <th>Login Time</th>
                                        <th>Logout Time</th>
                                        <th>Duration</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {agentWorkHours[selectedAgentForDetails.id].map((log, index) => {
                                        const loginTime = log.loginTime ? (log.loginTime.toDate ? log.loginTime.toDate() : new Date(log.loginTime)) : 'N/A';
                                        const logoutTime = log.logoutTime ? (log.logoutTime.toDate ? log.logoutTime.toDate() : new Date(log.logoutTime)) : 'N/A';
                                        const duration = (log.logoutTime && log.loginTime) ? ((logoutTime.getTime() - loginTime.getTime()) / (1000 * 60 * 60)).toFixed(2) : 'N/A';
                                        return (
                                            <tr key={index}>
                                                <td>{loginTime !== 'N/A' ? loginTime.toLocaleString() : 'N/A'}</td>
                                                <td>{logoutTime !== 'N/A' ? logoutTime.toLocaleString() : 'N/A'}</td>
                                                <td>{duration} hrs</td>
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
                        <tr key={order.id} style={{background: !order.read && order.status === 'paid' ? '#fffacd' : 'transparent'}}> {/* Light yellow for unread paid */}
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
