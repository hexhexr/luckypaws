// pages/admin/games.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db, auth as firebaseAuth } from '../../lib/firebaseClient'; // Import auth for client-side Firebase
import { collection, query, orderBy, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';

export default function AdminGames() {
  const router = useRouter();
  const [games, setGames] = useState([]);
  const [newGame, setNewGame] = useState('');
  const [editingGame, setEditingGame] = useState(null); // { id, name } of game being edited
  const [editedGameName, setEditedGameName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true); // New loading state for auth and data
  const [addingGame, setAddingGame] = useState(false);
  const [updatingGame, setUpdatingGame] = useState(false);
  const [deletingGame, setDeletingGame] = useState(false);

  // Authentication check using onAuthStateChanged
  useEffect(() => {
    const unsubscribe = firebaseAuth.onAuthStateChanged(user => {
      if (!user) {
        // No user is signed in, redirect to admin login
        router.replace('/admin');
      } else {
        // User is signed in, proceed to load games
        loadGames();
      }
      setLoading(false); // Auth check complete
    });

    return () => unsubscribe(); // Cleanup the listener on component unmount
  }, [router]); // Depend on router to ensure redirect logic works

  const loadGames = async () => {
    setError('');
    try {
      // Ensure db is initialized before trying to use it
      if (!db) {
        console.error("Firestore DB not initialized.");
        setError('⚠️ Database not available. Please check Firebase configuration.');
        return;
      }
      const gamesCollectionRef = collection(db, 'games');
      const q = query(gamesCollectionRef, orderBy('name'));
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGames(list);
    } catch (err) {
      console.error("Error loading games:", err);
      setError(`⚠️ Failed to load games: ${err.message || 'Unknown error'}`);
    }
  };

  const handleAddGame = async (e) => {
    e.preventDefault();
    setError('');
    if (!newGame.trim()) {
      setError('Game name cannot be empty.');
      return;
    }
    setAddingGame(true);
    try {
      const gamesCollectionRef = collection(db, 'games');
      await addDoc(gamesCollectionRef, { name: newGame.trim() });
      setNewGame('');
      await loadGames(); // Reload games after adding
    } catch (err) {
      console.error("Error adding game:", err);
      setError(`⚠️ Failed to add game: ${err.message || 'Unknown error'}`);
    } finally {
      setAddingGame(false);
    }
  };

  const handleEditGame = (game) => {
    setEditingGame(game);
    setEditedGameName(game.name);
  };

  const handleSaveEdit = async () => {
    setError('');
    if (!editedGameName.trim()) {
      setError('Game name cannot be empty.');
      return;
    }
    if (!editingGame) return;

    setUpdatingGame(true);
    try {
      const gameDocRef = doc(db, 'games', editingGame.id);
      await updateDoc(gameDocRef, { name: editedGameName.trim() });
      setEditingGame(null);
      setEditedGameName('');
      await loadGames(); // Reload games after editing
    } catch (err) {
      console.error("Error updating game:", err);
      setError(`⚠️ Failed to update game: ${err.message || 'Unknown error'}`);
    } finally {
      setUpdatingGame(false);
    }
  };

  const handleDeleteGame = async (id) => {
    setError('');
    if (confirm('Are you sure you want to delete this game?')) {
      setDeletingGame(true);
      try {
        const gameDocRef = doc(db, 'games', id);
        await deleteDoc(gameDocRef);
        await loadGames(); // Reload games after deleting
      } catch (err) {
        console.error("Error deleting game:", err);
        setError(`⚠️ Failed to delete game: ${err.message || 'Unknown error'}`);
      } finally {
        setDeletingGame(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="ml-72 p-4 text-center">
        <p>Loading admin session and games...</p>
      </div>
    );
  }

  return (
    <div className="ml-72 p-4">
      <h1 className="text-2xl font-bold mb-4">Manage Games</h1>

      <div className="bg-white p-4 rounded shadow mb-6">
        <h2 className="text-xl font-semibold mb-3">Add New Game</h2>
        <form onSubmit={handleAddGame} className="flex gap-2">
          <input
            type="text"
            className="p-2 border rounded flex-grow"
            placeholder="New game name"
            value={newGame}
            onChange={(e) => setNewGame(e.target.value)}
            disabled={addingGame}
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            disabled={addingGame}
          >
            {addingGame ? 'Adding...' : 'Add Game'}
          </button>
        </form>
        {error && <p className="text-red-600 mt-2">{error}</p>}
      </div>

      <div className="bg-white shadow rounded overflow-auto max-h-[600px]">
        {games.length === 0 && !loading ? (
          <p className="p-4 text-center">No games found.</p>
        ) : (
          <ul className="game-list p-4 flex flex-wrap gap-4">
            {games.map((game) => (
              <li key={game.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3 text-lg font-medium shadow-sm">
                {editingGame?.id === game.id ? (
                  <>
                    <input
                      type="text"
                      className="p-1 border rounded flex-grow mr-2"
                      value={editedGameName}
                      onChange={(e) => setEditedGameName(e.target.value)}
                      disabled={updatingGame}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveEdit}
                        className="text-green-600 hover:text-green-800"
                        disabled={updatingGame}
                      >
                        {updatingGame ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => { setEditingGame(null); setError(''); }}
                        className="text-gray-600 hover:text-gray-800"
                        disabled={updatingGame}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span>{game.name}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditGame(game)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteGame(game.id)}
                        className="text-red-600 hover:text-red-800"
                        disabled={deletingGame}
                      >
                        {deletingGame ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <style jsx>{`
        .game-list {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
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
        @media (max-width: 768px) { /* md: equivalent */
          .game-list li {
            max-width: calc(50% - 0.75rem); /* 2 items per row */
          }
        }

        @media (max-width: 480px) {
          .game-list li {
            max-width: 100%; /* 1 item per row */
          }
        }
      `}</style>
    </div>
  );
}