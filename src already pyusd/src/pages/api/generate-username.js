// pages/api/generate-username.js
import { db } from '../../lib/firebaseAdmin';
import { withAgentAuth } from '../../lib/authMiddleware';

function sanitizeName(name) {
  return name.toLowerCase().replace(/[^a-z]/g, '').replace(/[il]/g, '');
}

function getPossibleNamePrefixes(sanitizedName) {
  const prefixes = new Set();
  if (sanitizedName.length > 0) {
    prefixes.add(sanitizedName.substring(0, Math.min(sanitizedName.length, 5)));
  }
  if (sanitizedName.length > 5) {
    for (let i = 1; i <= sanitizedName.length - 5; i++) {
      prefixes.add(sanitizedName.substring(i, i + 5));
    }
  }
  return Array.from(prefixes);
}

async function checkIfUsernameExists(username) {
  const snapshot = await db.collection('usernames').where('username', '==', username).get();
  return !snapshot.empty;
}

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Logic restored to require facebookName and pageCode
  const { facebookName, pageCode } = req.body;
  const agent = req.decodedToken; // Agent is verified by middleware

  if (!facebookName || !pageCode) {
    return res.status(400).json({ message: 'Facebook name and Page Code are required.' });
  }
  if (typeof pageCode !== 'string' || !/^\d{4}$/.test(pageCode)) {
    return res.status(400).json({ message: 'Page Code must be a 4-digit string.' });
  }

  try {
    const sanitizedName = sanitizeName(facebookName);
    if (!sanitizedName) {
      return res.status(400).json({ message: 'Invalid Facebook name provided.' });
    }

    const namePrefixes = getPossibleNamePrefixes(sanitizedName);
    const suffix = pageCode; // Suffix is the agent's page code
    let finalUsername = null;

    // First-pass attempt with available prefixes
    for (const prefix of namePrefixes) {
      const proposed = `${prefix}${suffix}`;
      if (!(await checkIfUsernameExists(proposed))) {
        finalUsername = proposed;
        break;
      }
    }

    // Fallback logic if simple prefixes are already taken
    if (!finalUsername) {
      const originalPrefix = sanitizedName.substring(0, Math.min(sanitizedName.length, 5));
      const availableChars = 'abcdefghjkmnopqrstuvwxyz';
      const base = originalPrefix.padEnd(5, 'a');

      for (let attempt = 0; attempt < 1000; attempt++) { // Limit attempts
        let chars = base.split('');
        let temp = attempt;
        for (let i = chars.length - 1; i >= 0; i--) {
          chars[i] = availableChars[(availableChars.indexOf(chars[i]) + temp) % availableChars.length];
          temp = Math.floor(temp / availableChars.length);
          if (temp === 0) break;
        }
        const mutated = `${chars.join('')}${suffix}`;
        if (!(await checkIfUsernameExists(mutated))) {
          finalUsername = mutated;
          break;
        }
      }
    }

    if (!finalUsername) {
      return res.status(500).json({
        success: false,
        message: 'Could not generate a unique username. Try a different name.',
      });
    }

    // Save the generated username to the database
    const newRef = db.collection('usernames').doc();
    await newRef.set({
      id: newRef.id,
      username: finalUsername,
      facebookName,
      pageCodeUsed: pageCode,
      generatedByAgentUid: agent.uid,
      generatedAt: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: 'Username successfully generated.',
      username: finalUsername,
    });
  } catch (err) {
    console.error('Error in username generation:', err);
    res.status(500).json({ message: 'Server error during username generation.' });
  }
};

export default withAgentAuth(handler);