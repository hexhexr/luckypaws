import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { db } from '../../lib/firebaseClient';

export default function AdminGames() {
  const router = useRouter();
  const [games, setGames] = useState([]);
  const [newGame, setNewGame] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('admin_auth') !== '1') {
      router.replace('/admin/login');
    }
  }, []);

  useEffect(() => {
    const loadGames = async () => {
      const snap = await db.collection('games').orderBy('name').get();
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGames(list);
      setLoading(false);
    };
    loadGames();
  }, []);

  const addGame = async e => {
    e.preventDefault();
    if (!newGame) return;
    const docRef = await db.collection('games').add({ name: newGame });
    setGames([...games, { id: docRef.id, name: newGame }]);
    setNewGame('');
  };

  const deleteGame = async id => {
    await db.collection('games').doc(id).delete();
    setGames(games.filter(g => g.id !== id));
  };

  return (
    <div className="container mt-lg">
      <div className="card">
        <h2 className="text-center">🎮 Manage Games</h2>
        <form onSubmit={addGame} className="mt-md">
          <input
            className="input"
            placeholder="Enter new game name"
            value={newGame}
            onChange={e => setNewGame(e.target.value)}
            required
          />
          <button className="btn btn-primary mt-sm" type="submit">Add Game</button>
        </form>

        {loading ? (
          <p className="mt-md text-center">Loading games...</p>
        ) : games.length === 0 ? (
          <p className="mt-md text-center">No games added yet.</p>
        ) : (
          <ul className="mt-md">
            {games.map(game => (
              <li key={game.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>{game.name}</span>
                <button className="btn btn-danger btn-sm" onClick={() => deleteGame(game.id)}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
