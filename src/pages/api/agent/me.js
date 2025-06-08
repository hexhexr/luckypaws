import { parse } from "cookie";

export default function handler(req, res) {
  const cookies = parse(req.headers.cookie || "");
  const session = cookies.agent_session;

  if (!session) {
    return res.status(401).json({ error: "Not logged in" });
  }

  res.status(200).json({ username: session });
}
