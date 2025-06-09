// src/pages/api/admin/login.js
import { getFirestore } from "firebase-admin/firestore";
import { firebaseAdmin } from "../../../lib/firebaseAdmin";
import { serialize } from "cookie";
import bcrypt from 'bcrypt';
import { auth as adminAuth } from 'firebase-admin/auth'; // Import admin auth

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
    const query = await db.collection("admins").where("username", "==", username).limit(1).get(); // Assuming 'admins' collection

    if (query.empty) {
      console.log(`Admin login failed: Username '${username}' not found.`);
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const adminUser = query.docs[0].data();

    const passwordMatch = await bcrypt.compare(password, adminUser.password);

    if (!passwordMatch) {
      console.log(`Admin login failed for '${username}': Password mismatch.`);
      return res.status(401).json({ error: "Invalid username or password." });
    }

    // Passwords match, create a custom token for Firebase client-side auth
    const customToken = await adminAuth.createCustomToken(adminUser.uid); // Assuming adminUser has a 'uid' field

    // Create a session cookie
    // Set a long-lived cookie for the admin session
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days, adjust as needed
    const sessionCookie = await adminAuth.createSessionCookie(customToken, { expiresIn });

    res.setHeader(
      "Set-Cookie",
      serialize("admin_session", sessionCookie, { // <-- This is the key change: use 'admin_session'
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // Use secure cookies in production
        sameSite: "lax",
        maxAge: expiresIn / 1000, // maxAge is in seconds
      })
    );

    console.log(`Admin '${username}' logged in successfully.`);
    return res.status(200).json({ success: true, message: 'Logged in successfully', token: customToken }); // Respond with custom token for client-side Firebase login
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ error: "Internal server error during login." });
  }
}