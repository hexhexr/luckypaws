import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function AdminAgents() {
  const router = useRouter();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newAgentForm, setNewAgentForm] = useState({ username: '', password: '', pageCode: '', role: 'agent' });
  const [editingAgent, setEditingAgent] = useState(null); // Stores agent being edited
  const [editedAgentForm, setEditedAgentForm] = useState({ username: '', password: '', pageCode: '', role: '' });

  // Authentication check
  useEffect(() => {
    const sessionCookie = typeof window !== 'undefined' ? document.cookie.split('; ').find(row => row.startsWith('session=')) : null;
    if (!sessionCookie) {
      router.replace('/admin'); // Redirect to admin login if no session
      return;
    }
    try {
      const sessionData = JSON.parse(decodeURIComponent(sessionCookie.split('=')[1]));
      if (sessionData.role !== 'admin') {
        router.replace('/admin/dashboard'); // Redirect if not admin
      }
    } catch (e) {
      console.error('Error parsing session cookie:', e);
      router.replace('/admin');
    }
  }, []);

  const fetchAgents = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/agents');
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch agents');
      setAgents(data);
    } catch (err) {
      console.error('Fetch agents error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleNewAgentChange = (e) => {
    const { name, value } = e.target;
    setNewAgentForm(prev => ({ ...prev, [name]: value }));
  };

  const handleEditAgentChange = (e) => {
    const { name, value } = e.target;
    setEditedAgentForm(prev => ({ ...prev, [name]: value }));
  };

  const handleAddAgent = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/admin/agents/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAgentForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add agent');
      alert(data.message);
      setNewAgentForm({ username: '', password: '', pageCode: '', role: 'agent' });
      fetchAgents(); // Refresh list
    } catch (err) {
      setError(err.message);
    }
  };

  const startEditAgent = (agent) => {
    setEditingAgent(agent);
    setEditedAgentForm({
      username: agent.username,
      password: '', // Password should not be pre-filled for security
      pageCode: agent.pageCode,
      role: agent.role,
    });
  };

  const handleUpdateAgent = async (e) => {
    e.preventDefault();
    setError('');
    if (!editingAgent) return;

    try {
      const res = await fetch('/api/admin/agents/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: editingAgent.id, ...editedAgentForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update agent');
      alert(data.message);
      setEditingAgent(null); // Exit edit mode
      fetchAgents(); // Refresh list
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteAgent = async (agentId) => {
    if (!confirm('Are you sure you want to delete this agent?')) return;
    setError('');
    try {
      const res = await fetch('/api/admin/agents/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete agent');
      alert(data.message);
      fetchAgents(); // Refresh list
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <p className="text-center mt-xl">Loading agents...</p>;

  return (
    <div className="container mt-xl">
      <h1 className="card-header">Manage Agents</h1>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card mt-lg">
        <h2 className="card-header">Add New Agent</h2>
        <form onSubmit={handleAddAgent} className="form-grid">
          <label htmlFor="new-username">Username:</label>
          <input
            id="new-username"
            className="input"
            name="username"
            value={newAgentForm.username}
            onChange={handleNewAgentChange}
            required
          />

          <label htmlFor="new-password">Password:</label>
          <input
            id="new-password"
            className="input"
            name="password"
            type="password"
            value={newAgentForm.password}
            onChange={handleNewAgentChange}
            required
          />

          <label htmlFor="new-pageCode">Page Code:</label>
          <input
            id="new-pageCode"
            className="input"
            name="pageCode"
            value={newAgentForm.pageCode}
            onChange={handleNewAgentChange}
            required
          />

          <label htmlFor="new-role">Role:</label>
          <select
            id="new-role"
            className="input"
            name="role"
            value={newAgentForm.role}
            onChange={handleNewAgentChange}
          >
            <option value="agent">Agent</option>
            <option value="admin">Admin</option>
          </select>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit">Add Agent</button>
          </div>
        </form>
      </div>

      <div className="card mt-lg">
        <h2 className="card-header">Existing Agents</h2>
        {agents.length === 0 ? (
          <p>No agents found.</p>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Page Code</th>
                  <th>Role</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {agents.map(agent => (
                  <tr key={agent.id}>
                    <td>{agent.username}</td>
                    <td>{agent.pageCode}</td>
                    <td>{agent.role}</td>
                    <td>{new Date(agent.createdAt).toLocaleString()}</td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => startEditAgent(agent)}>Edit</button>
                      <button className="btn btn-danger btn-sm ml-sm" onClick={() => handleDeleteAgent(agent.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingAgent && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="modal-title">Edit Agent: {editingAgent.username}</h2>
            <form onSubmit={handleUpdateAgent} className="form-grid">
              <label htmlFor="edit-username">Username:</label>
              <input
                id="edit-username"
                className="input"
                name="username"
                value={editedAgentForm.username}
                onChange={handleEditAgentChange}
                required
              />

              <label htmlFor="edit-password">New Password (leave blank to keep current):</label>
              <input
                id="edit-password"
                className="input"
                name="password"
                type="password"
                value={editedAgentForm.password}
                onChange={handleEditAgentChange}
              />

              <label htmlFor="edit-pageCode">Page Code:</label>
              <input
                id="edit-pageCode"
                className="input"
                name="pageCode"
                value={editedAgentForm.pageCode}
                onChange={handleEditAgentChange}
                required
              />

              <label htmlFor="edit-role">Role:</label>
              <select
                id="edit-role"
                className="input"
                name="role"
                value={editedAgentForm.role}
                onChange={handleEditAgentChange}
              >
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
              </select>

              <div className="form-actions">
                <button className="btn btn-primary" type="submit">Update Agent</button>
                <button className="btn btn-secondary ml-sm" type="button" onClick={() => setEditingAgent(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}