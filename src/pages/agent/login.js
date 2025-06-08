// pages/agent/login.js
import { useState } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import { auth as firebaseClientAuth } from "../../lib/firebaseClient"; // Import client-side Firebase Auth

export default function AgentLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!username || !password) {
      setError("Username and password required");
      return;
    }

    setLoading(true);
    setError(""); // Clear previous errors
    try {
      // 1. Authenticate with your backend API
      const res = await axios.post("/api/agent/login", { username, password });

      if (res.data.success && res.data.token) {
        // 2. Use the custom token to sign in to Firebase Authentication on the client
        await firebaseClientAuth.signInWithCustomToken(res.data.token);
        console.log("Agent successfully signed in with Firebase Auth.");
        router.push("/agent"); // Redirect to dashboard after successful Firebase Auth sign-in
      } else {
        setError(res.data.error || "Login failed.");
      }
    } catch (err) {
      console.error("Login error:", err);
      // More specific error handling for network issues or API errors
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else {
        setError("Login failed. Please check your credentials and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-6 rounded shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-4">Agent Login</h1>
        {error && <p className="text-red-600 mb-3">{error}</p>}
        <input
          type="text"
          placeholder="Username"
          className="w-full p-2 mb-2 border rounded"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full p-2 mb-4 border rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          onClick={handleLogin}
          className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </div>
    </div>
  );
}