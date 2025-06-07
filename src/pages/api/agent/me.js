// pages/api/agent/me.js

export default function handler(req, res) {
  const cookie = req.headers.cookie || "";
  const isAuth = cookie.includes("agent_auth=true");

  if (!isAuth) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  res.status(200).json({ message: "Authenticated" });
}
