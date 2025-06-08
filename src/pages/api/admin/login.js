// src/pages/api/agent/login.js
import { getFirestore } from "firebase-admin/firestore";
import { firebaseAdmin } from "../../../lib/firebaseAdmin"; // Ensure this path is correct
import { serialize } from "cookie";
import bcrypt from 'bcrypt'; // Import bcrypt

const db = getFirestore(firebaseAdmin);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  try {
    const query = await db.collection("agents").where("username", "==", username).limit(1).get();

    if (query.empty) {
      console.log(`Agent login failed: Username '${username}' not found.`);
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const agent = query.docs[0].data();

    // Compare the provided plain-text password with the stored hashed password
    const passwordMatch = await bcrypt.compare(password, agent.password);

    if (!passwordMatch) {
      console.log(`Agent login failed for '${username}': Password mismatch.`);
      return res.status(401).json({ error: "Invalid username or password." });
    }

    // Passwords match, proceed with setting cookie
    const cookie = serialize("agent_session", agent.username, { // Use agent.username to ensure it's the one from DB
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 1 day
    });

    res.setHeader("Set-Cookie", cookie);
    console.log(`Agent '${username}' logged in successfully.`);
    return res.status(200).json({ success: true, message: "Login successful." });

  } catch (error) {
    console.error("Agent login API error:", error);
    return res.status(500).json({ error: "Internal server error during login." });
  }
}