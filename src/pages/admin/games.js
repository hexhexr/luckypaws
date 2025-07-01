// pages/admin/games.js
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { db, auth as firebaseAuth } from '../../lib/firebaseClient';
import { collection, query, orderBy, onSnapshot, addDoc, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import DataTable from '../../components/DataTable';

// Removed the imports for the public Header and Footer
// import Header from '../../components/Header';
// import Footer from '../../components/Footer';


const LoadingSkeleton = () => (
    <div className="loading-skeleton mt-md">
        <div className="skeleton-line" style={{ width: '90%' }}></div>
        <div className="skeleton-line" style={{ width: '95%' }}></div>
    </div>
);

export default function AdminGames() {
    const router = useRouter();
    const [authLoading, setAuthLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    const [games, setGames] = useState([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [newGameName, setNewGameName] = useState('');
    const [editingGame, setEditingGame] = useState(null); // { id, name }
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
            if (user) {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists() && userDoc.data().isAdmin) {
                    setIsAdmin(true);
                } else {
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
        if (!isAdmin) return;
        setDataLoading(true);
        const q = query(collection(db, 'games'), orderBy('name'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const gameList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setGames(gameList);
            setDataLoading(false);
        }, (err) => {
            setError('Failed to load games.');
            setDataLoading(false);
        });
        return () => unsubscribe();
    }, [isAdmin]);

    const logout = useCallback(async () => {
        await firebaseAuth.signOut();
        router.push('/admin');
    }, [router]);

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        const adminIdToken = await firebaseAuth.currentUser.getIdToken();

        if (editingGame) { // Handle Update
            if (!editingGame.name.trim()) {
                setError('Game name cannot be empty.');
                setIsSubmitting(false);
                return;
            }
            try {
                const res = await fetch('/api/admin/games/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminIdToken}` },
                    body: JSON.stringify({ id: editingGame.id, name: editingGame.name })
                });
                if (!res.ok) throw new Error('Failed to update game.');
                setEditingGame(null);
            } catch (err) {
                setError(err.message);
            }
        } else { // Handle Add
            if (!newGameName.trim()) {
                setError('Game name cannot be empty.');
                setIsSubmitting(false);
                return;
            }
            try {
                await addDoc(collection(db, 'games'), { name: newGameName.trim() });
                setNewGameName('');
            } catch (err) {
                setError('Failed to add game.');
            }
        }
        setIsSubmitting(false);
    };

    const handleDeleteGame = async (id) => {
        if (window.confirm('Are you sure you want to delete this game?')) {
            try {
                await deleteDoc(doc(db, 'games', id));
            } catch (err) {
                setError('Failed to delete game.');
            }
        }
    };
    
    const columns = useMemo(() => [
        { header: 'Game Name', accessor: 'name', sortable: true },
        { header: 'Actions', accessor: 'actions', sortable: false, cell: (row) => (
            <div className="action-buttons">
                <button className="btn btn-info btn-small" onClick={() => setEditingGame(row)}>Edit</button>
                <button className="btn btn-danger btn-small" onClick={() => handleDeleteGame(row.id)}>Delete</button>
            </div>
        )}
    ], []);

    if (authLoading) return <div className="loading-screen">Authenticating...</div>;
    if (!isAdmin) return <div className="loading-screen">Access Denied.</div>;

    // The entire component now returns the standard admin container div directly
    return (
        <div className="admin-dashboard-container">
            <Head><title>Admin - Manage Games</title></Head>
            <header className="admin-header">
                <h1>Manage Games</h1>
                <nav>
                    <ul className="admin-nav">
                        <li><a href="/admin/dashboard">Dashboard</a></li>
                        <li><a href="/admin/cashouts">Cashouts</a></li>
                        <li><a href="/admin/games" className="active">Games</a></li>
                        <li><a href="/admin/agents">Agents</a></li>
                        <li><a href="/admin/profit-loss">Profit/Loss</a></li>
                        <li><button onClick={logout} className="btn btn-secondary">Logout</button></li>
                    </ul>
                </nav>
            </header>
            <main className="admin-main-content">
                <section className="card mb-lg">
                    <h2 className="card-header">{editingGame ? 'Edit Game' : 'Add New Game'}</h2>
                    <div className="card-body">
                        <form onSubmit={handleFormSubmit}>
                            <div className="form-group">
                                <label htmlFor="gameName">{editingGame ? `Editing: ${editingGame.id}`: 'New Game Name'}</label>
                                <input
                                    type="text"
                                    id="gameName"
                                    className="input"
                                    value={editingGame ? editingGame.name : newGameName}
                                    onChange={(e) => editingGame ? setEditingGame({...editingGame, name: e.target.value}) : setNewGameName(e.target.value)}
                                    placeholder="Enter game name"
                                    required
                                />
                            </div>
                            <div className="action-buttons">
                                <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? 'Saving...' : (editingGame ? 'Update Game' : 'Add Game')}
                                </button>
                                {editingGame && (
                                    <button className="btn btn-secondary" type="button" onClick={() => setEditingGame(null)}>
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </form>
                        {error && <div className="alert alert-danger mt-md">{error}</div>}
                    </div>
                </section>
                
                <section>
                    <h2>Existing Games List</h2>
                    {dataLoading ? <LoadingSkeleton /> : <DataTable columns={columns} data={games} defaultSortField="name" />}
                </section>
            </main>
        </div>
    );
}