// pages/api/generate-username.js
import { db } from '../../lib/firebaseAdmin'; // Adjust path to firebaseAdmin
import crypto from 'crypto'; // For generating random suffixes if needed

// Helper function to sanitize the Facebook name for username creation
function sanitizeName(name) {
  // Convert to lowercase, replace spaces with hyphens, and remove non-alphanumeric characters
  // except hyphens and underscores.
  return name
    .toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^a-z0-9-_]/g, ''); // Remove non-alphanumeric except hyphens/underscores
}

// Helper function to generate a unique username
async function generateUniqueUsername(baseName, pageCode, attempts = 0) {
  let proposedUsername = baseName;

  if (pageCode) {
    proposedUsername += `-${pageCode}`; // Append page code
  }

  // If this is not the first attempt, append a random suffix to ensure uniqueness
  if (attempts > 0) {
    const randomSuffix = crypto.randomBytes(3).toString('hex'); // 6 hex characters
    proposedUsername += `-${randomSuffix}`;
  }

  // Check if username already exists in the 'usernames' collection
  const usernameRef = db.collection('usernames');
  const snapshot = await usernameRef.where('username', '==', proposedUsername).get();

  if (snapshot.empty) {
    // If the username is not found, it's unique
    return proposedUsername;
  } else {
    // If found, recursively call to generate another one with an incremented attempt count
    return generateUniqueUsername(baseName, pageCode, attempts + 1);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { facebookName } = req.body;

  if (!facebookName || typeof facebookName !== 'string' || facebookName.trim() === '') {
    return res.status(400).json({ message: 'Facebook name is required.' });
  }

  // Retrieve the page code from environment variables
  // IMPORTANT: Set this in your Vercel project's environment variables (e.g., PAGE_CODE=mygamecode)
  const pageCode = process.env.PAGE_CODE || ''; // Use an empty string if not set

  try {
    // 1. Sanitize the Facebook name to create a base for the username
    const baseUsername = sanitizeName(facebookName);
    if (!baseUsername) {
      return res.status(400).json({ message: 'Could not generate a base username from the provided Facebook name.' });
    }

    // 2. Generate a unique username by checking the database
    const uniqueUsername = await generateUniqueUsername(baseUsername, pageCode);

    // 3. Save the username and Facebook name to the database
    const newUsernameRef = db.collection('usernames').doc(); // Create a new document with an auto-generated ID
    await newUsernameRef.set({
      id: newUsernameRef.id,
      username: uniqueUsername,
      facebookName: facebookName,
      createdAt: new Date().toISOString() // Timestamp for record-keeping
    });

    res.status(200).json({
      success: true,
      message: 'Username generated and saved successfully.',
      username: uniqueUsername,
      facebookName: facebookName
    });

  } catch (error) {
    console.error('Error generating or saving username:', error);
    res.status(500).json({ message: `Failed to generate username: ${error.message}` });
  }
}