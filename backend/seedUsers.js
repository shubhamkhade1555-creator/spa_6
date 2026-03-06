const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('./config/database');

async function main() {
  const connection = await pool.getConnection();

  // Create users table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role ENUM('owner', 'center', 'staff') NOT NULL,
      salon_id INT DEFAULT 1,
      phone VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_email (email),
      INDEX idx_salon_id (salon_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Hash passwords
  const ownerHash = await bcrypt.hash("owner@123", 10);
  const centerHash = await bcrypt.hash("center@123", 10);

  // Insert owner + center
  await connection.execute(`
    INSERT INTO users (email, password, name, role, salon_id)
    VALUES
      (?, ?, 'Salon Owner', 'owner', 1),
      (?, ?, 'Center Manager', 'center', 1)
  `, ["owner@gmail.com", ownerHash, "center@gmail.com", centerHash]);

  console.log("✅ Users table created and seeded successfully!");
  process.exit(0);
}

main().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
