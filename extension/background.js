// Career Dispatch — Background Service Worker
// Handles keyboard command and forwards it to the active tab

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'autofill') return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;

  // Load profile from storage
  const { profile } = await chrome.storage.local.get('profile');
  if (!profile) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const n = document.createElement('div');
        n.style.cssText = 'position:fixed;top:20px;right:20px;background:#0a0a0a;color:#f5f1e8;padding:16px 24px;font-family:monospace;font-size:12px;z-index:2147483647;border:2px solid #d63f1f;box-shadow:4px 4px 0 #d63f1f;';
        n.textContent = '⚠ No profile loaded. Click the Career Dispatch icon to import.';
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 4000);
      }
    });
    return;
  }

  // Send message to content script
  chrome.tabs.sendMessage(tab.id, { type: 'AUTOFILL', profile }, (res) => {
    // ignore if content script not ready
    void chrome.runtime.lastError;
  });
});

// Listen for install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'popup.html' });
  }
});
