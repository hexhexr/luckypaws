// pages/api/agent/logout.js

export default function handler(req, res) {
  res.setHeader("Set-Cookie", `agent_auth=; Path=/; Max-Age=0`);
  res.status(200).end();
}
