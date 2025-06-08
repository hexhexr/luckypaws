import { getFirestore } from "firebase-admin/firestore";
import { firebaseAdmin } from "../../../lib/firebaseAdmin"; // Ensure correct path to firebaseAdmin
import bcrypt from 'bcryptjs';

const db = getFirestore(firebaseAdmin);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { username, email, password, name } = req.body; // You can add more fields as needed

  // Basic validation
  if (!username || !email || !password || !name) {
    return res.status(400).json({ message: "Username, Email, Password, and Name are required." });
  }

  try {
    // Check if agent with username or email already exists
    const usernameExists = await db.collection("agents").where("username", "==", username).limit(1).get();
    if (!usernameExists.empty) {
      return res.status(409).json({ message: "Agent with this username already exists." });
    }

    const emailExists = await db.collection("agents").where("email", "==", email).limit(1).get();
    if (!emailExists.empty) {
      return res.status(409).json({ message: "Agent with this email already exists." });
    }

    // Hash the plain text password
    const hashedPassword = await bcrypt.hash(password, 10); // 10 is the salt rounds (cost factor)

    // Add the new agent to the 'agents' collection
    await db.collection("agents").add({
      username: username,
      email: email,
      password: hashedPassword, // Store the hashed password
      name: name,
      role: 'agent', // Assign a role, useful for permissions
      createdAt: new Date().toISOString(),
      status: 'active' // Initial status
    });

    res.status(201).json({ success: true, message: "Agent created successfully!" });

  } catch (error) {
    console.error("Error creating agent:", error);
    res.status(500).json({ message: `Failed to create agent: ${error.message}` });
  }
}