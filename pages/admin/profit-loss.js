// pages/admin/profit-loss.js
import { useState, useEffect } from 'react';
import { db } from '../../lib/firebaseClient';
import Link from 'next/link';

export default function ProfitLossPage() {
  // ... your existing useState, fetchEntries, etc.

  const handleAddEntry = async e => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // 1️⃣ Extract username from URL
      const fbUsername = extractFbUsername(form.facebookUrl);
      const fbImage = `https://graph.facebook.com/${fbUsername}/picture?type=large`;

      // 2️⃣ Check if customer already exists
      const custQuery = await db
        .collection('customers')
        .where('facebookUrl', '==', form.facebookUrl)
        .limit(1)
        .get();

      let customerId;
      let fbName;

      if (!custQuery.empty) {
        // Existing customer
        const doc = custQuery.docs[0];
        customerId = doc.id;
        fbName = doc.data().displayName;
      } else {
        // New customer → fetch name + create doc
        fbName = await getFbName(fbUsername);
        const custRef = await db.collection('customers').add({
          facebookUrl: form.facebookUrl,
          displayName: fbName,
          avatarUrl: fbImage,
          createdAt: new Date(),
        });
        customerId = custRef.id;
      }

      // 3️⃣ Now create the PL entry
      const payload = {
        customerId,
        type: form.type,
        amount: parseFloat(form.amount),
        timestamp: new Date().toISOString(),
      };
      await db.collection('pl_entries').add(payload);

      // 4️⃣ Reset form & reload
      setForm({ facebookUrl: '', type: 'deposit', amount: '' });
      await fetchEntries();

    } catch (error) {
      console.error('Failed to add entry:', error);
    }

    setSubmitting(false);
  };

  // ... the rest of your component (rendering, sorting, table, etc.)
}
