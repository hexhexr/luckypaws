// pages/api/generate-username.js
import { db } from '../../lib/firebaseAdmin'; // Ensure this path is correct for your Firebase Admin SDK

// Helper function to sanitize the Facebook name
function sanitizeName(name) {
  // Convert to lowercase, remove non-alphabetic characters, and remove 'i' and 'l'
  return name.toLowerCase().replace(/[^a-z]/g, '').replace(/[il]/g, '');
}

// Helper function to get possible prefixes from the sanitized name
function getPossibleNamePrefixes(sanitizedName) {
  const prefixes = new Set();
  if (sanitizedName.length > 0) {
    // Add the first 5 characters (or less if name is shorter)
    prefixes.add(sanitizedName.substring(0, Math.min(sanitizedName.length, 5)));
  }
  // If the name is longer than 5, try other 5-character segments
  if (sanitizedName.length > 5) {
    for (let i = 1; i <= sanitizedName.length - 5; i++) {
      prefixes.add(sanitizedName.substring(i, i + 5));
    }
  }
  return Array.from(prefixes);
}

// Helper function to check if a username already exists in Firestore
async function checkIfUsernameExists(username) {
  const snapshot = await db.collection('usernames').where('username', '==', username).get();
  return !snapshot.empty;
}

export default async function handler(req, res) {
  // Ensure only POST requests are allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { facebookName, pageCode } = req.body;

  // Validate incoming data
  if (!facebookName || typeof facebookName !== 'string' || facebookName.trim() === '') {
    return res.status(400).json({ message: 'Facebook name is required.' });
  }
  // Page code must be a 4-digit number
  if (!pageCode || typeof pageCode !== 'string' || !/^\d{4}$/.test(pageCode)) {
    return res.status(400).json({ message: 'Page Code must be a 4-digit number.' });
  }

  try {
    const sanitizedName = sanitizeName(facebookName);
    if (!sanitizedName) {
      return res.status(400).json({ message: 'Invalid Facebook name: no usable characters left after sanitizing.' });
    }

    const originalPrefix = sanitizedName.substring(0, Math.min(sanitizedName.length, 5));
    const namePrefixes = getPossibleNamePrefixes(sanitizedName);
    const suffix = pageCode.toLowerCase(); // Use pageCode as suffix
    let finalUsername = null;

    // Attempt to generate a username using direct prefixes
    for (const prefix of namePrefixes) {
      const proposed = `${prefix}${suffix}`;
      if (!(await checkIfUsernameExists(proposed))) {
        finalUsername = proposed;
        break;
      }
    }

    // If no direct prefix works, try mutating the base prefix
    if (!finalUsername) {
      const availableChars = 'abcdefghjkmnopqrstuvwxyz'; // Excludes 'i' and 'l'
      const base = originalPrefix.padEnd(5, 'a'); // Ensure base is at least 5 chars for mutation
      const maxAttempts = 10000; // Limit attempts to prevent infinite loops

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        let chars = base.split('');
        let temp = attempt;
        for (let i = chars.length - 1; i >= 0; i--) {
          // Ensure that for attempt 0, we don't modify the original base if it's already 5 chars
          // This logic is for character mutation, ensuring unique combinations
          const index = temp % availableChars.length;
          chars[i] = availableChars[index];
          temp = Math.floor(temp / availableChars.length);
        }

        const mutated = `${chars.join('')}${suffix}`;
        if (!(await checkIfUsernameExists(mutated))) {
          finalUsername = mutated;
          break;
        }
      }
    }

    // If after all attempts, a unique username isn't found
    if (!finalUsername) {
      return res.status(500).json({
        success: false,
        message: 'Could not generate unique username after multiple attempts. Try a different name or contact support.',
      });
    }

    // Save the newly generated username to Firestore
    const newRef = db.collection('usernames').doc(); // Create a new document reference
    await newRef.set({
      id: newRef.id, // Store the document ID within the document
      username: finalUsername,
      facebookName,
      pageCode,
      createdAt: new Date().toISOString(), // Store creation timestamp
    });

    // Return success response with the generated username
    res.status(200).json({
      success: true,
      message: 'Username successfully generated.',
      username: finalUsername,
      facebookName,
    });
  } catch (err) {
    console.error('Error in username generation API:', err);
    res.status(500).json({ message: 'Server error during username generation.' });
  }
}
