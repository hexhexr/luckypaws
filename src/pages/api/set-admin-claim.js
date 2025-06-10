// pages/api/set-admin-claim.js
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Replace escaped newlines for Vercel's environment variables
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const auth = admin.auth();

export default async function handler(req, res) {
  if (req.method !== 'GET') { // You can use GET for a simple trigger, or POST for more security
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Ensure FIREBASE_ADMIN_UID is available
  const adminUid = process.env.FIREBASE_ADMIN_UID;

  if (!adminUid) {
    console.error("FIREBASE_ADMIN_UID environment variable is not set!");
    return res.status(500).json({ success: false, message: "Server configuration error: Admin UID missing." });
  }

  try {
    await auth.setCustomUserClaims(adminUid, { admin: true });
    console.log(`Successfully set custom claims for user ${adminUid}: { admin: true }`);

    const userRecord = await auth.getUser(adminUid);
    console.log('Verified custom claims:', userRecord.customClaims);

    return res.status(200).json({ success: true, message: `Admin claim set for ${adminUid}.` });

  } catch (error) {
    console.error('Error setting custom admin claim:', error);
    return res.status(500).json({ success: false, message: 'Failed to set admin claim.', error: error.message });
  }
}