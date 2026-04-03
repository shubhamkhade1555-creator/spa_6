const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { authorize: authorizeRole } = require('../middleware/role.middleware');
const {
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
} = require('../controllers/settings.controller');

// Settings
router.get('/', authenticate, getSettings);
router.put('/', authenticate, authorizeRole('owner', 'center'), updateSettings);

// Logo
router.post('/upload-logo', authenticate, authorizeRole('owner', 'center'), upload.single('logo'), uploadLogo);

// Backup & Restore
router.get('/backup', authenticate, authorizeRole('owner', 'center'), exportBackup);
router.get('/backup/full', authenticate, authorizeRole('owner'), exportFullBackup);
router.post('/backup/import', authenticate, authorizeRole('owner'), importBackup);
router.post('/backup/import-file', authenticate, authorizeRole('owner'), backupUpload.single('backupFile'), importFromFile);
router.get('/backup/logs', authenticate, authorizeRole('owner', 'center'), getBackupLogs);
router.get('/backup/stats', authenticate, authorizeRole('owner', 'center'), getBackupStats);

// Users
router.get('/users', authenticate, getAllUsers);
router.post('/users', authenticate, authorizeRole('owner', 'center'), createUser);
router.put('/users/:id', authenticate, authorizeRole('owner', 'center'), updateUser);
router.delete('/users/:id', authenticate, authorizeRole('owner'), deleteUser);

module.exports = router;
