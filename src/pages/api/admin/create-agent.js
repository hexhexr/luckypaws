import { getFirestore } from "firebase-admin/firestore";
import { firebaseAdmin } from "../../../lib/firebaseAdmin";
import bcrypt from 'bcryptjs';

const db = getFirestore(firebaseAdmin);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { username, email, password, name } = req.body;

  if (!username || !email || !password || !name) {
    return res.status(400).json({ message: "Username, Email, Password, and Name are required." });
  }

  try {
    // Check for duplicate username
    const usernameExists = await db.collection("agents")
      .where("username", "==", username)
      .limit(1).get();
    if (!usernameExists.empty) {
      return res.status(409).json({ message: "Agent with this username already exists." });
    }

    // Check for duplicate email
    const emailExists = await db.collection("agents")
      .where("email", "==", email)
      .limit(1).get();
    if (!emailExists.empty) {
      return res.status(409).json({ message: "Agent with this email already exists." });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Add agent to 'agents' collection
    const agentRef = await db.collection("agents").add({
      username,
      email,
      password: hashedPassword,
      name,
      role: 'agent',
      createdAt: new Date().toISOString(),
      status: 'active'
    });

    const agentId = agentRef.id;

    // Add mirror entry to 'users' collection for frontend access
    await db.collection("users").doc(agentId).set({
      username,
      email,
      name,
      role: 'agent',
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({ success: true, message: "Agent created successfully!" });

  } catch (error) {
    console.error("Error creating agent:", error);
    res.status(500).json({ message: `Failed to create agent: ${error.message}` });
  }
}
