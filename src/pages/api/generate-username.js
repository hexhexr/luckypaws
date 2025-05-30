import { db } from '../../lib/firebaseAdmin';

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { facebookName, pageCode } = req.body;

  if (!facebookName || typeof facebookName !== 'string' || facebookName.trim() === '') {
    return res.status(400).json({ message: 'Facebook name is required.' });
  }
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
    const suffix = pageCode.toLowerCase();
    let finalUsername = null;

    for (const prefix of namePrefixes) {
      const proposed = `${prefix}${suffix}`;
      if (!(await checkIfUsernameExists(proposed))) {
        finalUsername = proposed;
        break;
      }
    }

    if (!finalUsername) {
      const availableChars = 'abcdefghjkmnopqrstuvwxyz';
      const base = originalPrefix.padEnd(5, 'a');
      const maxAttempts = 10000;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        let chars = base.split('');
        let temp = attempt;
        for (let i = chars.length - 1; i >= 0; i--) {
          if (attempt === 0 && i === chars.length - 1) continue;
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

    if (!finalUsername) {
      return res.status(500).json({
        success: false,
        message: 'Could not generate unique username after multiple attempts. Try a different name or contact support.',
      });
    }

    const newRef = db.collection('usernames').doc();
    await newRef.set({
      id: newRef.id,
      username: finalUsername,
      facebookName,
      pageCode,
      createdAt: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: 'Username successfully generated.',
      username: finalUsername,
      facebookName,
    });
  } catch (err) {
    console.error('Error in username generation:', err);
    res.status(500).json({ message: 'Server error during username generation.' });
  }
}
