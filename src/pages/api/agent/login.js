import { getFirestore } from "firebase-admin/firestore";
import { verifyPassword } from "../../../lib/password"; // optional bcrypt if hashed

import { firebaseAdmin } from "../../../lib/firebaseAdmin";

const db = getFirestore(firebaseAdmin);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { username, password } = req.body;

  const snapshot = await db.collection("agents").where("username", "==", username).limit(1).get();

  if (snapshot.empty) {
    return res.status(401).json({ error: "Agent not found" });
  }

  const agent = snapshot.docs[0].data();

  // Use bcrypt compare if you hash passwords, or direct check:
  const isValid = agent.password === password;
  // const isValid = await verifyPassword(password, agent.hashedPassword);

  if (!isValid) {
    return res.status(401).json({ error: "Invalid password" });
  }

  res.status(200).json({ session: "ok", username: agent.username });
}
