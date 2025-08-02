// src/pages/admin/dashboard.js
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { db, auth as firebaseAuth } from '../../lib/firebaseClient';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from 'firebase/auth';

import DataTable from '../../components/DataTable';
import OrderDetailsModal from '../../components/OrderDetailsModal';
import CustomerQuickView from '../../components/CustomerQuickView';
import ToastNotification from '../../components/ToastNotification';

const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    if (typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toLocaleString();
    }
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) { return 'Invalid Date'; }
        return date.toLocaleString();
    } catch (e) {
        return 'Formatting Error';
    }
};

const StatCard = ({ title, value, icon, color }) => (
    <div className="stat-card" style={{ borderTopColor: color }}>
        <div>
            <h4 className="stat-card-title">{title}</h4>
            <h2 className="stat-card-value">{value}</h2>
        </div>
        <span className="stat-card-icon" style={{ color }}>{icon}</span>
    </div>
);

export default function AdminDashboard() {
    const router = useRouter();
    const [orders, setOrders] = useState([]);
    const [customers, setCustomers] = useState({});
    const [stats, setStats] = useState({ totalDeposits: 0, totalCashouts: 0, totalOrders: 0, paidOrders: 0, pendingOrders: 0, totalUsers: 0, chimeDeposits: 0, cashAppDeposits: 0 });
    const [error, setError] = useState('');
    const [orderFilter, setOrderFilter] = useState('completed');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [quickViewStats, setQuickViewStats] = useState(null);
    const [quickViewPosition, setQuickViewPosition] = useState(null);
    const [notification, setNotification] = useState(null);
    const audioRef = useRef(null);
    const initialLoadDone = useRef(false);

    const [authLoading, setAuthLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    
    // --- ADDED: State for payment fees ---
    const [paymentFees, setPaymentFees] = useState({ chimeFee: 25, cashAppFee: 30 });
    const [isSubmittingFees, setIsSubmittingFees] = useState(false);
    const [feeMessage, setFeeMessage] = useState('');


    useEffect(() => {
        const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
            if (user) {
                try {
                    const idTokenResult = await user.getIdTokenResult(true);
                    if (idTokenResult.claims.admin) {
                        setIsAdmin(true);
                    } else {
                        await firebaseAuth.signOut();
                        router.replace('/admin');
                    }
                } catch (e) {
                    console.error("Error verifying admin status:", e);
                    router.replace('/admin');
                }
            } else {
                router.replace('/admin');
            }
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, [router]);

    useEffect(() => {
        if (authLoading || !isAdmin) {
            return;
        }

        // --- ADDED: Listener for payment fees ---
        const feeDocRef = doc(db, 'settings', 'paymentFees');
        const unsubscribeFees = onSnapshot(feeDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setPaymentFees(docSnap.data());
            } else {
                setPaymentFees({ chimeFee: 25, cashAppFee: 30 });
            }
        });

        const customersQuery = query(collection(db, 'customers'));
        const customerListener = onSnapshot(customersQuery, (snapshot) => {
            const customerMap = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                if(data.username) {
                    customerMap[data.username.toLowerCase()] = data.facebookName || 'N/A';
                }
            });
            setCustomers(customerMap);
        });

        const ordersQuery = query(collection(db, 'orders'), orderBy('created', 'desc'));
        const ordersListener = onSnapshot(ordersQuery, (snapshot) => {
            if (initialLoadDone.current) {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const newOrder = change.doc.data();
                        if (newOrder.status === 'completed' || newOrder.status === 'paid') {
                            setNotification({ type: 'success', title: 'New Deposit!', message: `$${newOrder.amount} from ${newOrder.username}` });
                            audioRef.current?.play().catch(e => console.error("Audio play failed:", e));
                        } else if (newOrder.status === 'unmatched_payment') {
                            setNotification({ type: 'warning', title: 'Unmatched Payment!', message: `Received $${newOrder.amount}` });
                            audioRef.current?.play().catch(e => console.error("Audio play failed:", e));
                        }
                    }
                });
            } else {
                initialLoadDone.current = true;
            }
            
            let paidCount = 0, pendingCount = 0, deposits = 0, chimeTotal = 0, cashAppTotal = 0;
            const allOrders = snapshot.docs.map(doc => {
                const data = doc.data();
                if (['completed', 'paid', 'unmatched_payment'].includes(data.status)) {
                    const amount = parseFloat(data.amount || 0);
                    paidCount++;
                    deposits += amount;
                    // --- ADDED: Logic to calculate totals for Chime and Cash App ---
                    if (data.method === 'chime') chimeTotal += amount;
                    if (data.method === 'cash app') cashAppTotal += amount;
                } else if (data.status === 'pending') {
                    pendingCount++;
                }
                return { id: doc.id, ...doc.data() };
            });

            setOrders(allOrders);
            setStats(prev => ({ ...prev, totalOrders: snapshot.size, paidOrders: paidCount, pendingOrders: pendingCount, totalDeposits: deposits, chimeDeposits: chimeTotal, cashAppDeposits: cashAppTotal }));
        }, err => { setError('Failed to load orders.'); });

        const usersListener = onSnapshot(collection(db, 'users'), (snapshot) => setStats(prev => ({ ...prev, totalUsers: snapshot.size })), err => setError('Failed to load user count.'));
        const cashoutsListener = onSnapshot(query(collection(db, 'cashouts'), where('status', '==', 'completed')), (snapshot) => setStats(prev => ({ ...prev, totalCashouts: snapshot.docs.reduce((sum, doc) => sum + parseFloat(doc.data().amountUSD || 0), 0) })), err => setError('Failed to load cashouts.'));

        return () => {
            unsubscribeFees();
            customerListener();
            ordersListener();
            usersListener();
            cashoutsListener();
        };

    }, [authLoading, isAdmin]);

    const handleUsernameHover = async (username, position) => {
        if (!username || username === 'unknown') { setQuickViewStats(null); return; }
        if (quickViewStats?.username === username) return;

        if (position) {
            const adjustedPosition = { x: position.x, y: position.y + window.scrollY };
            setQuickViewPosition(adjustedPosition);
        }

        setQuickViewStats({ username, isLoading: true });
        try {
            const token = await firebaseAuth.currentUser.getIdToken();
            const res = await fetch(`/api/admin/user-stats/${username}`, { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            if (res.ok) setQuickViewStats({ ...data, username: username, isLoading: false });
            else setQuickViewStats(null);
        } catch (e) {
            setQuickViewStats(null);
        }
    };
    
    const handleOpenMergeTool = (unmatchedOrder) => {
        const pendingOrderId = prompt(`Manual Merge:\n\nEnter the PENDING Order ID to merge with this payment of $${unmatchedOrder.amountReceived} (Memo: ${unmatchedOrder.memo})`);
        if (pendingOrderId && pendingOrderId.trim() !== '') {
            if (window.confirm(`Are you sure you want to merge this payment into Order ID: ${pendingOrderId}? THIS CANNOT BE UNDONE.`)) {
                mergeOrders(unmatchedOrder.id, pendingOrderId.trim());
            }
        }
    };
    
    const mergeOrders = async (unmatchedPaymentId, pendingOrderId) => {
        try {
            const token = await firebaseAuth.currentUser.getIdToken();
            const res = await fetch('/api/orders/merge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ unmatchedPaymentId, pendingOrderId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            alert('Merge successful!');
            setSelectedOrder(null);
        } catch (err) {
            alert(`Merge Failed: ${err.message}`);
        }
    };
    
    // --- ADDED: Handler to update fees ---
    const handleUpdateFees = async () => {
        setIsSubmittingFees(true);
        setFeeMessage('');
        try {
            const token = await firebaseAuth.currentUser.getIdToken();
            const res = await fetch('/api/admin/fees/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(paymentFees)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setFeeMessage('Fees updated successfully!');
        } catch (err) {
            setFeeMessage(`Error: ${err.message}`);
        } finally {
            setIsSubmittingFees(false);
        }
    };

    const logout = useCallback(async () => { await firebaseAuth.signOut(); router.push('/admin'); }, [router]);

    const columns = useMemo(() => [
        { header: 'Created', accessor: 'created', sortable: true, cell: (row) => formatTimestamp(row.created) },
        { header: 'Username', accessor: 'username', sortable: true },
        { header: 'Facebook', accessor: 'facebookName', sortable: true },
        { header: 'Game', accessor: 'game', sortable: true },
        { 
            header: 'Method', 
            accessor: 'method', 
            sortable: true, 
            cell: (row) => {
                const method = row.method || 'lightning';
                const displayName = method.replace('_', ' ');
                return <span className={`method-badge method-${method}`}>{displayName}</span>
            }
        },
        { header: 'Memo', accessor: 'memo', sortable: true },
        { header: 'Amount', accessor: 'amount', sortable: true, cell: (row) => `$${parseFloat(row.amount || 0).toFixed(2)}` },
        { header: 'Status', accessor: 'status', sortable: true, cell: (row) => <span className={`status-badge status-${row.status}`}>{row.status.replace('_', ' ')}</span> },
    ], []);

    const filteredOrders = useMemo(() => {
        const getFacebookName = (username) => customers[username?.toLowerCase()] || 'N/A';
        
        const ordersWithFacebookName = orders.map(order => ({
            ...order,
            facebookName: getFacebookName(order.username)
        }));

        if (orderFilter === 'all') return ordersWithFacebookName;
        if (orderFilter === 'pending') return ordersWithFacebookName.filter(o => o.status === 'pending');
        return ordersWithFacebookName.filter(o => ['completed', 'paid', 'unmatched_payment'].includes(o.status));
    }, [orders, customers, orderFilter]);

    const filterControls = (
        <div className="radio-filter-group">
            <label><input type="radio" name="orderFilter" value="completed" checked={orderFilter === 'completed'} onChange={e => setOrderFilter(e.target.value)} /> Show Completed</label>
            <label><input type="radio" name="orderFilter" value="pending" checked={orderFilter === 'pending'} onChange={e => setOrderFilter(e.target.value)} /> Show Pending</label>
            <label><input type="radio" name="orderFilter" value="all" checked={orderFilter === 'all'} onChange={e => setOrderFilter(e.target.value)} /> Show All</label>
        </div>
    );
    
    if (authLoading) return <div className="loading-screen">Authenticating & Loading Dashboard...</div>;

    return (
        <div className="admin-dashboard-container">
            <Head><title>Admin Dashboard</title></Head>
            <header className="admin-header">
                <h1>Admin Dashboard</h1>
                <nav>
                    <ul className="admin-nav">
                        <li><a href="/admin/dashboard">Dashboard</a></li>
                        <li><a href="/admin/expenses">Expenses</a></li>
                        <li><a href="/admin/partners">Partners</a></li>
                        <li><a href="/admin/offers">Offers</a></li>
                        <li><a href="/admin/cashouts">Cashouts</a></li>
                        <li><a href="/admin/games">Games</a></li>
                        <li><a href="/admin/agents">Personnel</a></li>
                        <li><a href="/admin/profit-loss">Profit/Loss</a></li>
                        <li><button onClick={logout} className="btn btn-secondary">Logout</button></li>
                    </ul>
                </nav>
            </header>
            <main className="admin-main-content">
                {error && <div className="alert alert-danger mb-lg">{error}</div>}
                <section className="stats-grid">
                    <StatCard title="Net Revenue" value={`$${(stats.totalDeposits - stats.totalCashouts).toFixed(2)}`} icon="💰" color="var(--primary-blue)" />
                    <StatCard title="Total Deposits" value={`$${(stats.totalDeposits || 0).toFixed(2)}`} icon="📈" color="var(--primary-green)" />
                    <StatCard title="Total Cashouts" value={`$${(stats.totalCashouts || 0).toFixed(2)}`} icon="💸" color="var(--red-alert)" />
                    <StatCard title="Paid Orders" value={stats.paidOrders || 0} icon="✅" color="var(--primary-green)" />
                    {/* --- ADDED: New Stat Cards --- */}
                    <StatCard title="Chime Revenue (After Fee)" value={`$${(stats.chimeDeposits * (1 - (paymentFees.chimeFee || 25) / 100)).toFixed(2)}`} icon="🔔" color="#00C16E" />
                    <StatCard title="Cash App Revenue (After Fee)" value={`$${(stats.cashAppDeposits * (1 - (paymentFees.cashAppFee || 30) / 100)).toFixed(2)}`} icon="💵" color="#00D632" />
                </section>
                
                {/* --- ADDED: New Fee Management Section --- */}
                <section className="card mt-lg">
                    <h2 className="card-header">Manage Manual Deposit Fees</h2>
                    <div className="card-body">
                        <div className="form-grid" style={{gridTemplateColumns: '1fr 1fr auto', alignItems: 'flex-end', gap: 'var(--spacing-md)'}}>
                            <div className="form-group">
                                <label>Chime Fee (%)</label>
                                <input type="number" className="input" value={paymentFees.chimeFee || ''} onChange={e => setPaymentFees({...paymentFees, chimeFee: e.target.value})} />
                            </div>
                            <div className="form-group">
                                <label>Cash App Fee (%)</label>
                                <input type="number" className="input" value={paymentFees.cashAppFee || ''} onChange={e => setPaymentFees({...paymentFees, cashAppFee: e.target.value})} />
                            </div>
                            <button className="btn btn-primary" onClick={handleUpdateFees} disabled={isSubmittingFees}>
                                {isSubmittingFees ? 'Updating...' : 'Update Fees'}
                            </button>
                        </div>
                        {feeMessage && <p className="alert alert-info mt-md">{feeMessage}</p>}
                    </div>
                </section>

                <section className="mt-xl">
                    <h2>Recent Orders</h2>
                    <DataTable 
                        columns={columns} 
                        data={filteredOrders} 
                        defaultSortField="created" 
                        filterControls={filterControls}
                        onRowClick={setSelectedOrder}
                        onUsernameHover={handleUsernameHover}
                    />
                </section>
            </main>
            {selectedOrder && <OrderDetailsModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onMerge={handleOpenMergeTool} />}
            {quickViewStats && quickViewPosition && <CustomerQuickView stats={quickViewStats} position={quickViewPosition} onClose={() => setQuickViewStats(null)} />}
            <ToastNotification notification={notification} onDone={() => setNotification(null)} />
            <audio ref={audioRef} src="/notification.mp3" preload="auto" />
        </div>
    );
}