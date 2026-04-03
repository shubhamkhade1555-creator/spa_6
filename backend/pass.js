const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool, testConnection } = require('./config/database');

async function updatePasswords() {
  try {
    const connected = await testConnection();
    if (!connected) {
      console.error('Database connection failed.');
      process.exit(1);
    }

    console.log('Generating password hashes and updating DB...\n');

    const users = [
      { email: 'owner@gmail.com',  password: 'owner@123',  role: 'owner'  },
      { email: 'center@gmail.com', password: 'center@123', role: 'center' },
      { email: 'staff@gmail.com',  password: 'staff@123',  role: 'staff'  },
    ];

    for (const user of users) {
      const hash = await bcrypt.hash(user.password, 10);
      const [result] = await pool.query(
        'UPDATE users SET password = ? WHERE email = ?',
        [hash, user.email]
      );

      if (result.affectedRows > 0) {
        console.log(`Updated ${user.email} (${user.role}) - password: ${user.password}`);
      } else {
        console.log(`Skipped ${user.email} - user not found in DB`);
      }
    }

    // Also update any users that have the placeholder password from import
    const placeholderHash = bcrypt.hashSync('ChangeMe@123', 10);
    const [allUsers] = await pool.query('SELECT id, email, password FROM users');

    let fixedCount = 0;
    for (const u of allUsers) {
      if (u.password && bcrypt.compareSync('ChangeMe@123', u.password)) {
        const newHash = await bcrypt.hash('owner@123', 10);
        await pool.query('UPDATE users SET password = ? WHERE id = ?', [newHash, u.id]);
        console.log(`Fixed placeholder password for ${u.email} -> owner@123`);
        fixedCount++;
      }
    }

    if (fixedCount > 0) {
      console.log(`\nFixed ${fixedCount} user(s) with placeholder passwords.`);
    }

    console.log('\nAll passwords updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

updatePasswords();
