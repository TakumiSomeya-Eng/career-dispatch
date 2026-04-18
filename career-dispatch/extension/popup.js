// Career Dispatch — Popup Script

const FIELD_LABELS = {
  firstName: 'First Name',
  lastName: 'Last Name',
  email: 'Email',
  phone: 'Phone',
  address: 'Address',
  city: 'City',
  state: 'State',
  zip: 'ZIP',
  linkedin: 'LinkedIn',
  github: 'GitHub',
  portfolio: 'Portfolio',
  twitter: 'Twitter/X',
  salary: 'Salary',
  startDate: 'Start Date',
  referral: 'Referral',
  source: 'Source',
  bio: 'Bio/Summary'
};

const statusBar = document.getElementById('status-bar');
const statusText = document.getElementById('status-text');
const btnAutofill = document.getElementById('btn-autofill');
const btnImport = document.getElementById('btn-import');
const btnClear = document.getElementById('btn-clear');
const fileInput = document.getElementById('file-input');
const fieldList = document.getElementById('field-list');
const pickerSection = document.getElementById('picker-section');

// Detect platform for shortcut display
const isMac = /Mac/i.test(navigator.platform) || /Mac/i.test(navigator.userAgent);
document.getElementById('shortcut-display').textContent = isMac ? '⌘⇧F' : 'Ctrl+⇧+F';

async function getProfile() {
  const { profile } = await chrome.storage.local.get('profile');
  return profile || null;
}

async function saveProfile(profile) {
  await chrome.storage.local.set({ profile });
}

function showMiniToast(msg, error = false) {
  const existing = document.querySelector('.toast-mini');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = 'toast-mini';
  if (error) t.style.borderColor = '#d63f1f';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

async function render() {
  const profile = await getProfile();

  if (!profile || Object.keys(profile).length === 0) {
    statusBar.className = 'status empty';
    statusText.innerHTML = '<strong>NO PROFILE</strong> — Import to begin';
    btnAutofill.disabled = true;
    btnClear.disabled = true;
    pickerSection.style.display = 'none';
    return;
  }

  const fieldCount = Object.values(profile).filter(v => v && String(v).trim()).length;
  statusBar.className = 'status loaded';
  statusText.innerHTML = `<strong>PROFILE ACTIVE</strong> — ${fieldCount} fields`;
  btnAutofill.disabled = false;
  btnClear.disabled = false;
  pickerSection.style.display = 'block';

  // populate picker list
  fieldList.innerHTML = '';
  for (const [key, label] of Object.entries(FIELD_LABELS)) {
    const val = profile[key];
    if (!val) continue;
    const btn = document.createElement('button');
    btn.className = 'field-btn';
    btn.innerHTML = `
      <div style="flex: 1; min-width: 0;">
        <div class="label">${label}</div>
        <div class="value" title="${escapeHtml(String(val))}">${escapeHtml(String(val))}</div>
      </div>
      <span style="color: var(--accent); font-size: 14px;">→</span>
    `;
    btn.addEventListener('click', () => activatePicker(profile, key));
    fieldList.appendChild(btn);
  }
}

async function activatePicker(profile, key) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'PICK_FIELD', profile, key });
    showMiniToast(`Click target field on page`);
    window.close();
  } catch (e) {
    showMiniToast('⚠ Cannot access this page', true);
  }
}

// ===== AUTOFILL BUTTON =====
btnAutofill.addEventListener('click', async () => {
  const profile = await getProfile();
  if (!profile) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;

  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'AUTOFILL', profile });
    showMiniToast(`⚡ ${res?.count ?? 0} field(s) filled`);
    setTimeout(() => window.close(), 900);
  } catch (e) {
    // Content script might not be loaded (e.g., chrome:// or blocked page)
    showMiniToast('⚠ Cannot access this page', true);
  }
});

// ===== IMPORT =====
btnImport.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const profile = JSON.parse(text);
    if (typeof profile !== 'object' || profile === null) throw new Error('Invalid');
    await saveProfile(profile);
    showMiniToast('✓ Profile imported');
    render();
  } catch (err) {
    showMiniToast('⚠ Invalid profile.json', true);
  }
  fileInput.value = '';
});

// ===== CLEAR =====
btnClear.addEventListener('click', async () => {
  if (!confirm('Clear stored profile?')) return;
  await chrome.storage.local.remove('profile');
  showMiniToast('Profile cleared');
  render();
});

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

render();
