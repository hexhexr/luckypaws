import { useState, useEffect } from 'react';
import { db } from '../../lib/firebaseClient';

export default function AdminGames() {
  const [games, setGames] = useState([]);
  const [newGame, setNewGame] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadGames = async () => {
      try {
        const snap = await db.collection('games').orderBy('name').get();
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setGames(list);
      } catch (err) {
        setError('Failed to load games');
      }
    };
    loadGames();
  }, []);

  const handleAddGame = async (e) => {
    e.preventDefault();
    setError('');
    if (!newGame.trim()) return;

    try {
      await db.collection('games').add({ name: newGame.trim() });
      setNewGame('');
      const snap = await db.collection('games').orderBy('name').get();
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGames(list);
    } catch (err) {
      setError('Error adding game');
    }
  };

  const handleDelete = async (id) => {
    try {
      await db.collection('games').doc(id).delete();
      setGames(games.filter(g => g.id !== id));
    } catch (err) {
      setError('Failed to delete game');
    }
  };

  return (
 
      <div className="main-content">
        <h2 className="text-center mt-lg">🎮 Manage Games</h2>
        <form onSubmit={handleAddGame}>
          <input
            className="input"
            placeholder="Add new game"
            value={newGame}
            onChange={(e) => setNewGame(e.target.value)}
          />
          <button className="btn btn-primary mt-md" type="submit">Add Game</button>
        </form>

        {error && <div className="alert alert-danger mt-md">{error}</div>}

        <div className="card mt-lg">
          <h3>Available Games</h3>
          <ul>
            {games.map(g => (
              <li key={g.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>{g.name}</span>
                <button className="btn btn-danger" onClick={() => handleDelete(g.id)}>Delete</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}