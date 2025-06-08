// pages/admin/AgentList.js
import { useState, useEffect } from 'react';

export default function AdminAgentList() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAgents = async () => {
      const response = await fetch('/api/admin/agents');
      const data = await response.json();
      setAgents(data);
      setLoading(false);
    };
    fetchAgents();
  }, []);

  if (loading) return <p>Loading agents...</p>;

  return (
    <div>
      <h2>List of Agents</h2>
      <table>
        <thead>
          <tr>
            <th>Username</th>
            <th>Email</th>
            <th>Created At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => (
            <tr key={agent.id}>
              <td>{agent.username}</td>
              <td>{agent.email}</td>
              <td>{new Date(agent.createdAt).toLocaleDateString()}</td>
              <td>
                <button>Edit</button>
                <button>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
