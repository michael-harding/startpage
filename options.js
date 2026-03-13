(() => {
  // ── Elements ──────────────────────────────────────────────────────────────
  const fileInput     = document.getElementById('file-input');
  const dropZone      = document.getElementById('drop-zone');
  const fileNameEl    = document.getElementById('file-name');
  const previewWrap   = document.getElementById('preview-wrap');
  const previewImg    = document.getElementById('preview-img');
  const previewPlaceholder = document.getElementById('preview-placeholder');
  const saveBtn       = document.getElementById('save-btn');
  const clearBtn      = document.getElementById('clear-btn');
  const statusEl      = document.getElementById('status');
  const fitTileLabel  = document.getElementById('fit-tile-label');
  const fitInputs     = document.querySelectorAll('input[name="fit"]');
  const fitTileInput  = document.getElementById('fit-tile');

  // ── State ─────────────────────────────────────────────────────────────────
  let pendingDataUrl = null;   // data URL for the newly selected (unsaved) image
  let isTile = false;          // separate flag since "tile" reuses the "auto" value

  // ── Toast ─────────────────────────────────────────────────────────────────
  let toastTimer = null;

  function showStatus(message, type = 'success') {
    statusEl.textContent = message;
    statusEl.className = `visible ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      statusEl.className = '';
    }, 2500);
  }

  // ── Preview helpers ───────────────────────────────────────────────────────
  function showPreview(dataUrl) {
    previewImg.src = dataUrl;
    previewImg.classList.add('visible');
    previewPlaceholder.style.display = 'none';
    previewWrap.classList.add('has-image');
  }

  function clearPreview() {
    previewImg.src = '';
    previewImg.classList.remove('visible');
    previewPlaceholder.style.display = '';
    previewWrap.classList.remove('has-image');
  }

  // ── Load saved wallpaper on open ──────────────────────────────────────────
  chrome.storage.local.get(['wallpaperDataUrl', 'wallpaperFit', 'wallpaperTile'], (result) => {
    if (result.wallpaperDataUrl) {
      showPreview(result.wallpaperDataUrl);
      clearBtn.disabled = false;

      // Restore fit selection
      if (result.wallpaperTile) {
        fitTileInput.checked = true;
        isTile = true;
      } else {
        const saved = result.wallpaperFit || 'cover';
        fitInputs.forEach((input) => {
          if (input.id !== 'fit-tile' && input.value === saved) {
            input.checked = true;
          }
        });
      }
    }
  });

  // ── File selection ────────────────────────────────────────────────────────
  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      showStatus('Please choose a valid image file.', 'error');
      return;
    }

    fileNameEl.textContent = `${file.name} — ${formatBytes(file.size)}`;

    const reader = new FileReader();
    reader.onload = (e) => {
      pendingDataUrl = e.target.result;
      showPreview(pendingDataUrl);
      saveBtn.disabled = false;
    };
    reader.onerror = () => showStatus('Failed to read the file.', 'error');
    reader.readAsDataURL(file);
  }

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) handleFile(fileInput.files[0]);
  });

  // ── Drag and drop ─────────────────────────────────────────────────────────
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  });

  // ── Fit / tile radio logic ─────────────────────────────────────────────────
  // The "tile" option needs special treatment (background-repeat: repeat)
  fitInputs.forEach((input) => {
    input.addEventListener('change', () => {
      isTile = (input.id === 'fit-tile');
    });
  });

  // ── Save ──────────────────────────────────────────────────────────────────
  saveBtn.addEventListener('click', () => {
    if (!pendingDataUrl) return;

    const fitInput = document.querySelector('input[name="fit"]:checked');
    const fit = isTile ? 'auto' : (fitInput?.value || 'cover');
    const tile = isTile;

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    chrome.storage.local.set(
      { wallpaperDataUrl: pendingDataUrl, wallpaperFit: fit, wallpaperTile: tile },
      () => {
        if (chrome.runtime.lastError) {
          showStatus('Error saving: ' + chrome.runtime.lastError.message, 'error');
        } else {
          showStatus('Wallpaper applied!');
          clearBtn.disabled = false;
        }
        saveBtn.disabled = false;
        saveBtn.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Apply wallpaper`;
        pendingDataUrl = null;
        saveBtn.disabled = true;
      }
    );
  });

  // ── Clear ─────────────────────────────────────────────────────────────────
  clearBtn.addEventListener('click', () => {
    chrome.storage.local.remove(['wallpaperDataUrl', 'wallpaperFit', 'wallpaperTile'], () => {
      if (chrome.runtime.lastError) {
        showStatus('Error removing wallpaper.', 'error');
        return;
      }
      clearPreview();
      fileNameEl.textContent = '';
      pendingDataUrl = null;
      saveBtn.disabled = true;
      clearBtn.disabled = true;
      // Reset fit to default
      document.getElementById('fit-cover').checked = true;
      isTile = false;
      showStatus('Wallpaper removed.');
    });
  });

  // ── Utilities ─────────────────────────────────────────────────────────────
  function formatBytes(bytes) {
    if (bytes < 1024)       return bytes + ' B';
    if (bytes < 1024 ** 2)  return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 ** 2).toFixed(1) + ' MB';
  }
})();
