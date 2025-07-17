// src/pages/admin/agents.js
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { db, auth as firebaseAuth } from '../../lib/firebaseClient';
import { collection, query, onSnapshot, getDoc, doc, orderBy } from 'firebase/firestore';
import { onAuthStateChanged, updatePassword } from 'firebase/auth';
import DataTable from '../../components/DataTable';

const LoadingSkeleton = () => (
    <div className="loading-skeleton mt-md">
        {[...Array(5)].map((_, i) => <div key={i} className="skeleton-line" style={{ width: `${95 - i*5}%`}}></div>)}
    </div>
);

export default function PersonnelPage() {
    const router = useRouter();
    const [allUsers, setAllUsers] = useState([]);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // State for creation forms
    const [agentForm, setAgentForm] = useState({ email: '', password: '', name: '', pageCode: '' });
    const [adminForm, setAdminForm] = useState({ email: '', password: '', name: ''});
    const [selfPassword, setSelfPassword] = useState('');

    // Auth states
    const [authLoading, setAuthLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);

    // Effect 1: Handles Authentication
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
            if (user) {
                setCurrentUser(user);
                try {
                    const idTokenResult = await user.getIdTokenResult(true);
                    if (idTokenResult.claims.admin) {
                        setIsAdmin(true);
                    } else {
                        router.replace('/admin');
                    }
                } catch (e) {
                    router.replace('/admin');
                }
            } else {
                router.replace('/admin');
            }
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, [router]);

    // Effect 2: Fetches data only after admin status is confirmed
    useEffect(() => {
        if (authLoading || !isAdmin) return;

        const q = query(collection(db, 'users'), orderBy('name'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const userList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setAllUsers(userList);
        }, (err) => { setError("Failed to load users."); });
        
        return () => unsubscribe();
    }, [authLoading, isAdmin]);

    const handleApiCall = async (endpoint, body, successMessage) => {
        setError('');
        setIsSubmitting(true);
        try {
            const adminIdToken = await firebaseAuth.currentUser.getIdToken();
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminIdToken}` },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            alert(successMessage);
            return true;
        } catch (err) {
            setError(err.message);
            return false;
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreateAgentSubmit = async (e) => {
        e.preventDefault();
        const success = await handleApiCall('/api/admin/agents/create', agentForm, 'Agent created successfully!');
        if (success) {
            setAgentForm({ email: '', password: '', name: '', pageCode: '' });
        }
    };

    const handleCreateAdminSubmit = async (e) => {
        e.preventDefault();
        const success = await handleApiCall('/api/admin/admins/create', adminForm, 'Admin created successfully!');
        if (success) {
            setAdminForm({ email: '', password: '', name: '' });
        }
    };

    const handlePromoteToAdmin = (user) => {
        if (window.confirm(`Are you sure you want to promote ${user.name} to an admin?`)) {
            handleApiCall('/api/set-admin-claim', { uid: user.id, isAdmin: true }, 'User promoted successfully!');
        }
    };

    const handleRevokeAdmin = (user) => {
        if (window.confirm(`Are you sure you want to revoke admin rights from ${user.name}?`)) {
            handleApiCall('/api/admin/admins/revoke', { uid: user.id }, 'Admin rights revoked successfully!');
        }
    };

    const handleChangePassword = (user) => {
        const newPassword = prompt(`Enter new password for ${user.name}:`);
        if (newPassword && newPassword.length >= 6) {
            handleApiCall('/api/admin/users/update-password', { uid: user.id, newPassword }, 'Password updated successfully!');
        } else if (newPassword) {
            alert('Password must be at least 6 characters long.');
        }
    };

    const handleSelfPasswordChange = async (e) => {
        e.preventDefault();
        if (!selfPassword || selfPassword.length < 6) {
            setError('New password must be at least 6 characters long.');
            return;
        }
        setIsSubmitting(true);
        setError('');
        try {
            await updatePassword(currentUser, selfPassword);
            alert('Your password has been changed successfully. You will be logged out.');
            await firebaseAuth.signOut();
            router.push('/admin');
        } catch (err) {
            setError(`Failed to change password: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const { adminUsers, otherUsers } = useMemo(() => {
        const admins = allUsers.filter(u => u.admin);
        const others = allUsers.filter(u => !u.admin);
        return { adminUsers: admins, otherUsers: others };
    }, [allUsers]);

    const adminColumns = useMemo(() => [
        { header: 'Name', accessor: 'name', sortable: true },
        { header: 'Email', accessor: 'email', sortable: true },
        { header: 'Actions', accessor: 'actions', sortable: false, cell: (row) => (
            <div className="action-buttons">
                {row.id !== currentUser?.uid ? (
                    <>
                        <button className="btn btn-danger btn-small" onClick={() => handleRevokeAdmin(row)} disabled={isSubmitting}>Revoke Admin</button>
                        <button className="btn btn-secondary btn-small" onClick={() => handleChangePassword(row)} disabled={isSubmitting}>Set Password</button>
                    </>
                ) : (
                    <span style={{color: 'var(--text-light)', fontStyle: 'italic'}}>Current User</span>
                )}
            </div>
        )},
    ], [currentUser, isSubmitting]);

    const userColumns = useMemo(() => [
        { header: 'Name', accessor: 'name', sortable: true },
        { header: 'Email', accessor: 'email', sortable: true },
        { header: 'Role', accessor: 'role', sortable: true, cell: (row) => (
            row.agent ? <span className="status-badge status-approved">Agent</span> : <span className="status-badge status-pending">User</span>
        )},
        { header: 'Actions', accessor: 'actions', sortable: false, cell: (row) => (
            <div className="action-buttons">
                <button className="btn btn-success btn-small" onClick={() => handlePromoteToAdmin(row)} disabled={isSubmitting}>Make Admin</button>
                <button className="btn btn-secondary btn-small" onClick={() => handleChangePassword(row)} disabled={isSubmitting}>Set Password</button>
            </div>
        )},
    ], [isSubmitting]);

    const logout = useCallback(async () => { await firebaseAuth.signOut(); router.push('/admin'); }, [router]);
    
    if (authLoading) return <div className="loading-screen">Authenticating...</div>;

    return (
        <div className="admin-dashboard-container">
            <Head><title>Admin - Personnel Management</title></Head>
            <header className="admin-header">
                <h1>Personnel Management</h1>
                <nav>
                    <ul className="admin-nav">
                        <li><a href="/admin/dashboard">Dashboard</a></li>
                        <li><a href="/admin/cashouts">Cashouts</a></li>
                        <li><a href="/admin/games">Games</a></li>
                        <li><a href="/admin/expenses">Expenses</a></li>
                        <li><a href="/admin/agents" className="active">Personnel</a></li>
                        <li><a href="/admin/profit-loss">Profit/Loss</a></li>
                        <li><button onClick={logout} className="btn btn-secondary">Logout</button></li>
                    </ul>
                </nav>
            </header>
            <main className="admin-main-content">
                {error && <div className="alert alert-danger mb-lg">{error}</div>}

                <div className="form-grid" style={{gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'start', marginBottom: 'var(--spacing-xl)'}}>
                    <section className="card">
                        <h2 className="card-header">Create New Agent</h2>
                        <div className="card-body">
                            <form onSubmit={handleCreateAgentSubmit}>
                                <div className="form-group"><label>Agent Name</label><input type="text" name="name" className="input" value={agentForm.name} onChange={e => setAgentForm({...agentForm, name: e.target.value})} required /></div>
                                <div className="form-group"><label>Agent Email</label><input type="email" name="email" className="input" value={agentForm.email} onChange={e => setAgentForm({...agentForm, email: e.target.value})} required /></div>
                                <div className="form-group"><label>Password</label><input type="password" name="password" className="input" value={agentForm.password} onChange={e => setAgentForm({...agentForm, password: e.target.value})} required minLength="6" /></div>
                                <div className="form-group"><label>Page Code (4 digits)</label><input type="text" name="pageCode" className="input" value={agentForm.pageCode} onChange={e => setAgentForm({...agentForm, pageCode: e.target.value})} required pattern="\d{4}" title="Page Code must be exactly 4 digits." /></div>
                                <div className="form-group"><button type="submit" className="btn btn-primary btn-full-width" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Create Agent'}</button></div>
                            </form>
                        </div>
                    </section>

                    <section className="card">
                        <h2 className="card-header">Create New Admin</h2>
                        <div className="card-body">
                            <form onSubmit={handleCreateAdminSubmit}>
                                <div className="form-group"><label>Admin Name</label><input type="text" name="name" className="input" value={adminForm.name} onChange={e => setAdminForm({...adminForm, name: e.target.value})} required /></div>
                                <div className="form-group"><label>Admin Email</label><input type="email" name="email" className="input" value={adminForm.email} onChange={e => setAdminForm({...adminForm, email: e.target.value})} required /></div>
                                <div className="form-group"><label>Password</label><input type="password" name="password" className="input" value={adminForm.password} onChange={e => setAdminForm({...adminForm, password: e.target.value})} required minLength="6" /></div>
                                <div className="form-group" style={{marginTop: '6.2rem'}}><button type="submit" className="btn btn-danger btn-full-width" disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create Admin'}</button></div>
                            </form>
                        </div>
                    </section>

                    <section className="card">
                        <h2 className="card-header">Change My Password</h2>
                        <div className="card-body">
                             <form onSubmit={handleSelfPasswordChange}>
                                <div className="form-group">
                                    <label>My Email</label>
                                    <input type="email" className="input" value={currentUser?.email || ''} readOnly disabled />
                                </div>
                                <div className="form-group">
                                    <label>New Password</label>
                                    <input type="password" name="selfPassword" className="input" value={selfPassword} onChange={e => setSelfPassword(e.target.value)} required minLength="6" />
                                </div>
                                <div className="form-group" style={{marginTop: '6.2rem'}}>
                                    <button type="submit" className="btn btn-warning btn-full-width" disabled={isSubmitting}>{isSubmitting ? 'Updating...' : 'Update My Password'}</button>
                                </div>
                            </form>
                        </div>
                    </section>
                </div>
                
                <section className="card mb-lg">
                    <h2 className="card-header">👑 Administrators</h2>
                    <div className="card-body">
                        <DataTable columns={adminColumns} data={adminUsers} defaultSortField="name" />
                    </div>
                </section>

                <section className="card">
                    <h2 className="card-header">👥 General Users & Agents</h2>
                    <div className="card-body">
                        <p style={{color: 'var(--text-secondary)'}}>Users listed here can be promoted to full administrators.</p>
                        <DataTable columns={userColumns} data={otherUsers} defaultSortField="name" />
                    </div>
                </section>
            </main>
        </div>
    );
}
