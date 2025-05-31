import { serialize } from 'cookie';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username, password } = req.body;
  const { ADMIN_USER = 'admin', ADMIN_PASS = '123456' } = process.env;

  if (!username || !password) {
    return res.status(400).json({ message: 'Missing credentials' });
  }

  const isValid = username === ADMIN_USER && password === ADMIN_PASS;

  if (!isValid) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  res.setHeader('Set-Cookie', serialize('admin_auth', 'authenticated', {
    path: '/',
    maxAge: 60 * 60,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }));

  return res.status(200).json({ success: true });
}
