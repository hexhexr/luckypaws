import { serialize } from 'cookie';

export default function handler(req, res) {
  const { ADMIN_USER = 'admin', ADMIN_PASS = '123456' } = process.env;

  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    res.setHeader('Set-Cookie', serialize('admin_auth', 'authenticated', {
      path: '/',
      maxAge: 3600,
      httpOnly: true,
      sameSite: 'lax'
    }));
    return res.status(200).json({ success: true });
  }

  return res.status(401).json({ message: 'Invalid credentials' });
}
