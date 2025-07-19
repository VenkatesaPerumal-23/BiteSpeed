import express from 'express';
import { pool } from './db.js';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(express.json());

app.post('/identify', async (req, res) => {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    return res.status(400).json({ error: 'Email and phoneNumber must be provided.' });
  }

  try {
    // 1. Fetch all contacts matching either email or phoneNumber
    const result = await pool.query(
      `SELECT * FROM Contact WHERE email = $1 OR phoneNumber = $2`,
      [email, phoneNumber]
    );

    const matchedContacts = result.rows;

    let primaryContact = null;

    // 2. If no existing contact, create new primary
    if (matchedContacts.length === 0) {
      const insertRes = await pool.query(
        `INSERT INTO Contact (email, phoneNumber, linkPrecedence, createdAt, updatedAt)
         VALUES ($1, $2, 'primary', NOW(), NOW()) RETURNING *`,
        [email, phoneNumber]
      );
      primaryContact = insertRes.rows[0];
    } else {
      // 3. Identify all primary contacts among matched
      const primaryContacts = matchedContacts.filter(c => c.linkprecedence === 'primary');
      
      // Pick oldest as final primary
      primaryContact = primaryContacts.reduce((oldest, contact) => {
        return new Date(contact.createdat) < new Date(oldest.createdat) ? contact : oldest;
      });

      // 4. Convert all other primaries to secondaries linked to primaryContact
      for (const contact of primaryContacts) {
        if (contact.id !== primaryContact.id) {
          await pool.query(
            `UPDATE Contact SET linkPrecedence = 'secondary', linkedId = $1, updatedAt = NOW() WHERE id = $2`,
            [primaryContact.id, contact.id]
          );
        }
      }

      // 5. If current email + phone combo not already stored, insert new secondary
      const exactMatch = matchedContacts.find(
        c => c.email === email && c.phonenumber === phoneNumber
      );
      if (!exactMatch) {
        await pool.query(
          `INSERT INTO Contact (email, phoneNumber, linkPrecedence, linkedId, createdAt, updatedAt)
           VALUES ($1, $2, 'secondary', $3, NOW(), NOW())`,
          [email, phoneNumber, primaryContact.id]
        );
      }
    }

    // 6. Fetch all contacts linked to primaryContact
    const { rows: allRelatedContacts } = await pool.query(
      `SELECT * FROM Contact WHERE id = $1 OR linkedId = $1`,
      [primaryContact.id]
    );

    const emails = new Set();
    const phoneNumbers = new Set();
    const secondaryContactIds = [];

    for (const c of allRelatedContacts) {
      if (c.email) emails.add(c.email);
      if (c.phonenumber) phoneNumbers.add(c.phonenumber);
      if (c.linkprecedence === 'secondary') secondaryContactIds.push(c.id);
    }

    res.json({
      contact: {
        primaryContactId: primaryContact.id,
        emails: Array.from(emails),
        phoneNumbers: Array.from(phoneNumbers),
        secondaryContactIds,
      },
    });
  } catch (error) {
    console.error('Error in /identify:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
