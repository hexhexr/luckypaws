import { getFirestore } from "firebase-admin/firestore";
import { firebaseAdmin } from "../../../lib/firebaseAdmin"; // Ensure this path is correct
import { serialize } from "cookie";
import bcrypt from 'bcrypt'; // Import bcrypt

const db = getFirestore(firebaseAdmin);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end(); // Only allow POST requests
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  try {
    // Query the 'users' collection for admin authentication
    const query = await db.collection("users").where("username", "==", username).limit(1).get();

    if (query.empty) {
      console.log(`Admin login failed: Username '${username}' not found.`);
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const user = query.docs[0].data();

    // Check if the user role is 'admin'
    if (user.role !== "admin") {
      console.log(`Admin login failed: User '${username}' is not an admin.`);
      return res.status(403).json({ error: "Access denied. User is not an admin." });
    }

    // Compare the provided plain-text password with the stored hashed password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      console.log(`Admin login failed for '${username}': Password mismatch.`);
      return res.status(401).json({ error: "Invalid username or password." });
    }

    // Passwords match, proceed with setting cookie for admin session
    const cookie = serialize("admin_session", user.username, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 1 day
    });

    res.setHeader("Set-Cookie", cookie);
    console.log(`Admin '${username}' logged in successfully.`);
    return res.status(200).json({ success: true, message: "Login successful." });

  } catch (error) {
    console.error("Admin login API error:", error);
    return res.status(500).json({ error: "Internal server error during login." });
  }
}
