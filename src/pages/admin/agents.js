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
        {[...Array(3)].map((_, i) => <div key={i} className="skeleton-line" style={{ width: `${95 - i*10}%`}}></div>)}
    </div>
);

export default function AdminAgents() {
    const router = useRouter();
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [form, setForm] = useState({ email: '', password: '', name: '', pageCode: '' });
    const [editingAgent, setEditingAgent] = useState(null);

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
        if (!isAdmin) { setLoading(false); return; }
        setLoading(true);
        const q = query(collection(db, 'users'), where('agent', '==', true));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const agentList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setAgents(agentList);
            setLoading(false);
        }, (err) => { setError("Failed to load agents."); setLoading(false); });
        return () => unsubscribe();
    }, [isAdmin]);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        if (editingAgent) {
            setEditingAgent(prev => ({...prev, [name]: value}));
        } else {
            setForm(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        const adminIdToken = await firebaseAuth.currentUser.getIdToken();
        
        const isEditing = !!editingAgent;
        const endpoint = isEditing ? '/api/admin/agents/update' : '/api/admin/agents/create';
        const payload = isEditing ? { uid: editingAgent.id, name: editingAgent.name, pageCode: editingAgent.pageCode } : form;

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminIdToken}` },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            alert(`Agent ${isEditing ? 'updated' : 'created'} successfully!`);
            if (isEditing) {
                setEditingAgent(null);
            } else {
                setForm({ email: '', password: '', name: '', pageCode: '' });
            }
        } catch (err) { setError(err.message); } finally { setIsSubmitting(false); }
    };
    
    const handleRevokeAgent = async (agentId) => {
        if (!window.confirm("Are you sure you want to revoke this agent's privileges? This cannot be undone.")) return;
        setError('');
        const adminIdToken = await firebaseAuth.currentUser.getIdToken();
        try {
            const res = await fetch('/api/admin/agents/revoke', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminIdToken}` },
                body: JSON.stringify({ uid: agentId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            alert('Agent privileges revoked successfully.');
        } catch (err) { setError(err.message); }
    };
    
    const startEditing = (agent) => {
        setEditingAgent({ id: agent.id, name: agent.name, pageCode: agent.pageCode || '' });
    };

    const columns = useMemo(() => [
        { header: 'Name', accessor: 'name', sortable: true },
        { header: 'Email', accessor: 'email', sortable: true },
        { header: 'Page Code', accessor: 'pageCode', sortable: true },
        { header: 'Actions', accessor: 'actions', sortable: false, cell: (row) => (
            <div className="action-buttons">
                <button className="btn btn-info btn-small" onClick={() => startEditing(row)}>Edit</button>
                <button className="btn btn-danger btn-small" onClick={() => handleRevokeAgent(row.id)}>Revoke</button>
            </div>
        )},
    ], []);

    const logout = useCallback(async () => { await firebaseAuth.signOut(); router.push('/admin'); }, [router]);
    
    if (!isAdmin && !loading) return <div className="loading-screen">Access Denied.</div>;

    return (
        <div className="admin-dashboard-container">
            <Head><title>Admin - Manage Agents</title></Head>
            <header className="admin-header">
                <h1>Manage Agents</h1>
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
                
                <section className="card mb-lg">
                    <h2 className="card-header">{editingAgent ? `Editing: ${editingAgent.name}` : 'Create New Agent'}</h2>
                    <div className="card-body">
                        <form onSubmit={handleFormSubmit} className="form-grid">
                            <div className="form-group">
                                <label>Agent Name</label>
                                <input type="text" name="name" className="input" value={editingAgent ? editingAgent.name : form.name} onChange={handleFormChange} required />
                            </div>
                           {!editingAgent && (
                                <>
                                <div className="form-group">
                                    <label>Agent Email</label>
                                    <input type="email" name="email" className="input" value={form.email} onChange={handleFormChange} required />
                                </div>
                                <div className="form-group">
                                    <label>Password</label>
                                    <input type="password" name="password" className="input" value={form.password} onChange={handleFormChange} required minLength="6" />
                                </div>
                                </>
                           )}
                           <div className="form-group">
                                <label>Page Code (4 digits)</label>
                                <input type="text" name="pageCode" className="input" value={editingAgent ? editingAgent.pageCode : form.pageCode} onChange={handleFormChange} required pattern="\d{4}" title="Page Code must be exactly 4 digits." />
                            </div>
                           <div className="form-group form-full-width">
                                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : (editingAgent ? 'Update Agent' : 'Create Agent')}</button>
                                {editingAgent && <button type="button" className="btn btn-secondary ml-md" onClick={() => setEditingAgent(null)}>Cancel</button>}
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