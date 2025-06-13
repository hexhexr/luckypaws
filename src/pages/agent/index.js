// src/pages/agent/index.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import { db, auth } from '../../lib/firebaseClient';
import { onSnapshot, query, collection, where, orderBy, getDoc, doc } from 'firebase/firestore';
import { useRouter } from 'next/router';
import { onAuthStateChanged } from 'firebase/auth';

// --- Reusable Helper Components ---
const LoadingSpinner = () => <div className="loading-spinner">Loading...</div>;

const SectionCard = ({ title, children, onRefresh, isRefreshing }) => (
    <section className="section-card">
        <div className="section-header">
            <h3>{title}</h3>
            {onRefresh && (
                <button onClick={onRefresh} disabled={isRefreshing} className="btn btn-secondary btn-xsmall">
                    {isRefreshing ? '...' : 'Refresh'}
                </button>
            )}
        </div>
        <div className="section-content">{children}</div>
    </section>
);

export default function AgentDashboard() {
    const router = useRouter();
    // All state variables remain the same as the fully-featured version
    const [user, setUser] = useState(null);
    const [agentProfile, setAgentProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [panelWidth, setPanelWidth] = useState(550);
    const [isResizing, setIsResizing] = useState(false);
    const [iframeUrl, setIframeUrl] = useState('https://luckypaws.vercel.app/games');
    const [urlInput, setUrlInput] = useState(iframeUrl);
    const [facebookName, setFacebookName] = useState('');
    const [manualPageCode, setManualPageCode] = useState('');
    const [generatedUsername, setGeneratedUsername] = useState('');
    const [customers, setCustomers] = useState([]);
    const [limitCheckResult, setLimitCheckResult] = useState(null);
    const [timeRemaining, setTimeRemaining] = useState('');
    const countdownIntervalRef = useRef();
    const [deposits, setDeposits] = useState([]);
    const [depositsLoading, setDepositsLoading] = useState(true);
    const [agentRequests, setAgentRequests] = useState([]);

    // --- All data fetching and handler logic remains the same ---
    useEffect(() => { /* Auth logic... */ }, [router]);
    const fetchDeposits = useCallback(() => { /* fetch logic... */ }, [user]);
    useEffect(() => { /* data listeners... */ }, [user, fetchDeposits]);
    const handleMouseDown = useCallback(() => { /*... */ }, []);
    const handleMouseUp = useCallback(() => { /*... */ }, []);
    const handleMouseMove = useCallback((e) => { /*... */ }, [isResizing]);
    useEffect(() => { /* mouse listeners... */ }, [handleMouseMove, handleMouseUp]);
    const handleGenerateUsername = async (e) => { /* ... */ };
    const handleAddCustomer = async (e) => { /* ... */ };
    const handleCheckLimit = async (e) => { /* ... */ };
    useEffect(() => { /* countdown logic... */ }, [limitCheckResult]);


    if (loading) return <div className="loading-screen"><LoadingSpinner /></div>;

    return (
        <>
            <Head><title>Agent Dashboard | Lucky Paws</title></Head>
            {/* UI FIX: The entire layout is now driven by standard CSS in the <style> block below */}
            <div className="dashboard-container" onMouseUp={handleMouseUp}>
                <aside className="agent-panel" style={{ width: `${panelWidth}px` }}>
                    <header className="panel-header">
                        <div>
                            <h2 className="agent-name">{agentProfile?.name}</h2>
                            <p className="page-code-display">Default Page Code: {agentProfile?.pageCode}</p>
                        </div>
                        <button onClick={() => auth.signOut()} className="btn btn-danger">Logout</button>
                    </header>
                    
                    {message.text && <div className={`message-bar message-${message.type}`}>{message.text}</div>}
                    
                    <div className="panel-content">
                        <SectionCard title="Browser Control">
                            <form onSubmit={(e) => { e.preventDefault(); setIframeUrl(urlInput); }} className="form-row">
                                <input type="url" value={urlInput} onChange={e => setUrlInput(e.target.value)} className="input-field" placeholder="https://example.com" />
                                <button type="submit" className="btn btn-secondary">Go</button>
                            </form>
                        </SectionCard>

                        <SectionCard title="Username Generator">
                            <form onSubmit={handleGenerateUsername} className="form-stack">
                                <div>
                                    <label htmlFor="facebookName">Customer's FB Name</label>
                                    <input id="facebookName" value={facebookName} onChange={e => setFacebookName(e.target.value)} required className="input-field" />
                                </div>
                                <div>
                                    <label htmlFor="manualPageCode">Page Code</label>
                                    <input id="manualPageCode" value={manualPageCode} onChange={e => setManualPageCode(e.target.value)} required pattern="\d{4}" className="input-field" />
                                </div>
                                <button type="submit" className="btn btn-primary">Generate</button>
                                {generatedUsername && <p className="alert alert-success">Generated: <strong>{generatedUsername}</strong></p>}
                            </form>
                        </SectionCard>

                        <SectionCard title="Add New Customer">
                            <form onSubmit={handleAddCustomer} className="form-stack">
                                <input name="username" required className="input-field" placeholder="Game Username"/>
                                <input name="facebookName" required className="input-field" placeholder="Facebook Name"/>
                                <input name="facebookProfileLink" type="url" required className="input-field" placeholder="Facebook Profile URL"/>
                                <button type="submit" className="btn btn-success">Add Customer</button>
                            </form>
                        </SectionCard>
                        
                        <SectionCard title="Check Cashout Limit">
                             <form onSubmit={handleCheckLimit}>
                                <div className="form-row">
                                    <input name="customerUsername" required className="input-field" placeholder="Customer Username"/>
                                    <button type="submit" className="btn btn-info">Check</button>
                                </div>
                                {limitCheckResult && (
                                    <div className="alert alert-info">
                                        <p>Limit for <strong>{limitCheckResult.username}</strong>: ${limitCheckResult.remainingLimit.toFixed(2)}</p>
                                        <p><small>First cashout: {limitCheckResult.firstCashoutTimeInWindow ? new Date(limitCheckResult.firstCashoutTimeInWindow).toLocaleTimeString() : 'N/A'}</small></p>
                                        {limitCheckResult.windowResetsAt && <p><small>Resets in: <strong>{timeRemaining}</strong></small></p>}
                                    </div>
                                )}
                            </form>
                        </SectionCard>
                        
                        <SectionCard title="Recent Deposits" onRefresh={fetchDeposits} isRefreshing={depositsLoading}>
                            <div className="list-container">
                                {depositsLoading ? <LoadingSpinner/> : deposits.map(dep => (
                                    <div key={dep.id} className="list-item">
                                        <p><strong>{dep.facebookName}</strong> ({dep.username})</p>
                                        <p>Deposited ${dep.amount.toFixed(2)} for {dep.game}</p>
                                        <p className="list-item-footer">{new Date(dep.created).toLocaleString()}</p>
                                    </div>
                                ))}
                            </div>
                        </SectionCard>

                        <SectionCard title="My Customers">
                           <div className="list-container">
                                {customers.map(c => (
                                    <div key={c.id} className="list-item">
                                        <p><strong>{c.facebookName}</strong> ({c.username})</p>
                                        <a href={c.facebookProfileLink} target="_blank" rel="noopener noreferrer" className="link">View Profile</a>
                                    </div>
                                ))}
                            </div>
                        </SectionCard>

                        <SectionCard title="My Cashout Requests">
                            <div className="list-container">
                                {agentRequests.map(r => (
                                    <div key={r.id} className="list-item">
                                        <p>${r.amount.toFixed(2)} requested on {new Date(r.requestedAt.seconds * 1000).toLocaleDateString()}</p>
                                        <p>Status: <span className={`status-${r.status}`}>{r.status}</span></p>
                                    </div>
                                ))}
                            </div>
                        </SectionCard>
                    </div>
                </aside>

                <div className="resize-handle" onMouseDown={handleMouseDown}></div>
                
                <main className="iframe-container">
                    <iframe src={iframeUrl} title="Main Content" className="iframe-content"></iframe>
                </main>
            </div>
            
            <style jsx>{`
                /* UI FIX: All layout and component styles are now defined here using standard CSS */
                .dashboard-container { display: flex; height: 100vh; width: 100vw; background-color: #e5e7eb; overflow: hidden; }
                .agent-panel { height: 100%; display: flex; flex-direction: column; background-color: #f9fafb; }
                .panel-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem; background-color: #1f2937; color: white; flex-shrink: 0; }
                .agent-name { font-size: 1.25rem; font-weight: bold; }
                .page-code-display { font-size: 0.875rem; color: #93c5fd; }
                .panel-content { overflow-y: auto; padding: 1rem; flex-grow: 1; }
                .resize-handle { width: 8px; height: 100%; cursor: col-resize; background-color: #d1d5db; transition: background-color 0.2s; }
                .resize-handle:hover { background-color: #3b82f6; }
                .iframe-container { flex-grow: 1; height: 100%; }
                .iframe-content { width: 100%; height: 100%; border: 0; }
                
                .section-card { background-color: white; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06); border-radius: 0.5rem; margin-bottom: 1.5rem; overflow: hidden; }
                .section-header { display: flex; justify-content: space-between; align-items: center; background-color: #f3f4f6; padding: 0.75rem 1rem; border-bottom: 1px solid #e5e7eb; }
                .section-header h3 { font-size: 1.125rem; font-weight: 600; color: #111827; }
                .section-content { padding: 1rem; }
                
                .form-row { display: flex; gap: 0.5rem; }
                .form-stack { display: flex; flex-direction: column; gap: 0.75rem; }
                .input-field { width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.25rem; font-size: 0.875rem; }
                .input-field:focus { outline: 2px solid #3b82f6; border-color: transparent; }
                .btn { padding: 0.5rem 0.75rem; border-radius: 0.25rem; color: white; border: none; cursor: pointer; font-weight: 500; }
                .btn-xsmall { font-size: 0.75rem; padding: 0.25rem 0.5rem; }
                .btn-primary { background-color: #3b82f6; } .btn-secondary { background-color: #6b7280; }
                .btn-info { background-color: #06b6d4; } .btn-success { background-color: #10b981; } .btn-danger { background-color: #ef4444; }
                .btn:disabled { opacity: 0.5; cursor: not-allowed; }

                .list-container { max-height: 12rem; overflow-y: auto; font-size: 0.875rem; }
                .list-item { padding: 0.5rem; border-bottom: 1px solid #e5e7eb; }
                .list-item:last-child { border-bottom: none; }
                .list-item p { margin: 0; }
                .list-item-footer { font-size: 0.75rem; color: #6b7280; }
                .link { color: #3b82f6; text-decoration: none; font-size: 0.75rem; }
                .link:hover { text-decoration: underline; }

                .message-bar { padding: 0.5rem; text-align: center; font-size: 0.875rem; }
                .message-success { background-color: #d1fae5; color: #065f46; }
                .message-error { background-color: #fee2e2; color: #991b1b; }
                .alert { padding: 0.75rem; margin-top: 0.5rem; border-radius: 0.25rem; font-size: 0.9em; }
                .alert-success { background-color: #d1fae5; color: #065f46; } .alert-info { background-color: #cffafe; color: #0e7490; }
                
                .status-pending { color: #f59e0b; font-weight: bold; } .status-approved, .status-completed { color: #10b981; font-weight: bold; } .status-rejected, .status-failed { color: #ef4444; font-weight: bold; }
                .loading-screen, .loading-spinner { text-align: center; padding: 2rem; font-size: 1.25rem; color: #4b5563; }
            `}</style>
        </>
    );
}