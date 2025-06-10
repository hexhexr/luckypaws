// src/pages/api/admin/login.js
// This API route is no longer used for the primary admin login
// because authentication is now handled directly by Firebase's client-side SDK.
// You can safely remove this file if it served no other purpose.

export default async function handler(req, res) {
  console.warn("WARN: /api/admin/login was accessed but is deprecated for primary admin login. Authentication is now handled client-side with Firebase Auth.");
  return res.status(405).json({ message: 'Method Not Allowed. Admin login is handled directly by Firebase Auth client-side.' });
}