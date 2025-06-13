// src/pages/admin/dashboard.js
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { db, auth as firebaseAuth } from '../../lib/firebaseClient';
import { collection, query, where, onSnapshot, orderBy, getDocs, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from 'firebase/auth';
import DataTable from '../../components/DataTable';

const LoadingSkeleton = () => (
    <div className="loading-skeleton">
        <div className="skeleton-line" style={{ width: '95%' }}></div>
        <div className="skeleton-line" style={{ width: '85%' }}></div>
        <div className="skeleton-line" style={{ width: '90%' }}></div>
        <div className="skeleton-line" style={{ width: '70%' }}></div>
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
    const [authLoading, setAuthLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [dataLoading, setDataLoading] = useState(true);

    // Dashboard Data
    const [stats, setStats] = useState({
        totalOrders: 0,
        paidOrders: 0,
        pendingOrders: 0,
        totalUsers: 0,
        totalRevenue: 0,
        totalCashouts: 0,
    });
    const [orders, setOrders] = useState([]);
    const [error, setError] = useState('');

    // Authentication and Role Check
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
            if (user) {
                try {
                    const userDocSnap = await getDoc(doc(db, 'users', user.uid));
                    if (userDocSnap.exists() && userDocSnap.data()?.isAdmin) {
                        setIsAdmin(true);
                    } else {
                        await firebaseAuth.signOut();
                        router.replace('/admin');
                    }
                } catch (e) {
                    console.error("Auth check error:", e);
                    await firebaseAuth.signOut();
                    router.replace('/admin');
                }
            } else {
                router.replace('/admin');
            }
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, [router]);

    // Data Fetching
    useEffect(() => {
        if (!isAdmin) return;

        const listeners = [];
        setDataLoading(true);

        // All orders for stats and table
        const ordersQuery = query(collection(db, 'orders'), orderBy('created', 'desc'));
        const ordersListener = onSnapshot(ordersQuery, (snapshot) => {
            let paidCount = 0, pendingCount = 0, revenue = 0;
            const allOrders = snapshot.docs.map(doc => {
                const data = doc.data();
                if (data.status === 'paid') {
                    paidCount++;
                    revenue += parseFloat(data.amount || 0);
                } else if (data.status === 'pending') {
                    pendingCount++;
                }
                return {
                    id: doc.id, ...data,
                    created: data.created?.toDate ? data.created.toDate().toISOString() : data.created
                };
            });
            setOrders(allOrders);
            setStats(prev => ({ ...prev, totalOrders: snapshot.size, paidOrders: paidCount, pendingOrders: pendingCount, totalRevenue: revenue }));
            setDataLoading(false);
        }, err => setError('Failed to load orders.'));
        listeners.push(ordersListener);

        // Total users
        const usersListener = onSnapshot(collection(db, 'users'), (snapshot) => {
            setStats(prev => ({ ...prev, totalUsers: snapshot.size }));
        }, err => setError('Failed to load user count.'));
        listeners.push(usersListener);

        // Total cashouts
        const cashoutsQuery = query(collection(db, 'cashouts'), where('status', '==', 'completed'));
        const cashoutsListener = onSnapshot(cashoutsQuery, (snapshot) => {
            const total = snapshot.docs.reduce((sum, doc) => sum + parseFloat(doc.data().amountUSD || 0), 0);
            setStats(prev => ({ ...prev, totalCashouts: total }));
        }, err => setError('Failed to load cashouts.'));
        listeners.push(cashoutsListener);

        return () => listeners.forEach(unsub => unsub());
    }, [isAdmin]);

    const logout = useCallback(async () => {
        await firebaseAuth.signOut();
        router.push('/admin');
    }, [router]);

    const markAsRead = async (orderId) => {
        try {
            const adminIdToken = await firebaseAuth.currentUser.getIdToken();
            await fetch('/api/orders/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminIdToken}` },
                body: JSON.stringify({ id: orderId, update: { read: true } })
            });
        } catch (err) {
            console.error("Error marking order as read:", err);
            alert('Failed to mark order as read.');
        }
    };
    
    const archiveOrder = async (orderId) => {
         try {
            const adminIdToken = await firebaseAuth.currentUser.getIdToken();
            await fetch('/api/orders/archive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminIdToken}` },
                body: JSON.stringify({ id: orderId })
            });
        } catch (err) {
            console.error("Error archiving order:", err);
            alert('Failed to archive order.');
        }
    };

    const columns = useMemo(() => [
        { header: 'Created', accessor: 'created', sortable: true, cell: (row) => new Date(row.created).toLocaleString() },
        { header: 'Username', accessor: 'username', sortable: true },
        { header: 'Amount', accessor: 'amount', sortable: true, cell: (row) => `$${parseFloat(row.amount || 0).toFixed(2)}` },
        { header: 'Status', accessor: 'status', sortable: true, cell: (row) => <span className={`status-badge status-${row.status} ${row.read ? '' : 'unread-badge'}`}>{row.status}</span> },
        { header: 'Game', accessor: 'game', sortable: true },
        { header: 'Actions', accessor: 'actions', sortable: false, cell: (row) => (
            <div className="action-buttons">
                {row.status === 'paid' && !row.read && (
                    <button className="btn btn-success btn-small" onClick={() => markAsRead(row.id)}>Mark Read</button>
                )}
                <button className="btn btn-secondary btn-small" onClick={() => archiveOrder(row.id)}>Archive</button>
            </div>
        )},
    ], []);

    if (authLoading) return <div className="loading-screen">Authenticating...</div>;
    if (!isAdmin) return <div className="loading-screen">Access Denied.</div>;

    return (
        <div className="admin-dashboard-container">
            <Head><title>Admin Dashboard</title></Head>
            <header className="admin-header">
                <h1>Admin Dashboard</h1>
                <nav>
                    <ul className="admin-nav">
                        <li><a href="/admin/dashboard" className="active">Dashboard</a></li>
                        <li><a href="/admin/cashouts">Cashouts</a></li>
                        <li><a href="/admin/games">Games</a></li>
                        <li><a href="/admin/agents">Agents</a></li>
                        <li><a href="/admin/profit-loss">Profit/Loss</a></li>
                        <li><button onClick={logout} className="btn btn-secondary">Logout</button></li>
                    </ul>
                </nav>
            </header>

            <main className="admin-main-content">
                {error && <div className="alert alert-danger mb-lg">{error}</div>}

                <section className="stats-grid">
                    <StatCard title="Total Revenue" value={`$${stats.totalRevenue.toFixed(2)}`} icon="💰" color="var(--primary-green)" />
                    <StatCard title="Total Cashouts" value={`$${stats.totalCashouts.toFixed(2)}`} icon="💸" color="var(--red-alert)" />
                    <StatCard title="Total Orders" value={stats.totalOrders} icon="📦" color="var(--primary-blue)" />
                    <StatCard title="Paid Orders" value={stats.paidOrders} icon="✅" color="var(--primary-green)" />
                    <StatCard title="Pending Orders" value={stats.pendingOrders} icon="⏳" color="var(--orange)" />
                    <StatCard title="Total Users" value={stats.totalUsers} icon="👥" color="var(--purple)" />
                </section>

                <section className="mt-xl">
                    <h2>Recent Orders</h2>
                    {dataLoading ? <LoadingSkeleton /> : <DataTable columns={columns} data={orders.filter(o => o.status !== 'archived')} defaultSortField="created" />}
                </section>
            </main>
        </div>
    );
}