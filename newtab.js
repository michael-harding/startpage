(() => {
  // ── Elements ──────────────────────────────────────────────────────────────
  const bg              = document.getElementById('bg');
  const clockEl         = document.getElementById('clock');
  const dateEl          = document.getElementById('date');
  const clockContainer  = document.getElementById('clock-container');
  const setupPrompt     = document.getElementById('setup-prompt');
  const setupBtn        = document.getElementById('setup-btn');
  const settingsBtn     = document.getElementById('settings-btn');
  const fileInput       = document.getElementById('file-input');
  const dropZone        = document.getElementById('drop-zone');
  const fileNameEl      = document.getElementById('file-name');
  const clearBtn        = document.getElementById('clear-btn');
  const fitInputs       = document.querySelectorAll('input[name="fit"]');
  const clockToggle     = document.getElementById('clock-toggle');
  const clockSwatches   = document.querySelectorAll('#clock-color-swatches .color-swatch');
  const clockCustomInput = document.getElementById('clock-color-custom');
  const bgSwatches      = document.querySelectorAll('#bg-color-swatches .color-swatch');
  const bgCustomInput   = document.getElementById('bg-color-custom');
  const toast           = document.getElementById('toast');

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

  // ── Background color presets ──────────────────────────────────────────────
  const BG_COLORS = {
    midnight: '#111827',
    black:    '#000000',
    white:    '#f8fafc',
    blue:     '#1d4ed8',
    purple:   '#7c3aed',
    teal:     '#0891b2',
    rose:     '#e11d48',
    amber:    '#d97706',
  };

  // ── Clock color presets ───────────────────────────────────────────────────
  const CLOCK_COLORS = {
    white:  { bg: 'rgba(255,255,255,0.08)',  border: 'rgba(255,255,255,0.18)' },
    black:  { bg: 'rgba(0,0,0,0.45)',        border: 'rgba(255,255,255,0.12)' },
    blue:   { bg: 'rgba(59,130,246,0.18)',   border: 'rgba(59,130,246,0.4)'   },
    purple: { bg: 'rgba(139,92,246,0.18)',   border: 'rgba(139,92,246,0.4)'   },
    rose:   { bg: 'rgba(244,63,94,0.15)',    border: 'rgba(244,63,94,0.4)'    },
    amber:  { bg: 'rgba(245,158,11,0.15)',   border: 'rgba(245,158,11,0.4)'   },
    green:  { bg: 'rgba(34,197,94,0.15)',    border: 'rgba(34,197,94,0.4)'    },
  };

  // ── State ─────────────────────────────────────────────────────────────────
  let state = { fit: 'cover', tile: false, clockVisible: true, clockColor: 'white', clockCustomHex: '#6366f1', bgColor: 'midnight', bgCustomHex: '#111827' };
  let currentObjectUrl = null;
  let hasWallpaper = false;

  // ── Background color ──────────────────────────────────────────────────────
  function applyBgColor() {
    const color = state.bgColor === 'custom'
      ? state.bgCustomHex
      : (BG_COLORS[state.bgColor] || '#111827');
    document.body.style.backgroundColor = color;
    if (state.bgColor === 'custom') {
      bgCustomInput.closest('.custom-swatch').style.background = state.bgCustomHex;
    }
    bgSwatches.forEach(s => s.classList.toggle('active', s.dataset.color === state.bgColor));
  }

  // ── Clock settings ─────────────────────────────────────────────────────────
  function applyClockVisibility() {
    if (hasWallpaper && state.clockVisible) {
      clockContainer.classList.remove('hidden');
    } else {
      clockContainer.classList.add('hidden');
    }
    clockToggle.checked = state.clockVisible;
  }

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function applyClockColor() {
    let bg, border;
    if (state.clockColor === 'custom') {
      bg     = hexToRgba(state.clockCustomHex, 0.18);
      border = hexToRgba(state.clockCustomHex, 0.4);
      clockCustomInput.closest('.custom-swatch').style.background = hexToRgba(state.clockCustomHex, 0.7);
    } else {
      const c = CLOCK_COLORS[state.clockColor] || CLOCK_COLORS.white;
      bg = c.bg; border = c.border;
    }
    clockContainer.style.background  = bg;
    clockContainer.style.borderColor = border;
    clockSwatches.forEach(s => s.classList.toggle('active', s.dataset.color === state.clockColor));
  }

  // ── Background rendering ───────────────────────────────────────────────────
  function renderBg(objectUrl) {
    if (!objectUrl) {
      if (currentObjectUrl) { URL.revokeObjectURL(currentObjectUrl); currentObjectUrl = null; }
      bg.style.backgroundImage = '';
      bg.classList.remove('loaded');
      setupPrompt.classList.remove('hidden');
      hasWallpaper = false;
      applyClockVisibility();
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
    hasWallpaper = true;
    applyClockVisibility();
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
    chrome.storage.local.set({
      wallpaperFit: state.fit,
      wallpaperTile: state.tile,
      clockVisible: state.clockVisible,
      clockColor: state.clockColor,
      clockCustomHex: state.clockCustomHex,
      bgColor: state.bgColor,
      bgCustomHex: state.bgCustomHex,
    });
  }

  // ── Load on startup ────────────────────────────────────────────────────────
  async function init() {
    const stored = await new Promise(resolve =>
      chrome.storage.local.get(['wallpaperFit', 'wallpaperTile', 'wallpaperDataUrl', 'clockVisible', 'clockColor', 'clockCustomHex', 'bgColor', 'bgCustomHex'], resolve)
    );

    state.fit          = stored.wallpaperFit  || 'cover';
    state.tile         = !!stored.wallpaperTile;
    state.clockVisible   = stored.clockVisible !== false; // default true
    state.clockColor     = stored.clockColor   || 'white';
    state.clockCustomHex = stored.clockCustomHex || '#6366f1';
    state.bgColor        = stored.bgColor      || 'midnight';
    state.bgCustomHex    = stored.bgCustomHex  || '#111827';
    clockCustomInput.value = state.clockCustomHex;
    bgCustomInput.value    = state.bgCustomHex;
    applyClockColor();
    applyBgColor();

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

  document.addEventListener('click', (e) => {
    if (
      document.body.classList.contains('settings-open') &&
      !document.getElementById('settings-panel').contains(e.target) &&
      !settingsBtn.contains(e.target)
    ) {
      document.body.classList.remove('settings-open');
    }
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

  // ── Background color ──────────────────────────────────────────────────────
  bgSwatches.forEach(swatch => swatch.addEventListener('click', () => {
    state.bgColor = swatch.dataset.color;
    if (state.bgColor === 'custom') bgCustomInput.click();
    applyBgColor();
    persistSettings();
  }));

  bgCustomInput.addEventListener('input', () => {
    state.bgColor     = 'custom';
    state.bgCustomHex = bgCustomInput.value;
    applyBgColor();
    persistSettings();
  });

  // ── Clock toggle ───────────────────────────────────────────────────────────
  clockToggle.addEventListener('change', () => {
    state.clockVisible = clockToggle.checked;
    applyClockVisibility();
    persistSettings();
  });

  // ── Clock color ────────────────────────────────────────────────────────────
  clockSwatches.forEach(swatch => swatch.addEventListener('click', () => {
    state.clockColor = swatch.dataset.color;
    if (state.clockColor === 'custom') clockCustomInput.click();
    applyClockColor();
    persistSettings();
  }));

  clockCustomInput.addEventListener('input', () => {
    state.clockColor     = 'custom';
    state.clockCustomHex = clockCustomInput.value;
    applyClockColor();
    persistSettings();
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
