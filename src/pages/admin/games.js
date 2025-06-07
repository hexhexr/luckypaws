// pages/admin/games.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link'; // Import Link for navigation
import { db } from '../../lib/firebaseClient'; // Ensure this path is correct
import { isAuthenticated } from '../../lib/auth'; // Import server-side auth utility

export default function AdminGames({ isAuthenticatedUser }) {
  const router = useRouter();
  const [games, setGames] = useState([]);
  const [newGame, setNewGame] = useState('');
  const [editingGame, setEditingGame] = useState(null); // { id, name } of game being edited
  const [editedGameName, setEditedGameName] = useState('');
  const [error, setError] = useState('');

  // Client-side effect for logout (only if the server-side check didn't redirect)
  useEffect(() => {
    if (!isAuthenticatedUser && typeof window !== 'undefined') {
        router.replace('/admin');
    }
  }, [isAuthenticatedUser, router]);

  const logout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      router.replace('/admin'); // Redirect to login after successful logout
    } catch (err) {
      console.error('Logout API error:', err);
      setError('Failed to log out.');
    }
  };

  const loadGames = async () => {
    setError('');
    try {
      const snap = await db.collection('games').orderBy('name').get();
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGames(list);
    } catch (err) {
      console.error(err);
      setError('⚠️ Failed to load games');
    }
  };

  useEffect(() => {
    // Only load games if the user is authenticated (passed from getServerSideProps)
    if (isAuthenticatedUser) {
      loadGames();
    }
  }, [isAuthenticatedUser]);


  const handleAddGame = async (e) => {
    e.preventDefault();
    if (!newGame.trim()) {
      setError('Game name cannot be empty.');
      return;
    }
    setError('');
    try {
      const res = await fetch('/api/admin/games/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGame }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add game');
      setNewGame('');
      loadGames(); // Refresh the list
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEditGame = (game) => {
    setEditingGame(game);
    setEditedGameName(game.name);
  };

  const handleSaveEdit = async () => {
    if (!editingGame || !editedGameName.trim()) {
      setError('Edited game name cannot be empty.');
      return;
    }
    setError('');
    try {
      const res = await fetch('/api/admin/games/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingGame.id, name: editedGameName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update game');
      setEditingGame(null);
      setEditedGameName('');
      loadGames(); // Refresh the list
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteGame = async (gameId) => {
    if (!confirm('Are you sure you want to delete this game? This action cannot be undone.')) return;
    setError('');
    try {
      const res = await fetch('/api/admin/games/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: gameId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete game');
      loadGames(); // Refresh the list
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container mt-lg">
      <div className="card">
        <h1 className="card-header">Manage Games</h1>
        <nav className="admin-nav">
          <Link href="/admin/dashboard" className="btn btn-secondary mr-sm">
            Dashboard
          </Link>
          <Link href="/admin/games" className="btn btn-secondary mr-sm">
            Manage Games
          </Link>
          <Link href="/admin/profit-loss" className="btn btn-secondary mr-sm">
            Profit & Loss
          </Link>
          <Link href="/admin/agents" className="btn btn-secondary mr-sm">
            Manage Agents
          </Link>
          <button onClick={logout} className="btn btn-danger">Logout</button>
        </nav>

        {error && <p className="error-message mt-md">{error}</p>}

        <div className="form-section mt-lg">
          <form onSubmit={handleAddGame} className="add-game-form">
            <input
              type="text"
              className="input"
              placeholder="Add new game name"
              value={newGame}
              onChange={(e) => setNewGame(e.target.value)}
              required
            />
            <button className="btn btn-primary" type="submit">Add Game</button>
          </form>
        </div>

        <h2 className="section-header mt-lg">Existing Games</h2>
        {games.length === 0 && !error && <p className="text-center">No games added yet.</p>}
        {games.length > 0 && (
          <ul className="game-list">
            {games.map((game) => (
              <li key={game.id}>
                {editingGame?.id === game.id ? (
                  <>
                    <input
                      type="text"
                      className="input"
                      value={editedGameName}
                      onChange={(e) => setEditedGameName(e.target.value)}
                    />
                    <div>
                      <button className="btn btn-primary btn-sm" onClick={handleSaveEdit}>Save</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditingGame(null)}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <span>{game.name}</span>
                    <div>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleEditGame(game)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteGame(game.id)}>Delete</button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Server-side authentication check for AdminGames
export async function getServerSideProps(context) {
  const { req } = context;
  const { isAuthenticated } = await import('../../lib/auth');

  if (!isAuthenticated(req)) {
    return {
      redirect: {
        destination: '/admin',
        permanent: false,
      },
    };
  }

  return {
    props: {
      isAuthenticatedUser: true,
    },
  };
}