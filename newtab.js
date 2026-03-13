(() => {
  const bg = document.getElementById('bg');
  const clockEl = document.getElementById('clock');
  const dateEl = document.getElementById('date');
  const clockContainer = document.getElementById('clock-container');
  const setupPrompt = document.getElementById('setup-prompt');
  const settingsBtn = document.getElementById('settings-btn');
  const setupBtn = document.getElementById('setup-btn');

  // ── Clock ────────────────────────────────────────────────────────────────

  function updateClock() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    dateEl.textContent = now.toLocaleDateString([], {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }

  updateClock();
  setInterval(updateClock, 1000);

  // ── Wallpaper ─────────────────────────────────────────────────────────────

  function applyWallpaper(dataUrl, fit) {
    bg.style.backgroundImage = `url(${dataUrl})`;
    bg.style.backgroundSize = fit || 'cover';
    bg.classList.add('loaded');
    setupPrompt.classList.add('hidden');
    clockContainer.classList.remove('hidden');
  }

  chrome.storage.local.get(['wallpaperDataUrl', 'wallpaperFit'], (result) => {
    if (result.wallpaperDataUrl) {
      applyWallpaper(result.wallpaperDataUrl, result.wallpaperFit);
    }
  });

  // Listen for changes made in the options page (same session)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.wallpaperDataUrl) {
      const dataUrl = changes.wallpaperDataUrl.newValue;
      const fit = changes.wallpaperFit?.newValue;
      if (dataUrl) {
        applyWallpaper(dataUrl, fit);
      } else {
        // Wallpaper cleared
        bg.style.backgroundImage = '';
        bg.classList.remove('loaded');
        setupPrompt.classList.remove('hidden');
        clockContainer.classList.add('hidden');
      }
    }
    if (changes.wallpaperFit && bg.style.backgroundImage) {
      bg.style.backgroundSize = changes.wallpaperFit.newValue;
    }
  });

  // ── Navigation ────────────────────────────────────────────────────────────

  function openOptions() {
    chrome.runtime.openOptionsPage();
  }

  settingsBtn.addEventListener('click', openOptions);
  setupBtn.addEventListener('click', openOptions);
})();
