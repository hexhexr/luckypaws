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
    if (typeof window !== 'undefined' && localStorage.getItem('admin_auth') !== '1') {
      router.replace('/admin'); // Redirect to the admin login page
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
    </div>
  );
}