// pages/admin/AgentManagement.js
import { useState } from 'react';

export default function AdminAgentManagement() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleCreateAgent = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!username || !email || !password || !name) {
      setErrorMessage('All fields are required.');
      return;
    }

    try {
      const response = await fetch('/api/admin/create-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password, name }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage('Agent created successfully!');
        setUsername('');
        setEmail('');
        setPassword('');
        setName('');
      } else {
        setErrorMessage(data.message || 'Error creating agent.');
      }
    } catch (error) {
      setErrorMessage('An error occurred while creating the agent.');
    }
  };

  return (
    <div>
      <h1>Agent Management</h1>
      <div>
        <h2>Create New Agent</h2>
        <form onSubmit={(e) => e.preventDefault()}>
          <div>
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <button type="button" onClick={handleCreateAgent}>Create Agent</button>
        </form>
        {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}
        {successMessage && <p style={{ color: 'green' }}>{successMessage}</p>}
      </div>
    </div>
  );
}
