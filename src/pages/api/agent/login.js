// pages/api/agent/login.js
import { getFirestore } from "firebase-admin/firestore";
import { auth as adminAuth } from "../../../lib/firebaseAdmin"; // Import admin auth
import bcrypt from 'bcryptjs';

const db = getFirestore(); // Use admin.firestore() after initializing app

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { username, password } = req.body;

  try {
    const query = await db.collection("agents").where("username", "==", username).limit(1).get();
    if (query.empty) {
      console.log(`Login attempt for non-existent user: ${username}`);
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const agentDoc = query.docs[0];
    const agent = agentDoc.data();

    // Use bcrypt.compare to check hashed password
    const isPasswordValid = await bcrypt.compare(password, agent.password);

    if (!isPasswordValid) {
      console.log(`Login attempt: Wrong password for user: ${username}`);
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // --- NEW: Generate Firebase Custom Token ---
    // The UID for the custom token can be the agent's username or a unique ID from their Firestore document.
    // Using agentDoc.id (which is the username in your current setup) as the UID is common.
    const firebaseUid = agentDoc.id;
    const customToken = await adminAuth.createCustomToken(firebaseUid, { agent: true }); // Add a custom claim
    console.log(`Custom token generated for agent: ${username}`);

    // --- IMPORTANT: Remove cookie logic, Firebase handles session via token ---
    // const cookie = serialize("agent_session", username, { ... });
    // res.setHeader("Set-Cookie", cookie);

    return res.status(200).json({ success: true, token: customToken, username: agent.username }); // Return token and username
  } catch (error) {
    console.error("Agent login API error:", error);
    return res.status(500).json({ error: "Internal server error during login." });
  }
}