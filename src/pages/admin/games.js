// src/pages/admin/games.js
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { db, auth as firebaseAuth } from '../../lib/firebaseClient';
import { collection, query, orderBy, onSnapshot, addDoc, doc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import DataTable from '../../components/DataTable';

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
    const [newGameName, setNewGameName] = useState('');
    const [editingGame, setEditingGame] = useState(null);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
            if (user) {
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

    useEffect(() => {
        if (authLoading || !isAdmin) return;
        
        const q = query(collection(db, 'games'), orderBy('name'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const gameList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setGames(gameList);
        }, (err) => {
            setError('Failed to load games.');
        });
        return () => unsubscribe();
    }, [authLoading, isAdmin]);

    const logout = useCallback(async () => {
        await firebaseAuth.signOut();
        router.push('/admin');
    }, [router]);

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        const adminIdToken = await firebaseAuth.currentUser.getIdToken();

        if (editingGame) {
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
        } else {
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

    return (
        <div className="admin-dashboard-container">
            <Head><title>Admin - Manage Games</title></Head>
            <header className="admin-header">
                <h1>Manage Games</h1>
                <nav>
                    <ul className="admin-nav">
                            <li><a href="/admin/dashboard">Dashboard</a></li>
                            <li><a href="/admin/expenses" className="active">Expenses</a></li>
                            <li><a href="/admin/partners">Partners</a></li>
                            <li><a href="/admin/cashouts">Cashouts</a></li>
                            <li><a href="/admin/games">Games</a></li>
                            <li><a href="/admin/agents">Personnel</a></li>
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
                    {authLoading ? <LoadingSkeleton /> : <DataTable columns={columns} data={games} defaultSortField="name" />}
                </section>
            </main>
        </div>
    );
}
