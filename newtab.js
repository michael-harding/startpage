(() => {
  // ── Elements ──────────────────────────────────────────────────────────────
  const bg             = document.getElementById('bg');
  const clockEl        = document.getElementById('clock');
  const dateEl         = document.getElementById('date');
  const clockContainer = document.getElementById('clock-container');
  const setupPrompt    = document.getElementById('setup-prompt');
  const setupBtn       = document.getElementById('setup-btn');
  const settingsBtn    = document.getElementById('settings-btn');
  const fileInput      = document.getElementById('file-input');
  const dropZone       = document.getElementById('drop-zone');
  const fileNameEl     = document.getElementById('file-name');
  const clearBtn       = document.getElementById('clear-btn');
  const fitInputs      = document.querySelectorAll('input[name="fit"]');
  const toast          = document.getElementById('toast');

  // ── Clock ─────────────────────────────────────────────────────────────────
  function updateClock() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    dateEl.textContent  = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  }
  updateClock();
  setInterval(updateClock, 1000);

  // ── State ─────────────────────────────────────────────────────────────────
  let state = { dataUrl: null, fit: 'cover', tile: false };

  // ── Background rendering ───────────────────────────────────────────────────
  function renderBg() {
    if (!state.dataUrl) {
      bg.style.backgroundImage = '';
      bg.classList.remove('loaded');
      setupPrompt.classList.remove('hidden');
      clockContainer.classList.add('hidden');
      clearBtn.disabled = true;
      return;
    }
    bg.style.backgroundImage  = `url(${state.dataUrl})`;
    bg.style.backgroundSize   = state.fit;
    bg.style.backgroundRepeat = state.tile ? 'repeat' : 'no-repeat';
    bg.classList.add('loaded');
    setupPrompt.classList.add('hidden');
    clockContainer.classList.remove('hidden');
    clearBtn.disabled = false;
  }

  // ── Persist & render ───────────────────────────────────────────────────────
  function persist() {
    chrome.storage.local.set({
      wallpaperDataUrl: state.dataUrl,
      wallpaperFit:     state.fit,
      wallpaperTile:    state.tile,
    }, () => {
      if (chrome.runtime.lastError) showToast('Error saving: ' + chrome.runtime.lastError.message);
    });
    renderBg();
  }

  // ── Load saved wallpaper on startup ───────────────────────────────────────
  chrome.storage.local.get(['wallpaperDataUrl', 'wallpaperFit', 'wallpaperTile'], (result) => {
    if (result.wallpaperDataUrl) {
      state = {
        dataUrl: result.wallpaperDataUrl,
        fit:     result.wallpaperFit || 'cover',
        tile:    !!result.wallpaperTile,
      };

      if (state.tile) {
        document.getElementById('fit-tile').checked = true;
      } else {
        fitInputs.forEach((r) => {
          if (r.id !== 'fit-tile' && r.value === state.fit) r.checked = true;
        });
      }
    }
    renderBg();
  });

  // ── Settings toggle ────────────────────────────────────────────────────────
  settingsBtn.addEventListener('click', () => {
    document.body.classList.toggle('settings-open');
  });

  setupBtn.addEventListener('click', () => {
    document.body.classList.add('settings-open');
  });

  // ── File selection ─────────────────────────────────────────────────────────
  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      showToast('Please choose a valid image file.');
      return;
    }
    fileNameEl.textContent = `${file.name} · ${formatBytes(file.size)}`;
    const reader = new FileReader();
    reader.onload = (e) => {
      state.dataUrl = e.target.result;
      persist();
    };
    reader.onerror = () => showToast('Failed to read file.');
    reader.readAsDataURL(file);
  }

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  dropZone.addEventListener('dragover',  (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', ()  => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  });

  // ── Fit change ─────────────────────────────────────────────────────────────
  fitInputs.forEach((r) => r.addEventListener('change', () => {
    if (!state.dataUrl) return;
    state.tile = r.id === 'fit-tile';
    state.fit  = state.tile ? 'auto' : r.value;
    persist();
  }));

  // ── Clear ──────────────────────────────────────────────────────────────────
  clearBtn.addEventListener('click', () => {
    chrome.storage.local.remove(['wallpaperDataUrl', 'wallpaperFit', 'wallpaperTile'], () => {
      if (chrome.runtime.lastError) { showToast('Error removing wallpaper.'); return; }
      state = { dataUrl: null, fit: 'cover', tile: false };
      renderBg();
      fileNameEl.textContent = '';
      document.getElementById('fit-cover').checked = true;
    });
  });

  // ── Toast ──────────────────────────────────────────────────────────────────
  let toastTimer;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2400);
  }

  // ── Utils ──────────────────────────────────────────────────────────────────
  function formatBytes(b) {
    if (b < 1024)      return b + ' B';
    if (b < 1024 ** 2) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1024 ** 2).toFixed(1) + ' MB';
  }
})();
