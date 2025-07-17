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
    const [stats, setStats] = useState({ totalRevenue: 0, totalCashouts: 0, totalOrders: 0, paidOrders: 0, pendingOrders: 0, totalUsers: 0 });
    const [error, setError] = useState('');
    const [orderFilter, setOrderFilter] = useState('completed');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [quickViewStats, setQuickViewStats] = useState(null);
    const [quickViewPosition, setQuickViewPosition] = useState(null);
    const [notification, setNotification] = useState(null);
    const audioRef = useRef(null);
    const initialLoadDone = useRef(false);

    // Authentication and data loading states
    const [authLoading, setAuthLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    // Effect 1: Handles Authentication and determines user role.
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
            if (user) {
                try {
                    // Force a token refresh to get the latest claims
                    const idTokenResult = await user.getIdTokenResult(true);
                    if (idTokenResult.claims.admin) {
                        setIsAdmin(true); // User is a verified admin
                    } else {
                        // User is logged in but not an admin
                        await firebaseAuth.signOut();
                        router.replace('/admin');
                    }
                } catch (e) {
                    console.error("Error verifying admin status:", e);
                    router.replace('/admin');
                }
            } else {
                // No user is logged in
                router.replace('/admin');
            }
            // Signal that the authentication check is complete
            setAuthLoading(false);
        });
        // Cleanup the auth listener when the component unmounts
        return () => unsubscribe();
    }, [router]);

    // Effect 2: Fetches data only after authentication is confirmed.
    useEffect(() => {
        // Do not proceed if authentication is still in progress or if the user is not an admin
        if (authLoading || !isAdmin) {
            return;
        }

        // It's now safe to set up all real-time Firestore listeners
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
            
            let paidCount = 0, pendingCount = 0, revenue = 0;
            const allOrders = snapshot.docs.map(doc => {
                const data = doc.data();
                if (['completed', 'paid', 'unmatched_payment'].includes(data.status)) {
                    paidCount++;
                    revenue += parseFloat(data.amount || 0);
                } else if (data.status === 'pending') {
                    pendingCount++;
                }
                return { id: doc.id, ...doc.data() };
            });

            setOrders(allOrders);
            setStats(prev => ({ ...prev, totalOrders: snapshot.size, paidOrders: paidCount, pendingOrders: pendingCount, totalRevenue: revenue }));
        }, err => { setError('Failed to load orders.'); });

        const usersListener = onSnapshot(collection(db, 'users'), (snapshot) => setStats(prev => ({ ...prev, totalUsers: snapshot.size })), err => setError('Failed to load user count.'));
        const cashoutsListener = onSnapshot(query(collection(db, 'cashouts'), where('status', '==', 'completed')), (snapshot) => setStats(prev => ({ ...prev, totalCashouts: snapshot.docs.reduce((sum, doc) => sum + parseFloat(doc.data().amountUSD || 0), 0) })), err => setError('Failed to load cashouts.'));

        // Return a cleanup function to unsubscribe from all listeners when the component unmounts
        return () => {
            customerListener();
            ordersListener();
            usersListener();
            cashoutsListener();
        };

    }, [authLoading, isAdmin]); // This effect depends on the auth state

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

    const logout = useCallback(async () => { await firebaseAuth.signOut(); router.push('/admin'); }, [router]);

    const columns = useMemo(() => [
        { header: 'Created', accessor: 'created', sortable: true, cell: (row) => formatTimestamp(row.created) },
        { header: 'Username', accessor: 'username', sortable: true },
        { header: 'Facebook', accessor: 'facebookName', sortable: true },
        { header: 'Game', accessor: 'game', sortable: true },
        { header: 'Method', accessor: 'method', sortable: true, cell: (row) => <span className={`method-badge method-${row.method || 'lightning'}`}>{row.method === 'pyusd' ? 'PYUSD' : 'Lightning'}</span> },
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
                        <li><a href="/admin/cashouts">Cashouts</a></li>
                        <li><a href="/admin/games">Games</a></li>
                        <li><a href="/admin/expenses">Expenses</a></li>
                        <li><a href="/admin/agents">Personnel</a></li>
                        <li><a href="/admin/profit-loss">Profit/Loss</a></li>
                        <li><button onClick={logout} className="btn btn-secondary">Logout</button></li>
                    </ul>
                </nav>
            </header>
            <main className="admin-main-content">
                {error && <div className="alert alert-danger mb-lg">{error}</div>}
                <section className="stats-grid">
                    <StatCard title="Total Revenue" value={`$${(stats.totalRevenue || 0).toFixed(2)}`} icon="💰" color="var(--primary-green)" />
                    <StatCard title="Total Cashouts" value={`$${(stats.totalCashouts || 0).toFixed(2)}`} icon="💸" color="var(--red-alert)" />
                    <StatCard title="Total Orders" value={stats.totalOrders || 0} icon="📦" color="var(--primary-blue)" />
                    <StatCard title="Paid Orders" value={stats.paidOrders || 0} icon="✅" color="var(--primary-green)" />
                    <StatCard title="Pending Orders" value={stats.pendingOrders || 0} icon="⏳" color="var(--orange)" />
                    <StatCard title="Total Users" value={stats.totalUsers || 0} icon="👥" color="var(--purple)" />
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
