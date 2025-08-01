// src/pages/api/paygate/create-payment.js
import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username, game, amount, method, email } = req.body;
  if (!username || !game || !amount || !method || !email) {
    return res.status(400).json({ message: 'Missing required fields, including email.' });
  }

  const yourUsdcWallet = process.env.YOUR_USDC_POLYGON_WALLET;
  if (!yourUsdcWallet) {
    console.error('CRITICAL: YOUR_USDC_POLYGON_WALLET is not set in environment variables.');
    return res.status(500).json({ message: 'Payment provider is not configured.' });
  }

  // Trim whitespace from the wallet address to prevent configuration errors.
  const cleanedWalletAddress = yourUsdcWallet.trim();

  const orderId = `LUCKYPAWS-${Date.now()}`;
  const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/paygate/webhook?orderId=${orderId}`;

  try {
    // Step 1: Create a temporary wallet
    const walletApiUrl = `https://api.paygate.to/control/wallet.php?address=${cleanedWalletAddress}&callback=${encodeURIComponent(callbackUrl)}`;
    
    const walletResponse = await fetch(walletApiUrl);
    if (!walletResponse.ok) {
      const errorText = await walletResponse.text();
      console.error("Paygate Wallet API Error:", errorText);
      throw new Error('Failed to create a temporary payment wallet with Paygate.');
    }
    const walletData = await walletResponse.json();
    const encryptedAddressIn = walletData.address_in;

    if (!encryptedAddressIn) {
      throw new Error('Could not retrieve the encrypted wallet address from Paygate.');
    }

    // --- Step 2: Create the final payment URL ---
    // THE FIX: The 'encryptedAddressIn' is already encoded by the API. We must not encode it again.
    // We only need to encode the other parameters like the email address.
    const paymentUrl = `https://checkout.paygate.to/pay.php?address=${encryptedAddressIn}&amount=${amount}&email=${encodeURIComponent(email)}&currency=USD`;

    // Store the order in our database
    await db.collection('orders').doc(orderId).set({
      orderId,
      username,
      game,
      amount: parseFloat(amount),
      method,
      email,
      status: 'pending',
      created: Timestamp.now(),
      read: false,
      paymentGateway: 'Paygate',
      paymentUrl: paymentUrl,
    });

    // Send the final payment URL to the frontend for redirection
    res.status(200).json({ paymentUrl: paymentUrl, orderId: orderId });

  } catch (err) {
    console.error('Paygate payment creation error:', err);
    res.status(500).json({ message: 'Payment creation failed', error: err.message });
  }
}