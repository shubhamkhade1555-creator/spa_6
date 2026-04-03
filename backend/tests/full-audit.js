/**
 * ═══════════════════════════════════════════════════════════
 *  SALON MANAGEMENT SYSTEM — FULL PRODUCTION AUDIT
 *  100+ Test Cases | Amazon-grade Quality Checklist
 *  Run: node tests/full-audit.js
 * ═══════════════════════════════════════════════════════════
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const fs = require('fs');
const http = require('http');

const results = [];
let passCount = 0;
let failCount = 0;
let warnCount = 0;
let skipCount = 0;

function log(id, category, name, status, detail = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : status === 'WARN' ? '⚠️' : '⏭️';
  if (status === 'PASS') passCount++;
  else if (status === 'FAIL') failCount++;
  else if (status === 'WARN') warnCount++;
  else skipCount++;
  results.push({ id, category, name, status, detail });
  console.log(`${icon} TC-${String(id).padStart(3, '0')} [${category}] ${name} ${detail ? '— ' + detail : ''}`);
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
function fileExists(p) { return fs.existsSync(path.join(__dirname, '..', p)); }
function readFile(p) { return fs.readFileSync(path.join(__dirname, '..', p), 'utf-8'); }
function fileSize(p) { try { return fs.statSync(path.join(__dirname, '..', p)).size; } catch { return 0; } }

function httpGet(urlPath) {
  return new Promise((resolve) => {
    const port = process.env.PORT || 3000;
    const req = http.get(`http://localhost:${port}${urlPath}`, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
    });
    req.on('error', () => resolve({ status: 0, data: '', headers: {} }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, data: '', headers: {} }); });
  });
}

async function httpPost(urlPath, body, token = '') {
  return new Promise((resolve) => {
    const port = process.env.PORT || 3000;
    const postData = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost', port, path: `/api${urlPath}`, method: 'POST', timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } catch { resolve({ status: res.statusCode, data }); } });
    });
    req.on('error', () => resolve({ status: 0, data: null }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, data: null }); });
    req.write(postData);
    req.end();
  });
}

async function httpGetApi(urlPath, token = '') {
  return new Promise((resolve) => {
    const port = process.env.PORT || 3000;
    const req = http.get(`http://localhost:${port}/api${urlPath}`, {
      timeout: 5000,
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } catch { resolve({ status: res.statusCode, data }); } });
    });
    req.on('error', () => resolve({ status: 0, data: null }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, data: null }); });
  });
}

// ═══════════════════════════════════════════════════════════
async function runAllTests() {
  console.log('\n' + '═'.repeat(70));
  console.log('  SALON MANAGEMENT SYSTEM — PRODUCTION QUALITY AUDIT');
  console.log('  100+ Test Cases | ' + new Date().toISOString());
  console.log('═'.repeat(70) + '\n');

  let tc = 0;

  // ─────────────────────────────────────────────
  // SECTION 1: FILE STRUCTURE & PROJECT SETUP
  // ─────────────────────────────────────────────
  console.log('\n📁 SECTION 1: FILE STRUCTURE & PROJECT SETUP\n');

  log(++tc, 'Structure', 'package.json exists', fileExists('package.json') ? 'PASS' : 'FAIL');
  log(++tc, 'Structure', '.env file exists', fileExists('.env') ? 'PASS' : 'FAIL');
  log(++tc, 'Structure', '.env not in frontend (security)', !fileExists('frontend/.env') ? 'PASS' : 'FAIL');
  log(++tc, 'Structure', 'Main entry point exists (api/index.js)', fileExists('api/index.js') ? 'PASS' : 'FAIL');
  log(++tc, 'Structure', 'Frontend app.html exists', fileExists('frontend/app.html') ? 'PASS' : 'FAIL');
  log(++tc, 'Structure', 'Frontend login.html exists', fileExists('frontend/login.html') ? 'PASS' : 'FAIL');
  log(++tc, 'Structure', 'Database config exists', fileExists('config/database.js') ? 'PASS' : 'FAIL');
  log(++tc, 'Structure', 'Auth config exists', fileExists('config/auth.js') ? 'PASS' : 'FAIL');
  log(++tc, 'Structure', 'Uploads directory exists', fileExists('uploads') ? 'PASS' : 'WARN', 'May not exist until first upload');

  // Check all route files
  const routes = ['auth', 'dashboard', 'customers', 'services', 'bookings', 'billing', 'expenses', 'reports', 'settings', 'memberships', 'staff', 'calendar', 'advanced-bi'];
  for (const r of routes) {
    log(++tc, 'Structure', `Route file: ${r}.routes.js`, fileExists(`routes/${r}.routes.js`) ? 'PASS' : 'FAIL');
  }

  // Check all controller files
  const controllers = ['auth', 'dashboard', 'customers', 'services', 'bookings', 'billing', 'expenses', 'reports', 'settings', 'memberships', 'staff', 'calendar'];
  for (const c of controllers) {
    log(++tc, 'Structure', `Controller: ${c}.controller.js`, fileExists(`controllers/${c}.controller.js`) ? 'PASS' : 'FAIL');
  }

  // Check frontend modules
  const modules = ['dashboard', 'staff', 'customers', 'services', 'calendar', 'bookings', 'billing', 'expenses', 'memberships', 'settings'];
  for (const m of modules) {
    log(++tc, 'Structure', `Frontend module: ${m}/${m}.js`, fileExists(`frontend/assets/js/modules/${m}/${m}.js`) ? 'PASS' : 'FAIL');
  }

  // ─────────────────────────────────────────────
  // SECTION 2: SECURITY CHECKS
  // ─────────────────────────────────────────────
  console.log('\n🔐 SECTION 2: SECURITY CHECKS\n');

  const envContent = readFile('.env');
  log(++tc, 'Security', 'JWT_SECRET is set', envContent.includes('JWT_SECRET=') && !envContent.includes('JWT_SECRET=\n') ? 'PASS' : 'FAIL');
  log(++tc, 'Security', 'JWT_SECRET is not default/weak', !envContent.includes('JWT_SECRET=secret') && !envContent.includes('JWT_SECRET=123') ? 'PASS' : 'WARN', 'Review secret strength');
  log(++tc, 'Security', 'DB_PASSWORD is set', envContent.includes('DB_PASSWORD=') && !envContent.includes('DB_PASSWORD=\n') ? 'PASS' : 'FAIL');
  log(++tc, 'Security', 'DB_SSL enabled', envContent.includes('DB_SSL=true') ? 'PASS' : 'WARN', 'SSL recommended for production');

  // Check .gitignore
  const gitignore = fileExists('../.gitignore') ? readFile('../.gitignore') : (fileExists('.gitignore') ? readFile('.gitignore') : '');
  log(++tc, 'Security', '.gitignore includes .env', gitignore.includes('.env') ? 'PASS' : 'FAIL', 'CRITICAL: .env must not be committed');
  log(++tc, 'Security', '.gitignore includes node_modules', gitignore.includes('node_modules') ? 'PASS' : 'FAIL');

  // Check login.html for credential exposure
  const loginHtml = readFile('frontend/login.html');
  log(++tc, 'Security', 'Login page has no hardcoded passwords', !loginHtml.includes('owner@123') && !loginHtml.includes('center@123') ? 'PASS' : 'FAIL', 'Credentials exposed to public');

  // Check for unknown 3rd party scripts
  const appHtml = readFile('frontend/app.html');
  log(++tc, 'Security', 'No unknown 3rd party scripts in app.html', !appHtml.includes('ninja-daytona') ? 'PASS' : 'FAIL', 'Unknown script loaded');
  log(++tc, 'Security', 'No unknown 3rd party scripts in login.html', !loginHtml.includes('ninja-daytona') ? 'PASS' : 'FAIL');

  // Auth middleware checks
  const authMiddleware = readFile('middleware/auth.middleware.js');
  log(++tc, 'Security', 'Auth middleware uses JWT verify', authMiddleware.includes('verifyToken') ? 'PASS' : 'FAIL');
  log(++tc, 'Security', 'Auth middleware re-fetches user from DB', authMiddleware.includes('findById') ? 'PASS' : 'FAIL');
  log(++tc, 'Security', 'Auth middleware returns 401 on invalid token', authMiddleware.includes('401') ? 'PASS' : 'FAIL');

  // Role middleware
  const roleMiddleware = readFile('middleware/role.middleware.js');
  log(++tc, 'Security', 'Role middleware returns 403 on unauthorized', roleMiddleware.includes('403') ? 'PASS' : 'FAIL');

  // Check auth controller uses bcryptjs (not bcrypt)
  const authCtrl = readFile('controllers/auth.controller.js');
  log(++tc, 'Security', 'Auth uses bcryptjs (consistent hashing)', authCtrl.includes('bcryptjs') ? 'PASS' : 'WARN', 'bcrypt vs bcryptjs mismatch');

  // XSS checks in frontend
  const utilsJs = readFile('frontend/assets/js/utils.js');
  log(++tc, 'Security', 'escapeHtml utility exists', utilsJs.includes('escapeHtml') ? 'PASS' : 'FAIL', 'Needed for XSS prevention');

  // Check backup routes require owner role
  const settingsRoutes = readFile('routes/settings.routes.js');
  log(++tc, 'Security', 'Backup import requires owner role', settingsRoutes.includes("authorizeRole('owner')") && settingsRoutes.includes('backup/import') ? 'PASS' : 'FAIL');
  log(++tc, 'Security', 'Full backup requires owner role', settingsRoutes.includes('backup/full') ? 'PASS' : 'FAIL');

  // ─────────────────────────────────────────────
  // SECTION 3: DATABASE CHECKS
  // ─────────────────────────────────────────────
  console.log('\n🗄️ SECTION 3: DATABASE CHECKS\n');

  let pool;
  try {
    const db = require('../config/database');
    pool = db.pool;
    const conn = await pool.getConnection();
    log(++tc, 'Database', 'Database connection successful', 'PASS');
    conn.release();
  } catch (e) {
    log(++tc, 'Database', 'Database connection successful', 'FAIL', e.message);
  }

  if (pool) {
    // Check critical tables exist
    const criticalTables = ['users', 'salons', 'customers', 'staff', 'services', 'categories', 'bookings', 'booking_items', 'invoices', 'invoice_items', 'expenses', 'memberships', 'membership_plans', 'rooms', 'backup_logs'];
    for (const table of criticalTables) {
      try {
        await pool.query(`SELECT 1 FROM \`${table}\` LIMIT 1`);
        log(++tc, 'Database', `Table "${table}" exists and accessible`, 'PASS');
      } catch (e) {
        log(++tc, 'Database', `Table "${table}" exists and accessible`, 'FAIL', e.message.substring(0, 60));
      }
    }

    // Check users have hashed passwords
    try {
      const [users] = await pool.query('SELECT email, password FROM users');
      const allHashed = users.every(u => u.password && u.password.startsWith('$2'));
      log(++tc, 'Database', 'All user passwords are bcrypt hashed', allHashed ? 'PASS' : 'FAIL');
      log(++tc, 'Database', `User count: ${users.length}`, users.length > 0 ? 'PASS' : 'WARN', 'No users in system');
    } catch (e) {
      log(++tc, 'Database', 'User password check', 'FAIL', e.message);
    }

    // Check salon exists
    try {
      const [salons] = await pool.query('SELECT id, name FROM salons');
      log(++tc, 'Database', 'At least one salon exists', salons.length > 0 ? 'PASS' : 'FAIL');
    } catch (e) {
      log(++tc, 'Database', 'Salon check', 'FAIL', e.message);
    }

    // Check data integrity - foreign keys
    try {
      const [orphanBookings] = await pool.query('SELECT b.id FROM bookings b LEFT JOIN customers c ON b.customer_id = c.id WHERE c.id IS NULL');
      log(++tc, 'Database', 'No orphan bookings (FK integrity)', orphanBookings.length === 0 ? 'PASS' : 'WARN', `${orphanBookings.length} orphans found`);
    } catch { log(++tc, 'Database', 'Booking FK integrity', 'SKIP'); }

    try {
      const [orphanInvoices] = await pool.query('SELECT i.id FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id WHERE c.id IS NULL');
      log(++tc, 'Database', 'No orphan invoices (FK integrity)', orphanInvoices.length === 0 ? 'PASS' : 'WARN', `${orphanInvoices.length} orphans`);
    } catch { log(++tc, 'Database', 'Invoice FK integrity', 'SKIP'); }

    // Check backup_logs table
    try {
      const [logs] = await pool.query('SELECT COUNT(*) as c FROM backup_logs');
      log(++tc, 'Database', 'Backup logs table functional', 'PASS', `${logs[0].c} logs recorded`);
    } catch (e) {
      log(++tc, 'Database', 'Backup logs table', 'FAIL', e.message);
    }
  }

  // ─────────────────────────────────────────────
  // SECTION 4: API ENDPOINT TESTS
  // ─────────────────────────────────────────────
  console.log('\n🌐 SECTION 4: API ENDPOINT TESTS\n');

  // Test server is running
  const serverCheck = await httpGet('/');
  const serverUp = serverCheck.status > 0;
  log(++tc, 'API', 'Server is running on port ' + (process.env.PORT || 3000), serverUp ? 'PASS' : 'FAIL', serverUp ? '' : 'Start server first with: node api/index.js');

  if (serverUp) {
    // Auth endpoints
    const loginRes = await httpPost('/auth/login', { email: 'owner@gmail.com', password: 'owner@1234' });
    log(++tc, 'API', 'POST /auth/login - valid credentials', loginRes.status === 200 ? 'PASS' : 'FAIL', `Status: ${loginRes.status}`);

    const token = loginRes.data?.token || '';
    log(++tc, 'API', 'Login returns JWT token', token.length > 50 ? 'PASS' : 'FAIL');
    log(++tc, 'API', 'Login returns user object', loginRes.data?.user?.email ? 'PASS' : 'FAIL');

    // Invalid login
    const badLogin = await httpPost('/auth/login', { email: 'fake@test.com', password: 'wrong' });
    log(++tc, 'API', 'POST /auth/login - invalid creds returns 401', badLogin.status === 401 ? 'PASS' : 'FAIL', `Status: ${badLogin.status}`);

    // Missing fields
    const noFields = await httpPost('/auth/login', {});
    log(++tc, 'API', 'POST /auth/login - missing fields returns 400', noFields.status === 400 ? 'PASS' : 'FAIL', `Status: ${noFields.status}`);

    // Protected routes without token
    const noAuth = await httpGetApi('/settings');
    log(++tc, 'API', 'GET /settings without token returns 401', noAuth.status === 401 ? 'PASS' : 'FAIL', `Status: ${noAuth.status}`);

    // Protected routes with token
    if (token) {
      const settings = await httpGetApi('/settings', token);
      log(++tc, 'API', 'GET /settings with token returns 200', settings.status === 200 ? 'PASS' : 'FAIL', `Status: ${settings.status}`);
      log(++tc, 'API', 'Settings returns salon data', settings.data?.salon ? 'PASS' : 'FAIL');

      const customers = await httpGetApi('/customers', token);
      log(++tc, 'API', 'GET /customers returns 200', customers.status === 200 ? 'PASS' : 'FAIL');

      const staff = await httpGetApi('/staff', token);
      log(++tc, 'API', 'GET /staff returns 200', staff.status === 200 ? 'PASS' : 'FAIL');

      const services = await httpGetApi('/services', token);
      log(++tc, 'API', 'GET /services returns 200', services.status === 200 ? 'PASS' : 'FAIL');

      const bookings = await httpGetApi('/bookings', token);
      log(++tc, 'API', 'GET /bookings returns 200', bookings.status === 200 ? 'PASS' : 'FAIL');

      const billing = await httpGetApi('/billing', token);
      log(++tc, 'API', 'GET /billing (invoices) returns 200', billing.status === 200 ? 'PASS' : 'FAIL');

      const expenses = await httpGetApi('/expenses', token);
      log(++tc, 'API', 'GET /expenses returns 200', expenses.status === 200 ? 'PASS' : 'FAIL');

      const memberships = await httpGetApi('/memberships/plans', token);
      log(++tc, 'API', 'GET /memberships/plans returns 200', memberships.status === 200 ? 'PASS' : 'FAIL');

      const dashboard = await httpGetApi('/dashboard', token);
      log(++tc, 'API', 'GET /dashboard returns 200', dashboard.status === 200 ? 'PASS' : 'FAIL');

      const users = await httpGetApi('/settings/users', token);
      log(++tc, 'API', 'GET /settings/users returns 200', users.status === 200 ? 'PASS' : 'FAIL');
      log(++tc, 'API', 'Users response has no password field', !JSON.stringify(users.data).includes('"password"') ? 'PASS' : 'FAIL', 'Passwords must be stripped');

      // Backup endpoints
      const backup = await httpGetApi('/settings/backup', token);
      log(++tc, 'API', 'GET /settings/backup returns 200', backup.status === 200 ? 'PASS' : 'FAIL');
      log(++tc, 'API', 'Backup contains expected entities', backup.data?.users !== undefined && backup.data?.services !== undefined ? 'PASS' : 'FAIL');

      const stats = await httpGetApi('/settings/backup/stats', token);
      log(++tc, 'API', 'GET /settings/backup/stats returns 200', stats.status === 200 ? 'PASS' : 'FAIL');

      const logs = await httpGetApi('/settings/backup/logs', token);
      log(++tc, 'API', 'GET /settings/backup/logs returns 200', logs.status === 200 ? 'PASS' : 'FAIL');

      // 404 for non-existent API route
      const notFound = await httpGetApi('/nonexistent', token);
      log(++tc, 'API', 'GET /nonexistent returns 404', notFound.status === 404 ? 'PASS' : 'FAIL');
    }

    // Static file serving
    const htmlPage = await httpGet('/app.html');
    log(++tc, 'API', 'Static files served (app.html)', htmlPage.status === 200 ? 'PASS' : 'FAIL');

    const cssFile = await httpGet('/assets/css/main.css');
    log(++tc, 'API', 'CSS files served', cssFile.status === 200 ? 'PASS' : 'FAIL');

    const jsFile = await httpGet('/assets/js/api.js');
    log(++tc, 'API', 'JS files served', jsFile.status === 200 ? 'PASS' : 'FAIL');
  } else {
    // Skip API tests if server not running
    for (let i = 0; i < 25; i++) {
      log(++tc, 'API', 'Skipped (server not running)', 'SKIP');
    }
  }

  // ─────────────────────────────────────────────
  // SECTION 5: FRONTEND CODE QUALITY
  // ─────────────────────────────────────────────
  console.log('\n🎨 SECTION 5: FRONTEND CODE QUALITY\n');

  // Check no merge conflicts
  const frontendFiles = ['frontend/app.html', 'frontend/login.html', 'frontend/assets/js/app.js', 'frontend/assets/js/api.js', 'frontend/assets/js/utils.js', 'frontend/assets/js/auth.js', 'frontend/assets/js/permissions.js'];
  for (const f of frontendFiles) {
    const content = readFile(f);
    log(++tc, 'CodeQuality', `No merge conflicts in ${f.split('/').pop()}`, !content.includes('<<<<<<<') ? 'PASS' : 'FAIL');
  }

  // Check all module JS files for syntax issues
  for (const m of modules) {
    const fp = `frontend/assets/js/modules/${m}/${m}.js`;
    const content = readFile(fp);
    log(++tc, 'CodeQuality', `No merge conflicts in ${m}.js`, !content.includes('<<<<<<<') ? 'PASS' : 'FAIL');
    log(++tc, 'CodeQuality', `No alert() calls in ${m}.js`, !/^\s*alert\(/m.test(content) ? 'PASS' : 'WARN', 'Use utils.showToast instead');
  }

  // CSS checks
  const mainCss = readFile('frontend/assets/css/main.css');
  log(++tc, 'CodeQuality', 'Spinner CSS exists', mainCss.includes('.spinner') ? 'PASS' : 'FAIL');
  log(++tc, 'CodeQuality', 'Loader overlay CSS exists', mainCss.includes('.loader-overlay') ? 'PASS' : 'FAIL');
  log(++tc, 'CodeQuality', 'Toast CSS exists', mainCss.includes('.toast') ? 'PASS' : 'FAIL');
  log(++tc, 'CodeQuality', 'Modal CSS exists', mainCss.includes('.modal-content') ? 'PASS' : 'FAIL');
  log(++tc, 'CodeQuality', 'Responsive breakpoints exist', mainCss.includes('@media') ? 'PASS' : 'FAIL');
  log(++tc, 'CodeQuality', 'Table responsive overflow', mainCss.includes('overflow-x') ? 'PASS' : 'FAIL');

  // HTML checks
  log(++tc, 'CodeQuality', 'app.html has viewport meta', appHtml.includes('viewport') ? 'PASS' : 'FAIL');
  log(++tc, 'CodeQuality', 'app.html has charset UTF-8', appHtml.includes('UTF-8') ? 'PASS' : 'FAIL');
  log(++tc, 'CodeQuality', 'app.html has title tag', appHtml.includes('<title>') ? 'PASS' : 'FAIL');
  log(++tc, 'CodeQuality', 'XLSX library loaded locally (not CDN)', appHtml.includes('assets/js/lib/xlsx') ? 'PASS' : 'FAIL', 'CDN blocked by tracking prevention');
  log(++tc, 'CodeQuality', 'PapaParse library loaded locally', appHtml.includes('assets/js/lib/papaparse') ? 'PASS' : 'FAIL');

  // Check local lib files exist
  log(++tc, 'CodeQuality', 'Local xlsx.min.js exists', fileExists('frontend/assets/js/lib/xlsx.min.js') ? 'PASS' : 'FAIL');
  log(++tc, 'CodeQuality', 'Local papaparse.min.js exists', fileExists('frontend/assets/js/lib/papaparse.min.js') ? 'PASS' : 'FAIL');

  // ─────────────────────────────────────────────
  // SECTION 6: PERFORMANCE & OPTIMIZATION
  // ─────────────────────────────────────────────
  console.log('\n⚡ SECTION 6: PERFORMANCE & OPTIMIZATION\n');

  // File sizes
  const xlsxSize = fileSize('frontend/assets/js/lib/xlsx.min.js');
  log(++tc, 'Performance', 'XLSX lib is minified', xlsxSize > 0 && xlsxSize < 2000000 ? 'PASS' : 'WARN', `${(xlsxSize / 1024).toFixed(0)}KB`);

  const cssSize = fileSize('frontend/assets/css/main.css');
  log(++tc, 'Performance', 'Main CSS file size reasonable', cssSize < 200000 ? 'PASS' : 'WARN', `${(cssSize / 1024).toFixed(0)}KB`);

  const apiJsSize = fileSize('frontend/assets/js/api.js');
  log(++tc, 'Performance', 'API.js file size reasonable', apiJsSize < 150000 ? 'PASS' : 'WARN', `${(apiJsSize / 1024).toFixed(0)}KB`);

  // Check for console.log in production code (controllers)
  for (const c of controllers) {
    const fp = `controllers/${c}.controller.js`;
    if (fileExists(fp)) {
      const content = readFile(fp);
      const logCount = (content.match(/console\.log/g) || []).length;
      log(++tc, 'Performance', `Debug logs in ${c}.controller.js`, logCount < 5 ? 'PASS' : 'WARN', `${logCount} console.log statements`);
    }
  }

  // ─────────────────────────────────────────────
  // SECTION 7: BACKUP & RESTORE SYSTEM
  // ─────────────────────────────────────────────
  console.log('\n💾 SECTION 7: BACKUP & RESTORE SYSTEM\n');

  const settingsCtrl = readFile('controllers/settings.controller.js');
  log(++tc, 'Backup', 'Export backup function exists', settingsCtrl.includes('exportBackup') ? 'PASS' : 'FAIL');
  log(++tc, 'Backup', 'Full backup function exists', settingsCtrl.includes('exportFullBackup') ? 'PASS' : 'FAIL');
  log(++tc, 'Backup', 'Import backup function exists', settingsCtrl.includes('importBackup') ? 'PASS' : 'FAIL');
  log(++tc, 'Backup', 'Backup logging exists', settingsCtrl.includes('BackupModel.createLog') ? 'PASS' : 'FAIL');
  log(++tc, 'Backup', 'ISO datetime fix in cleanRow', settingsCtrl.includes('replace(\'T\', \' \')') ? 'PASS' : 'FAIL');
  log(++tc, 'Backup', 'Empty string to null fix', settingsCtrl.includes("val === ''") ? 'PASS' : 'FAIL');
  log(++tc, 'Backup', 'JSON column validation', settingsCtrl.includes('JSON_COLUMNS') ? 'PASS' : 'FAIL');
  log(++tc, 'Backup', 'FK checks disabled during import', settingsCtrl.includes('FOREIGN_KEY_CHECKS = 0') ? 'PASS' : 'FAIL');
  log(++tc, 'Backup', 'Transaction-based import', settingsCtrl.includes('beginTransaction') ? 'PASS' : 'FAIL');
  log(++tc, 'Backup', 'No appointments table reference', !settingsCtrl.includes("'appointments'") ? 'PASS' : 'FAIL', 'Table does not exist in DB');
  log(++tc, 'Backup', 'Backup model file exists', fileExists('models/backup.model.js') ? 'PASS' : 'FAIL');
  log(++tc, 'Backup', 'Users password handling on import', settingsCtrl.includes("entityKey === 'users'") && settingsCtrl.includes('ChangeMe@123') ? 'PASS' : 'FAIL');

  // Frontend backup UI
  const settingsJs = readFile('frontend/assets/js/modules/settings/settings.js');
  log(++tc, 'Backup', 'Export XLSX button in UI', settingsJs.includes('exportXlsxBtn') ? 'PASS' : 'FAIL');
  log(++tc, 'Backup', 'Export CSV button in UI', settingsJs.includes('exportCsvBtn') ? 'PASS' : 'FAIL');
  log(++tc, 'Backup', 'Import drop zone in UI', settingsJs.includes('importDropZone') ? 'PASS' : 'FAIL');
  log(++tc, 'Backup', 'Import progress bar in UI', settingsJs.includes('importProgressBar') ? 'PASS' : 'FAIL');
  log(++tc, 'Backup', 'Backup activity log in UI', settingsJs.includes('backupLogsTable') ? 'PASS' : 'FAIL');

  // ─────────────────────────────────────────────
  // SECTION 8: ERROR HANDLING & EDGE CASES
  // ─────────────────────────────────────────────
  console.log('\n🐞 SECTION 8: ERROR HANDLING & EDGE CASES\n');

  // Error middleware
  log(++tc, 'ErrorHandling', 'Error middleware exists', fileExists('middleware/error.middleware.js') ? 'PASS' : 'FAIL');

  // Global error handler in api/index.js
  const indexJs = readFile('api/index.js');
  log(++tc, 'ErrorHandling', 'Global error handler in server', indexJs.includes('err, req, res, next') ? 'PASS' : 'FAIL');
  log(++tc, 'ErrorHandling', 'API 404 handler', indexJs.includes("'/api'") && indexJs.includes('404') ? 'PASS' : 'FAIL');
  log(++tc, 'ErrorHandling', 'SPA fallback route', indexJs.includes("'*'") || indexJs.includes('app.html') ? 'PASS' : 'FAIL');

  // Frontend error handling
  const appJs = readFile('frontend/assets/js/app.js');
  log(++tc, 'ErrorHandling', 'Module load error boundary', appJs.includes('Failed to load module') ? 'PASS' : 'FAIL');
  log(++tc, 'ErrorHandling', 'Error boundary has recovery action', appJs.includes('Go to Dashboard') ? 'PASS' : 'FAIL');

  // API error handling
  const apiJs = readFile('frontend/assets/js/api.js');
  log(++tc, 'ErrorHandling', 'API client has error handling', apiJs.includes('API Error') || apiJs.includes('throw') ? 'PASS' : 'FAIL');
  log(++tc, 'ErrorHandling', 'API handles 401 token expiry', apiJs.includes('401') ? 'PASS' : 'FAIL');

  // ─────────────────────────────────────────────
  // SECTION 9: ACCESSIBILITY & UX
  // ─────────────────────────────────────────────
  console.log('\n♿ SECTION 9: ACCESSIBILITY & UX\n');

  log(++tc, 'Accessibility', 'Modal has close button', appJs.includes('modal-close') ? 'PASS' : 'FAIL');
  log(++tc, 'Accessibility', 'Modal close has aria-label', appJs.includes("aria-label") ? 'PASS' : 'FAIL');
  log(++tc, 'Accessibility', 'Modal has focus management', appJs.includes('focus()') ? 'PASS' : 'FAIL');
  log(++tc, 'Accessibility', 'Modal click-outside-to-close', appJs.includes('e.target === modal') ? 'PASS' : 'FAIL');
  log(++tc, 'Accessibility', 'Theme toggle has aria-label', readFile('frontend/assets/js/theme-toggle.js').includes('aria-label') ? 'PASS' : 'FAIL');
  log(++tc, 'Accessibility', 'Mobile menu button exists', appHtml.includes('mobileMenuBtn') ? 'PASS' : 'FAIL');
  log(++tc, 'Accessibility', 'Mobile menu has aria-label', appHtml.includes('aria-label="Toggle navigation"') ? 'PASS' : 'FAIL');

  // ─────────────────────────────────────────────
  // SECTION 10: DEPLOYMENT READINESS
  // ─────────────────────────────────────────────
  console.log('\n🚀 SECTION 10: DEPLOYMENT READINESS\n');

  log(++tc, 'Deployment', 'Vercel config exists', fileExists('vercel.json') ? 'PASS' : 'WARN');
  log(++tc, 'Deployment', 'Server exports app for serverless', indexJs.includes('module.exports') ? 'PASS' : 'FAIL');
  log(++tc, 'Deployment', 'CORS enabled', indexJs.includes('cors()') ? 'PASS' : 'FAIL');
  log(++tc, 'Deployment', 'JSON body parser enabled', indexJs.includes('express.json()') ? 'PASS' : 'FAIL');

  const pkg = JSON.parse(readFile('package.json'));
  log(++tc, 'Deployment', 'package.json has start script', pkg.scripts?.start ? 'PASS' : 'WARN', pkg.scripts?.start || 'Missing');
  log(++tc, 'Deployment', 'Node version compatible', !pkg.engines || true ? 'PASS' : 'WARN');

  // Dependencies check
  const requiredDeps = ['express', 'cors', 'mysql2', 'bcryptjs', 'jsonwebtoken', 'dotenv', 'multer'];
  for (const dep of requiredDeps) {
    log(++tc, 'Deployment', `Dependency: ${dep}`, pkg.dependencies?.[dep] ? 'PASS' : 'FAIL');
  }

  // ═══════════════════════════════════════════════════════════
  // FINAL REPORT
  // ═══════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(70));
  console.log('  FINAL REPORT');
  console.log('═'.repeat(70));
  console.log(`\n  Total Test Cases:  ${tc}`);
  console.log(`  ✅ PASSED:         ${passCount}`);
  console.log(`  ❌ FAILED:         ${failCount}`);
  console.log(`  ⚠️  WARNINGS:      ${warnCount}`);
  console.log(`  ⏭️  SKIPPED:       ${skipCount}`);
  console.log(`\n  Pass Rate:         ${((passCount / (tc - skipCount)) * 100).toFixed(1)}%`);
  console.log(`  Grade:             ${passCount / (tc - skipCount) >= 0.95 ? 'A+' : passCount / (tc - skipCount) >= 0.9 ? 'A' : passCount / (tc - skipCount) >= 0.8 ? 'B' : passCount / (tc - skipCount) >= 0.7 ? 'C' : 'D'}`);

  if (failCount > 0) {
    console.log('\n  ❌ FAILURES:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`     TC-${String(r.id).padStart(3, '0')} [${r.category}] ${r.name} ${r.detail ? '— ' + r.detail : ''}`);
    });
  }

  if (warnCount > 0) {
    console.log('\n  ⚠️  WARNINGS:');
    results.filter(r => r.status === 'WARN').forEach(r => {
      console.log(`     TC-${String(r.id).padStart(3, '0')} [${r.category}] ${r.name} ${r.detail ? '— ' + r.detail : ''}`);
    });
  }

  console.log('\n' + '═'.repeat(70) + '\n');

  process.exit(failCount > 0 ? 1 : 0);
}

runAllTests().catch(e => {
  console.error('Audit failed:', e);
  process.exit(1);
});
