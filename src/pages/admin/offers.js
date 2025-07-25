// src/pages/admin/offers.js
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { auth as firebaseAuth } from '../../lib/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';

export default function AdminOffers() {
    const router = useRouter();
    const [authLoading, setAuthLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [offers, setOffers] = useState([]);
    const [newOfferText, setNewOfferText] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchOffers = useCallback(async () => {
        if (!firebaseAuth.currentUser) return;
        try {
            const token = await firebaseAuth.currentUser.getIdToken();
            const res = await fetch('/api/admin/offers/list', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch offers');
            const data = await res.json();
            setOffers(data);
        } catch (err) {
            setError(err.message);
        }
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
            if (user) {
                const idTokenResult = await user.getIdTokenResult(true);
                if (idTokenResult.claims.admin) {
                    setIsAdmin(true);
                    fetchOffers();
                } else {
                    router.replace('/admin');
                }
            } else {
                router.replace('/admin');
            }
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, [router, fetchOffers]);

    const handleApiCall = async (endpoint, body, successMessage) => {
        setIsSubmitting(true);
        setError('');
        try {
            const token = await firebaseAuth.currentUser.getIdToken();
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            alert(successMessage);
            fetchOffers(); // Refresh the list
            return true;
        } catch (err) {
            setError(err.message);
            return false;
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddOffer = (e) => {
        e.preventDefault();
        handleApiCall('/api/admin/offers/add', { text: newOfferText }, 'Offer added!');
        setNewOfferText('');
    };

    const handleSetActive = (id) => {
        if (confirm('Are you sure you want to make this the active offer? All other offers will be deactivated.')) {
            handleApiCall('/api/admin/offers/set-active', { id }, 'Offer activated!');
        }
    };

    const handleDelete = (id) => {
        if (confirm('Are you sure you want to permanently delete this offer?')) {
            handleApiCall('/api/admin/offers/delete', { id }, 'Offer deleted!');
        }
    };

    const logout = useCallback(async () => {
        await firebaseAuth.signOut();
        router.push('/admin');
    }, [router]);

    if (authLoading) return <div className="loading-screen">Authenticating...</div>;

    return (
        <div className="admin-dashboard-container">
            <Head><title>Admin - Manage Offers</title></Head>
            <header className="admin-header">
                <h1>Manage Offers</h1>
                <nav>
                    <ul className="admin-nav">
            <li><a href="/admin/dashboard">Dashboard</a></li>
            <li><a href="/admin/expenses">Expenses</a></li>
            <li><a href="/admin/partners">Partners</a></li>
            <li><a href="/admin/offers">Offers</a></li> {/* Add this link */}
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
                
                <section className="card mb-lg">
                    <h2 className="card-header">Add New Offer</h2>
                    <div className="card-body">
                        <form onSubmit={handleAddOffer}>
                            <div className="form-group">
                                <label>Offer Text</label>
                                <textarea
                                    className="input"
                                    value={newOfferText}
                                    onChange={(e) => setNewOfferText(e.target.value)}
                                    placeholder="e.g., ✨ Special Offer! Get 10% extra on deposits over $50. We accept Lightning & PYUSD! ✨"
                                    required
                                    rows="3"
                                />
                            </div>
                            <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Saving...' : 'Add Offer'}
                            </button>
                        </form>
                    </div>
                </section>
                
                <section className="card">
                    <h2 className="card-header">Existing Offers</h2>
                    <div className="card-body">
                        {offers.length === 0 ? <p>No offers created yet.</p> : (
                            <div className="table-responsive">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Offer Text</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {offers.map(offer => (
                                            <tr key={offer.id}>
                                                <td>{offer.text}</td>
                                                <td>
                                                    {offer.active ? 
                                                        <span className="status-badge status-approved">Active</span> : 
                                                        <span className="status-badge status-pending">Inactive</span>
                                                    }
                                                </td>
                                                <td>
                                                    <div className="action-buttons">
                                                        {!offer.active && (
                                                            <button className="btn btn-success btn-small" onClick={() => handleSetActive(offer.id)} disabled={isSubmitting}>Set Active</button>
                                                        )}
                                                        <button className="btn btn-danger btn-small" onClick={() => handleDelete(offer.id)} disabled={isSubmitting}>Delete</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
}