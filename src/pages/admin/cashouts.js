// pages/admin/cashouts.js
import { useState, useEffect } from "react";
import axios from "axios";
import { useRouter } from 'next/router';
import { auth as firebaseAuth } from '../../lib/firebaseClient'; // Import client-side Firebase Auth

export default function AdminCashouts() {
  const router = useRouter();
  const [cashouts, setCashouts] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true); // New loading state for auth and data
  const [isProcessingCashout, setIsProcessingCashout] = useState(false); // For individual cashout actions

  // Authentication check using onAuthStateChanged
  useEffect(() => {
    const unsubscribe = firebaseAuth.onAuthStateChanged(user => {
      if (!user) {
        // No user is signed in, redirect to admin login
        router.replace('/admin');
      } else {
        // User is signed in, proceed to fetch cashouts
        fetchCashouts();
      }
      setLoading(false); // Auth check complete
    });

    return () => unsubscribe(); // Cleanup the listener on component unmount
  }, [router]);

  const fetchCashouts = async () => {
    setError('');
    try {
      setLoading(true); // Indicate data loading
      const res = await axios.get("/api/admin/cashouts");
      setCashouts(res.data);
    } catch (err) {
      console.error("Error fetching cashouts:", err);
      setError(`⚠️ Failed to load cashouts: ${err.message || 'Unknown error'}`);
      setCashouts([]); // Clear cashouts on error
    } finally {
      setLoading(false); // Data loading complete
    }
  };

  const filteredCashouts = cashouts.filter((c) => {
    const searchMatch =
      c.username.toLowerCase().includes(search.toLowerCase()) ||
      c.facebookName.toLowerCase().includes(search.toLowerCase());
    const statusMatch = statusFilter === "all" || c.status === statusFilter;
    return searchMatch && statusMatch;
  });

  const markAsSent = async (id) => {
    setError('');
    if (confirm("Are you sure you want to mark this cashout as SENT?")) {
      setIsProcessingCashout(true); // Set global processing state
      try {
        await axios.post("/api/admin/cashouts/send", { id }); // Assuming this API exists and updates status
        await fetchCashouts(); // Reload cashouts after update
      } catch (err) {
        console.error("Error marking as sent:", err);
        setError(`⚠️ Failed to mark as sent: ${err.response?.data?.message || err.message || 'Unknown error'}`);
      } finally {
        setIsProcessingCashout(false);
      }
    }
  };

  const markAsFailed = async (id) => {
    setError('');
    if (confirm("Are you sure you want to mark this cashout as FAILED?")) {
      setIsProcessingCashout(true); // Set global processing state
      try {
        await axios.post("/api/admin/cashouts/fail", { id }); // Assuming this API exists and updates status
        await fetchCashouts(); // Reload cashouts after update
      } catch (err) {
        console.error("Error marking as failed:", err);
        setError(`⚠️ Failed to mark as failed: ${err.response?.data?.message || err.message || 'Unknown error'}`);
      } finally {
        setIsProcessingCashout(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="ml-72 p-4 text-center">
        <p>Loading admin session and cashouts data...</p>
      </div>
    );
  }

  return (
    <div className="ml-72 p-4">
      <h1 className="text-2xl font-bold mb-4">Customer Cashouts</h1>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <input
          type="text"
          className="p-2 border rounded w-full md:w-1/3"
          placeholder="Search by username or Facebook name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="p-2 border rounded w-full md:w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <div className="bg-white shadow rounded overflow-auto max-h-[600px]">
        {filteredCashouts.length === 0 && !loading ? (
          <p className="p-4 text-center">No cashouts found matching criteria.</p>
        ) : (
          <table className="min-w-full text-sm text-left">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="px-4 py-2">Username</th>
                <th className="px-4 py-2">Facebook Name</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCashouts.map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="px-4 py-2">{c.username}</td>
                  <td className="px-4 py-2">{c.facebookName}</td>
                  <td className="px-4 py-2">${Number(c.amount || 0).toFixed(2)}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        c.status === "sent"
                          ? "bg-green-100 text-green-700"
                          : c.status === "failed"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'N/A'}</td>
                  <td className="px-4 py-2 space-x-2">
                    {c.status === 'pending' && (
                      <>
                        <button
                          onClick={() => markAsSent(c.id)}
                          className="text-green-600 underline hover:text-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={isProcessingCashout}
                        >
                          {isProcessingCashout ? 'Sending...' : 'Mark Sent'}
                        </button>
                        <button
                          onClick={() => markAsFailed(c.id)}
                          className="text-red-600 underline hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={isProcessingCashout}
                        >
                          {isProcessingCashout ? 'Failing...' : 'Mark Failed'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}