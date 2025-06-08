import { getFirestore } from "firebase-admin/firestore";
import { firebaseAdmin } from "../../../lib/firebaseAdmin";
import { serialize } from "cookie";
import bcrypt from 'bcryptjs'; // <--- ADD THIS LINE

const db = getFirestore(firebaseAdmin);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { username, password } = req.body; // 'password' here is the plain text password from the user trying to log in

  const query = await db.collection("agents").where("username", "==", username).limit(1).get();
  if (query.empty) return res.status(401).json({ error: "Not found" });

  const agent = query.docs[0].data();

  // --- START OF MODIFIED PASSWORD CHECK ---
  // Compare the plain text password from the request with the hashed password stored in Firebase
  const isPasswordValid = await bcrypt.compare(password, agent.password);

  if (!isPasswordValid) {
    return res.status(401).json({ error: "Wrong password" });
  }
  // --- END OF MODIFIED PASSWORD CHECK ---

  // Set cookie
  const cookie = serialize("agent_session", username, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 1 day
  });

  res.setHeader("Set-Cookie", cookie);
  res.status(200).json({ success: true });
}