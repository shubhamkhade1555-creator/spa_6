const bcrypt = require("bcryptjs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { pool, testConnection } = require("./config/database");

async function main() {
  const connected = await testConnection();
  if (!connected) {
    console.error("Database connection failed.");
    process.exit(1);
  }

  // Create users table
  await pool.query(`
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
  await pool.query(`
    INSERT INTO users (email, password, name, role, salon_id, phone)
    VALUES
      (?, ?, 'Salon Owner', 'owner', 1, '+1234567890'),
      (?, ?, 'Center Manager', 'center', 1, '+1234567891')
    ON DUPLICATE KEY UPDATE 
      password = VALUES(password)
  `, ["owner@gmail.com", ownerHash, "center@gmail.com", centerHash]);

  console.log("✅ Users table created and seeded successfully!");
  process.exit(0);
}

main().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
