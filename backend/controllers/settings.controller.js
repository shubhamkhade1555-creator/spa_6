const { pool } = require('../config/database');
const User = require('../models/user.model');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'logos');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename with timestamp and user's salon ID
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
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
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
    
    // Save logo URL to salon settings
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
    
    // Format settings for frontend
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
    
    // Build update query
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
    
    res.json({
      message: 'Settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: error.message });
  }
}

async function getAllUsers(req, res) {
  try {
    const salonId = req.user.salon_id;
    const users = await User.getAll(salonId);
    
    // Remove password from response
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
    
    // Hash password
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
    
    // Prevent deleting own account
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

async function exportBackup(req, res) {
  try {
    const salonId = req.user.salon_id;
    const backup = {};

    // Helper: safely query a table (returns [] if the table doesn't exist)
    async function safeQuery(label, sql, params) {
      try {
        const [rows] = await pool.query(sql, params);
        return rows;
      } catch (err) {
        console.warn(`Backup: skipping "${label}" – ${err.message}`);
        return [];
      }
    }

    // ── Core tables ──
    const usersRows = await safeQuery('users', 'SELECT * FROM users WHERE salon_id = ?', [salonId]);
    backup.users = usersRows.map(u => { const { password, ...rest } = u; return rest; });

    backup.staff             = await safeQuery('staff',             'SELECT * FROM staff WHERE salon_id = ?', [salonId]);
    backup.customers         = await safeQuery('customers',         'SELECT * FROM customers WHERE salon_id = ?', [salonId]);
    backup.services          = await safeQuery('services',          'SELECT * FROM services WHERE salon_id = ?', [salonId]);
    backup.bookings          = await safeQuery('bookings',          'SELECT * FROM bookings WHERE salon_id = ?', [salonId]);
    backup.invoices          = await safeQuery('invoices',          'SELECT * FROM invoices WHERE salon_id = ?', [salonId]);
    backup.expenses          = await safeQuery('expenses',          'SELECT * FROM expenses WHERE salon_id = ?', [salonId]);

    // ── Categories & Rooms ──
    backup.categories        = await safeQuery('categories',        'SELECT * FROM categories WHERE salon_id = ?', [salonId]);
    backup.rooms             = await safeQuery('rooms',             'SELECT * FROM rooms WHERE salon_id = ?', [salonId]);

    // ── Service extras ──
    backup.service_combos    = await safeQuery('service_combos',    'SELECT * FROM service_combos WHERE salon_id = ?', [salonId]);
    backup.combo_services    = await safeQuery('combo_services',
      `SELECT cs.* FROM combo_services cs
       JOIN service_combos sc ON cs.combo_id = sc.id
       WHERE sc.salon_id = ?`, [salonId]);
    backup.service_rooms     = await safeQuery('service_rooms',
      `SELECT sr.* FROM service_rooms sr
       JOIN services s ON sr.service_id = s.id
       WHERE s.salon_id = ?`, [salonId]);

    // ── Invoice items ──
    backup.invoice_items     = await safeQuery('invoice_items',
      `SELECT ii.* FROM invoice_items ii
       JOIN invoices i ON ii.invoice_id = i.id
       WHERE i.salon_id = ?`, [salonId]);

    // ── Booking items ──
    backup.booking_items     = await safeQuery('booking_items',
      `SELECT bi.* FROM booking_items bi
       JOIN bookings b ON bi.booking_id = b.id
       WHERE b.salon_id = ?`, [salonId]);

    // ── Memberships ──
    backup.membership_plans  = await safeQuery('membership_plans',  'SELECT * FROM membership_plans WHERE salon_id = ?', [salonId]);
    backup.memberships       = await safeQuery('memberships',
      `SELECT m.* FROM memberships m
       JOIN customers c ON m.customer_id = c.id
       WHERE c.salon_id = ?`, [salonId]);
    backup.membership_payments = await safeQuery('membership_payments',
      `SELECT mp.* FROM membership_payments mp
       JOIN memberships m ON mp.membership_id = m.id
       JOIN customers c ON m.customer_id = c.id
       WHERE c.salon_id = ?`, [salonId]);
    backup.guest_passes      = await safeQuery('guest_passes',
      `SELECT gp.* FROM guest_passes gp
       JOIN memberships m ON gp.membership_id = m.id
       JOIN customers c ON m.customer_id = c.id
       WHERE c.salon_id = ?`, [salonId]);
    backup.membership_plan_allowed_categories = await safeQuery('membership_plan_allowed_categories',
      `SELECT mpac.* FROM membership_plan_allowed_categories mpac
       JOIN membership_plans mp ON mpac.plan_id = mp.id
       WHERE mp.salon_id = ?`, [salonId]);
    backup.membership_plan_time_restrictions = await safeQuery('membership_plan_time_restrictions',
      `SELECT mptr.* FROM membership_plan_time_restrictions mptr
       JOIN membership_plans mp ON mptr.plan_id = mp.id
       WHERE mp.salon_id = ?`, [salonId]);

    // ── Staff extras ──
    backup.staff_attendance  = await safeQuery('staff_attendance',
      `SELECT sa.* FROM staff_attendance sa
       JOIN staff s ON sa.staff_id = s.id
       WHERE s.salon_id = ?`, [salonId]);
    backup.staff_leaves      = await safeQuery('staff_leaves',
      `SELECT sl.* FROM staff_leaves sl
       JOIN staff s ON sl.staff_id = s.id
       WHERE s.salon_id = ?`, [salonId]);
    backup.staff_leave_balance = await safeQuery('staff_leave_balance',
      `SELECT slb.* FROM staff_leave_balance slb
       JOIN staff s ON slb.staff_id = s.id
       WHERE s.salon_id = ?`, [salonId]);
    backup.staff_schedule    = await safeQuery('staff_schedule',
      `SELECT ss.* FROM staff_schedule ss
       JOIN staff s ON ss.staff_id = s.id
       WHERE s.salon_id = ?`, [salonId]);
    backup.staff_performance = await safeQuery('staff_performance',
      `SELECT sp.* FROM staff_performance sp
       JOIN staff s ON sp.staff_id = s.id
       WHERE s.salon_id = ?`, [salonId]);
    backup.staff_commission  = await safeQuery('staff_commission',
      `SELECT sc.* FROM staff_commission sc
       JOIN staff s ON sc.staff_id = s.id
       WHERE s.salon_id = ?`, [salonId]);

    // ── Appointments ──
    backup.appointments      = await safeQuery('appointments',      'SELECT * FROM appointments WHERE salon_id = ?', [salonId]);

    // ── Salon settings ──
    backup.salon_settings    = await safeQuery('salon_settings',    'SELECT * FROM salons WHERE id = ?', [salonId]);

    res.json(backup);
  } catch (error) {
    console.error('Backup generation error:', error);
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
  uploadLogo,
  upload // Export multer middleware for use in routes
};