let users = [];

export async function render(container) {
  const currentUser = auth.getCurrentUser();
  const userRole = currentUser?.role;

  if (!permissions.can(userRole, 'manageSettings')) {
    container.innerHTML = `
      <div class="card">
        <h3>Access Denied</h3>
        <p>You don't have permission to access settings.</p>
      </div>
    `;
    return;
  }

  let savedSettings = {};
  try {
    savedSettings = await api.settings.get();
  } catch (error) {
    console.log('Using default settings');
  }

  container.innerHTML = `
    <div class="card mb-3">
      <h3>Salon Settings</h3>
      <form id="salonSettingsForm">
        <div class="form-group">
          <label for="salonName">Salon Name</label>
          <input type="text" id="salonName" name="name" value="${savedSettings.salon?.name || 'My Salon'}">
        </div>
        <div class="form-group">
          <label for="salonAddress">Address</label>
          <input type="text" id="salonAddress" name="address" value="${savedSettings.salon?.address || ''}">
        </div>
        <div class="form-group">
          <label for="salonPhone">Phone</label>
          <input type="tel" id="salonPhone" name="phone" value="${savedSettings.salon?.phone || ''}">
        </div>
        <div class="form-group">
          <label for="salonEmail">Email</label>
          <input type="email" id="salonEmail" name="email" value="${savedSettings.salon?.email || ''}">
        </div>
        <div class="form-row">
          <div class="form-group" style="flex:1; min-width:150px;">
            <label for="workingHoursStart">Working Hours Start</label>
            <input type="time" id="workingHoursStart" name="working_hours_start" value="${savedSettings.salon?.working_hours_start || '08:00'}">
          </div>
          <div class="form-group" style="flex:1; min-width:150px;">
            <label for="workingHoursEnd">Working Hours End</label>
            <input type="time" id="workingHoursEnd" name="working_hours_end" value="${savedSettings.salon?.working_hours_end || '22:00'}">
          </div>
        </div>

        <div class="form-group">
          <label for="salonGstin">GSTIN Number</label>
          <input type="text" id="salonGstin" name="gstin" value="${savedSettings.salon?.gstin || ''}"
                 placeholder="e.g. 27AAAAA0000A1Z5" pattern="[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}">
          <small class="text-muted">15-character alphanumeric code for tax identification</small>
        </div>

        <div class="form-group">
          <label for="companyLogo">Company Logo</label>
          <div class="logo-upload-container">
            <input type="file" id="companyLogo" name="logo" accept="image/*" style="display: none;">
            <div class="logo-preview" id="logoPreview">
              ${savedSettings.salon?.logo ? `<img src="${savedSettings.salon.logo}" alt="Company Logo" style="max-width: 150px; max-height: 100px; object-fit: contain;">` : '<div class="no-logo-placeholder">No logo uploaded</div>'}
            </div>
            <div class="logo-actions mt-2">
              <button type="button" class="btn btn-sm btn-outline" onclick="document.getElementById('companyLogo').click()">Choose Logo</button>
              ${savedSettings.salon?.logo ? '<button type="button" class="btn btn-sm btn-danger" id="removeLogo">Remove Logo</button>' : ''}
            </div>
          </div>
        </div>

        <div class="form-group">
          <label>GST Configuration</label>
          <div style="margin-bottom:8px; display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" id="gstEnabled" style="width: auto; margin: 0; min-height: auto;" ${savedSettings.billing?.gst_enabled ? 'checked' : ''}>
            <label for="gstEnabled" style="margin: 0;">Enable GST</label>
          </div>
          <div style="display:flex; gap:10px;">
            <div style="flex:1;">
              <label>GST Type</label>
              <select id="gstType">
                <option value="intra" ${savedSettings.billing?.gst_type === 'intra' ? 'selected' : ''}>Intra State (CGST + SGST)</option>
                <option value="inter" ${savedSettings.billing?.gst_type === 'inter' ? 'selected' : ''}>Inter State (IGST)</option>
              </select>
            </div>
            <div style="flex:1;">
              <label>Total GST %</label>
              <input type="number" id="gstRate" value="${savedSettings.billing?.gst_rate || 18}" step="0.1">
            </div>
          </div>
        </div>

        <div class="form-group">
          <label for="invoicePrefix">Invoice Prefix</label>
          <input type="text" id="invoicePrefix" name="invoicePrefix" value="${savedSettings.billing?.invoicePrefix || 'INV'}" maxlength="10">
        </div>

        <div class="form-group">
          <label for="nextInvoiceNumber">Next Invoice Number</label>
          <input type="number" id="nextInvoiceNumber" name="nextInvoiceNumber" value="${savedSettings.billing?.nextInvoiceNumber || 1001}" min="1">
        </div>

        <button type="submit" class="btn btn-primary mt-2">Save Settings</button>
      </form>
    </div>

    ${permissions.can(userRole, 'manageSettings') ? renderBackupSection(userRole) : ''}

    ${permissions.can(userRole, 'manageUsers') ? `
      <div class="card">
        <div class="table-header">
          <h4>Users</h4>
          <button id="addUserBtn" class="btn btn-primary btn-sm">Add User</button>
        </div>
        <div id="usersTable">Loading...</div>
      </div>
    ` : ''}
  `;

  attachEventListeners(container, savedSettings);

  if (permissions.can(userRole, 'manageUsers')) {
    loadUsers(container);
  }

  // Load backup stats and logs
  loadBackupDashboard(container);
}

// ═══════════════════════════════════════════════════════════════
// BACKUP & RESTORE SECTION
// ═══════════════════════════════════════════════════════════════

function renderBackupSection(userRole) {
  const isOwner = userRole === 'owner';

  return `
    <div class="card mb-3">
      <h4 style="margin-bottom: 4px;"><i class="fas fa-database"></i> Backup & Restore Center</h4>
      <p class="text-muted" style="margin-bottom: 16px;">Manage your salon data backups. Export to Excel/CSV, import from files, and track all backup activity.</p>

      <!-- Stats Row -->
      <div id="backupStats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 20px;">
        <div style="background: var(--bg-tertiary, #1a2332); border-radius: 8px; padding: 14px; text-align: center;">
          <div style="font-size: 22px; font-weight: 700; color: var(--primary, #00d4aa);" id="statTotalRecords">--</div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Total Records</div>
        </div>
        <div style="background: var(--bg-tertiary, #1a2332); border-radius: 8px; padding: 14px; text-align: center;">
          <div style="font-size: 22px; font-weight: 700; color: var(--primary, #00d4aa);" id="statTables">--</div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Tables</div>
        </div>
        <div style="background: var(--bg-tertiary, #1a2332); border-radius: 8px; padding: 14px; text-align: center;">
          <div style="font-size: 22px; font-weight: 700; color: #4fc3f7;" id="statExports">--</div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Exports</div>
        </div>
        <div style="background: var(--bg-tertiary, #1a2332); border-radius: 8px; padding: 14px; text-align: center;">
          <div style="font-size: 22px; font-weight: 700; color: #ffb74d;" id="statImports">--</div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Imports</div>
        </div>
        <div style="background: var(--bg-tertiary, #1a2332); border-radius: 8px; padding: 14px; text-align: center;">
          <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);" id="statLastBackup">Never</div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Last Backup</div>
        </div>
      </div>

      <!-- Export Section -->
      <div style="background: var(--bg-tertiary, #1a2332); border-radius: 8px; padding: 16px; margin-bottom: 12px;">
        <h5 style="margin: 0 0 10px 0;"><i class="fas fa-download"></i> Export Backup</h5>
        <p class="text-muted" style="font-size: 12px; margin-bottom: 12px;">Download all salon data including customers, services, bookings, invoices, staff, memberships, and more.</p>
        <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
          <button id="exportXlsxBtn" class="btn btn-primary btn-sm">
            <i class="fas fa-file-excel"></i> Export Excel (.xlsx)
          </button>
          <button id="exportCsvBtn" class="btn btn-sm" style="background: #43a047; color: white;">
            <i class="fas fa-file-csv"></i> Export CSV (.csv)
          </button>
          ${isOwner ? `
            <button id="exportFullBtn" class="btn btn-sm" style="background: #e53935; color: white;">
              <i class="fas fa-shield-alt"></i> Full Backup (with passwords)
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Import Section -->
      ${isOwner ? `
        <div style="background: var(--bg-tertiary, #1a2332); border-radius: 8px; padding: 16px; margin-bottom: 12px;">
          <h5 style="margin: 0 0 10px 0;"><i class="fas fa-upload"></i> Import / Restore Backup</h5>
          <p class="text-muted" style="font-size: 12px; margin-bottom: 12px;">Restore data from a previously exported Excel (.xlsx), CSV (.csv), or JSON file.</p>

          <div style="display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 250px;">
              <div id="importDropZone" style="border: 2px dashed var(--border-color, #2d3748); border-radius: 8px; padding: 24px; text-align: center; cursor: pointer; transition: all 0.2s;">
                <input type="file" id="importFileInput" accept=".xlsx,.xls,.csv,.json" style="display: none;">
                <i class="fas fa-cloud-upload-alt" style="font-size: 28px; color: var(--text-muted); margin-bottom: 8px; display: block;"></i>
                <p style="margin: 0; font-size: 13px; color: var(--text-muted);">
                  Drop file here or <span style="color: var(--primary, #00d4aa); cursor: pointer;">browse</span>
                </p>
                <small class="text-muted">Supports: .xlsx, .csv, .json (max 50MB)</small>
              </div>
              <div id="importFileInfo" style="display: none; margin-top: 8px; padding: 8px 12px; background: var(--bg-secondary, #0f1923); border-radius: 6px;">
                <span id="importFileName" style="font-size: 12px;"></span>
                <button id="importFileClear" class="btn btn-sm btn-danger" style="float: right; padding: 2px 8px; font-size: 11px;">Remove</button>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
              <label style="font-size: 12px; font-weight: 600;">Import Mode:</label>
              <select id="importMode" style="min-width: 140px;">
                <option value="merge">Merge (keep existing + add new)</option>
                <option value="replace">Replace (delete existing first)</option>
              </select>
              <button id="importStartBtn" class="btn btn-primary btn-sm" disabled>
                <i class="fas fa-upload"></i> Start Import
              </button>
            </div>
          </div>

          <div id="importProgress" style="display: none; margin-top: 12px;">
            <div style="background: var(--bg-secondary, #0f1923); border-radius: 6px; padding: 12px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span id="importProgressLabel" style="font-size: 12px;">Importing...</span>
                <span id="importProgressPercent" style="font-size: 12px;">0%</span>
              </div>
              <div style="background: var(--border-color, #2d3748); border-radius: 4px; height: 6px; overflow: hidden;">
                <div id="importProgressBar" style="background: var(--primary, #00d4aa); height: 100%; width: 0%; transition: width 0.3s;"></div>
              </div>
            </div>
          </div>

          <div id="importResult" style="display: none; margin-top: 12px;"></div>
        </div>
      ` : ''}

      <!-- Backup History / Logs -->
      <div style="background: var(--bg-tertiary, #1a2332); border-radius: 8px; padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <h5 style="margin: 0;"><i class="fas fa-history"></i> Backup Activity Log</h5>
          <button id="refreshLogsBtn" class="btn btn-sm btn-outline" style="padding: 4px 10px; font-size: 11px;">
            <i class="fas fa-sync-alt"></i> Refresh
          </button>
        </div>
        <div id="backupLogsTable" style="max-height: 300px; overflow-y: auto;">
          <p class="text-muted text-center" style="font-size: 13px;">Loading activity log...</p>
        </div>
      </div>
    </div>
  `;
}

async function loadBackupDashboard(container) {
  // Load stats
  try {
    const stats = await api.settings.getBackupStats();
    const el = (id) => container.querySelector(`#${id}`);
    if (el('statTotalRecords')) el('statTotalRecords').textContent = stats.totalDataRecords?.toLocaleString() || '0';
    if (el('statTables')) el('statTables').textContent = stats.tablesCount || '0';
    if (el('statExports')) el('statExports').textContent = stats.totalExports || '0';
    if (el('statImports')) el('statImports').textContent = stats.totalImports || '0';
    if (el('statLastBackup')) {
      if (stats.lastBackup) {
        const d = new Date(stats.lastBackup.created_at);
        el('statLastBackup').textContent = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else {
        el('statLastBackup').textContent = 'Never';
      }
    }
  } catch (err) {
    console.warn('Failed to load backup stats:', err);
  }

  // Load logs
  loadBackupLogs(container);
}

async function loadBackupLogs(container) {
  const logsContainer = container.querySelector('#backupLogsTable');
  if (!logsContainer) return;

  try {
    const logs = await api.settings.getBackupLogs(30);

    if (!logs || logs.length === 0) {
      logsContainer.innerHTML = '<p class="text-muted text-center" style="font-size: 13px; padding: 20px 0;">No backup activity yet. Create your first backup above.</p>';
      return;
    }

    logsContainer.innerHTML = `
      <table style="width: 100%; font-size: 12px;">
        <thead>
          <tr style="border-bottom: 1px solid var(--border-color, #2d3748);">
            <th style="padding: 6px 8px; text-align: left;">Date</th>
            <th style="padding: 6px 8px; text-align: left;">Action</th>
            <th style="padding: 6px 8px; text-align: left;">Format</th>
            <th style="padding: 6px 8px; text-align: left;">Records</th>
            <th style="padding: 6px 8px; text-align: left;">Tables</th>
            <th style="padding: 6px 8px; text-align: left;">User</th>
            <th style="padding: 6px 8px; text-align: left;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${logs.map(log => {
            const d = new Date(log.created_at);
            const dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const actionIcon = log.action === 'export' ? 'fa-download' : 'fa-upload';
            const actionColor = log.action === 'export' ? '#4fc3f7' : '#ffb74d';
            const statusColor = log.status === 'success' ? '#66bb6a' : (log.status === 'partial' ? '#ffb74d' : '#ef5350');
            const statusIcon = log.status === 'success' ? 'fa-check-circle' : (log.status === 'partial' ? 'fa-exclamation-circle' : 'fa-times-circle');

            return `
              <tr style="border-bottom: 1px solid var(--border-color, #2d3748);">
                <td style="padding: 6px 8px; white-space: nowrap;">${dateStr}</td>
                <td style="padding: 6px 8px;">
                  <i class="fas ${actionIcon}" style="color: ${actionColor}; margin-right: 4px;"></i>
                  ${log.action.charAt(0).toUpperCase() + log.action.slice(1)}
                </td>
                <td style="padding: 6px 8px;">
                  <span style="background: var(--bg-secondary, #0f1923); padding: 2px 6px; border-radius: 4px; font-size: 11px;">${(log.format || 'json').toUpperCase()}</span>
                </td>
                <td style="padding: 6px 8px;">${(log.total_records || 0).toLocaleString()}</td>
                <td style="padding: 6px 8px;">${log.tables_count || 0}</td>
                <td style="padding: 6px 8px;">${log.user_name || 'System'}</td>
                <td style="padding: 6px 8px;">
                  <i class="fas ${statusIcon}" style="color: ${statusColor}; margin-right: 3px;"></i>
                  <span style="color: ${statusColor};">${log.status}</span>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    console.warn('Failed to load backup logs:', err);
    logsContainer.innerHTML = '<p class="text-muted text-center" style="font-size: 13px;">Failed to load backup logs.</p>';
  }
}

// ═══════════════════════════════════════════════════════════════
// BACKUP EXPORT HANDLERS
// ═══════════════════════════════════════════════════════════════

const ENTITIES_LIST = [
  'users', 'staff', 'customers', 'services', 'bookings',
  'invoices', 'invoice_items', 'expenses',
  'categories', 'rooms', 'service_rooms',
  'service_combos', 'combo_services',
  'booking_items',
  'membership_plans', 'memberships', 'membership_payments',
  'guest_passes', 'membership_plan_allowed_categories', 'membership_plan_time_restrictions',
  'staff_attendance', 'staff_leaves', 'staff_leave_balance',
  'staff_schedule', 'staff_performance', 'staff_commission',
  'salon_settings'
];

// Excel sheet names max 31 chars — map long names to short ones
const SHEET_NAME_MAP = {};
const SHEET_NAME_REVERSE = {};
ENTITIES_LIST.forEach(name => {
  const short = name.substring(0, 31);
  SHEET_NAME_MAP[name] = short;
  SHEET_NAME_REVERSE[short] = name;
});
// Override the ones that actually get truncated
SHEET_NAME_MAP['membership_plan_allowed_categories'] = 'mbr_plan_allowed_cats';
SHEET_NAME_REVERSE['mbr_plan_allowed_cats'] = 'membership_plan_allowed_categories';
SHEET_NAME_MAP['membership_plan_time_restrictions'] = 'mbr_plan_time_restrict';
SHEET_NAME_REVERSE['mbr_plan_time_restrict'] = 'membership_plan_time_restrictions';

// Excel date serial number to JS Date
function excelDateToISO(serial) {
  if (typeof serial !== 'number' || serial < 1) return serial;
  // Excel epoch is 1900-01-01, but has a leap year bug for 1900
  const utcDays = Math.floor(serial) - 25569;
  const utcMs = utcDays * 86400000;
  const fractionalDay = serial - Math.floor(serial);
  const timeMs = Math.round(fractionalDay * 86400000);
  const d = new Date(utcMs + timeMs);
  if (isNaN(d.getTime())) return serial;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

// Columns that contain date/datetime values
const DATE_COLUMNS = [
  'created_at', 'updated_at', 'deleted_at', 'booking_date', 'invoice_date',
  'expense_date', 'start_date', 'end_date', 'date', 'clock_in', 'clock_out',
  'leave_date', 'start_time', 'end_time', 'week_start_date', 'period_start',
  'period_end', 'payment_date', 'used_at', 'expires_at', 'last_visit'
];

function fixExcelDates(rows) {
  return rows.map(row => {
    const fixed = { ...row };
    for (const key of Object.keys(fixed)) {
      if (DATE_COLUMNS.includes(key) && typeof fixed[key] === 'number') {
        fixed[key] = excelDateToISO(fixed[key]);
      }
    }
    return fixed;
  });
}

async function handleExportXlsx(btn, includePasswords = false) {
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';
  btn.disabled = true;

  try {
    const data = includePasswords
      ? await api.settings.exportFullBackup()
      : await api.settings.exportBackup();

    await utils.ensureXLSX();

    const wb = XLSX.utils.book_new();
    let downloadCount = 0;

    ENTITIES_LIST.forEach(entity => {
      if (data[entity] && data[entity].length > 0) {
        const ws = XLSX.utils.json_to_sheet(data[entity], { dateNF: 'yyyy-mm-dd hh:mm:ss' });
        XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME_MAP[entity] || entity.substring(0, 31));
        downloadCount++;
      }
    });

    if (downloadCount > 0) {
      const prefix = includePasswords ? 'salon_full_backup' : 'salon_backup';
      XLSX.writeFile(wb, `${prefix}_${new Date().toISOString().split('T')[0]}.xlsx`);
      utils.showToast(`Exported ${downloadCount} tables to Excel`, 'success');
    } else {
      utils.showToast('No data available to export', 'info');
    }
  } catch (error) {
    console.error('Export error:', error);
    utils.showToast('Export failed: ' + error.message, 'error');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
    loadBackupDashboard(document.getElementById('contentArea'));
  }
}

async function handleExportCsv(btn) {
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';
  btn.disabled = true;

  try {
    const data = await api.settings.exportBackup();

    await utils.ensurePapaParse();

    // Create a zip-like approach: download each table as separate CSV bundled in a single multi-sheet approach
    // Or create one CSV per table and zip them. For simplicity, we'll create one combined JSON + individual CSVs
    let downloadCount = 0;
    const csvParts = [];

    ENTITIES_LIST.forEach(entity => {
      if (data[entity] && data[entity].length > 0) {
        const csv = Papa.unparse(data[entity]);
        csvParts.push(`\n===== ${entity.toUpperCase()} =====\n${csv}`);
        downloadCount++;
      }
    });

    if (downloadCount > 0) {
      const combined = `SALON BACKUP - ${new Date().toISOString()}\nTotal Tables: ${downloadCount}\n` + csvParts.join('\n');
      const blob = new Blob([combined], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `salon_backup_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      utils.showToast(`Exported ${downloadCount} tables to CSV`, 'success');
    } else {
      utils.showToast('No data available to export', 'info');
    }
  } catch (error) {
    console.error('CSV export error:', error);
    utils.showToast('Export failed: ' + error.message, 'error');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
    loadBackupDashboard(document.getElementById('contentArea'));
  }
}

// ═══════════════════════════════════════════════════════════════
// BACKUP IMPORT HANDLERS
// ═══════════════════════════════════════════════════════════════

let selectedImportFile = null;
let parsedImportData = null;

function setupImportHandlers(container) {
  const dropZone = container.querySelector('#importDropZone');
  const fileInput = container.querySelector('#importFileInput');
  const fileInfo = container.querySelector('#importFileInfo');
  const fileName = container.querySelector('#importFileName');
  const fileClear = container.querySelector('#importFileClear');
  const startBtn = container.querySelector('#importStartBtn');

  if (!dropZone) return;

  // Click to browse
  dropZone.addEventListener('click', () => fileInput.click());

  // Drag and drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--primary, #00d4aa)';
    dropZone.style.background = 'rgba(0, 212, 170, 0.05)';
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = 'var(--border-color, #2d3748)';
    dropZone.style.background = '';
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--border-color, #2d3748)';
    dropZone.style.background = '';
    if (e.dataTransfer.files.length > 0) {
      handleImportFile(e.dataTransfer.files[0], container);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleImportFile(e.target.files[0], container);
    }
  });

  if (fileClear) {
    fileClear.addEventListener('click', () => {
      selectedImportFile = null;
      parsedImportData = null;
      fileInfo.style.display = 'none';
      dropZone.style.display = '';
      startBtn.disabled = true;
      fileInput.value = '';
    });
  }

  if (startBtn) {
    startBtn.addEventListener('click', () => executeImport(container));
  }
}

async function handleImportFile(file, container) {
  const fileInfo = container.querySelector('#importFileInfo');
  const fileNameEl = container.querySelector('#importFileName');
  const dropZone = container.querySelector('#importDropZone');
  const startBtn = container.querySelector('#importStartBtn');

  const ext = file.name.split('.').pop().toLowerCase();
  const validExts = ['xlsx', 'xls', 'csv', 'json'];

  if (!validExts.includes(ext)) {
    utils.showToast('Invalid file type. Please use .xlsx, .csv, or .json', 'error');
    return;
  }

  if (file.size > 50 * 1024 * 1024) {
    utils.showToast('File too large. Maximum 50MB allowed.', 'error');
    return;
  }

  selectedImportFile = file;

  // Pre-load libraries needed for parsing
  try {
    if (ext === 'xlsx' || ext === 'xls') await utils.ensureXLSX();
    if (ext === 'csv') await utils.ensurePapaParse();
  } catch (e) {
    utils.showToast('Failed to load parser library: ' + e.message, 'error');
    return;
  }
  const sizeStr = file.size > 1024 * 1024
    ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
    : (file.size / 1024).toFixed(1) + ' KB';

  fileNameEl.innerHTML = `<i class="fas fa-file"></i> <strong>${file.name}</strong> (${sizeStr})`;
  fileInfo.style.display = 'block';
  dropZone.style.display = 'none';

  // Parse the file client-side
  try {
    parsedImportData = await parseImportFile(file, ext);
    const tableCount = Object.keys(parsedImportData).filter(k => parsedImportData[k]?.length > 0).length;
    const recordCount = Object.values(parsedImportData).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
    fileNameEl.innerHTML += `<br><small class="text-muted">${tableCount} tables, ${recordCount.toLocaleString()} records detected</small>`;
    startBtn.disabled = false;
  } catch (err) {
    utils.showToast('Failed to parse file: ' + err.message, 'error');
    fileNameEl.innerHTML += '<br><small style="color: #ef5350;">Parse error: ' + err.message + '</small>';
    startBtn.disabled = true;
  }
}

async function parseImportFile(file, ext) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = function (e) {
      try {
        if (ext === 'json') {
          resolve(JSON.parse(e.target.result));
        } else if (ext === 'xlsx' || ext === 'xls') {
          if (typeof XLSX === 'undefined') {
            reject(new Error('Excel library not loaded'));
            return;
          }
          const workbook = XLSX.read(e.target.result, { type: 'array', cellDates: false });
          const data = {};
          workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            // Reverse-map truncated/short sheet name back to full entity name
            const entityName = SHEET_NAME_REVERSE[sheetName] || sheetName;
            const rows = XLSX.utils.sheet_to_json(worksheet, { raw: true });
            // Fix Excel date serial numbers back to ISO strings
            data[entityName] = fixExcelDates(rows);
          });
          resolve(data);
        } else if (ext === 'csv') {
          if (typeof Papa === 'undefined') {
            reject(new Error('CSV library not loaded'));
            return;
          }
          // Parse multi-section CSV (our export format)
          const text = e.target.result;
          const data = {};
          let currentEntity = null;
          let currentCsvBlock = [];

          const lines = text.split('\n');
          for (const line of lines) {
            const sectionMatch = line.match(/^===== (.+) =====$/);
            if (sectionMatch) {
              // Save previous entity
              if (currentEntity && currentCsvBlock.length > 0) {
                const parsed = Papa.parse(currentCsvBlock.join('\n'), { header: true, skipEmptyLines: true });
                data[currentEntity] = parsed.data;
              }
              currentEntity = sectionMatch[1].toLowerCase();
              currentCsvBlock = [];
            } else if (currentEntity) {
              currentCsvBlock.push(line);
            }
          }
          // Save last entity
          if (currentEntity && currentCsvBlock.length > 0) {
            const parsed = Papa.parse(currentCsvBlock.join('\n'), { header: true, skipEmptyLines: true });
            data[currentEntity] = parsed.data;
          }
          resolve(data);
        } else {
          reject(new Error('Unsupported file format'));
        }
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));

    if (ext === 'xlsx' || ext === 'xls') {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  });
}

async function executeImport(container) {
  if (!parsedImportData) {
    utils.showToast('No file loaded', 'error');
    return;
  }

  const mode = container.querySelector('#importMode')?.value || 'merge';
  const startBtn = container.querySelector('#importStartBtn');
  const progressDiv = container.querySelector('#importProgress');
  const progressBar = container.querySelector('#importProgressBar');
  const progressLabel = container.querySelector('#importProgressLabel');
  const progressPercent = container.querySelector('#importProgressPercent');
  const resultDiv = container.querySelector('#importResult');

  // Confirm for replace mode
  if (mode === 'replace') {
    if (!confirm('WARNING: Replace mode will DELETE all existing data before importing. This cannot be undone. Are you sure?')) {
      return;
    }
  }

  startBtn.disabled = true;
  startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importing...';
  progressDiv.style.display = 'block';
  resultDiv.style.display = 'none';

  // Animate progress
  progressBar.style.width = '30%';
  progressLabel.textContent = 'Sending data to server...';
  progressPercent.textContent = '30%';

  try {
    const ext = selectedImportFile?.name.split('.').pop().toLowerCase() || 'json';

    progressBar.style.width = '60%';
    progressPercent.textContent = '60%';
    progressLabel.textContent = 'Processing import...';

    const result = await api.settings.importBackup(
      parsedImportData,
      mode,
      ext,
      selectedImportFile?.name || 'backup'
    );

    progressBar.style.width = '100%';
    progressPercent.textContent = '100%';
    progressLabel.textContent = 'Complete!';

    // Show result
    const isSuccess = result.status === 'success';
    const isPartial = result.status === 'partial';

    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `
      <div style="background: ${isSuccess ? 'rgba(102,187,106,0.1)' : (isPartial ? 'rgba(255,183,77,0.1)' : 'rgba(239,83,80,0.1)')}; border: 1px solid ${isSuccess ? '#66bb6a' : (isPartial ? '#ffb74d' : '#ef5350')}; border-radius: 6px; padding: 12px;">
        <strong style="color: ${isSuccess ? '#66bb6a' : (isPartial ? '#ffb74d' : '#ef5350')};">
          <i class="fas ${isSuccess ? 'fa-check-circle' : (isPartial ? 'fa-exclamation-circle' : 'fa-times-circle')}"></i>
          ${result.message}
        </strong>
        ${result.results ? `
          <div style="margin-top: 8px; font-size: 12px;">
            <table style="width: 100%;">
              <thead>
                <tr><th style="text-align: left; padding: 3px 6px;">Table</th><th style="padding: 3px 6px;">Imported</th><th style="padding: 3px 6px;">Skipped</th></tr>
              </thead>
              <tbody>
                ${Object.entries(result.results).map(([key, val]) => `
                  <tr>
                    <td style="padding: 3px 6px;">${key}</td>
                    <td style="padding: 3px 6px; text-align: center; color: #66bb6a;">${val.imported}</td>
                    <td style="padding: 3px 6px; text-align: center; color: ${val.skipped > 0 ? '#ef5350' : 'var(--text-muted)'};">${val.skipped}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
        ${result.errors && result.errors.length > 0 ? `
          <details style="margin-top: 8px; font-size: 11px;">
            <summary style="cursor: pointer; color: #ef5350;">View ${result.errors.length} error(s)</summary>
            <ul style="margin-top: 4px; padding-left: 16px;">
              ${result.errors.map(err => `<li>${err}</li>`).join('')}
            </ul>
          </details>
        ` : ''}
      </div>
    `;

    utils.showToast(result.message, isSuccess ? 'success' : (isPartial ? 'info' : 'error'));
    loadBackupDashboard(document.getElementById('contentArea'));
  } catch (error) {
    console.error('Import error:', error);
    progressBar.style.width = '100%';
    progressBar.style.background = '#ef5350';
    progressLabel.textContent = 'Failed!';

    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `
      <div style="background: rgba(239,83,80,0.1); border: 1px solid #ef5350; border-radius: 6px; padding: 12px;">
        <strong style="color: #ef5350;"><i class="fas fa-times-circle"></i> Import failed: ${error.message}</strong>
      </div>
    `;

    utils.showToast('Import failed: ' + error.message, 'error');
  } finally {
    startBtn.innerHTML = '<i class="fas fa-upload"></i> Start Import';
    startBtn.disabled = false;
  }
}

// ═══════════════════════════════════════════════════════════════
// EXISTING FUNCTIONALITY (Users, Settings form, Logo)
// ═══════════════════════════════════════════════════════════════

async function loadUsers(container) {
  try {
    users = await api.settings.getAllUsers();
    container.querySelector('#usersTable').innerHTML = renderUsersTable(users);
  } catch (error) {
    console.error('Error loading users:', error);
    container.querySelector('#usersTable').innerHTML = '<p class="text-center">Failed to load users</p>';
  }
}

function renderUsersTable(usersList) {
  if (usersList.length === 0) {
    return '<p class="text-center">No users found</p>';
  }

  return `
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${usersList.map(user => `
          <tr>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td><span class="badge badge-info">${user.role}</span></td>
            <td>
              <button class="btn btn-sm btn-outline" onclick="window.settingsModule.editUser(${user.id})">Edit</button>
              <button class="btn btn-sm btn-danger" onclick="window.settingsModule.deleteUser(${user.id})">Delete</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function attachEventListeners(container, savedSettings) {
  // Logo file upload handling
  const logoInput = container.querySelector('#companyLogo');
  const logoPreview = container.querySelector('#logoPreview');
  const removeLogo = container.querySelector('#removeLogo');

  if (logoInput) {
    logoInput.addEventListener('change', async function(e) {
      const file = e.target.files[0];
      if (file) {
        if (!file.type.startsWith('image/')) {
          utils.showToast('Please select an image file', 'error');
          return;
        }

        if (file.size > 2 * 1024 * 1024) {
          utils.showToast('Image file size should be less than 2MB', 'error');
          return;
        }

        try {
          const formData = new FormData();
          formData.append('logo', file);

          const uploadResult = await api.request('/settings/upload-logo', {
            method: 'POST',
            body: formData
          });

          window.currentLogoData = uploadResult.logoPath;

          logoPreview.innerHTML = `<img src="${uploadResult.logoUrl}" alt="Company Logo" style="max-width: 150px; max-height: 100px; object-fit: contain;">`;

          const logoActions = container.querySelector('.logo-actions');
          if (logoActions && !logoActions.querySelector('#removeLogo')) {
            logoActions.innerHTML += '<button type="button" class="btn btn-sm btn-danger" id="removeLogo">Remove Logo</button>';
            container.querySelector('#removeLogo').addEventListener('click', removeLogo);
          }

          const appLogo = document.getElementById('appLogo');
          if (appLogo) {
            const salonName = document.getElementById('salonName')?.value || 'Salon Manager';
            appLogo.innerHTML = `
              <img src="${uploadResult.logoUrl}" alt="Company Logo" style="max-height: 40px; max-width: 200px; object-fit: contain; display: block; margin: 0 auto;">
              <h3 style="margin: 5px 0 0 0; text-align: center; font-size: 14px; font-weight: 500;">${salonName}</h3>
            `;
          }

          utils.showToast('Logo uploaded successfully', 'success');
        } catch (error) {
          console.error('Logo upload error:', error);
          utils.showToast('Failed to upload logo: ' + error.message, 'error');
        }
      }
    });
  }

  if (removeLogo) {
    removeLogo.addEventListener('click', function() {
      if (confirm('Are you sure you want to remove the logo?')) {
        window.currentLogoData = '';
        logoPreview.innerHTML = '<div class="no-logo-placeholder">No logo uploaded</div>';

        const appLogo = document.getElementById('appLogo');
        if (appLogo) {
          const salonName = document.getElementById('salonName')?.value || 'Salon Manager';
          appLogo.innerHTML = `<h2>${salonName}</h2>`;
        }

        this.remove();
        utils.showToast('Logo removed', 'info');
      }
    });
  }

  // Save salon settings
  const settingsForm = container.querySelector('#salonSettingsForm');
  if (settingsForm) {
    settingsForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const settingsData = {
        salon: {
          name: document.getElementById('salonName').value,
          address: document.getElementById('salonAddress').value,
          phone: document.getElementById('salonPhone').value,
          email: document.getElementById('salonEmail').value,
          gstin: document.getElementById('salonGstin').value,
          logoUrl: window.currentLogoData || savedSettings.salon?.logoUrl || '',
          working_hours_start: document.getElementById('workingHoursStart').value,
          working_hours_end: document.getElementById('workingHoursEnd').value
        },
        billing: {
          gst_enabled: !!document.getElementById('gstEnabled')?.checked,
          gst_type: document.getElementById('gstType')?.value || 'intra',
          gst_rate: parseFloat(document.getElementById('gstRate')?.value) || 18,
          cgst_rate: 9,
          sgst_rate: 9,
          igst_rate: 18,
          currency: 'INR',
          invoicePrefix: document.getElementById('invoicePrefix').value,
          nextInvoiceNumber: parseInt(document.getElementById('nextInvoiceNumber').value) || 1001
        }
      };
      try {
        await api.settings.update(settingsData);
        utils.showToast('Settings saved successfully', 'success');
      } catch (error) {
        utils.showToast(error.message || 'Failed to save settings', 'error');
      }
    });
  }

  // ── Backup Export Buttons ──
  const exportXlsxBtn = container.querySelector('#exportXlsxBtn');
  if (exportXlsxBtn) {
    exportXlsxBtn.addEventListener('click', function() {
      handleExportXlsx(this, false);
    });
  }

  const exportCsvBtn = container.querySelector('#exportCsvBtn');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', function() {
      handleExportCsv(this);
    });
  }

  const exportFullBtn = container.querySelector('#exportFullBtn');
  if (exportFullBtn) {
    exportFullBtn.addEventListener('click', function() {
      if (confirm('This will export ALL data including hashed passwords. Only use this for complete system restore. Continue?')) {
        handleExportXlsx(this, true);
      }
    });
  }

  // ── Import Handlers ──
  setupImportHandlers(container);

  // ── Refresh Logs ──
  const refreshLogsBtn = container.querySelector('#refreshLogsBtn');
  if (refreshLogsBtn) {
    refreshLogsBtn.addEventListener('click', () => loadBackupDashboard(container));
  }

  // Add user button
  const addUserBtn = container.querySelector('#addUserBtn');
  if (addUserBtn) {
    addUserBtn.addEventListener('click', () => showUserForm());
  }
}

function showUserForm(user = null) {
  const isEdit = !!user;
  const currentUser = auth.getCurrentUser();

  const formHTML = `
    <form id="userForm">
      <div class="form-group">
        <label for="userName">Name *</label>
        <input type="text" id="userName" name="name" value="${user?.name || ''}" required>
      </div>
      <div class="form-group">
        <label for="userEmail">Email *</label>
        <input type="email" id="userEmail" name="email" value="${user?.email || ''}" required>
      </div>
      <div class="form-group">
        <label for="userPassword">Password ${isEdit ? '(leave blank to keep current)' : '*'}</label>
        <input type="password" id="userPassword" name="password" ${!isEdit ? 'required' : ''}>
      </div>
      <div class="form-group">
        <label for="userRole">Role *</label>
        <select id="userRole" name="role" required>
          <option value="">Select role</option>
          <option value="owner" ${user?.role === 'owner' ? 'selected' : ''}>Owner</option>
          <option value="center" ${user?.role === 'center' ? 'selected' : ''}>Center Manager</option>
          <option value="staff" ${user?.role === 'staff' ? 'selected' : ''}>Staff</option>
        </select>
      </div>
      <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Create'} User</button>
    </form>
  `;

  window.appUtils.showModal(isEdit ? 'Edit User' : 'Add User', formHTML);

  document.getElementById('userForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = {
      name: document.getElementById('userName').value,
      email: document.getElementById('userEmail').value,
      role: document.getElementById('userRole').value
    };

    const password = document.getElementById('userPassword').value;
    if (password) {
      formData.password = password;
    }

    try {
      if (isEdit) {
        await api.settings.updateUser(user.id, formData);
        utils.showToast('User updated successfully', 'success');
      } else {
        await api.settings.createUser(formData);
        utils.showToast('User created successfully', 'success');
      }

      window.appUtils.closeModal();
      const contentArea = document.getElementById('contentArea');
      await render(contentArea);
    } catch (error) {
      utils.showToast(error.message || 'Operation failed', 'error');
    }
  });
}

// Export functions for global access
window.settingsModule = {
  editUser: async function(id) {
    const user = await api.settings.getAllUsers().then(users => users.find(u => u.id === id));
    showUserForm(user);
  },

  deleteUser: async function(id) {
    if (confirm('Are you sure you want to delete this user?')) {
      try {
        await api.settings.deleteUser(id);
        utils.showToast('User deleted successfully', 'success');
        const contentArea = document.getElementById('contentArea');
        await render(contentArea);
      } catch (error) {
        utils.showToast(error.message || 'Delete failed', 'error');
      }
    }
  }
};
