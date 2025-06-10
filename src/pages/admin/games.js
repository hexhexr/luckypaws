// pages/admin/games.js
import { useState, useEffect, useCallback } from 'react'; // Import useCallback
import { useRouter } from 'next/router';
import Head from 'next/head'; // Import Head for page title

// Import Firebase client-side SDK elements
import { db, auth as firebaseAuth } from '../../lib/firebaseClient';
import { collection, query, orderBy, onSnapshot, addDoc, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';


export default function AdminGames() {
  const router = useRouter();

  // --- AUTHENTICATION STATES ---
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // --- GAME MANAGEMENT STATES ---
  const [games, setGames] = useState([]);
  const [newGame, setNewGame] = useState('');
  const [editingGame, setEditingGame] = useState(null); // { id, name } of game being edited
  const [editedGameName, setEditedGameName] = useState('');
  const [error, setError] = useState('');

  // --- AUTHENTICATION AND ROLE CHECK (Same as dashboard.js & cashouts.js) ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (user) {
        // User is signed in, now check their role in Firestore
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists() && userDocSnap.data()?.isAdmin) {
            setIsAdmin(true);
            setLoading(false);
          } else {
            // User is signed in but not an admin
            console.log('User is not an admin. Redirecting.');
            await firebaseAuth.signOut(); // Sign them out
            router.replace('/admin');
          }
        } catch (e) {
          console.error("Error checking admin role:", e);
          await firebaseAuth.signOut(); // Sign out on error
          router.replace('/admin');
        }
      } else {
        // No user is signed in
        console.log('No user signed in. Redirecting to admin login.');
        router.replace('/admin');
      }
    });

    return () => unsubscribe(); // Clean up auth listener
  }, [router]);


  // --- LOGOUT FUNCTION (Same as dashboard.js & cashouts.js) ---
  const logout = useCallback(async () => {
    try {
      await firebaseAuth.signOut();
      router.push('/admin');
    } catch (err) {
      console.error("Logout error:", err);
      alert('Failed to logout. Please try again.');
    }
  }, [router]);


  // --- GAME LOADING LOGIC ---
  const loadGames = useCallback(async () => {
    if (!isAdmin) return; // Only load games if user is confirmed admin
    try {
      setError(''); // Clear previous errors
      const gamesQuery = query(collection(db, 'games'), orderBy('name'));
      const unsubscribe = onSnapshot(gamesQuery, (snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setGames(list);
      }, (err) => {
        console.error("Error fetching games:", err);
        setError('⚠️ Failed to load games');
      });
      return () => unsubscribe(); // Return unsubscribe for cleanup
    } catch (err) {
      console.error(err);
      setError('⚠️ Failed to load games');
    }
  }, [isAdmin]); // Depend on isAdmin

  useEffect(() => {
    // This useEffect will trigger loadGames once isAdmin becomes true
    let unsubscribeFromGames;
    if (isAdmin) {
      unsubscribeFromGames = loadGames();
    }
    return () => {
      if (unsubscribeFromGames) {
        unsubscribeFromGames(); // Cleanup the games listener
      }
    };
  }, [isAdmin, loadGames]);


  // --- CRUD OPERATIONS FOR GAMES ---
  const handleAddGame = async (e) => {
    e.preventDefault();
    setError('');
    if (!newGame.trim()) {
      setError('Game name cannot be empty.');
      return;
    }
    try {
      await addDoc(collection(db, 'games'), { name: newGame.trim() });
      setNewGame('');
      // loadGames() will be triggered by the onSnapshot listener, updating the state automatically
    } catch (err) {
      console.error("Error adding game:", err);
      setError('Failed to add game.');
    }
  };

  const handleEditClick = (game) => {
    setEditingGame(game);
    setEditedGameName(game.name);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setError('');
    if (!editedGameName.trim() || !editingGame) {
      setError('Edited game name cannot be empty.');
      return;
    }
    try {
      const gameRef = doc(db, 'games', editingGame.id);
      await updateDoc(gameRef, { name: editedGameName.trim() });
      setEditingGame(null);
      setEditedGameName('');
      // loadGames() will be triggered by the onSnapshot listener
    } catch (err) {
      console.error("Error updating game:", err);
      setError('Failed to update game.');
    }
  };

  const handleCancelEdit = () => {
    setEditingGame(null);
    setEditedGameName('');
  };

  const handleDeleteGame = async (id) => {
    setError('');
    if (window.confirm('Are you sure you want to delete this game? This action cannot be undone.')) {
      try {
        await deleteDoc(doc(db, 'games', id));
        // loadGames() will be triggered by the onSnapshot listener
      } catch (err) {
        console.error("Error deleting game:", err);
        setError('Failed to delete game.');
      }
    }
  };


  // --- CONDITIONAL RENDERING FOR LOADING/ACCESS ---
  if (loading) {
    return (
      <div className="container mt-lg text-center">
        <p>Loading admin panel...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container mt-lg text-center">
        <p>Access Denied. You are not authorized to view this page.</p>
      </div>
    );
  }


  return (
    <div className="admin-games-container">
      <Head>
        <title>Admin Games</title>
      </Head>
      <header className="admin-header">
        <h1>Manage Games</h1>
        <nav>
          <ul className="admin-nav">
            <li><a href="/admin/dashboard" className={router.pathname === "/admin/dashboard" ? "active" : ""}>Dashboard</a></li>
            <li><a href="/admin/cashouts" className={router.pathname === "/admin/cashouts" ? "active" : ""}>Cashouts</a></li>
            <li><a href="/admin/games" className={router.pathname === "/admin/games" ? "active" : ""}>Games</a></li>
            <li><a href="/admin/profit-loss" className={router.pathname === "/admin/profit-loss" ? "active" : ""}>Profit/Loss</a></li>
            <li><button onClick={logout} className="btn btn-secondary">Logout</button></li>
          </ul>
        </nav>
      </header>

      <div className="admin-main">
        <section className="add-game-section">
          <h2>{editingGame ? 'Edit Game' : 'Add New Game'}</h2>
          <div className="card">
            <form onSubmit={editingGame ? handleSaveEdit : handleAddGame}>
              <input
                type="text"
                className="input"
                value={editingGame ? editedGameName : newGame}
                onChange={(e) => editingGame ? setEditedGameName(e.target.value) : setNewGame(e.target.value)}
                placeholder="Game Name"
                required
              />
              <div className="button-group mt-md">
                <button className="btn btn-primary" type="submit">
                  {editingGame ? 'Save Changes' : 'Add Game'}
                </button>
                {editingGame && (
                  <button className="btn btn-secondary ml-sm" type="button" onClick={handleCancelEdit}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
            {error && <div className="alert alert-danger mt-md">{error}</div>}
          </div>
        </section>

        <section className="game-list-section mt-lg">
          <h2>Existing Games</h2>
          <div className="card">
            {games.length === 0 && !loading ? (
              <p className="text-center">No games added yet.</p>
            ) : (
              <ul className="game-list">
                {games.map(game => (
                  <li key={game.id}>
                    <span>{game.name}</span>
                    <div>
                      <button className="btn btn-info btn-small" onClick={() => handleEditClick(game)}>Edit</button>
                      <button className="btn btn-danger btn-small" onClick={() => handleDeleteGame(game.id)}>Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}