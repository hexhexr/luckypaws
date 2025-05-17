import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { db } from '../../lib/firebaseClient';

export default function AdminGames() {
  const router = useRouter();
  const [games, setGames] = useState([]);
  const [newGame, setNewGame] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('admin_auth') !== '1') {
      router.replace('/admin/login');
    }
    db.collection('games').orderBy('name').get().then(snapshot => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGames(list);
    });
  }, []);

  const addGame = async e => {
    e.preventDefault();
    if (!newGame.trim()) return;
    const ref = await db.collection('games').add({ name: newGame.trim() });
    setGames([...games, { id: ref.id, name: newGame.trim() }]);
    setNewGame('');
  };

  const deleteGame = async id => {
    await db.collection('games').doc(id).delete();
    setGames(games.filter(g => g.id !== id));
  };

  return (
    <div className="container mt-lg">
      <div className="card">
        <h2 className="text-center card-header">🎮 Manage Games</h2>
        <form onSubmit={addGame}>
          <input className="input" placeholder="Enter new game name" value={newGame} onChange={(e) => setNewGame(e.target.value)} />
          <button className="btn btn-primary" type="submit">Add Game</button>
        </form>
        <ul className="mt-md">
          {games.map(game => (
            <li key={game.id} style={{ display: 'flex', justifyContent: 'space-between', margin: '0.5rem 0' }}>
              <span>{game.name}</span>
              <button className="btn btn-danger btn-sm" onClick={() => deleteGame(game.id)}>Delete</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
