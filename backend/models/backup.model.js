const { pool } = require('../config/database');

const BackupModel = {
  async ensureTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS backup_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        salon_id INT NOT NULL,
        user_id INT NOT NULL,
        action ENUM('export', 'import') NOT NULL,
        format ENUM('xlsx', 'csv', 'json') NOT NULL DEFAULT 'xlsx',
        filename VARCHAR(255),
        tables_count INT DEFAULT 0,
        total_records INT DEFAULT 0,
        file_size_bytes BIGINT DEFAULT 0,
        status ENUM('success', 'failed', 'partial') NOT NULL DEFAULT 'success',
        error_message TEXT,
        details JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  },

  async createLog(data) {
    const [result] = await pool.query(
      `INSERT INTO backup_logs (salon_id, user_id, action, format, filename, tables_count, total_records, file_size_bytes, status, error_message, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.salon_id,
        data.user_id,
        data.action,
        data.format || 'xlsx',
        data.filename || null,
        data.tables_count || 0,
        data.total_records || 0,
        data.file_size_bytes || 0,
        data.status || 'success',
        data.error_message || null,
        JSON.stringify(data.details || {})
      ]
    );
    return result.insertId;
  },

  async getLogs(salonId, limit = 50) {
    const [rows] = await pool.query(
      `SELECT bl.*, u.name as user_name
       FROM backup_logs bl
       LEFT JOIN users u ON bl.user_id = u.id
       WHERE bl.salon_id = ?
       ORDER BY bl.created_at DESC
       LIMIT ?`,
      [salonId, limit]
    );
    return rows;
  },

  async getLogById(id, salonId) {
    const [rows] = await pool.query(
      'SELECT * FROM backup_logs WHERE id = ? AND salon_id = ?',
      [id, salonId]
    );
    return rows[0] || null;
  }
};

module.exports = BackupModel;
