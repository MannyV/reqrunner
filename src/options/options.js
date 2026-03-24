document.addEventListener('DOMContentLoaded', () => {
  const geminiKeyInput = document.getElementById('gemini-key');
  const supabaseUrlInput = document.getElementById('supabase-url');
  const supabaseKeyInput = document.getElementById('supabase-key');
  const saveBtn = document.getElementById('save-btn');
  const status = document.getElementById('status');

  // Load saved settings
  chrome.storage.local.get(['geminiApiKey', 'supabaseUrl', 'supabaseKey'], (result) => {
    if (result.geminiApiKey) geminiKeyInput.value = result.geminiApiKey;
    if (result.supabaseUrl) supabaseUrlInput.value = result.supabaseUrl;
    if (result.supabaseKey) supabaseKeyInput.value = result.supabaseKey;
  });

  // Save settings
  saveBtn.addEventListener('click', () => {
    const geminiApiKey = geminiKeyInput.value.trim();
    const supabaseUrl = supabaseUrlInput.value.trim();
    const supabaseKey = supabaseKeyInput.value.trim();

    if (!geminiApiKey || !supabaseUrl || !supabaseKey) {
      status.textContent = 'Please fill in all fields.';
      status.style.color = 'var(--danger)';
      return;
    }

    chrome.storage.local.set({
      geminiApiKey,
      supabaseUrl,
      supabaseKey
    }, () => {
      status.textContent = 'Settings saved successfully!';
      status.style.color = '#28a745';
      
      // Auto-clear status after 2 seconds
      setTimeout(() => {
        status.textContent = '';
      }, 2000);
    });
  });
});
