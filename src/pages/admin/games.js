// pages/admin/games.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router'; // Import useRouter for auth check
import { db } from '../../lib/firebaseClient'; // Ensure this path is correct

export default function AdminGames() {
  const router = useRouter(); // Initialize useRouter
  const [games, setGames] = useState([]);
  const [newGame, setNewGame] = useState('');
  const [editingGame, setEditingGame] = useState(null); // { id, name } of game being edited
  const [editedGameName, setEditedGameName] = useState('');
  const [error, setError] = useState('');

  // Authentication check for admin pages
useEffect(() => {
    const sessionCookie = typeof window !== 'undefined' ? document.cookie.split('; ').find(row => row.startsWith('session=')) : null;
    if (!sessionCookie) {
      router.replace('/admin');
      return;
    }
    try {
      const sessionData = JSON.parse(decodeURIComponent(sessionCookie.split('=')[1]));
      if (sessionData.role !== 'admin') {
        router.replace('/admin/dashboard'); // Redirect if not admin, or to agent dashboard
      }
    } catch (e) {
      console.error('Error parsing session cookie:', e);
      router.replace('/admin');
    }
  }, []);

  const loadGames = async () => {
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
    loadGames();
  }, []);

  const handleAddGame = async (e) => {
    e.preventDefault();
    setError('');

    const trimmed = newGame.trim();
    if (!trimmed) {
      setError('Game name is required');
      return;
    }

    try {
      await db.collection('games').add({ name: trimmed });
      setNewGame('');
      await loadGames(); // Reload games after adding
    } catch (err) {
      console.error(err);
      setError('⚠️ Error adding game');
    }
  };

  const handleEditClick = (game) => {
    setEditingGame(game);
    setEditedGameName(game.name);
    setError(''); // Clear any previous errors
  };

  const handleUpdateGame = async (e) => {
    e.preventDefault();
    setError('');

    const trimmed = editedGameName.trim();
    if (!trimmed) {
      setError('Game name cannot be empty');
      return;
    }
    if (!editingGame) {
      setError('No game selected for editing.');
      return;
    }

    try {
      // Call your new API endpoint to update the game name
      const res = await fetch('/api/admin/games/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingGame.id, name: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update game');
      }

      setEditingGame(null); // Exit editing mode
      setEditedGameName('');
      await loadGames(); // Reload games after updating
    } catch (err) {
      console.error(err);
      setError(`⚠️ Error updating game: ${err.message}`);
    }
  };


  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this game? This action cannot be undone.")) {
      try {
        await db.collection('games').doc(id).delete();
        setGames(games.filter(g => g.id !== id));
      } catch (err) {
        console.error(err);
        setError('⚠️ Failed to delete game');
      }
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout API error:', err);
    } finally {
      localStorage.removeItem('admin_auth');
      router.replace('/admin');
    }
  };


  return (
    <div className="admin-dashboard"> {/* Using admin-dashboard layout */}
      <div className="sidebar">
        <h1>Lucky Paw Admin</h1>
        <a className="nav-btn" href="/admin/dashboard">📋 Orders</a>
        <a className="nav-btn" href="/admin/games">🎮 Games</a>
        <a className="nav-btn" href="/admin/profit-loss">📊 Profit & Loss</a>
        <button className="nav-btn" onClick={logout}>🚪 Logout</button>
      </div>

      <div className="main-content">
        <h2 className="text-center mt-lg">🎮 Manage Games</h2>

        {editingGame ? (
          <form onSubmit={handleUpdateGame} className="form-inline mt-md">
            <input
              className="input"
              placeholder="Edit game name"
              value={editedGameName}
              onChange={(e) => setEditedGameName(e.target.value)}
              required
            />
            <button className="btn btn-primary ml-sm" type="submit">Update Game</button>
            <button className="btn btn-secondary ml-sm" type="button" onClick={() => setEditingGame(null)}>Cancel</button>
          </form>
        ) : (
          <form onSubmit={handleAddGame} className="form-inline mt-md">
            <input
              className="input"
              placeholder="Enter new game name"
              value={newGame}
              onChange={(e) => setNewGame(e.target.value)}
              required
            />
            <button className="btn btn-primary ml-sm" type="submit">Add Game</button>
          </form>
        )}

        {error && <div className="alert alert-danger mt-md">{error}</div>}

        <div className="card mt-lg">
          <h3 className="mb-sm">Available Games</h3>
          {games.length === 0 ? (
            <p>No games added yet.</p>
          ) : (
            // Updated game list styling
            <ul className="game-list">
              {games.map(game => (
                <li key={game.id}>
                  <span>{game.name}</span>
                  <div>
                    <button className="btn btn-sm btn-primary" onClick={() => handleEditClick(game)}>Edit</button>
                    <button className="btn btn-sm btn-danger ml-sm" onClick={() => handleDelete(game.id)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <style jsx>{`
        /* Styles for horizontal game list */
        .game-list {
          display: flex;
          flex-wrap: wrap; /* Allows items to wrap to the next line */
          gap: 1rem; /* Space between items */
          padding: 0;
          margin: 0;
          list-style: none; /* Remove bullet points */
        }

        .game-list li {
          background: #f0f0f0;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 0.75rem 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-grow: 1; /* Allow items to grow to fill space */
          max-width: calc(33% - 1rem); /* Roughly 3 items per row on wider screens */
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .game-list li span {
          font-weight: 500;
          margin-right: 1rem;
        }

        .game-list li div {
          display: flex;
          gap: 0.5rem;
        }

        /* Responsive adjustments for smaller screens */
        @media (max-width: 768px) {
          .game-list li {
            max-width: calc(50% - 0.75rem); /* 2 items per row */
          }
        }

        @media (max-width: 480px) {
          .game-list li {
            max-width: 100%; /* 1 item per row */
            flex-direction: column; /* Stack name and buttons vertically */
            align-items: flex-start;
          }
          .game-list li div {
            margin-top: 0.5rem;
            width: 100%;
            justify-content: flex-end;
          }
          .game-list li span {
            margin-bottom: 0.5rem;
          }
        }
      `}</style>
    </div>
  );
}