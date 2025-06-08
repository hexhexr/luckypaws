// src/pages/agent/index.js
import { useState, useEffect, useCallback, useMemo } from 'react';
import Head from 'next/head';
import { db, auth } from '../../lib/firebaseClient'; // Corrected import path
import { doc, onSnapshot, query, collection, where, orderBy, updateDoc, getDoc, addDoc, serverTimestamp, getDocs, limit } from 'firebase/firestore'; // Added getDocs, limit
import { useRouter } from 'next/router';
import axios from 'axios'; // Import axios for API calls

export default function AgentPage() {
  const router = useRouter();

  // --- ALL STATE HOOKS (useState) MUST BE DECLARED FIRST ---
  const [user, setUser] = useState(null); // This will hold agent data if logged in
  const [agentProfile, setAgentProfile] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true); // New state for session loading

  const [pageCode, setPageCode] = useState('');
  const [lockPageCode, setLockCodePage] = useState(false); // Unused, can be removed if not needed
  const [isSavingPageCode, setIsSavingPageCode] = useState(false);
  const [facebookName, setFacebookName] = useState('');
  const [generatedUsername, setGeneratedUsername] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(false); // For general loading states

  const [customerUsername, setCustomerUsername] = useState('');
  const [cashoutLimitRemaining, setCashoutLimitRemaining] = useState(null);
  const [customerFinancialsLoading, setCustomerFinancialsLoading] = useState(false);
  const [cashoutMessage, setCashoutMessage] = useState({ text: '', type: '' });

  const [last10AllDeposits, setLast10AllDeposits] = useState([]);
  const [totalCommission, setTotalCommission] = useState(0);
  const [customerSearchTerm, setCustomerSearchTerm] = useState(''); // Unused, can be removed
  const [searchResults, setSearchResults] = useState(null);
  const [searchMessage, setSearchMessage] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [customerDeposits, setCustomerDeposits] = useState([]);
  const [customerCashouts, setCustomerCashouts] = useState([]);
  const [showDepositModal, setShowDepositModal] = useState(false); // Unused, can be removed
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMessage, setDepositMessage] = useState({ text: '', type: '' }); // Unused, can be removed

  // --- ALL CALLBACK HOOKS (useCallback) MUST BE DECLARED AFTER useState, BEFORE CONDITIONAL RENDERS ---

  // Helper for showing messages
  const showMessage = useCallback((text, type) => {
    setMessage({ text, type });
    const timer = setTimeout(() => {
      setMessage({ text: '', type: '' });
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // Fetches the agent's profile from Firestore
  const fetchAgentProfile = useCallback(async (username) => {
    if (!username) return;
    try {
      const docRef = doc(db, "agents", username);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setAgentProfile({ id: docSnap.id, ...docSnap.data() });
        setPageCode(docSnap.data().pageCode || ''); // Initialize pageCode from profile
        setFacebookName(docSnap.data().facebookName || ''); // Initialize facebookName
        setGeneratedUsername(docSnap.data().generatedUsername || ''); // Initialize generatedUsername
      } else {
        console.log("No such agent profile!");
        setAgentProfile(null);
      }
    } catch (error) {
      console.error("Error fetching agent profile:", error);
      setAgentProfile(null);
    }
  }, []);

  // Generate Page Code
  const handleGeneratePageCode = useCallback(async () => {
    if (!user?.username) {
      showMessage("Please log in to generate a page code.", "error");
      return;
    }
    setIsSavingPageCode(true);
    try {
      const agentDocRef = doc(db, "agents", user.username);
      const agentDocSnap = await getDoc(agentDocRef);

      if (!agentDocSnap.exists()) {
        showMessage("Agent profile not found. Please contact support.", "error");
        setIsSavingPageCode(false);
        return;
      }

      const agentData = agentDocSnap.data();
      let newPageCode = agentData.pageCode;

      if (!newPageCode) {
        const generateUniqueCode = async () => {
          let code;
          let isUnique = false;
          while (!isUnique) {
            code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit number
            const q = query(collection(db, "agents"), where("pageCode", "==", code));
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
              isUnique = true;
            }
          }
          return code;
        };
        newPageCode = await generateUniqueCode();
        await updateDoc(agentDocRef, { pageCode: newPageCode });
        showMessage("New unique page code generated and saved!", "success");
      } else {
        showMessage("Existing page code retrieved.", "info");
      }
      setPageCode(newPageCode);
    } catch (error) {
      console.error("Error generating/fetching page code:", error);
      showMessage("Failed to generate or fetch page code.", "error");
    } finally {
      setIsSavingPageCode(false);
    }
  }, [user, showMessage]);


  // Save Facebook Name
  const handleSaveFacebookName = useCallback(async () => {
    if (!user?.username) {
      showMessage("Please log in to save Facebook name.", "error");
      return;
    }
    setIsSavingPageCode(true); // Using same loading state for simplicity
    try {
      const agentDocRef = doc(db, "agents", user.username);
      await updateDoc(agentDocRef, { facebookName: facebookName });
      showMessage("Facebook name saved successfully!", "success");
    } catch (error) {
      console.error("Error saving Facebook name:", error);
      showMessage("Failed to save Facebook name.", "error");
    } finally {
      setIsSavingPageCode(false);
    }
  }, [user, facebookName, showMessage]);

  // Generate Username
  const handleGenerateUsername = useCallback(async () => {
    if (!user?.username) {
      showMessage("Please log in to generate a username.", "error");
      return;
    }
    setIsSavingPageCode(true); // Using same loading state
    try {
      const agentDocRef = doc(db, "agents", user.username);
      const agentDocSnap = await getDoc(agentDocRef);

      if (!agentDocSnap.exists()) {
        showMessage("Agent profile not found. Please contact support.", "error");
        setIsSavingPageCode(false);
        return;
      }

      const agentData = agentDocSnap.data();
      let newUsername = agentData.generatedUsername; // Assuming 'generatedUsername' field

      if (!newUsername) {
        const generateUniqueAgentUsername = async () => {
          let uName;
          let isUnique = false;
          while (!isUnique) {
            uName = `agent_${Math.random().toString(36).substring(2, 8)}`; // Random string
            const q = query(collection(db, "agents"), where("generatedUsername", "==", uName));
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
              isUnique = true;
            }
          }
          return uName;
        };
        newUsername = await generateUniqueAgentUsername();
        await updateDoc(agentDocRef, { generatedUsername: newUsername });
        showMessage("New unique agent username generated and saved!", "success");
      } else {
        showMessage("Existing agent username retrieved.", "info");
      }
      setGeneratedUsername(newUsername);
    } catch (error) {
      console.error("Error generating/fetching username:", error);
      showMessage("Failed to generate or fetch username.", "error");
    } finally {
      setIsSavingPageCode(false);
    }
  }, [user, showMessage]);

  // Fetch customer financials (Deposits & Cashouts)
  const fetchCustomerFinancials = useCallback(async () => {
    if (!customerUsername) {
      setSearchMessage("Please enter a customer username.");
      setSearchResults(null);
      return;
    }
    setIsSearching(true);
    setSearchMessage('');
    setSearchResults(null);
    setCustomerDeposits([]);
    setCustomerCashouts([]);

    try {
      // Fetch customer's deposits
      const depositsQuery = query(
        collection(db, 'orders'), // Assuming customer deposits are 'orders'
        where('username', '==', customerUsername),
        where('status', '==', 'paid'), // Only paid orders count as deposits
        orderBy('created', 'desc')
      );
      const depositsSnapshot = await getDocs(depositsQuery);
      const deposits = depositsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCustomerDeposits(deposits);

      // Fetch customer's cashouts
      const cashoutsQuery = query(
        collection(db, 'cashouts'), // Assuming 'cashouts' collection for customer withdrawals
        where('customerUsername', '==', customerUsername),
        orderBy('requestedAt', 'desc') // Assuming a 'requestedAt' field
      );
      const cashoutsSnapshot = await getDocs(cashoutsQuery);
      const cashouts = cashoutsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCustomerCashouts(cashouts);

      // Calculate total deposits and cashouts for the limit
      const totalDeposited = deposits.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
      const totalCashedOut = cashouts.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);

      const remaining = totalDeposited - totalCashedOut;
      setCashoutLimitRemaining(remaining);
      setSearchResults({ customerUsername }); // Indicate successful search for the customer
      setSearchMessage(`Financials for ${customerUsername} loaded.`);

    } catch (error) {
      console.error("Error fetching customer financials:", error);
      setSearchMessage("Failed to fetch customer financials. Please try again.");
    } finally {
      setIsSearching(false);
    }
  }, [customerUsername]);

  // Handle Cashout Request
  const handleCashoutRequest = useCallback(async () => {
    if (!user?.username || !agentProfile?.agentName) {
      setCashoutMessage({ text: "Agent not logged in or profile missing.", type: "error" });
      return;
    }
    if (!customerUsername || isNaN(parseFloat(depositAmount)) || parseFloat(depositAmount) <= 0) {
      setCashoutMessage({ text: "Please enter a valid customer username and positive amount.", type: "error" });
      return;
    }
    if (cashoutLimitRemaining !== null && parseFloat(depositAmount) > cashoutLimitRemaining) {
      setCashoutMessage({ text: "Cashout amount exceeds customer's remaining limit.", type: "error" });
      return;
    }

    setCustomerFinancialsLoading(true); // Using this for cashout submission loading
    try {
      const res = await axios.post('/api/agent/submit-cashout-request', {
        agentId: user.username, // Assuming agentId is the username
        agentName: agentProfile.agentName || user.username, // Use agentName from profile or username
        customerUsername: customerUsername, // Add customer username to the request
        amount: parseFloat(depositAmount),
      });

      if (res.data.success) {
        setCashoutMessage({ text: res.data.message, type: "success" });
        setDepositAmount(''); // Clear amount
        setCustomerUsername(''); // Clear customer username
        setCashoutLimitRemaining(null); // Reset limit
        setSearchResults(null); // Clear search results
      } else {
        setCashoutMessage({ text: res.data.message || "Failed to submit cashout request.", type: "error" });
      }
    } catch (error) {
      console.error("Error submitting cashout request:", error);
      setCashoutMessage({ text: error.response?.data?.message || "Error submitting cashout request.", type: "error" });
    } finally {
      setCustomerFinancialsLoading(false);
    }
  }, [user, agentProfile, customerUsername, depositAmount, cashoutLimitRemaining]);

  // Placeholder for logout function - make sure this matches your /api/agent/logout.js
  const handleLogout = useCallback(async () => {
    try {
      await axios.post('/api/agent/logout');
      router.push('/agent/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails on server, redirect to login page
      router.push('/agent/login');
    }
  }, [router]);


  // --- ALL EFFECT HOOKS (useEffect) MUST BE DECLARED AFTER useState and useCallback, BEFORE CONDITIONAL RENDERS ---

  // Session Check & Redirection
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await axios.get('/api/agent/me'); // Call your session check API
        if (response.status === 200 && response.data.username) {
          setUser({ username: response.data.username }); // Set the user state
        } else {
          router.replace('/agent/login'); // Redirect to login if session is not valid
        }
      } catch (error) {
        console.error("Session check failed:", error);
        router.replace('/agent/login'); // Redirect to login on error
      } finally {
        setLoadingSession(false);
      }
    };

    checkSession();
  }, [router]); // Re-run effect if router changes

  // Use this useEffect to fetch agent profile once user is set
  useEffect(() => {
    if (user?.username && !agentProfile) {
      fetchAgentProfile(user.username);
    }
  }, [user, agentProfile, fetchAgentProfile]);

  // Fetch last 10 ALL deposits for the dashboard view
  useEffect(() => {
    // Only fetch if session is loaded and user is present
    if (!loadingSession && user) {
      const q = query(
        collection(db, "orders"), // Assuming 'orders' collection contains deposits
        where('status', '==', 'paid'), // Only show paid deposits
        orderBy("createdAt", "desc"),
        limit(10)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const deposits = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate()?.toISOString(), // Convert Timestamp to ISO string
        }));
        setLast10AllDeposits(deposits);
      }, (error) => {
        console.error("Error fetching last 10 deposits:", error);
      });

      return () => unsubscribe();
    }
  }, [loadingSession, user]); // Depend on loadingSession and user

  // Fetch total commission for the logged-in agent
  useEffect(() => {
    if (!user?.username) return;

    const fetchCommission = async () => {
      try {
        const q = query(
          collection(db, "orders"),
          where("agent", "==", user.username), // Assuming agent username is stored in 'agent' field
          where("status", "==", "paid")
        );
        const snapshot = await getDocs(q);
        let total = 0;
        snapshot.forEach(doc => {
          total += parseFloat(doc.data().commission || 0); // Assuming a 'commission' field
        });
        setTotalCommission(total);
      } catch (error) {
        console.error("Error fetching total commission:", error);
      }
    };

    fetchCommission();
  }, [user]);


  // --- CONDITIONAL RENDERING (return) STATEMENTS ARE PLACED HERE ---
  // Display loading state while checking session
  if (loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p>Loading agent session...</p>
      </div>
    );
  }

  // If user is null after session check, it means they are not logged in and have been redirected.
  // This return statement ensures nothing else tries to render prematurely.
  if (!user) {
    return null; // Or a very minimal "Redirecting..." message
  }

  // --- ACTUAL RENDERED JSX (only when session is valid and user is set) ---
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Head>
        <title>Agent Dashboard</title>
      </Head>

      <header className="bg-white shadow-sm p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Agent Dashboard</h1>
        {user && (
          <div className="flex items-center space-x-4">
            <span className="text-gray-700">Welcome, {user.username}!</span>
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            >
              Logout
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Messages */}
        {message.text && (
          <div className={`col-span-full alert alert-${message.type}`}>
            {message.text}
          </div>
        )}

        {/* Agent Profile & Codes */}
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Your Agent Profile</h2>
          {agentProfile ? (
            <div>
              <p><strong>Agent Username:</strong> {agentProfile.username}</p>
              <p><strong>Page Code:</strong> {pageCode || 'Not generated'}</p>
              <p><strong>Facebook Name:</strong> {facebookName || 'Not set'}</p>
              <p><strong>Generated Username:</strong> {generatedUsername || 'Not generated'}</p>
            </div>
          ) : (
            <p>Loading profile...</p>
          )}

          <div className="mt-4 space-y-3">
            <button
              onClick={handleGeneratePageCode}
              className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              disabled={isSavingPageCode}
            >
              {isSavingPageCode ? 'Generating...' : (pageCode ? 'Refresh Page Code' : 'Generate Page Code')}
            </button>
            {pageCode && <p className="text-sm text-gray-600">Your page code: <span className="font-bold">{pageCode}</span></p>}

            <input
              type="text"
              placeholder="Your Facebook Name"
              className="w-full p-2 border rounded"
              value={facebookName}
              onChange={(e) => setFacebookName(e.target.value)}
            />
            <button
              onClick={handleSaveFacebookName}
              className="w-full bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
              disabled={isSavingPageCode}
            >
              {isSavingPageCode ? 'Saving...' : 'Save Facebook Name'}
            </button>

            <button
              onClick={handleGenerateUsername}
              className="w-full bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
              disabled={isSavingPageCode}
            >
              {isSavingPageCode ? 'Generating...' : (generatedUsername ? 'Refresh Username' : 'Generate Username')}
            </button>
            {generatedUsername && <p className="text-sm text-gray-600">Your unique username: <span className="font-bold">{generatedUsername}</span></p>}
          </div>
        </section>

        {/* Customer Financials Search */}
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Customer Financials</h2>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Customer Username"
              className="w-full p-2 border rounded mb-2"
              value={customerUsername}
              onChange={(e) => setCustomerUsername(e.target.value)}
            />
            <button
              onClick={fetchCustomerFinancials}
              className="w-full bg-indigo-500 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded"
              disabled={isSearching}
            >
              {isSearching ? 'Searching...' : 'Search Customer'}
            </button>
            {searchMessage && <p className="text-sm mt-2">{searchMessage}</p>}
          </div>

          {searchResults && (
            <div className="border-t pt-4 mt-4">
              <h3 className="text-md font-semibold mb-2">Details for {searchResults.customerUsername}</h3>
              {cashoutLimitRemaining !== null && (
                <p><strong>Cashout Limit Remaining:</strong> ${cashoutLimitRemaining.toFixed(2)}</p>
              )}

              <h4 className="font-semibold mt-4">Deposits:</h4>
              {customerDeposits.length > 0 ? (
                <ul className="list-disc pl-5">
                  {customerDeposits.map(d => (
                    <li key={d.id}>${d.amount?.toFixed(2)} on {d.created ? new Date(d.created).toLocaleString() : 'N/A'}</li>
                  ))}
                </ul>
              ) : (
                <p>No deposits found.</p>
              )}

              <h4 className="font-semibold mt-4">Cashouts:</h4>
              {customerCashouts.length > 0 ? (
                <ul className="list-disc pl-5">
                  {customerCashouts.map(c => (
                    <li key={c.id}>${c.amount?.toFixed(2)} on {c.requestedAt ? new Date(c.requestedAt?.toDate()).toLocaleString() : 'N/A'} (Status: {c.status})</li>
                  ))}
                </ul>
              ) : (
                <p>No cashouts found.</p>
              )}

              <h4 className="font-semibold mt-4">Submit Cashout Request</h4>
              <input
                type="number"
                placeholder="Amount"
                className="w-full p-2 border rounded mb-2"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
              />
              <button
                onClick={handleCashoutRequest}
                className="w-full bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                disabled={customerFinancialsLoading}
              >
                {customerFinancialsLoading ? 'Submitting...' : 'Request Cashout'}
              </button>
              {cashoutMessage.text && <p className={`text-sm mt-2 text-${cashoutMessage.type === 'success' ? 'green' : 'red'}-600`}>{cashoutMessage.text}</p>}
            </div>
          )}
        </section>

        {/* Last 10 All Deposits */}
        <section className="bg-white p-6 rounded-lg shadow lg:col-span-1">
          <h2 className="text-lg font-semibold mb-4">Last 10 All Customer Deposits (Paid)</h2>
          {last10AllDeposits.length > 0 ? (
            <div className="overflow-x-auto overflow-y-auto rounded-lg shadow-sm border border-gray-200" style={{ maxHeight: '250px' }}>
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
          ) : (
            <p>No recent paid deposits found.</p>
          )}
        </section>

        {/* Total Commission */}
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Your Total Commission</h2>
          <p className="text-3xl font-bold text-green-600">${totalCommission.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-2">Calculated from your paid orders.</p>
        </section>

        {/* Additional sections as needed */}
      </main>
    </div>
  );
}