// pages/agent/index.js
import { useState, useEffect, useCallback, useMemo } from 'react';
import Head from 'next/head';
import { db, auth } from '../../lib/firebaseClient';
import { doc, onSnapshot, query, collection, where, orderBy, updateDoc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/router';

export default function AgentPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [agentProfile, setAgentProfile] = useState(null);

  const [pageCode, setPageCode] = useState('');
  const [lockPageCode, setLockCodePage] = useState(false);
  const [isSavingPageCode, setIsSavingPageCode] = useState(false);
  const [facebookName, setFacebookName] = useState('');
  const [generatedUsername, setGeneratedUsername] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);

  const [customerUsername, setCustomerUsername] = useState('');
  const [cashoutLimitRemaining, setCashoutLimitRemaining] = useState(null);
  const [customerFinancialsLoading, setCustomerFinancialsLoading] = useState(false);
  const [cashoutMessage, setCashoutMessage] = useState({ text: '', type: '' });

  const [last10AllDeposits, setLast10AllDeposits] = useState([]);

  const [agentWorkHours, setAgentWorkHours] = useState([]); // Agent's own work hours
  const [agentLeaves, setAgentLeaves] = useState([]); // Agent's own leave requests
  const [cashoutRequestAmount, setCashoutRequestAmount] = useState(''); // For agent's own cashout request
  const [cashoutRequestMessage, setCashoutRequestMessage] = useState({ text: '', type: '' });


  // --- Firebase Document Reference for Agent Settings ---
  const agentSettingsRef = useMemo(() => {
    return doc(db, 'agentSettings', 'pageCodeConfig');
  }, []);

  // --- Authentication Protection & Agent Profile Fetch ---
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (currentUser) => {
      if (!currentUser) {
        console.log('No user logged in, redirecting to /agent/login');
        router.replace('/agent/login');
        return;
      }

      setUser(currentUser);

      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists() && userDocSnap.data().role === 'agent') {
          setAgentProfile(userDocSnap.data());
          console.log('Agent user authenticated:', currentUser.email);
        } else {
          console.warn('Authenticated user is not an agent. Signing out.');
          await auth.signOut();
          router.replace('/agent/login?error=unauthorized');
        }
      } catch (error) {
        console.error('Error fetching agent profile:', error);
        await auth.signOut();
        router.replace('/agent/login?error=profile_fetch_failed');
      }
    });

    return () => unsubscribeAuth();
  }, [router]);

  // --- Page Code Locking Logic ---
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(agentSettingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPageCode(data.pageCode || '');
        setLockCodePage(data.locked || false);
        setMessage({ text: 'Page code settings loaded.', type: 'success' });
      } else {
        setMessage({ text: 'No page code settings found. Create one.', type: 'error' });
        setPageCode('');
        setLockCodePage(false);
      }
    }, (error) => {
      console.error('Error listening to page code settings:', error);
      setMessage({ text: 'Error fetching page code settings: ' + error.message, type: 'error' });
    });

    return () => unsubscribe();
  }, [user, agentSettingsRef]);

  const savePageCodeSettingsToFirebase = useCallback(async () => {
    setIsSavingPageCode(true);
    setMessage({ text: '', type: '' });
    try {
      await updateDoc(agentSettingsRef, {
        pageCode: pageCode,
        locked: lockPageCode,
        lastUpdated: new Date().toISOString(),
      });
      setMessage({ text: 'Page code settings saved successfully!', type: 'success' });
    } catch (error) {
      console.error('Error saving page code settings:', error);
      setMessage({ text: 'Failed to save page code settings. ' + error.message, type: 'error' });
    } finally {
      setIsSavingPageCode(false);
    }
  }, [pageCode, lockPageCode, agentSettingsRef]);

  // --- Username Generation Logic ---
  const handleGenerateUsername = async (e) => {
    e.preventDefault();
    setGeneratedUsername('');
    setMessage({ text: '', type: '' });
    setIsLoading(true);

    if (!facebookName.trim() || !pageCode.trim()) {
      setMessage({ text: 'Please enter Facebook Name and Page Code.', type: 'error' });
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/generate-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facebookName, pageCode }),
      });

      const data = await response.json();

      if (response.ok) {
        setGeneratedUsername(data.username);
        setMessage({ text: data.message, type: 'success' });
      } else {
        setMessage({ text: data.message || 'Failed to generate username.', type: 'error' });
      }
    } catch (error) {
      console.error('Error generating username:', error);
      setMessage({ text: 'An unexpected error occurred while generating username.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // --- Customer Cashout Limit Logic ---
  const fetchCustomerCashoutLimit = async (e) => {
    e.preventDefault();
    setCashoutLimitRemaining(null);
    setCashoutMessage({ text: '', type: '' });
    setCustomerFinancialsLoading(true);

    if (!customerUsername.trim()) {
      setCashoutMessage({ text: 'Please enter a customer username.', type: 'error' });
      setCustomerFinancialsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/customer-cashout-limit?username=${encodeURIComponent(customerUsername.trim())}`);
      const data = await response.json();

      if (response.ok) {
        setCashoutLimitRemaining(data.remainingLimit);
        setCashoutMessage({
          text: `Limit for ${data.username}: $${data.remainingLimit.toFixed(2)} (Total cashed out: $${data.totalCashoutsToday.toFixed(2)})`,
          type: 'success'
        });
      } else {
        setCashoutMessage({ text: data.message || 'Failed to fetch cashout limit.', type: 'error' });
      }
    } catch (error) {
      console.error('Error fetching cashout limit:', error);
      setCashoutMessage({ text: 'An unexpected error occurred while fetching cashout limit.', type: 'error' });
    } finally {
      setCustomerFinancialsLoading(false);
    }
  };

  // --- Live Deposit Checker (Last 10 Deposits) ---
  useEffect(() => {
    if (!user) return;

    const depositsQuery = query(
      collection(db, 'orders'),
      where('status', '==', 'paid'),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(depositsQuery, (snapshot) => {
      const deposits = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        deposits.push({
          id: doc.id,
          username: data.username,
          amount: parseFloat(data.amount || 0),
          createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt) : null,
        });
      });
      setLast10AllDeposits(deposits.slice(0, 10));
      setMessage({ text: 'Live deposits updated.', type: 'success' });
    }, (error) => {
      console.error('Error fetching live deposits:', error);
      setMessage({ text: 'Error fetching live deposits: ' + error.message, type: 'error' });
    });

    return () => unsubscribe();
  }, [user]);

  // --- Agent's Own Work Hours Fetching ---
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'workHours'),
      where('agentId', '==', user.uid),
      orderBy('loginTime', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const hours = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        loginTime: doc.data().loginTime ? (doc.data().loginTime.toDate ? doc.data().loginTime.toDate().toISOString() : doc.data().loginTime) : null,
        logoutTime: doc.data().logoutTime ? (doc.data().logoutTime.toDate ? doc.data().logoutTime.toDate().toISOString() : doc.data().logoutTime) : null,
      }));
      setAgentWorkHours(hours);
    }, (error) => {
      console.error("Error fetching agent's work hours:", error);
      setMessage({ text: "Error fetching your work hours: " + error.message, type: 'error' });
    });

    return () => unsubscribe();
  }, [user]);

  // --- Agent's Own Leave Requests Fetching ---
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'leaves'),
      where('agentId', '==', user.uid),
      orderBy('requestedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const leaves = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        requestedAt: doc.data().requestedAt ? (doc.data().requestedAt.toDate ? doc.data().requestedAt.toDate().toISOString() : doc.data().requestedAt) : null,
      }));
      setAgentLeaves(leaves);
    }, (error) => {
      console.error("Error fetching agent's leave requests:", error);
      setMessage({ text: "Error fetching your leave requests: " + error.message, type: 'error' });
    });

    return () => unsubscribe();
  }, [user]);

  // --- Calculate Total Hours for current agent ---
  const calculateOwnTotalHours = useCallback(() => {
    let totalDurationMs = 0;
    agentWorkHours.forEach(entry => {
        if (entry.loginTime && entry.logoutTime) {
            const login = new Date(entry.loginTime);
            const logout = new Date(entry.logoutTime);
            totalDurationMs += (logout.getTime() - login.getTime());
        }
    });
    const totalHours = totalDurationMs / (1000 * 60 * 60);
    return totalHours.toFixed(2);
  }, [agentWorkHours]);

  // --- Submit Agent Cashout Request ---
  const handleSubmitCashoutRequest = async (e) => {
    e.preventDefault();
    setCashoutRequestMessage({ text: '', type: '' });

    const amount = parseFloat(cashoutRequestAmount);
    if (isNaN(amount) || amount <= 0) {
      setCashoutRequestMessage({ text: 'Please enter a valid positive amount for cashout.', type: 'error' });
      return;
    }

    if (!user || !agentProfile) {
        setCashoutRequestMessage({ text: 'Agent not authenticated. Please log in.', type: 'error' });
        return;
    }

    try {
      await addDoc(collection(db, 'agentCashoutRequests'), { // New collection for agent cashout requests
        agentId: user.uid,
        agentName: agentProfile.name || agentProfile.email,
        amount: amount,
        status: 'pending', // pending, approved, rejected
        requestedAt: serverTimestamp(),
      });
      setCashoutRequestMessage({ text: 'Cashout request submitted successfully!', type: 'success' });
      setCashoutRequestAmount('');
    } catch (error) {
      console.error('Error submitting cashout request:', error);
      setCashoutRequestMessage({ text: 'Failed to submit cashout request: ' + error.message, type: 'error' });
    }
  };


  // --- Logout Functionality ---
  const handleLogout = async () => {
    if (user) {
      try {
        await fetch('/api/agent/record-logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId: user.uid }),
        });
        await auth.signOut();
        console.log('User signed out.');
        router.replace('/agent/login');
      } catch (error) {
        console.error('Error during logout:', error);
        setMessage({ text: 'Failed to log out: ' + error.message, type: 'error' });
      }
    }
  };

  if (!user || !agentProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center text-lg bg-gray-100">
        <Head><title>Loading Agent Page...</title></Head>
        <p>Loading agent dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 font-inter">
      {/* Tailwind CSS CDN script - IMPORTANT: Ensure this is loaded in your _document.js or layout if not already */}
      <script src="https://cdn.tailwindcss.com"></script>
      <Head>
        <title>Agent Dashboard</title>
        <meta name="description" content="Agent dashboard for managing customers and orders" />
        <link rel="icon" href="/favicon.ico" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
      </Head>

      <header className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-lg shadow-md mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-4 sm:mb-0">Agent Dashboard</h1>
        <nav className="flex flex-wrap gap-2 sm:gap-4">
          <button
            onClick={() => router.push('/agent')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm"
          >
            Dashboard
          </button>
          <button
            onClick={() => router.push('/admin')} // Link to Admin Login
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors shadow-sm"
          >
            Admin Login
          </button>
          {/* Add more menu items here if needed */}
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors shadow-sm"
          >
            Logout
          </button>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto">
        {message.text && (
          <p className={`mb-4 p-3 rounded-md ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {message.text}
          </p>
        )}

        {/* Agent's Own Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-green-500">
                <h3 className="text-xl font-semibold mb-3 text-green-700">Your Work Summary</h3>
                <p className="text-gray-700 text-lg">Total Hours Today: <span className="font-bold text-gray-900">{calculateOwnTotalHours()} hrs</span></p>
                {/* You might want to filter work hours by current day/week for this display */}
                <div className="mt-4 text-gray-600 text-sm">
                    <h4 className="font-semibold mb-2">Recent Login/Logout:</h4>
                    {agentWorkHours.length > 0 ? (
                        <ul className="list-disc list-inside space-y-1">
                            {agentWorkHours.slice(0, 3).map((log, index) => ( // Show last 3
                                <li key={index}>
                                    Login: {log.loginTime ? new Date(log.loginTime).toLocaleString() : 'N/A'} - 
                                    Logout: {log.logoutTime ? new Date(log.logoutTime).toLocaleString() : 'Active'}
                                </li>
                            ))}
                        </ul>
                    ) : <p>No recent work activity.</p>}
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-purple-500">
                <h3 className="text-xl font-semibold mb-3 text-purple-700">Your Leave Status</h3>
                {agentLeaves.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {agentLeaves.slice(0, 5).map((leave) => ( // Show last 5 leaves
                                    <tr key={leave.id}>
                                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600">{leave.reason}</td>
                                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600">{leave.days}</td>
                                        <td className="px-3 py-2 whitespace-nowrap text-sm font-semibold">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                leave.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                leave.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                                'bg-yellow-100 text-yellow-800'
                                            }`}>
                                                {leave.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : <p className="text-gray-600">No leave requests submitted yet.</p>}
            </div>
        </div>


        {/* Submit Cashout Request Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Submit Your Cashout Request</h2>
            <form onSubmit={handleSubmitCashoutRequest} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                    type="number"
                    placeholder="Amount to Cashout"
                    value={cashoutRequestAmount}
                    onChange={(e) => setCashoutRequestAmount(e.target.value)}
                    className="p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    min="0.01"
                    step="0.01"
                    required
                />
                <button
                    type="submit"
                    className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-md font-semibold"
                >
                    Submit Cashout Request
                </button>
            </form>
            {cashoutRequestMessage.text && (
                <p className={`mt-4 p-3 rounded-md ${cashoutRequestMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {cashoutRequestMessage.text}
                </p>
            )}
        </div>


        {/* Page Code Locking Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Page Code Management</h2>
          <form className="space-y-4">
            <div>
              <label htmlFor="pageCode" className="block text-sm font-medium text-gray-700 mb-1">Current Page Code:</label>
              <input
                type="text"
                id="pageCode"
                value={pageCode}
                onChange={(e) => setPageCode(e.target.value)}
                placeholder="Enter page code"
                className="p-3 border border-gray-300 rounded-md w-full focus:ring-blue-500 focus:border-blue-500"
                disabled={lockPageCode || isSavingPageCode}
              />
            </div>
            {lockPageCode && (
              <p className="text-blue-600 text-sm">
                This page code is locked by admin. You cannot change it.
              </p>
            )}
            {!lockPageCode && (
              <button
                type="button"
                onClick={savePageCodeSettingsToFirebase}
                className={`px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-md font-semibold ${isSavingPageCode ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isSavingPageCode}
              >
                {isSavingPageCode ? 'Saving...' : 'Save Page Code'}
              </button>
            )}
            <p className="text-sm text-gray-500 mt-2">
              *Page code can be locked by an admin from Firebase.
            </p>
          </form>
        </div>

        {/* Username Generation Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Generate Customer Username</h2>
          <form onSubmit={handleGenerateUsername} className="space-y-4">
            <div>
              <label htmlFor="facebookName" className="block text-sm font-medium text-gray-700 mb-1">Customer Facebook Name:</label>
              <input
                type="text"
                id="facebookName"
                value={facebookName}
                onChange={(e) => setFacebookName(e.target.value)}
                placeholder="e.g., John Doe"
                required
                className="p-3 border border-gray-300 rounded-md w-full focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              />
            </div>
            <p className="text-sm text-gray-600">
              Page Code will be automatically used from the "Page Code Management" section above.
            </p>
            <button
              type="submit"
              className={`px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-md font-semibold ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={isLoading}
            >
              {isLoading ? 'Generating...' : 'Generate Username'}
            </button>
          </form>
          {generatedUsername && (
            <p className="mt-4 p-3 rounded-md bg-green-100 text-green-700">
              Generated Username: <strong className="text-green-900">{generatedUsername}</strong>
            </p>
          )}
        </div>

        {/* Customer Cashout Limit Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Check Customer Cashout Limit</h2>
          <form onSubmit={fetchCustomerCashoutLimit} className="space-y-4">
            <div>
              <label htmlFor="customerUsername" className="block text-sm font-medium text-gray-700 mb-1">Customer Username:</label>
              <input
                type="text"
                id="customerUsername"
                value={customerUsername}
                onChange={(e) => setCustomerUsername(e.target.value)}
                placeholder="Enter customer username"
                required
                className="p-3 border border-gray-300 rounded-md w-full focus:ring-blue-500 focus:border-blue-500"
                disabled={customerFinancialsLoading}
              />
            </div>
            <button
              type="submit"
              className={`px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-md font-semibold ${customerFinancialsLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={customerFinancialsLoading}
            >
              {customerFinancialsLoading ? 'Checking...' : 'Check Cashout Limit'}
            </button>
          </form>
          {cashoutLimitRemaining !== null && (
            <p className="mt-4 p-3 rounded-md bg-blue-100 text-blue-700">
              Remaining Limit: <strong className="text-blue-900">${cashoutLimitRemaining.toFixed(2)}</strong>
            </p>
          )}
          {cashoutMessage.text && (
            <p className={`mt-4 p-3 rounded-md ${cashoutMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {cashoutMessage.text}
            </p>
          )}
        </div>

        {/* Live Deposit Checker Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Live Deposit Checker (Last 10 Paid Orders)</h2>
          {last10AllDeposits.length === 0 ? (
            <p className="text-gray-600">No recent paid deposits found. {message.type === 'error' && message.text.includes('live deposits') ? `(${message.text})` : ''}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg shadow-sm border border-gray-200" style={{ maxHeight: '250px' }}>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount (USD)</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {last10AllDeposits.map((deposit) => (
                    <tr key={deposit.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{deposit.username}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${Number(deposit.amount).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{deposit.createdAt ? new Date(deposit.createdAt).toLocaleString() : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
