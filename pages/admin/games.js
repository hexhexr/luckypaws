import { useState, useEffect } from 'react';
import { db } from '../../lib/firebaseClient';

export default function AdminGames() {
  const [games, setGames] = useState([]);
  const [newGame, setNewGame] = useState('');
  const [error, setError] = useState('');

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
      await loadGames();
    } catch (err) {
      console.error(err);
      setError('⚠️ Error adding game');
    }
  };

  const handleDelete = async (id) => {
    try {
      await db.collection('games').doc(id).delete();
      setGames(games.filter(g => g.id !== id));
    } catch (err) {
      console.error(err);
      setError('⚠️ Failed to delete game');
    }
  };

  return (
    <div className="main-content">
      <h2 className="text-center mt-lg">🎮 Manage Games</h2>

      <form onSubmit={handleAddGame} className="form-inline mt-md">
        <input
          className="input"
          placeholder="Enter game name"
          value={newGame}
          onChange={(e) => setNewGame(e.target.value)}
        />
        <button className="btn btn-primary ml-sm" type="submit">Add Game</button>
      </form>

      {error && <div className="alert alert-danger mt-md">{error}</div>}

      <div className="card mt-lg">
        <h3 className="mb-sm">Available Games</h3>
        {games.length === 0 ? (
          <p>No games added yet.</p>
        ) : (
          <ul className="game-list">
            {games.map(g => (
              <li key={g.id} className="game-item">
                <span>{g.name}</span>
                <button className="btn btn-danger" onClick={() => handleDelete(g.id)}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
