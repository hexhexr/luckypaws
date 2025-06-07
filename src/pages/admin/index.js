// src/pages/admin/games.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { clientAuth, getAuthToken, hasRole } from '../../lib/clientAuth'; // Import from client-side auth helpers

const GamesPage = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true); // Start as loading to check auth state
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [games, setGames] = useState([]); // State to store fetched games data
  const [error, setError] = useState(null); // State to store any errors

  useEffect(() => {
    // Listener for Firebase authentication state changes
    const unsubscribe = clientAuth.onAuthStateChanged(async (user) => {
      if (user) {
        // User is logged in, now check their custom role
        const userIsAdmin = await hasRole('admin'); // Uses getAuthTokenResult to check claims
        if (userIsAdmin) {
          setIsAdminUser(true);
          await fetchGamesData(); // Fetch games data only if the user is an admin
        } else {
          // User is logged in but not an admin, redirect them
          router.push('/admin/login');
        }
      } else {
        // No user logged in, redirect to login page
        router.push('/admin/login');
      }
      setLoading(false); // Authentication check is complete
    });

    // Cleanup the listener when the component unmounts
    return () => unsubscribe();
  }, []); // Empty dependency array means this effect runs once on mount

  const fetchGamesData = async () => {
    setError(null); // Clear any previous errors before fetching
    try {
      const token = await getAuthToken(); // Get the user's ID token for API authorization
      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }

      // Make API call to your server-side API (e.g., /api/admin/games)
      const response = await fetch('/api/admin/games', {
        headers: {
          'Authorization': `Bearer ${token}`, // Send the token in the Authorization header
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 403) {
            // Specific handling for Forbidden access
            throw new Error('Access Denied: You do not have permission to view games.');
        }
        throw new Error(errorData.message || 'Failed to fetch games.');
      }

      const data = await response.json();
      setGames(data); // Set the fetched games data to state
    } catch (err) {
      console.error("Error fetching games:", err);
      setError(err.message); // Set error message
      // If unauthorized or forbidden, log out the user and redirect to login
      if (err.message.includes('Access Denied') || err.message.includes('Unauthorized')) {
          clientAuth.signOut(); // Log out potentially invalid session
          router.push('/admin/login');
      }
    }
  };

  if (loading) {
    return <div>Loading page and verifying access...</div>;
  }

  if (!isAdminUser) {
    // This state should ideally be brief as the useEffect should redirect quickly
    return <div>Access Denied. Redirecting to login...</div>;
  }

  return (
    <div>
      <h1>Admin Games Management</h1>
      <p>Welcome, Admin! Here you can manage games.</p>
      {error && <p style={{ color: 'red', marginTop: '10px' }}>Error: {error}</p>}

      {games.length === 0 && !error ? (
        <p>No games found. Add some games!</p>
      ) : (
        <div>
          <h2>Current Games:</h2>
          <ul>
            {games.map((game) => (
              // Adjust these fields based on your actual game data structure
              <li key={game.id}>
                <strong>{game.name || 'Unnamed Game'}</strong> (Code: {game.pageCode || 'N/A'}) - Added By: {game.addedByAdminId || 'Unknown Admin'}
                {/* Add edit/delete buttons here */}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* You can add forms/buttons for adding/editing games here */}
    </div>
  );
};

export default GamesPage;