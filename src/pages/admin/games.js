// pages/admin/games.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db } from '../../lib/firebaseClient';
import { isAuthenticated } from '../../lib/auth'; // Adjust path as needed

// Add getServerSideProps for authentication
export async function getServerSideProps(context) {
  if (!isAuthenticated(context.req)) {
    return {
      redirect: {
        destination: '/admin',
        permanent: false,
      },
    };
  }
  return {
    props: {},
  };
}

export default function AdminGames() {
  const router = useRouter();
  const [games, setGames] = useState([]);
  const [newGame, setNewGame] = useState('');
  const [editingGame, setEditingGame] = useState(null);
  const [editedGameName, setEditedGameName] = useState('');
  const [error, setError] = useState('');

  // REMOVE THIS useEffect completely as authentication is now handled by getServerSideProps
  // useEffect(() => {
  //   if (typeof window !== 'undefined' && localStorage.getItem('admin_auth') !== '1') {
  //     router.replace('/admin');
  //   }
  // }, []);

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
    if (!newGame.trim()) {
      setError('Game name cannot be empty.');
      return;
    }
    try {
      await db.collection('games').add({ name: newGame.trim() });
      setNewGame('');
      setError('');
      loadGames(); // Reload games after adding
    } catch (err) {
      console.error(err);
      setError('⚠️ Failed to add game');
    }
  };

  const handleEditClick = (game) => {
    setEditingGame(game);
    setEditedGameName(game.name);
  };

  const handleUpdateGame = async (e) => {
    e.preventDefault();
    if (!editedGameName.trim()) {
      setError('Game name cannot be empty.');
      return;
    }
    try {
      await fetch('/api/admin/games/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingGame.id, name: editedGameName.trim() }),
      });
      setEditingGame(null);
      setEditedGameName('');
      setError('');
      loadGames(); // Reload games after updating
    } catch (err) {
      console.error(err);
      setError('⚠️ Failed to update game');
    }
  };

  const handleDeleteGame = async (id) => {
    if (!window.confirm('Are you sure you want to delete this game?')) {
      return;
    }
    try {
      await db.collection('games').doc(id).delete();
      setError('');
      loadGames(); // Reload games after deleting
    } catch (err) {
      console.error(err);
      setError('⚠️ Failed to delete game');
    }
  };

  return (
    <div className="container mt-xl">
      <h1 className="title text-center mb-lg">Manage Games</h1>

      <nav className="admin-nav mb-lg">
        <button className="btn btn-secondary" onClick={() => router.push('/admin/dashboard')}>Dashboard</button>
        <button className="btn btn-primary" onClick={() => router.push('/admin/games')}>Manage Games</button>
        <button className="btn btn-secondary" onClick={() => router.push('/admin/profit-loss')}>Profit/Loss</button>
      </nav>

      {error && <div className="alert alert-danger mt-md">{error}</div>}

      <div className="card mb-lg">
        <h2 className="card-header">Add New Game</h2>
        <form onSubmit={handleAddGame} className="card-body">
          <input
            type="text"
            className="input"
            placeholder="New game name"
            value={newGame}
            onChange={(e) => setNewGame(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-primary mt-md">Add Game</button>
        </form>
      </div>

      <div className="card">
        <h2 className="card-header">Existing Games</h2>
        <div className="card-body">
          {games.length === 0 ? (
            <p className="text-center">No games added yet.</p>
          ) : (
            <ul className="game-list">
              {games.map(game => (
                <li key={game.id}>
                  {editingGame && editingGame.id === game.id ? (
                    <form onSubmit={handleUpdateGame} style={{ display: 'flex', alignItems: 'center', flexGrow: 1, gap: '0.5rem' }}>
                      <input
                        type="text"
                        className="input"
                        value={editedGameName}
                        onChange={(e) => setEditedGameName(e.target.value)}
                        required
                      />
                      <button type="submit" className="btn btn-primary btn-sm">Save</button>
                      <button type="button" onClick={() => setEditingGame(null)} className="btn btn-secondary btn-sm">Cancel</button>
                    </form>
                  ) : (
                    <>
                      <span>{game.name}</span>
                      <div>
                        <button onClick={() => handleEditClick(game)} className="btn btn-secondary btn-sm">Edit</button>
                        <button onClick={() => handleDeleteGame(game.id)} className="btn btn-danger btn-sm">Delete</button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <style jsx>{`
        .admin-nav {
          display: flex;
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-lg);
          justify-content: center;
          flex-wrap: wrap;
        }
        .admin-nav .btn {
          min-width: 120px;
        }
        .game-list {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem; /* Adjust gap between items */
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
            max-width: 100%; /* Single column */
          }
        }
      `}</style>
    </div>
  );
}