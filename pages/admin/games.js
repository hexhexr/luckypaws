import { useEffect, useState } from 'react';
import { db } from '../../lib/firebaseClient';
import Link from 'next/link';

export default function GameManagementPage() {
  const [games, setGames] = useState([]);
  const [newGame, setNewGame] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchGames = async () => {
    const snapshot = await db.collection('games').orderBy('name').get();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setGames(data);
  };

  useEffect(() => {
    fetchGames();
  }, []);

  const handleAddGame = async e => {
    e.preventDefault();
    if (!newGame.trim()) return;
    setLoading(true);
    await db.collection('games').add({ name: newGame.trim() });
    setNewGame('');
    await fetchGames();
    setLoading(false);
  };

  const handleDeleteGame = async id => {
    await db.collection('games').doc(id).delete();
    await fetchGames();
  };

  return (
    <div className="pl-section">
      <nav className="sidebar-menu">
        <Link href="/admin/dashboard" className="nav-btn">📊 Dashboard</Link>
        <Link href="/admin/profit-loss" className="nav-btn">💰 Profit & Loss</Link>
        <Link href="/admin/games" className="nav-btn active">🎮 Manage Games</Link>
      </nav>

      <h1>🎮 Game List</h1>

      <form onSubmit={handleAddGame} className="entry-form">
        <input
          type="text"
          placeholder="Enter new game name"
          value={newGame}
          onChange={e => setNewGame(e.target.value)}
        />
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Adding...' : 'Add Game'}
        </button>
      </form>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Game Name</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {games.map(game => (
              <tr key={game.id}>
                <td>{game.name}</td>
                <td>
                  <button className="btn btn-danger" onClick={() => handleDeleteGame(game.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
