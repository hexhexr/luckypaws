// pages/admin/agents.js
import { useState, useEffect } from "react";
import axios from "axios";
import { useRouter } from 'next/router';
import { auth as firebaseAuth } from '../../lib/firebaseClient'; // Import client-side Firebase Auth

export default function AdminAgents() {
  const router = useRouter();
  const [agents, setAgents] = useState([]);
  const [search, setSearch] = useState("");
  const [newAgent, setNewAgent] = useState({ username: "", password: "" });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true); // New loading state for auth and data
  const [isAddingAgent, setIsAddingAgent] = useState(false);
  const [isDeletingAgent, setIsDeletingAgent] = useState(false); // For individual delete operations

  // Authentication check using onAuthStateChanged
  useEffect(() => {
    const unsubscribe = firebaseAuth.onAuthStateChanged(user => {
      if (!user) {
        // No user is signed in, redirect to admin login
        router.replace('/admin');
      } else {
        // User is signed in, proceed to fetch agents
        fetchAgents();
      }
      setLoading(false); // Auth check complete
    });

    return () => unsubscribe(); // Cleanup the listener on component unmount
  }, [router]);

  const fetchAgents = async () => {
    setError('');
    try {
      setLoading(true); // Indicate data loading
      const res = await axios.get("/api/admin/agents");
      setAgents(res.data);
    } catch (err) {
      console.error("Error fetching agents:", err);
      setError(`⚠️ Failed to load agents: ${err.message || 'Unknown error'}`);
      setAgents([]); // Clear agents on error
    } finally {
      setLoading(false); // Data loading complete
    }
  };

  const handleSearch = (e) => {
    setSearch(e.target.value);
  };

  const filteredAgents = agents.filter((a) =>
    a.username.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddAgent = async () => {
    setError('');
    if (!newAgent.username || !newAgent.password) {
      setError("Username and password are required.");
      return;
    }
    setIsAddingAgent(true);
    try {
      // Assuming your API handles Firebase user creation and DB storage
      const res = await axios.post("/api/admin/agents/create-agent", newAgent);
      if (res.data.success) {
        setNewAgent({ username: "", password: "" });
        await fetchAgents(); // Reload agents after adding
      } else {
        setError(res.data.message || "Failed to add agent.");
      }
    } catch (err) {
      console.error("Error adding agent:", err);
      setError(`⚠️ Failed to add agent: ${err.response?.data?.message || err.message || 'Unknown error'}`);
    } finally {
      setIsAddingAgent(false);
    }
  };

  const handleDelete = async (id) => {
    setError('');
    if (confirm("Are you sure you want to delete this agent? This action is irreversible.")) {
      setIsDeletingAgent(true); // Set global deleting state or manage per-row
      try {
        // Assuming your API handles Firebase user deletion and DB removal
        await axios.delete(`/api/admin/agents/${id}`); // Adjust API endpoint if needed
        await fetchAgents(); // Reload agents after deleting
      } catch (err) {
        console.error("Error deleting agent:", err);
        setError(`⚠️ Failed to delete agent: ${err.response?.data?.message || err.message || 'Unknown error'}`);
      } finally {
        setIsDeletingAgent(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="ml-72 p-4 text-center">
        <p>Loading admin session and agents data...</p>
      </div>
    );
  }

  return (
    <div className="ml-72 p-4">
      <h1 className="text-2xl font-bold mb-4">Manage Agents</h1>

      <div className="bg-white p-4 rounded shadow mb-6">
        <h2 className="text-xl font-semibold mb-3">Add New Agent</h2>
        {error && <p className="text-red-600 mb-3">{error}</p>}
        <div className="flex flex-col md:flex-row gap-2">
          <input
            type="text"
            className="p-2 border rounded w-full md:w-1/2"
            placeholder="Username"
            value={newAgent.username}
            onChange={(e) =>
              setNewAgent({ ...newAgent, username: e.target.value })
            }
            disabled={isAddingAgent}
          />
          <input
            type="password"
            className="p-2 border rounded w-full md:w-1/2"
            placeholder="Password"
            value={newAgent.password}
            onChange={(e) =>
              setNewAgent({ ...newAgent, password: e.target.value })
            }
            disabled={isAddingAgent}
          />
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleAddAgent}
            disabled={isAddingAgent}
          >
            {isAddingAgent ? 'Adding...' : 'Add Agent'}
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <input
          type="text"
          className="p-2 border rounded w-full md:w-1/3"
          placeholder="Search by username"
          value={search}
          onChange={handleSearch}
        />
      </div>

      <div className="bg-white shadow rounded overflow-auto max-h-[600px]">
        {filteredAgents.length === 0 && !loading ? (
          <p className="p-4 text-center">No agents found.</p>
        ) : (
          <table className="min-w-full text-sm text-left">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="px-4 py-2">Username</th>
                <th className="px-4 py-2">Created</th>
                <th className="px-4 py-2">Total Customers</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAgents.map((a) => (
                <tr key={a.id} className="border-b">
                  <td className="px-4 py-2">{a.username}</td>
                  <td className="px-4 py-2">
                    {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-4 py-2">{a.customerCount || 0}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="text-red-600 underline hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isDeletingAgent}
                    >
                      {isDeletingAgent ? 'Deleting...' : 'Delete'}
                    </button>
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