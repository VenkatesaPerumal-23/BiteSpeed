import { pool } from './db.js';

const createTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS Contact (
      id SERIAL PRIMARY KEY,
      phoneNumber VARCHAR(15),
      email VARCHAR(255),
      linkedId INTEGER,
      linkPrecedence VARCHAR(10) CHECK (linkPrecedence IN ('primary', 'secondary')),
      createdAt TIMESTAMP DEFAULT NOW(),
      updatedAt TIMESTAMP DEFAULT NOW(),
      deletedAt TIMESTAMP
    );
  `;

  try {
    await pool.query(query);
    console.log("✅ Contact table created or already exists.");
  } catch (err) {
    console.error("❌ Failed to create Contact table:", err);
  } finally {
    await pool.end();
  }
};

createTable();
