// pages/api/generate-username.js
import { db } from '../../lib/firebaseAdmin';

// Helper function to sanitize the Facebook name for username creation
// Now excludes 'i' and 'l' from the resulting alphabetic string.
function sanitizeName(name) {
  // Convert to lowercase, remove non-alphabetic characters, and then remove 'i' and 'l'
  return name.toLowerCase().replace(/[^a-z]/g, '').replace(/[il]/g, '');
}

// Helper function to get all possible 5-character substrings from a sanitized name
// Always includes the first 5 characters as a primary candidate.
// If the sanitized name is shorter than 5 chars, it returns the whole sanitized name.
function getPossibleNamePrefixes(sanitizedName) {
  const prefixes = new Set();
  
  // Always include the first characters, up to 5, as a primary candidate
  if (sanitizedName.length > 0) {
    prefixes.add(sanitizedName.substring(0, Math.min(sanitizedName.length, 5)));
  }

  // Add other 5-character substrings if available
  if (sanitizedName.length > 5) {
    for (let i = 1; i <= sanitizedName.length - 5; i++) {
      prefixes.add(sanitizedName.substring(i, i + 5));
    }
  }
  return Array.from(prefixes);
}

// Helper function to check if a username exists
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
    const sanitizedFacebookName = sanitizeName(facebookName);
    if (!sanitizedFacebookName) {
        return res.status(400).json({ message: 'Could not generate a base username from the provided Facebook name (no alphabetic characters found after removing "i" and "l").' });
    }

    const originalFiveCharPrefix = sanitizedFacebookName.substring(0, Math.min(sanitizedFacebookName.length, 5));
    const possibleSubstrings = getPossibleNamePrefixes(sanitizedFacebookName); 

    let generatedUsername = null;
    
    // Step 1: Try natural substrings (including the very first 5)
    for (const prefix of possibleSubstrings) {
      const proposedUsername = `${prefix}${pageCode.toLowerCase()}`;
      const usernameExists = await checkIfUsernameExists(proposedUsername);
      if (!usernameExists) {
        generatedUsername = proposedUsername;
        break; // Found a unique one, stop searching
      }
    }

    // Step 2: If no natural substring combination is unique, start mutating the ORIGINAL five-char prefix
    if (!generatedUsername) {
      const alphabetSize = 24; // 'a' through 'z' excluding 'i' and 'l'
      const availableChars = 'abcdefghjkmnopqrstuvwxyz'.split(''); // Alphabets without 'i' and 'l'

      // Ensure we have a 5-char prefix to mutate. Pad with 'a' if original is shorter.
      let basePrefixToMutate = originalFiveCharPrefix.padEnd(5, 'a');

      // Loop through potential mutations. Limited for practical purposes.
      // 24^5 combinations is very large, so we'll cap attempts.
      const maxMutationAttempts = 10000; // Limit attempts to avoid excessive operations

      for (let attempt = 0; attempt < maxMutationAttempts; attempt++) {
        let currentPrefixChars = basePrefixToMutate.split('');
        let tempAttempt = attempt;

        // Apply mutation based on attempt count (like base-24 increment)
        for (let i = currentPrefixChars.length - 1; i >= 0; i--) {
            if (tempAttempt === 0 && i === currentPrefixChars.length - 1) {
                // If this is the very first attempt (attempt 0), use the basePrefixToMutate directly
                // without applying any offset to it, just ensure its characters are in `availableChars`.
                // This is a correction to ensure the loop starts correctly from the base.
            } else {
                // Calculate the new character index in availableChars
                const newCharIndex = tempAttempt % alphabetSize;
                currentPrefixChars[i] = availableChars[newCharIndex];
                tempAttempt = Math.floor(tempAttempt / alphabetSize);
            }
        }
        const mutatedPrefix = currentPrefixChars.join('');

        // Ensure the mutated prefix does not contain 'i' or 'l' (redundant if `availableChars` is used correctly)
        if (mutatedPrefix.includes('i') || mutatedPrefix.includes('l')) {
            continue; // Skip if mutation somehow resulted in 'i' or 'l' (shouldn't happen with `availableChars`)
        }

        const proposedUsername = `${mutatedPrefix}${pageCode.toLowerCase()}`;
        const usernameExists = await checkIfUsernameExists(proposedUsername);

        if (!usernameExists) {
          generatedUsername = proposedUsername;
          break;
        }
      }
    }

    if (!generatedUsername) {
      // This is a very rare fallback, as the mutation strategy should almost always find a unique name.
      return res.status(500).json({
        success: false,
        message: 'Failed to generate a unique username after extensive attempts. The database might be extremely saturated, or an unexpected error occurred. Please try a different Facebook name or contact support.',
      });
    }

    // Save the found unique username and Facebook name to the database
    const newUsernameRef = db.collection('usernames').doc(); // Create a new document with an auto-generated ID
    await newUsernameRef.set({
      id: newUsernameRef.id,
      username: generatedUsername,
      facebookName: facebookName,
      pageCode: pageCode, // Store the page code used
      createdAt: new Date().toISOString() // Timestamp for record-keeping
    });

    res.status(200).json({
      success: true,
      message: 'Username generated and saved successfully.',
      username: generatedUsername,
      facebookName: facebookName
    });

  } catch (error) {
    console.error('Error generating or saving username:', error);
    res.status(500).json({ message: `Failed to generate username: ${error.message}` });
  }
}