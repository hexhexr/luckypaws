import { serialize } from "cookie";

export default function handler(req, res) {
  const cookie = serialize("agent_session", "", {
    path: "/",
    httpOnly: true,
    maxAge: 0,
  });

  res.setHeader("Set-Cookie", cookie);
  res.status(200).json({ message: "Logged out" });
}
