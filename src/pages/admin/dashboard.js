// src/pages/admin/dashboard.js
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { db, auth as firebaseAuth } from '../../lib/firebaseClient';
import { collection, query, where, onSnapshot, orderBy, getDocs, doc, getDoc } from "firebase/firestore";
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

const LoadingSkeleton = () => (
    <div className="loading-skeleton">
        <div className="skeleton-line" style={{ width: '95%' }}></div>
        <div className="skeleton-line" style={{ width: '85%' }}></div>
    </div>
);

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
    const [isAdmin, setIsAdmin] = useState(false);
    const [dataLoading, setDataLoading] = useState(true);
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

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
            if (user) {
                const userDocSnap = await getDoc(doc(db, 'users', user.uid));
                if (userDocSnap.exists() && userDocSnap.data()?.isAdmin) {
                    setIsAdmin(true);
                } else { router.replace('/admin'); }
            } else { router.replace('/admin'); }
        });
        return () => unsubscribe();
    }, [router]);

    useEffect(() => {
        if (!isAdmin) return;

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
            setDataLoading(false);
        }, err => { setError('Failed to load orders.'); setDataLoading(false); });

        const usersListener = onSnapshot(collection(db, 'users'), (snapshot) => setStats(prev => ({ ...prev, totalUsers: snapshot.size })), err => setError('Failed to load user count.'));
        const cashoutsListener = onSnapshot(query(collection(db, 'cashouts'), where('status', '==', 'completed')), (snapshot) => setStats(prev => ({ ...prev, totalCashouts: snapshot.docs.reduce((sum, doc) => sum + parseFloat(doc.data().amountUSD || 0), 0) })), err => setError('Failed to load cashouts.'));

        return () => { customerListener(); ordersListener(); usersListener(); cashoutsListener(); };
    }, [isAdmin]);

    const handleUsernameHover = async (username, position) => {
        if (!username || username === 'unknown') { setQuickViewStats(null); return; }
        if (quickViewStats?.username === username) return;

        const adjustedPosition = {
            x: position.x,
            y: position.y + window.scrollY
        };
        setQuickViewPosition(adjustedPosition);

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
        const getFacebookName = (username) => customers[username.toLowerCase()] || 'N/A';
        
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
    
    if (dataLoading) return <div className="loading-screen">Loading Dashboard...</div>;

    return (
        <div className="admin-dashboard-container">
            <Head><title>Admin Dashboard</title></Head>
            <header className="admin-header">
                <h1>Admin Dashboard</h1>
                <nav>
                    <ul className="admin-nav">
                        <li><a href="/admin/dashboard">Dashboard</a></li>
                        <li><a href="/admin/cashouts" className="active">Cashouts</a></li>
                        <li><a href="/admin/games">Games</a></li>
	      <li><a href="/admin/expenses">Expenses</a></li>
                        <li><a href="/admin/agents">Agents</a></li>
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
            {quickViewStats && <CustomerQuickView stats={quickViewStats} position={quickViewPosition} onClose={() => setQuickViewStats(null)} />}
            <ToastNotification notification={notification} onDone={() => setNotification(null)} />
            <audio ref={audioRef} src="/notification.mp3" preload="auto" />
        </div>
    );
}