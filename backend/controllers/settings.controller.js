const { pool } = require('../config/database');
const User = require('../models/user.model');
const BackupModel = require('../models/backup.model');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure backup_logs table exists on load
BackupModel.ensureTable().catch(err => console.warn('backup_logs table setup:', err.message));

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'logos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const salonId = req.user.salon_id;
    cb(null, `salon-${salonId}-logo-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Configure multer for backup file uploads
const backupStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'backups');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const salonId = req.user.salon_id;
    cb(null, `backup-${salonId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const backupUpload = multer({
  storage: backupStorage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for backups
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/json'
    ];
    const allowedExts = ['.xlsx', '.xls', '.csv', '.json'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx, .csv, or .json files are allowed'), false);
    }
  }
});

async function uploadLogo(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No logo file provided' });
    }

    const logoPath = `/uploads/logos/${req.file.filename}`;
    const logoUrl = `${req.protocol}://${req.get('host')}${logoPath}`;
    const salonId = req.user.salon_id;

    await pool.query('UPDATE salons SET logo_url = ? WHERE id = ?', [logoUrl, salonId]);

    res.json({
      message: 'Logo uploaded successfully',
      logoPath: logoPath,
      logoUrl: logoUrl,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Logo upload error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function getSettings(req, res) {
  try {
    const salonId = req.user?.salon_id || 1;
    const [rows] = await pool.query('SELECT * FROM salons WHERE id = ?', [salonId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Salon not found' });
    }

    const salon = rows[0];

    const response = {
      salon: {
        name: salon.name,
        address: salon.address,
        phone: salon.phone,
        email: salon.email,
        gstin: salon.gstin,
        logoUrl: salon.logo_url,
        working_hours_start: salon.working_hours_start,
        working_hours_end: salon.working_hours_end
      },
      billing: {
        gst_enabled: !!salon.billing_gst_enabled,
        gst_type: salon.billing_gst_type || 'intra',
        gst_rate: parseFloat(salon.billing_gst_rate || salon.billing_tax_rate || 0),
        cgst_rate: parseFloat(salon.billing_cgst_rate || 0),
        sgst_rate: parseFloat(salon.billing_sgst_rate || 0),
        igst_rate: parseFloat(salon.billing_igst_rate || 0),
        currency: salon.billing_currency || 'INR',
        invoicePrefix: salon.billing_invoice_prefix || 'INV',
        nextInvoiceNumber: salon.billing_next_invoice_number || 1001
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error getting settings:', error);
    res.status(500).json({ error: error.message });
  }
}

async function updateSettings(req, res) {
  try {
    const salonId = req.user?.salon_id || 1;
    const { salon, billing } = req.body;

    const updateFields = [];
    const values = [];

    if (salon) {
      if (salon.name !== undefined) { updateFields.push('name = ?'); values.push(salon.name); }
      if (salon.address !== undefined) { updateFields.push('address = ?'); values.push(salon.address); }
      if (salon.phone !== undefined) { updateFields.push('phone = ?'); values.push(salon.phone); }
      if (salon.email !== undefined) { updateFields.push('email = ?'); values.push(salon.email); }
      if (salon.gstin !== undefined) { updateFields.push('gstin = ?'); values.push(salon.gstin); }
      if (salon.logoUrl !== undefined) { updateFields.push('logo_url = ?'); values.push(salon.logoUrl); }
      if (salon.working_hours_start !== undefined) { updateFields.push('working_hours_start = ?'); values.push(salon.working_hours_start); }
      if (salon.working_hours_end !== undefined) { updateFields.push('working_hours_end = ?'); values.push(salon.working_hours_end); }
    }

    if (billing) {
      if (billing.gst_enabled !== undefined) { updateFields.push('billing_gst_enabled = ?'); values.push(billing.gst_enabled ? 1 : 0); }
      if (billing.gst_type !== undefined) { updateFields.push('billing_gst_type = ?'); values.push(billing.gst_type); }
      if (billing.gst_rate !== undefined) { updateFields.push('billing_gst_rate = ?'); values.push(billing.gst_rate); }
      if (billing.cgst_rate !== undefined) { updateFields.push('billing_cgst_rate = ?'); values.push(billing.cgst_rate); }
      if (billing.sgst_rate !== undefined) { updateFields.push('billing_sgst_rate = ?'); values.push(billing.sgst_rate); }
      if (billing.igst_rate !== undefined) { updateFields.push('billing_igst_rate = ?'); values.push(billing.igst_rate); }
      if (billing.currency !== undefined) { updateFields.push('billing_currency = ?'); values.push(billing.currency); }
      if (billing.invoicePrefix !== undefined) { updateFields.push('billing_invoice_prefix = ?'); values.push(billing.invoicePrefix); }
      if (billing.nextInvoiceNumber !== undefined) { updateFields.push('billing_next_invoice_number = ?'); values.push(billing.nextInvoiceNumber); }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(salonId);

    const [result] = await pool.query(
      `UPDATE salons SET ${updateFields.join(', ')} WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Salon not found' });
    }

    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: error.message });
  }
}

async function getAllUsers(req, res) {
  try {
    const salonId = req.user.salon_id;
    const users = await User.getAll(salonId);

    const usersWithoutPassword = users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    res.json(usersWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function createUser(req, res) {
  try {
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(req.body.password || 'default123', 10);

    const userData = {
      ...req.body,
      password: hashedPassword,
      salon_id: req.user.salon_id
    };

    const userId = await User.create(userData);
    const user = await User.findById(userId);
    const { password, ...userWithoutPassword } = user;

    res.status(201).json({
      message: 'User created successfully',
      user: userWithoutPassword
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const updated = await User.update(id, req.body);

    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = await User.findById(id);
    const { password, ...userWithoutPassword } = user;

    res.json({
      message: 'User updated successfully',
      user: userWithoutPassword
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function deleteUser(req, res) {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const deleted = await User.delete(id);

    if (!deleted) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// BACKUP & RESTORE SYSTEM
// ═══════════════════════════════════════════════════════════════

// All entities and their queries for backup - includes ALL data
const BACKUP_ENTITIES = [
  { key: 'users',          sql: 'SELECT * FROM users WHERE salon_id = ?',          direct: true },
  { key: 'staff',          sql: 'SELECT * FROM staff WHERE salon_id = ?',          direct: true },
  { key: 'customers',      sql: 'SELECT * FROM customers WHERE salon_id = ?',      direct: true },
  { key: 'services',       sql: 'SELECT * FROM services WHERE salon_id = ?',       direct: true },
  { key: 'bookings',       sql: 'SELECT * FROM bookings WHERE salon_id = ?',       direct: true },
  { key: 'invoices',       sql: 'SELECT * FROM invoices WHERE salon_id = ?',       direct: true },
  { key: 'expenses',       sql: 'SELECT * FROM expenses WHERE salon_id = ?',       direct: true },
  { key: 'categories',     sql: 'SELECT * FROM categories WHERE salon_id = ?',     direct: true },
  { key: 'rooms',          sql: 'SELECT * FROM rooms WHERE salon_id = ?',          direct: true },
  { key: 'service_combos', sql: 'SELECT * FROM service_combos WHERE salon_id = ?', direct: true },
  { key: 'combo_services', sql: `SELECT cs.* FROM combo_services cs JOIN service_combos sc ON cs.combo_id = sc.id WHERE sc.salon_id = ?` },
  { key: 'service_rooms',  sql: `SELECT sr.* FROM service_rooms sr JOIN services s ON sr.service_id = s.id WHERE s.salon_id = ?` },
  { key: 'invoice_items',  sql: `SELECT ii.* FROM invoice_items ii JOIN invoices i ON ii.invoice_id = i.id WHERE i.salon_id = ?` },
  { key: 'booking_items',  sql: `SELECT bi.* FROM booking_items bi JOIN bookings b ON bi.booking_id = b.id WHERE b.salon_id = ?` },
  { key: 'membership_plans', sql: 'SELECT * FROM membership_plans WHERE salon_id = ?', direct: true },
  { key: 'memberships',    sql: `SELECT m.* FROM memberships m JOIN customers c ON m.customer_id = c.id WHERE c.salon_id = ?` },
  { key: 'membership_payments', sql: `SELECT mp.* FROM membership_payments mp JOIN memberships m ON mp.membership_id = m.id JOIN customers c ON m.customer_id = c.id WHERE c.salon_id = ?` },
  { key: 'guest_passes',   sql: `SELECT gp.* FROM guest_passes gp JOIN memberships m ON gp.membership_id = m.id JOIN customers c ON m.customer_id = c.id WHERE c.salon_id = ?` },
  { key: 'membership_plan_allowed_categories', sql: `SELECT mpac.* FROM membership_plan_allowed_categories mpac JOIN membership_plans mp ON mpac.plan_id = mp.id WHERE mp.salon_id = ?` },
  { key: 'membership_plan_time_restrictions',  sql: `SELECT mptr.* FROM membership_plan_time_restrictions mptr JOIN membership_plans mp ON mptr.plan_id = mp.id WHERE mp.salon_id = ?` },
  { key: 'staff_attendance',    sql: `SELECT sa.* FROM staff_attendance sa JOIN staff s ON sa.staff_id = s.id WHERE s.salon_id = ?` },
  { key: 'staff_leaves',        sql: `SELECT sl.* FROM staff_leaves sl JOIN staff s ON sl.staff_id = s.id WHERE s.salon_id = ?` },
  { key: 'staff_leave_balance', sql: `SELECT slb.* FROM staff_leave_balance slb JOIN staff s ON slb.staff_id = s.id WHERE s.salon_id = ?` },
  { key: 'staff_schedule',      sql: `SELECT ss.* FROM staff_schedule ss JOIN staff s ON ss.staff_id = s.id WHERE s.salon_id = ?` },
  { key: 'staff_performance',   sql: `SELECT sp.* FROM staff_performance sp JOIN staff s ON sp.staff_id = s.id WHERE s.salon_id = ?` },
  { key: 'staff_commission',    sql: `SELECT sc.* FROM staff_commission sc JOIN staff s ON sc.staff_id = s.id WHERE s.salon_id = ?` },
  { key: 'appointments',   sql: 'SELECT * FROM appointments WHERE salon_id = ?',   direct: true },
  { key: 'salon_settings', sql: 'SELECT * FROM salons WHERE id = ?',               direct: true },
];

// Import order respects foreign key dependencies
const IMPORT_ORDER = [
  'salon_settings', 'users', 'categories', 'rooms', 'staff', 'customers',
  'services', 'service_combos', 'combo_services', 'service_rooms',
  'membership_plans', 'memberships', 'membership_payments', 'guest_passes',
  'membership_plan_allowed_categories', 'membership_plan_time_restrictions',
  'bookings', 'booking_items', 'appointments',
  'invoices', 'invoice_items', 'expenses',
  'staff_attendance', 'staff_leaves', 'staff_leave_balance',
  'staff_schedule', 'staff_performance', 'staff_commission'
];

// Maps entity keys to actual table names
const TABLE_NAME_MAP = {
  'salon_settings': 'salons'
};

function getTableName(entityKey) {
  return TABLE_NAME_MAP[entityKey] || entityKey;
}

// Sanitize a row before INSERT: fix ISO dates, empty strings → null
function sanitizeRow(row) {
  const cleaned = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === '' || value === undefined) {
      cleaned[key] = null;
    } else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      cleaned[key] = value.replace('T', ' ').replace(/\.\d+Z$/, '').replace('Z', '');
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

// Safe query helper
async function safeQuery(label, sql, params) {
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (err) {
    console.warn(`Backup: skipping "${label}" – ${err.message}`);
    return [];
  }
}

// ── EXPORT BACKUP (enhanced with logging & full data including passwords) ──
async function exportBackup(req, res) {
  try {
    const salonId = req.user.salon_id;
    const format = req.query.format || 'json'; // json, xlsx, csv
    const includePasswords = req.query.includePasswords === 'true';
    const backup = {};
    let totalRecords = 0;

    for (const entity of BACKUP_ENTITIES) {
      const rows = await safeQuery(entity.key, entity.sql, [salonId]);

      // For users: optionally include hashed passwords for full backup
      if (entity.key === 'users' && !includePasswords) {
        backup[entity.key] = rows.map(u => { const { password, ...rest } = u; return rest; });
      } else {
        backup[entity.key] = rows;
      }
      totalRecords += rows.length;
    }

    // Log the backup
    await BackupModel.createLog({
      salon_id: salonId,
      user_id: req.user.id,
      action: 'export',
      format: format === 'json' ? 'json' : format,
      filename: `salon_backup_${new Date().toISOString().split('T')[0]}.${format}`,
      tables_count: Object.keys(backup).filter(k => backup[k].length > 0).length,
      total_records: totalRecords,
      status: 'success',
      details: {
        entities: Object.keys(backup).map(k => ({ name: k, count: backup[k].length })),
        includePasswords
      }
    }).catch(err => console.warn('Backup log failed:', err.message));

    res.json(backup);
  } catch (error) {
    console.error('Backup generation error:', error);

    await BackupModel.createLog({
      salon_id: req.user.salon_id,
      user_id: req.user.id,
      action: 'export',
      format: 'json',
      status: 'failed',
      error_message: error.message
    }).catch(() => {});

    res.status(500).json({ error: error.message });
  }
}

// ── EXPORT FULL BACKUP (includes hashed passwords for complete restore) ──
async function exportFullBackup(req, res) {
  try {
    const salonId = req.user.salon_id;
    const backup = {};
    let totalRecords = 0;

    for (const entity of BACKUP_ENTITIES) {
      const rows = await safeQuery(entity.key, entity.sql, [salonId]);
      backup[entity.key] = rows; // Include ALL data including passwords
      totalRecords += rows.length;
    }

    await BackupModel.createLog({
      salon_id: salonId,
      user_id: req.user.id,
      action: 'export',
      format: 'json',
      filename: `salon_full_backup_${new Date().toISOString().split('T')[0]}.json`,
      tables_count: Object.keys(backup).filter(k => backup[k].length > 0).length,
      total_records: totalRecords,
      status: 'success',
      details: {
        type: 'full_backup',
        includePasswords: true,
        entities: Object.keys(backup).map(k => ({ name: k, count: backup[k].length }))
      }
    }).catch(err => console.warn('Backup log failed:', err.message));

    res.json(backup);
  } catch (error) {
    console.error('Full backup error:', error);
    res.status(500).json({ error: error.message });
  }
}

// Reverse map for truncated XLSX sheet names
const SHEET_NAME_REVERSE = {
  'mbr_plan_allowed_cats': 'membership_plan_allowed_categories',
  'mbr_plan_time_restrict': 'membership_plan_time_restrictions',
  'membership_plan_allowed_categor': 'membership_plan_allowed_categories',
  'membership_plan_time_restrictio': 'membership_plan_time_restrictions',
};

// Normalize incoming data keys to match IMPORT_ORDER
function normalizeDataKeys(data) {
  const normalized = {};
  for (const [key, value] of Object.entries(data)) {
    const mappedKey = SHEET_NAME_REVERSE[key] || key;
    normalized[mappedKey] = value;
  }
  return normalized;
}

// Get valid columns for a table from DB
async function getTableColumns(connection, tableName) {
  try {
    const [cols] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\``);
    return cols.map(c => c.Field);
  } catch {
    return null;
  }
}

// JSON column names that need special handling during import
const JSON_COLUMNS = new Set([
  'payment_methods', 'booking_ids', 'services_qualified',
  'applicable_days', 'amenities'
]);

// Clean row: keep only valid columns, convert values
function cleanRow(row, validColumns, entityKey) {
  const cleaned = {};
  for (const col of validColumns) {
    if (row.hasOwnProperty(col)) {
      let val = row[col];
      // Convert empty strings to null (fixes integer/date columns from Excel/CSV)
      if (val === '' || val === undefined) {
        val = null;
      }
      // Convert ISO 8601 datetime to MySQL format: 2026-03-14T23:52:19.000Z → 2026-03-14 23:52:19
      else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
        val = val.replace('T', ' ').replace(/\.\d+Z$/, '').replace('Z', '');
      }
      // Fix JSON columns: Excel may corrupt JSON — validate and fix
      if (JSON_COLUMNS.has(col) && val !== null) {
        if (typeof val === 'object') {
          val = JSON.stringify(val);
        } else if (typeof val === 'string') {
          try { JSON.parse(val); } catch { val = null; }
        } else {
          val = null;
        }
      }
      cleaned[col] = val;
    }
  }

  // Users without password field: set a placeholder hash so NOT NULL constraint passes
  if (entityKey === 'users' && !cleaned.password) {
    const bcrypt = require('bcryptjs');
    cleaned.password = bcrypt.hashSync('ChangeMe@123', 10);
  }

  return cleaned;
}

// ── IMPORT BACKUP ──
async function importBackup(req, res) {
  const connection = await pool.getConnection();
  try {
    const salonId = req.user.salon_id;
    const { data: rawData, mode } = req.body; // mode: 'merge' or 'replace'

    if (!rawData || typeof rawData !== 'object') {
      return res.status(400).json({ error: 'Invalid backup data' });
    }

    // Normalize keys (handles truncated XLSX sheet names)
    const data = normalizeDataKeys(rawData);

    const importMode = mode || 'merge';
    const results = {};
    let totalImported = 0;
    let totalSkipped = 0;
    const errors = [];

    await connection.beginTransaction();
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    // Cache table columns to only insert valid columns
    const tableColumnsCache = {};

    for (const entityKey of IMPORT_ORDER) {
      if (!data[entityKey] || !Array.isArray(data[entityKey]) || data[entityKey].length === 0) {
        continue;
      }

      const tableName = getTableName(entityKey);
      const rows = data[entityKey];
      let imported = 0;
      let skipped = 0;

      try {
        // Get valid columns for this table
        if (!tableColumnsCache[tableName]) {
          tableColumnsCache[tableName] = await getTableColumns(connection, tableName);
        }
        const validColumns = tableColumnsCache[tableName];
        if (!validColumns) {
          errors.push(`${entityKey}: table "${tableName}" does not exist`);
          continue;
        }

        // For 'replace' mode, delete existing data first
        if (importMode === 'replace') {
          if (tableName === 'salons') {
            // Don't delete salon, just update
          } else if (validColumns.includes('salon_id')) {
            await connection.query(`DELETE FROM \`${tableName}\` WHERE salon_id = ?`, [salonId]);
          }
          // For junction tables without salon_id, they'll be handled by ON DUPLICATE KEY
        }

        for (const rawRow of rows) {
          try {
            if (entityKey === 'backup_logs') continue;

            // Handle salon_settings separately - update only
            if (entityKey === 'salon_settings') {
              const cleaned = cleanRow(rawRow, validColumns.filter(c => c !== 'id'), entityKey);
              if (Object.keys(cleaned).length > 0) {
                const setClauses = Object.keys(cleaned).map(k => `\`${k}\` = ?`).join(', ');
                await connection.query(
                  `UPDATE salons SET ${setClauses} WHERE id = ?`,
                  [...Object.values(cleaned), salonId]
                );
                imported++;
              }
              continue;
            }

            // Clean row: only include columns that exist in the table
            const row = cleanRow(rawRow, validColumns, entityKey);
            const columns = Object.keys(row);
            if (columns.length === 0) { skipped++; continue; }

            const values = columns.map(c => row[c]);
            const placeholders = columns.map(() => '?').join(', ');
            const updateClauses = columns.filter(c => c !== 'id').map(c => `\`${c}\` = VALUES(\`${c}\`)`);

            const sql = `INSERT INTO \`${tableName}\` (${columns.map(c => `\`${c}\``).join(', ')})
                         VALUES (${placeholders})
                         ON DUPLICATE KEY UPDATE ${updateClauses.length > 0 ? updateClauses.join(', ') : 'id = id'}`;

            await connection.query(sql, values);
            imported++;
          } catch (rowErr) {
            skipped++;
            if (errors.length < 50) {
              errors.push(`${entityKey} row: ${rowErr.message.substring(0, 120)}`);
            }
          }
        }
      } catch (tableErr) {
        errors.push(`${entityKey} (table-level): ${tableErr.message.substring(0, 120)}`);
      }

      results[entityKey] = { imported, skipped, total: rows.length };
      totalImported += imported;
      totalSkipped += skipped;
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    await connection.commit();

    const status = errors.length === 0 ? 'success' : (totalImported > 0 ? 'partial' : 'failed');

    // Log the import
    await BackupModel.createLog({
      salon_id: salonId,
      user_id: req.user.id,
      action: 'import',
      format: req.body.sourceFormat || 'json',
      filename: req.body.sourceFilename || 'uploaded_backup',
      tables_count: Object.keys(results).length,
      total_records: totalImported,
      status: status,
      error_message: errors.length > 0 ? errors.slice(0, 10).join('; ') : null,
      details: { mode: importMode, results, errors: errors.slice(0, 20) }
    }).catch(err => console.warn('Import log failed:', err.message));

    res.json({
      message: `Import ${status}: ${totalImported} records imported, ${totalSkipped} skipped`,
      status,
      totalImported,
      totalSkipped,
      results,
      errors: errors.slice(0, 20)
    });
  } catch (error) {
    await connection.rollback();
    console.error('Import error:', error);

    await BackupModel.createLog({
      salon_id: req.user.salon_id,
      user_id: req.user.id,
      action: 'import',
      format: 'json',
      status: 'failed',
      error_message: error.message
    }).catch(() => {});

    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
}

// ── IMPORT FROM UPLOADED FILE ──
async function importFromFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No backup file uploaded' });
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    let parsedData = {};

    if (ext === '.json') {
      parsedData = JSON.parse(fileContent);
    } else {
      // For xlsx and csv, the frontend will parse and send as JSON
      // This endpoint handles pre-parsed JSON from the frontend
      return res.status(400).json({
        error: 'For .xlsx and .csv files, please use the client-side parser and send as JSON to /backup/import'
      });
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    // Forward to import handler via internal call
    req.body = {
      data: parsedData,
      mode: req.body.mode || 'merge',
      sourceFormat: ext.replace('.', ''),
      sourceFilename: req.file.originalname
    };

    return importBackup(req, res);
  } catch (error) {
    console.error('File import error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
}

// ── GET BACKUP LOGS ──
async function getBackupLogs(req, res) {
  try {
    const salonId = req.user.salon_id;
    const limit = parseInt(req.query.limit) || 50;
    const logs = await BackupModel.getLogs(salonId, limit);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching backup logs:', error);
    res.status(500).json({ error: error.message });
  }
}

// ── GET BACKUP STATS ──
async function getBackupStats(req, res) {
  try {
    const salonId = req.user.salon_id;

    const [totalExports] = await pool.query(
      `SELECT COUNT(*) as count FROM backup_logs WHERE salon_id = ? AND action = 'export' AND status = 'success'`,
      [salonId]
    ).catch(() => [[{ count: 0 }]]);

    const [totalImports] = await pool.query(
      `SELECT COUNT(*) as count FROM backup_logs WHERE salon_id = ? AND action = 'import' AND status IN ('success', 'partial')`,
      [salonId]
    ).catch(() => [[{ count: 0 }]]);

    const [lastBackup] = await pool.query(
      `SELECT created_at, format, total_records FROM backup_logs WHERE salon_id = ? AND action = 'export' AND status = 'success' ORDER BY created_at DESC LIMIT 1`,
      [salonId]
    ).catch(() => [[]]);

    const [lastImport] = await pool.query(
      `SELECT created_at, total_records, status FROM backup_logs WHERE salon_id = ? AND action = 'import' ORDER BY created_at DESC LIMIT 1`,
      [salonId]
    ).catch(() => [[]]);

    // Count total data records across all tables
    let totalDataRecords = 0;
    for (const entity of BACKUP_ENTITIES) {
      if (entity.key === 'salon_settings') continue;
      const rows = await safeQuery(entity.key, entity.sql, [salonId]);
      totalDataRecords += rows.length;
    }

    res.json({
      totalExports: totalExports[0]?.count || 0,
      totalImports: totalImports[0]?.count || 0,
      lastBackup: lastBackup[0] || null,
      lastImport: lastImport[0] || null,
      totalDataRecords,
      tablesCount: BACKUP_ENTITIES.length
    });
  } catch (error) {
    console.error('Error fetching backup stats:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getSettings,
  updateSettings,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  exportBackup,
  exportFullBackup,
  importBackup,
  importFromFile,
  getBackupLogs,
  getBackupStats,
  uploadLogo,
  upload,
  backupUpload
};
