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
    .replace(/[^a-z]/g, ''); // ONLY keep alphabets for the initial 5 chars
}

// Helper function to generate a unique username
async function generateUniqueUsername(facebookName, pageCode, attempts = 0) {
  const sanitizedFacebookName = sanitizeName(facebookName);

  // Take the first 5 alphabetic characters from the sanitized name
  const namePrefix = sanitizedFacebookName.substring(0, 5);

  let proposedUsername = `${namePrefix}${pageCode.toLowerCase()}`;

  // If this is not the first attempt or if the initial username already exists, append a random suffix
  // This helps ensure uniqueness even if multiple users have very similar names/page codes.
  if (attempts > 0 || (await checkIfUsernameExists(proposedUsername))) {
    const randomSuffix = crypto.randomBytes(2).toString('hex'); // 4 hex characters
    proposedUsername = `${namePrefix}${pageCode.toLowerCase()}-${randomSuffix}`;
  }


  // Final check if username already exists in the 'usernames' collection
  const usernameRef = db.collection('usernames');
  const snapshot = await usernameRef.where('username', '==', proposedUsername).get();

  if (snapshot.empty) {
    return proposedUsername;
  } else {
    // If the username is still found (very rare after suffix), try again
    return generateUniqueUsername(facebookName, pageCode, attempts + 1);
  }
}

async function checkIfUsernameExists(username) {
  const usernameRef = db.collection('usernames');
  const snapshot = await usernameRef.where('username', '==', username).get();
  return !snapshot.empty;
}


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { facebookName, pageCode } = req.body;

  if (!facebookName || typeof facebookName !== 'string' || facebookName.trim() === '') {
    return res.status(400).json({ message: 'Facebook name is required.' });
  }
  if (!pageCode || typeof pageCode !== 'string' || pageCode.trim() === '') {
    return res.status(400).json({ message: 'Page Code is required.' });
  }

  try {
    // Generate a single unique username
    const uniqueUsername = await generateUniqueUsername(facebookName, pageCode);

    // Save the username and Facebook name to the database
    const newUsernameRef = db.collection('usernames').doc(); // Create a new document with an auto-generated ID
    await newUsernameRef.set({
      id: newUsernameRef.id,
      username: uniqueUsername,
      facebookName: facebookName,
      pageCode: pageCode, // Store the page code used
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