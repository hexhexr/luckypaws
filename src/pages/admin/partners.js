// src/pages/admin/partners.js
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { db, auth as firebaseAuth } from '../../lib/firebaseClient';
import { onSnapshot, collection, query, orderBy, addDoc, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import DataTable from '../../components/DataTable';

const formatCurrency = (amount) => {
    const numAmount = parseFloat(amount);
    return isNaN(numAmount) ? '$0.00' : `$${numAmount.toFixed(2)}`;
};

export default function AdminPartners() {
    const router = useRouter();
    const [isAdmin, setIsAdmin] = useState(false);
    const [dataLoading, setDataLoading] = useState(true);
    const [error, setError] = useState('');
    
    const [partners, setPartners] = useState([]);
    const [newPartnerName, setNewPartnerName] = useState('');
    const [selectedPartner, setSelectedPartner] = useState(null);
    const [investmentAmount, setInvestmentAmount] = useState('');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
            if (user) {
                const userDocSnap = await getDoc(doc(db, 'users', user.uid));
                if (userDocSnap.exists() && userDocSnap.data()?.isAdmin) {
                    setIsAdmin(true);
                } else {
                    router.replace('/admin');
                }
            } else {
                router.replace('/admin');
            }
        });
        return () => unsubscribe();
    }, [router]);

    useEffect(() => {
        if (!isAdmin) return;
        setDataLoading(true);

        const partnersQuery = query(collection(db, "partners"), orderBy("name"));
        const unsubscribe = onSnapshot(partnersQuery, (snapshot) => {
            setPartners(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setDataLoading(false);
        }, (err) => {
            setError("Failed to load partners.");
            setDataLoading(false);
        });

        return () => unsubscribe();
    }, [isAdmin]);

    const handleAddPartner = async (e) => {
        e.preventDefault();
        if (!newPartnerName.trim()) return;
        try {
            const adminIdToken = await firebaseAuth.currentUser.getIdToken(true);
            await fetch('/api/admin/partners/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminIdToken}` },
                body: JSON.stringify({ name: newPartnerName })
            });
            setNewPartnerName('');
            alert('Partner added!');
        } catch (err) {
            setError(err.message);
        }
    };

    const handleAddFunds = async (e) => {
        e.preventDefault();
        if (!selectedPartner || !investmentAmount || parseFloat(investmentAmount) <= 0) {
            setError("Please select a partner and enter a valid amount.");
            return;
        }
        try {
            const adminIdToken = await firebaseAuth.currentUser.getIdToken(true);
            await fetch('/api/admin/partners/add-funds', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminIdToken}` },
                body: JSON.stringify({ partnerId: selectedPartner, amount: investmentAmount })
            });
            setSelectedPartner(null);
            setInvestmentAmount('');
            alert('Funds added successfully!');
        } catch (err) {
            setError(err.message);
        }
    };
    
    const logout = useCallback(async () => {
        await firebaseAuth.signOut();
        router.push('/admin');
    }, [router]);

    const columns = useMemo(() => [
        { header: 'Partner Name', accessor: 'name', sortable: true },
        { header: 'Total Investment', accessor: 'totalInvestment', sortable: true, cell: (row) => formatCurrency(row.totalInvestment) },
    ], []);

    if (!isAdmin) return <div className="loading-screen">Authenticating...</div>;

    return (
        <div className="admin-dashboard-container">
            <Head><title>Admin - Partners</title></Head>
            <header className="admin-header">
                <h1>Partner Investments</h1>
                <nav>
                    <ul className="admin-nav">
                        <li><a href="/admin/dashboard">Dashboard</a></li>
                        <li><a href="/admin/expenses">Expenses</a></li>
                        <li><a href="/admin/partners" className="active">Partners</a></li>
                        {/* ... other nav links */}
                        <li><button onClick={logout} className="btn btn-secondary">Logout</button></li>
                    </ul>
                </nav>
            </header>
            <main className="admin-main-content">
                {error && <div className="alert alert-danger mb-lg">{error}</div>}
                
                <div className="form-grid">
                    <section className="card">
                        <h2 className="card-header">Add New Partner</h2>
                        <div className="card-body">
                            <form onSubmit={handleAddPartner}>
                                <div className="form-group">
                                    <label>Partner Name</label>
                                    <input type="text" className="input" value={newPartnerName} onChange={e => setNewPartnerName(e.target.value)} required placeholder="Enter partner's full name"/>
                                </div>
                                <button type="submit" className="btn btn-primary btn-full-width">Add Partner</button>
                            </form>
                        </div>
                    </section>
                    <section className="card">
                        <h2 className="card-header">Add Investment</h2>
                        <div className="card-body">
                            <form onSubmit={handleAddFunds}>
                                <div className="form-group">
                                    <label>Select Partner</label>
                                    <select className="select" value={selectedPartner || ''} onChange={e => setSelectedPartner(e.target.value)} required>
                                        <option value="" disabled>Choose a partner...</option>
                                        {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Investment Amount (USD)</label>
                                    <input type="number" step="0.01" className="input" value={investmentAmount} onChange={e => setInvestmentAmount(e.target.value)} required placeholder="e.g., 5000.00"/>
                                </div>
                                <button type="submit" className="btn btn-success btn-full-width">Add Funds</button>
                            </form>
                        </div>
                    </section>
                </div>

                <section className="mt-xl">
                    <h2>Partner Investment Summary</h2>
                    {dataLoading ? <p>Loading partners...</p> : <DataTable columns={columns} data={partners} defaultSortField="name" />}
                </section>
            </main>
        </div>
    );
}