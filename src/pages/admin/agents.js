// src/pages/admin/agents.js
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { db, auth as firebaseAuth } from '../../lib/firebaseClient';
import { collection, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import DataTable from '../../components/DataTable';

const LoadingSkeleton = () => (
    <div className="loading-skeleton mt-md">
        <div className="skeleton-line" style={{ width: '90%' }}></div>
        <div className="skeleton-line" style={{ width: '80%' }}></div>
        <div className="skeleton-line" style={{ width: '95%' }}></div>
    </div>
);

export default function AdminAgents() {
    const router = useRouter();
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [form, setForm] = useState({ email: '', password: '', name: '' });

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
        });
        return () => unsubscribe();
    }, [router]);

    // Fetch Agents
    useEffect(() => {
        if (!isAdmin) {
            setLoading(false);
            return;
        }
        setLoading(true);
        const q = query(collection(db, 'users'), where('agent', '==', true));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const agentList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAgents(agentList);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching agents:", err);
            setError("Failed to load agents.");
            setLoading(false);
        });
        return () => unsubscribe();
    }, [isAdmin]);

    const logout = useCallback(async () => {
        await firebaseAuth.signOut();
        router.push('/admin');
    }, [router]);

    const handleFormChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleCreateAgent = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        const adminIdToken = await firebaseAuth.currentUser.getIdToken();

        try {
            const res = await fetch('/api/admin/agents/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminIdToken}`
                },
                body: JSON.stringify(form)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to create agent.');
            alert('Agent created successfully!');
            setForm({ email: '', password: '', name: '' });
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleRevokeAgent = async (agentId) => {
        if (!window.confirm("Are you sure you want to revoke this agent's privileges?")) return;
        setError('');
        const adminIdToken = await firebaseAuth.currentUser.getIdToken();

        try {
            const res = await fetch('/api/admin/agents/revoke', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminIdToken}`
                },
                body: JSON.stringify({ uid: agentId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to revoke agent.');
            alert('Agent privileges revoked successfully.');
        } catch (err) {
            console.error(err);
            setError(err.message);
        }
    };

    const columns = useMemo(() => [
        { header: 'Name', accessor: 'name', sortable: true },
        { header: 'Email', accessor: 'email', sortable: true },
        { header: 'UID', accessor: 'id', sortable: false },
        { header: 'Actions', accessor: 'actions', sortable: false, cell: (row) => (
            <button className="btn btn-danger btn-small" onClick={() => handleRevokeAgent(row.id)}>
                Revoke
            </button>
        )},
    ], []);

    if (!isAdmin && !loading) return <p>Access Denied.</p>

    return (
        <div className="admin-dashboard-container">
            <Head><title>Admin - Manage Agents</title></Head>
            <header className="admin-header">
                <h1>Manage Agents</h1>
                <nav>
                    <ul className="admin-nav">
                         <li><a href="/admin/dashboard">Dashboard</a></li>
                         <li><a href="/admin/cashouts">Cashouts</a></li>
                         <li><a href="/admin/games">Games</a></li>
                         <li><a href="/admin/agents" className="active">Agents</a></li>
                         <li><a href="/admin/profit-loss">Profit/Loss</a></li>
                         <li><button onClick={logout} className="btn btn-secondary">Logout</button></li>
                    </ul>
                </nav>
            </header>
            <main className="admin-main-content">
                {error && <div className="alert alert-danger mb-lg">{error}</div>}
                
                <section className="card mb-lg">
                    <h2 className="card-header">Create New Agent</h2>
                    <div className="card-body">
                        <form onSubmit={handleCreateAgent} className="form-grid">
                            <div className="form-group">
                                <label htmlFor="name">Agent Name</label>
                                <input type="text" id="name" name="name" className="input" value={form.name} onChange={handleFormChange} required />
                            </div>
                            <div className="form-group">
                                <label htmlFor="email">Agent Email</label>
                                <input type="email" id="email" name="email" className="input" value={form.email} onChange={handleFormChange} required />
                            </div>
                            <div className="form-group">
                                <label htmlFor="password">Password</label>
                                <input type="password" id="password" name="password" className="input" value={form.password} onChange={handleFormChange} required minLength="6" />
                            </div>
                            <div className="form-group form-full-width">
                                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                                    {isSubmitting ? 'Creating...' : 'Create Agent'}
                                </button>
                            </div>
                        </form>
                    </div>
                </section>

                <section>
                    <h2>Existing Agents</h2>
                    {loading ? <LoadingSkeleton /> : <DataTable columns={columns} data={agents} defaultSortField="name" />}
                </section>
            </main>
        </div>
    );
}