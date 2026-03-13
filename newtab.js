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

  // ── IndexedDB ─────────────────────────────────────────────────────────────
  // Blobs stored here avoid base64 encoding and JSON serialization overhead.
  const dbReady = new Promise((resolve, reject) => {
    const req = indexedDB.open('wallpaper-db', 1);
    req.onupgradeneeded = (e) => e.target.result.createObjectStore('images');
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });

  function idbGet() {
    return dbReady.then(db => new Promise((resolve, reject) => {
      const req = db.transaction('images').objectStore('images').get('wallpaper');
      req.onsuccess = (e) => resolve(e.target.result ?? null);
      req.onerror   = (e) => reject(e.target.error);
    }));
  }

  function idbPut(blob) {
    return dbReady.then(db => new Promise((resolve, reject) => {
      const req = db.transaction('images', 'readwrite').objectStore('images').put(blob, 'wallpaper');
      req.onsuccess = () => resolve();
      req.onerror   = (e) => reject(e.target.error);
    }));
  }

  function idbDelete() {
    return dbReady.then(db => new Promise((resolve, reject) => {
      const req = db.transaction('images', 'readwrite').objectStore('images').delete('wallpaper');
      req.onsuccess = () => resolve();
      req.onerror   = (e) => reject(e.target.error);
    }));
  }

  // ── State ─────────────────────────────────────────────────────────────────
  let state = { fit: 'cover', tile: false };
  let currentObjectUrl = null;

  // ── Background rendering ───────────────────────────────────────────────────
  function renderBg(objectUrl) {
    if (!objectUrl) {
      if (currentObjectUrl) { URL.revokeObjectURL(currentObjectUrl); currentObjectUrl = null; }
      bg.style.backgroundImage = '';
      bg.classList.remove('loaded');
      setupPrompt.classList.remove('hidden');
      clockContainer.classList.add('hidden');
      clearBtn.disabled = true;
      return;
    }
    if (currentObjectUrl && currentObjectUrl !== objectUrl) URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = objectUrl;
    bg.style.backgroundImage  = `url(${objectUrl})`;
    bg.style.backgroundSize   = state.fit;
    bg.style.backgroundRepeat = state.tile ? 'repeat' : 'no-repeat';
    bg.classList.add('loaded');
    setupPrompt.classList.add('hidden');
    clockContainer.classList.remove('hidden');
    clearBtn.disabled = false;
  }

  function applyFit() {
    bg.style.backgroundSize   = state.fit;
    bg.style.backgroundRepeat = state.tile ? 'repeat' : 'no-repeat';
  }

  function syncFitInputs() {
    if (state.tile) {
      document.getElementById('fit-tile').checked = true;
    } else {
      fitInputs.forEach((r) => { if (r.id !== 'fit-tile' && r.value === state.fit) r.checked = true; });
    }
  }

  function persistSettings() {
    chrome.storage.local.set({ wallpaperFit: state.fit, wallpaperTile: state.tile });
  }

  // ── Load on startup ────────────────────────────────────────────────────────
  async function init() {
    const stored = await new Promise(resolve =>
      chrome.storage.local.get(['wallpaperFit', 'wallpaperTile', 'wallpaperDataUrl'], resolve)
    );

    state.fit  = stored.wallpaperFit  || 'cover';
    state.tile = !!stored.wallpaperTile;

    let blob = null;

    if (stored.wallpaperDataUrl) {
      // One-time migration: base64 in chrome.storage.local → Blob in IndexedDB
      try {
        const res = await fetch(stored.wallpaperDataUrl);
        blob = await res.blob();
        await idbPut(blob);
        chrome.storage.local.remove('wallpaperDataUrl');
      } catch { blob = null; }
    } else {
      blob = await idbGet().catch(() => null);
    }

    if (blob) {
      syncFitInputs();
      renderBg(URL.createObjectURL(blob));
    } else {
      renderBg(null);
    }
  }

  init();

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
    // Store the raw Blob — no FileReader / base64 conversion needed
    idbPut(file)
      .then(() => { persistSettings(); renderBg(URL.createObjectURL(file)); })
      .catch(() => showToast('Failed to save image.'));
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
    if (!currentObjectUrl) return;
    state.tile = r.id === 'fit-tile';
    state.fit  = state.tile ? 'auto' : r.value;
    persistSettings();
    applyFit();
  }));

  // ── Clear ──────────────────────────────────────────────────────────────────
  clearBtn.addEventListener('click', () => {
    idbDelete()
      .then(() => {
        chrome.storage.local.remove(['wallpaperFit', 'wallpaperTile']);
        state = { fit: 'cover', tile: false };
        renderBg(null);
        fileNameEl.textContent = '';
        document.getElementById('fit-cover').checked = true;
      })
      .catch(() => showToast('Error removing wallpaper.'));
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
