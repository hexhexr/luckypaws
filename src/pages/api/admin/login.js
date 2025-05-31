// pages/api/admin/login.js
// This API route handles custom username/password validation for admin login.

export default async function handler(req, res) {
  // Ensure only POST requests are allowed for login attempts.
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { username, password } = req.body;

  // --- DEBUGGING LOGS ---
  console.log('--- Admin Login Attempt ---');
  console.log('Received Username:', username);
  console.log('Received Password:', password ? '********' : 'undefined'); // Mask password for security in logs

  // Load environment variables directly within the handler for debugging
  const VALID_ADMIN_USERNAME = process.env.ADMIN_USERNAME;
  const VALID_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  console.log('Expected Username (from env):', VALID_ADMIN_USERNAME);
  console.log('Expected Password (from env):', VALID_ADMIN_PASSWORD ? '********' : 'undefined'); // Mask password

  // --- IMPORTANT: REPLACE THIS WITH YOUR ACTUAL SECURE ADMIN VALIDATION LOGIC ---
  // This is a placeholder for your existing admin username and password validation.
  // In a real application, you would typically fetch these credentials from a secure
  // database or environment variables and compare them securely (e.g., using hashing).

  // Perform the custom validation
  if (username === VALID_ADMIN_USERNAME && password === VALID_ADMIN_PASSWORD) {
    console.log('Admin login: Credentials MATCHED.');
    // If validation passes, return a success response.
    // The client-side (pages/admin/index.js) will then set localStorage and redirect.
    return res.status(200).json({ success: true, message: 'Admin login successful.' });
  } else {
    console.log('Admin login: Credentials MISMATCH.');
    // If validation fails, return an unauthorized error.
    return res.status(401).json({ success: false, message: 'Invalid username or password.' });
  }
}
