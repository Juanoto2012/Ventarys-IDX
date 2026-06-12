// CONFIG: Set your current app version here to compare against GitHub Releases
const CURRENT_APP_VERSION = "v1.0.1";
const REPO_LATEST_RELEASE_URL = "https://api.github.com/repos/Juanoto2012/Ventarys-IDX/releases/latest";

// CORE: Handle Electron vs Web dependencies
let isElectron = false, fs, path, spawn, os, cpModule, https;
let sysEnvInfo = "Environment: Web Mode (No OS or Terminal access).";

if (typeof require !== 'undefined') {
    try {
        cpModule = require('child_process');
        if (cpModule && cpModule.spawn) {
            isElectron = true;
            fs = require('fs');
            path = require('path');
            spawn = cpModule.spawn;
            os = require('os');
            https = require('https');

            const platform = os.platform();
            const release = os.release();
            const shell = platform === 'win32' ? 'powershell.exe' : 'bash';

            sysEnvInfo = `OS: ${platform} (${release}) | Architecture: ${os.arch()}\nDefault Terminal: ${shell}`;

            const versionCmd = platform === 'win32' ? 'powershell -command "$PSVersionTable.PSVersion.ToString()"' : 'bash --version';
            cpModule.exec(versionCmd, (err, stdout) => {
                if (!err) sysEnvInfo += `\nTerminal Version: ${stdout.split('\n')[0].trim()}`;
            });
        }
    } catch (e) { console.warn("Running in strict browser environment."); }
}

// --- CUSTOM PROVIDERS SYSTEM ---
let customProviders = JSON.parse(localStorage.getItem('ventarys_customProviders') || '[]');
let editingProviderIndex = -1; // -1 means adding new, >= 0 means editing

function saveCustomProviders() {
    localStorage.setItem('ventarys_customProviders', JSON.stringify(customProviders));
}

function renderCustomProvidersList() {
    const container = document.getElementById('custom-providers-list');
    if (!container) return;

    if (customProviders.length === 0) {
        container.innerHTML = '<div class="text-[10px] text-[#8b949e] text-center py-2">No custom providers added</div>';
        return;
    }

    container.innerHTML = customProviders.map((cp, i) => `
        <div class="flex items-center justify-between bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-[11px]">
            <div class="flex items-center gap-2 truncate flex-1">
                <span class="material-symbols-rounded text-[14px] text-[#8b949e]">cloud</span>
                <span class="truncate font-medium text-[#e6edf3]">${cp.name}</span>
                <span class="text-[#8b949e] truncate max-w-[120px]">${cp.url}</span>
                ${cp.noKey ? '<span class="text-[10px] text-[#3fb950] bg-[rgba(63,185,80,0.1)] px-1.5 py-0.5 rounded">No Key</span>' : '<span class="text-[10px] text-[#8b949e]">Key: ******</span>'}
            </div>
            <div class="flex items-center gap-1 shrink-0">
                <button onclick="editCustomProvider(${i})" class="hover:text-[#58a6ff] transition p-1" title="Edit">
                    <span class="material-symbols-rounded text-[14px]">edit</span>
                </button>
                <button onclick="deleteCustomProvider(${i})" class="hover:text-[#f85149] transition p-1" title="Delete">
                    <span class="material-symbols-rounded text-[14px]">delete</span>
                </button>
            </div>
        </div>
    `).join('');
}

window.editCustomProvider = function (index) {
    editingProviderIndex = index;
    const cp = customProviders[index];
    document.getElementById('cp-name').value = cp.name;
    document.getElementById('cp-url').value = cp.url;
    document.getElementById('cp-no-key').checked = cp.noKey || false;
    document.getElementById('cp-key').value = cp.key || '';
    toggleKeyInput();
    document.getElementById('custom-provider-form').classList.remove('hidden');
    document.getElementById('btn-save-custom-provider').innerHTML = '<span class="material-symbols-rounded text-[14px]">save</span> Update';
};

window.deleteCustomProvider = function (index) {
    if (confirm(`Delete provider "${customProviders[index].name}"?`)) {
        customProviders.splice(index, 1);
        saveCustomProviders();
        renderCustomProvidersList();
        fetchModels(false); // Re-fetch models
    }
};

function toggleKeyInput() {
    const noKey = document.getElementById('cp-no-key').checked;
    const keyContainer = document.getElementById('cp-key-container');
    const label = document.querySelector('#cp-no-key').nextElementSibling;
    if (keyContainer) keyContainer.style.display = noKey ? 'none' : 'block';
    if (label) label.textContent = noKey ? 'No API key required' : 'Require API key';
}

function resetProviderForm() {
    editingProviderIndex = -1;
    document.getElementById('cp-name').value = '';
    document.getElementById('cp-url').value = '';
    document.getElementById('cp-no-key').checked = false;
    document.getElementById('cp-key').value = '';
    document.getElementById('custom-provider-form').classList.add('hidden');
    document.getElementById('btn-save-custom-provider').innerHTML = '<span class="material-symbols-rounded text-[14px]">save</span> Save';
    toggleKeyInput();
}

function saveCustomProvider() {
    const name = document.getElementById('cp-name').value.trim();
    let url = document.getElementById('cp-url').value.trim();
    const noKey = document.getElementById('cp-no-key').checked;
    const key = document.getElementById('cp-key').value.trim();

    if (!name || !url) {
        showNotification('Error', 'Provider name and URL are required');
        return;
    }

    // Ensure URL ends with /v1
    if (!url.endsWith('/v1')) {
        url = url.replace(/\/+$/, '') + '/v1';
    }

    if (!noKey && !key) {
        showNotification('Error', 'API key is required for this provider');
        return;
    }

    const provider = { name, url, noKey: noKey || false, key: key || '' };

    if (editingProviderIndex >= 0) {
        customProviders[editingProviderIndex] = provider;
        showNotification('Provider Updated', `${name} has been updated`);
    } else {
        customProviders.push(provider);
        showNotification('Provider Added', `${name} has been added`);
    }

    saveCustomProviders();
    renderCustomProvidersList();
    resetProviderForm();
    fetchModels(false); // Re-fetch models including custom providers
}

// --- AUTO UPDATER SYSTEM FOR PORTABLE .EXE ---
// Parse version string to comparable array of numbers
function parseVersion(versionStr) {
    // Strip 'v' prefix if present
    versionStr = versionStr.replace(/^v/, '');
    // Split by '.' and convert to numbers
    return versionStr.split('.').map(part => {
        const num = parseInt(part, 10);
        return isNaN(num) ? 0 : num;
    });
}

// Compare two version arrays
// Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
function compareVersions(v1, v2) {
    const arr1 = parseVersion(v1);
    const arr2 = parseVersion(v2);
    const len = Math.max(arr1.length, arr2.length);

    for (let i = 0; i < len; i++) {
        const num1 = i < arr1.length ? arr1[i] : 0;
        const num2 = i < arr2.length ? arr2[i] : 0;

        if (num1 > num2) return 1;
        if (num1 < num2) return -1;
    }
    return 0;
}

async function checkForUpdates() {
    if (!isElectron) return; // Only update if running natively
    try {
        const res = await fetch(REPO_LATEST_RELEASE_URL);
        if (!res.ok) {
            console.log("Update check failed (HTTP " + res.status + ")");
            return;
        }
        const data = await res.json();

        if (!data.tag_name) {
            console.log("No tag_name found in release data");
            return;
        }

        // Get current version without 'v' prefix
        const currentVer = CURRENT_APP_VERSION.replace(/^v/, '');
        const latestTag = data.tag_name; // Keep the 'v' prefix from GitHub

        console.log(`[Updater] Current: ${currentVer} | GitHub: ${latestTag}`);

        // Compare versions numerically
        const cmp = compareVersions(currentVer, latestTag);

        if (cmp < 0) {
            // Latest version is greater - update available
            console.log(`[Updater] Update available! ${currentVer} < ${latestTag}`);
            const exeAsset = data.assets.find(a => a.name.endsWith('.exe'));
            if (exeAsset) {
                showUpdateUI(latestTag, exeAsset.browser_download_url);
            } else {
                console.log("[Updater] No .exe asset found in release");
            }
        } else if (cmp === 0) {
            // Versions are equal - up to date
            console.log(`[Updater] App is up to date! ${currentVer} == ${latestTag}`);
        } else {
            // Current version is greater (pre-release scenario)
            console.log(`[Updater] Current (${currentVer}) is newer than GitHub (${latestTag})`);
        }
    } catch (err) {
        console.warn("[Updater] Failed to check for updates:", err);
    }
}

function showUpdateUI(version, downloadUrl) {
    const headerActions = document.getElementById('header-actions');

    // Remove existing update button if present
    const existingBtn = headerActions.querySelector('[id^="update-btn-"]');
    if (existingBtn) return; // Already showing update UI

    const updateBtn = document.createElement('button');
    updateBtn.id = `update-btn-${version}`;
    updateBtn.className = 'bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold py-1 px-3 rounded-lg flex items-center gap-1 transition shadow-sm animate-pulse mr-2';
    updateBtn.innerHTML = `<span class="material-symbols-rounded text-[14px]">system_update</span> Update to ${version}`;

    updateBtn.onclick = () => {
        // Open GitHub releases page in default browser
        if (isElectron) {
            const { shell } = require('electron');
            shell.openExternal('https://github.com/Juanoto2012/Ventarys-IDX/releases');
        } else {
            window.open('https://github.com/Juanoto2012/Ventarys-IDX/releases', '_blank');
        }
    };

    headerActions.prepend(updateBtn);
}

// Helper to safely stream download following redirects natively
function downloadFileNative(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                return downloadFileNative(response.headers.location, dest).then(resolve).catch(reject);
            }
            if (response.statusCode !== 200) return reject(new Error("Failed with status " + response.statusCode));

            response.pipe(file);
            file.on('finish', () => file.close(resolve));
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

async function performPortableUpdate(url, version) {
    try {
        showNotification("Ventarys IDX Updater", `Downloading ${version} in background...`);
        const tempExePath = path.join(os.tmpdir(), 'Ventarys_Update.exe');
        const currentExePath = process.execPath;
        const currentDir = path.dirname(currentExePath);

        await downloadFileNative(url, tempExePath);
        showNotification("Ventarys IDX Updater", `Installing ${version}...`);

        // User data is stored in localStorage which persists in the app files
        // When we overwrite just the .exe, all user data remains intact
        // Data locations preserved:
        // - localStorage data: stored in app files, not affected by .exe overwrite
        // - Files in user's project folders: completely untouched

        // Create a robust batch script that waits, overwrites, and restarts
        const batPath = path.join(os.tmpdir(), 'update_ventarys_' + Date.now() + '.bat');
        const batContent = `@echo off
chcp 65001 > nul
setlocal EnableDelayedExpansion

:: Wait for the app to fully release the file handle
echo Waiting for Ventarys IDX to close...
set retries=10
:waitloop
if !retries! LEQ 0 goto startapp
timeout /t 1 /nobreak > nul
set /a retries-=1
goto waitloop

:: Overwrite the executable (preserves all user data in localStorage)
echo Installing update...
copy /Y "${tempExePath}" "${currentExePath}" > nul

:: Clean up the downloaded update file
del "${tempExePath}" > nul

:: Launch the updated application
echo Starting Ventarys IDX v${CURRENT_APP_VERSION.replace('v', '')}...
start "" "${currentExePath}"

:: Delete this batch file
del "%~f0"
`.trim();

        fs.writeFileSync(batPath, batContent, 'utf8');

        // Launch detached script to bypass file locking
        const child = spawn('cmd.exe', ['/c', batPath], {
            detached: true,
            stdio: 'ignore',
            windowsHide: true
        });
        child.unref();

        // Close all windows and exit app immediately
        if (typeof require !== 'undefined') {
            try {
                const { ipcRenderer } = require('electron');
                if (ipcRenderer) {
                    ipcRenderer.send('quit-app');
                }
            } catch (e) {
                // IPC not available, proceed with direct exit
            }
        }

        // Force quit after a brief delay
        setTimeout(() => {
            try {
                if (typeof process !== 'undefined' && process.exit) {
                    process.exit(0);
                }
            } catch (e) {
                // Ignore errors during exit
            }
        }, 1000);

    } catch (err) {
        alert("Error applying update: " + err.message);
        const btn = document.querySelector('#header-actions button');
        if (btn) btn.innerHTML = 'Update Failed';
    }
}
// --- END UPDATER SYSTEM ---

const offScr = document.getElementById('off-scr');
const updateOnlineStatus = () => { if (navigator.onLine) offScr.classList.add('hidden'); else offScr.classList.remove('hidden'); };
window.addEventListener('online', updateOnlineStatus); window.addEventListener('offline', updateOnlineStatus); updateOnlineStatus();

function makeResizable(id, pid, isH, dir) { const r = document.getElementById(id), p = document.getElementById(pid); let sP = 0, sS = 0; r.addEventListener('mousedown', e => { e.preventDefault(); sP = isH ? e.clientX : e.clientY; sS = isH ? p.getBoundingClientRect().width : p.getBoundingClientRect().height; document.body.style.cursor = isH ? 'col-resize' : 'row-resize'; r.classList.add('active'); const mv = ev => { const c = isH ? ev.clientX : ev.clientY, d = c - sP, n = dir === 1 ? sS + d : sS - d; if (n > 100 && n < (isH ? window.innerWidth - 100 : window.innerHeight - 100)) { p.style[isH ? 'width' : 'height'] = `${n}px`; if (term) term.fitAddon.fit(); if (editor) editor.resize(); } }; const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); document.body.style.cursor = 'default'; r.classList.remove('active'); }; document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up); }); }
makeResizable('drag-sidebar', 'panel-sidebar', true, 1); makeResizable('drag-chat', 'panel-chat', true, -1); makeResizable('drag-terminal', 'panel-terminal', false, -1);

const tg = id => { const e = document.getElementById(id); e.style.display = e.style.display === 'none' ? 'flex' : 'none'; if (editor) editor.resize(); };
document.getElementById('menu-toggle-sidebar').onclick = () => tg('panel-sidebar'); document.getElementById('menu-toggle-terminal').onclick = () => { tg('panel-terminal'); if (term) setTimeout(() => term.fitAddon.fit(), 50); }; document.getElementById('menu-toggle-chat').onclick = () => tg('panel-chat'); document.getElementById('btn-term-close').onclick = () => tg('panel-terminal'); document.getElementById('btn-chat-close').onclick = () => tg('panel-chat');

let ptyProcess = null, term = null, currentFolderPath = '', editor = null;
let openFiles = [];
let activeFilePath = null;
let isEditorUpdating = false;

// --- LARGE PROJECT SUPPORT ---
const MAX_OPEN_FILES = 200; // Maximum files to keep in memory
const MAX_FILE_SIZE_MEMORY = 5 * 1024 * 1024; // 5MB per file max in memory
const DEBOUNCE_SAVE_DELAY = 1500; // 1.5s debounce for saves

// File cache with LRU eviction
let fileCache = new Map(); // path -> { content, timestamp, size }
let cacheOrder = []; // For LRU tracking
const MAX_CACHE_ENTRIES = 500;

// Project file index (built asynchronously)
let projectFileIndex = []; // Pre-built file list for fast search
let indexingInProgress = false;
let projectFileCount = 0;

// Debounce timer for expensive operations
let folderLoadTimer = null;
let saveDebounceTimers = new Map(); // filePath -> timerId

// .gitignore patterns cache
let gitignorePatterns = new Set();
let gitignoreRawPatterns = [];

// File filter settings
let excludedDirs = new Set(['node_modules', 'bower_components', 'dist', 'build', '.git', '.svn', 'vendor', '__pycache__', '.next', '.nuxt', '.cache', 'coverage', '.idea', '.vscode', '.settings', 'obj', 'Debug', 'Release']);
let excludedFiles = new Set(['Thumbs.db', '.DS_Store', '.gitignore', '.gitkeep']);
let maxDirectoryDepth = 30; // Prevent infinitely deep traversal

// Virtual scroll settings for file explorer
const VIRTUAL_SCROLL_THRESHOLD = 100; // Items before enabling virtual scroll
let virtualScrollEnabled = false;
const VIRTUAL_ITEM_HEIGHT = 32;
let visibleStartIndex = 0;
let visibleEndIndex = 0;
let filteredFileTree = [];

// Progress tracking
let folderLoadProgress = { current: 0, total: 0, cancelled: false };

// --- OUTPUT PANEL / AI CONSOLE SYSTEM ---
let outputPanelVisible = false;
let outputLines = [];
const MAX_OUTPUT_LINES = 1000;

function toggleOutputPanel() {
    const panel = document.getElementById('panel-output');
    if (panel) {
        outputPanelVisible = !outputPanelVisible;
        panel.style.display = outputPanelVisible ? 'flex' : 'none';
        if (outputPanelVisible && term) {
            setTimeout(() => term.fitAddon.fit(), 50);
        }
    }
}

function clearOutput() {
    outputLines = [];
    const content = document.getElementById('output-content');
    if (content) {
        content.innerHTML = '<div class="text-[#8b949e] text-xs italic p-2">Output console cleared. AI actions will appear here.</div>';
    }
}

function addOutputLine(text, type = 'system') {
    const timestamp = new Date().toLocaleTimeString();
    outputLines.push({ text, type, timestamp });

    // Remove old lines if over max
    while (outputLines.length > MAX_OUTPUT_LINES) {
        outputLines.shift();
    }

    const content = document.getElementById('output-content');
    if (!content) return;

    // Only add if not already showing the cleared message
    if (outputLines.length === 1) {
        content.innerHTML = '';
    }

    const line = document.createElement('div');
    line.className = `output-line ${type}`;
    line.textContent = `[${timestamp}] ${text}`;
    content.appendChild(line);
    content.scrollTop = content.scrollHeight;

    // Keep DOM manageable - only keep last 100 lines in DOM
    const allLines = content.querySelectorAll('.output-line');
    if (allLines.length > 100) {
        Array.from(allLines).slice(0, allLines.length - 100).forEach(l => l.remove());
    }
}

// Make output functions available globally
window.toggleOutputPanel = toggleOutputPanel;
window.clearOutput = clearOutput;
window.addOutputLine = addOutputLine;

// --- AUTO RELOAD SYSTEM ---
let fileSnapshotMap = new Map(); // Track file content hashes for change detection
let autoReloadEnabled = localStorage.getItem('ventarys_autoReload') !== 'false'; // Default true

// --- ACCEPT/REJECT CHANGES SYSTEM ---
let pendingChanges = []; // Stack of pending file changes
let activeChangeBanner = null;

function getFileHash(content) {
    let hash = 0;
    if (content.length === 0) return hash.toString();
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString();
}

function trackFileChanges() {
    if (!isElectron) return;
    openFiles.forEach(f => {
        const currentHash = getFileHash(f.content);
        const prevHash = fileSnapshotMap.get(f.path);
        if (prevHash && prevHash !== currentHash) {
            // File was modified externally (by AI)
            handleExternalFileChange(f.path, f.content);
        }
        fileSnapshotMap.set(f.path, currentHash);
    });
}

function handleExternalFileChange(filePath, newContent) {
    const fileName = path.basename(filePath);

    // Show change banner
    const banner = document.getElementById('change-banner');
    const fileLabel = document.getElementById('change-banner-file');
    fileLabel.textContent = fileName;
    banner.classList.remove('hidden');

    // Store pending change
    activeChangeBanner = {
        filePath: filePath,
        newContent: newContent,
        timestamp: Date.now()
    };

    // Auto-accept if enabled and file is open in editor
    if (autoReloadEnabled) {
        setTimeout(() => {
            acceptChange();
        }, 2000); // Auto-accept after 2 seconds
    }
}

function acceptChange() {
    if (!activeChangeBanner) return;

    const { filePath, newContent } = activeChangeBanner;
    const f = openFiles.find(x => x.path === filePath);

    if (f && editor) {
        isEditorUpdating = true;
        f.content = newContent;
        f.isDirty = false;

        if (activeFilePath === filePath) {
            editor.setValue(newContent, -1);
        }

        // Save to disk if in Electron
        if (isElectron) {
            try {
                fs.writeFileSync(filePath, newContent, 'utf8');
            } catch (e) {
                console.error('Error saving accepted change:', e);
            }
        }

        renderTabs();
        isEditorUpdating = false;
    }

    hideChangeBanner();
}

function rejectChange() {
    if (!activeChangeBanner) return;

    const { filePath } = activeChangeBanner;
    const f = openFiles.find(x => x.path === filePath);

    if (f && editor) {
        // Restore original content from snapshot
        const prevHash = fileSnapshotMap.get(filePath);
        isEditorUpdating = true;
        f.isDirty = false;

        if (activeFilePath === filePath) {
            editor.setValue(f.content, -1);
        }

        renderTabs();
        isEditorUpdating = false;
    }

    hideChangeBanner();
}

function hideChangeBanner() {
    const banner = document.getElementById('change-banner');
    banner.classList.add('hidden');
    activeChangeBanner = null;
}

// Setup accept/reject button handlers
function setupChangeButtons() {
    const acceptBtn = document.getElementById('btn-accept-change');
    const rejectBtn = document.getElementById('btn-reject-change');

    if (acceptBtn) {
        acceptBtn.onclick = acceptChange;
    }
    if (rejectBtn) {
        rejectBtn.onclick = rejectChange;
    }
}

// --- CONFIGURATION CONSTANTS ---
let MAX_RETRIES = parseInt(localStorage.getItem('ventarys_maxRetries')) || 5;
let RETRY_DELAY = parseInt(localStorage.getItem('ventarys_retryDelay')) || 1000;
let AUTO_RELOAD_INTERVAL = parseInt(localStorage.getItem('ventarys_autoReloadInterval')) || 2000;
let LOG_AI_OUTPUT = localStorage.getItem('ventarys_logOutput') !== 'false';

// Load agent config if modal was opened
function loadAgentConfig() {
    const mr = document.getElementById('config-max-retries');
    const rd = document.getElementById('config-retry-delay');
    const ai = document.getElementById('config-autoreload-interval');
    const lo = document.getElementById('config-log-output');
    if (mr) mr.value = MAX_RETRIES;
    if (rd) rd.value = RETRY_DELAY;
    if (ai) ai.value = AUTO_RELOAD_INTERVAL;
    if (lo) lo.checked = LOG_AI_OUTPUT;
}

// --- AUTO RETRY API FETCH ---
async function fetchWithRetry(url, options, maxRetries = MAX_RETRIES) {
    let lastError;
    addOutputLine(`🌐 API Request: ${url.substring(0, 80)}...`, 'system');

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            // Show retry indicator if not first attempt
            if (attempt > 0) {
                showRetryIndicator(attempt, maxRetries);
                addOutputLine(`🔄 Retry attempt ${attempt}/${maxRetries}...`, 'warning');
                const delay = RETRY_DELAY * Math.pow(2, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            const response = await fetch(url, options);

            // Check for error status
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Hide retry indicator on success
            hideRetryIndicator();
            addOutputLine(`✓ API request successful`, 'success');
            return response;
        } catch (error) {
            lastError = error;
            console.warn(`API Request failed (attempt ${attempt + 1}/${maxRetries + 1}):`, error.message);
            addOutputLine(`✗ Request failed (${attempt + 1}/${maxRetries + 1}): ${error.message}`, 'error');

            // Don't retry on abort
            if (error.name === 'AbortError') {
                addOutputLine(`⛔ Request aborted by user`, 'warning');
                throw error;
            }
        }
    }

    // All retries exhausted
    hideRetryIndicator();
    addOutputLine(`✗ All retries exhausted. Request failed.`, 'error');
    throw new Error(`API request failed after ${maxRetries + 1} attempts: ${lastError.message}`);
}

function showRetryIndicator(attempt, max) {
    const indicator = document.getElementById('retry-indicator');
    const text = document.getElementById('retry-text');
    if (indicator && text) {
        text.textContent = `Retrying... (${attempt}/${max})`;
        indicator.classList.remove('hidden');
    }
}

function hideRetryIndicator() {
    const indicator = document.getElementById('retry-indicator');
    if (indicator) {
        indicator.classList.add('hidden');
    }
}

function initTerminal() {
    term = new Terminal({ theme: { background: '#1e1e1e', foreground: '#d4d4d4', cursor: '#d4d4d4', selection: '#444' }, fontFamily: 'Consolas, monospace', fontSize: 13, cursorBlink: true, convertEol: true });
    term.fitAddon = new FitAddon.FitAddon(); term.loadAddon(term.fitAddon);
    term.open(document.getElementById('terminal-container')); setTimeout(() => term.fitAddon.fit(), 100);
    window.addEventListener('resize', () => term.fitAddon.fit());
    if (isElectron) {
        const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
        try {
            ptyProcess = spawn(shell, [], { cwd: os.homedir(), env: process.env, shell: true });
            ptyProcess.stdout.on('data', d => term.write(d.toString()));
            ptyProcess.stderr.on('data', d => term.write(d.toString()));
            term.onData(d => ptyProcess.stdin.write(d));
            term.write(`\x1b[32m[Ventarys Local Terminal Connected]\x1b[0m\r\n`);
        } catch (e) { term.write(`\x1b[31mError starting shell: ${e.message}\x1b[0m\r\n`); }
    } else term.write('\x1b[33mWeb Mode. Local terminal disabled.\x1b[0m\r\n');
    document.getElementById('btn-term-clear').onclick = () => { term.clear(); if (ptyProcess) ptyProcess.stdin.write('clear\r\n'); };
}

const providers = { agnes: { url: 'https://apihub.agnes-ai.com/v1', name: 'Agnes' }, aqua: { url: 'https://api.aquadevs.com/v1', name: 'Aqua' } };

// Get all providers including custom ones
function getAllProviders() {
    const allProviders = { ...providers };
    customProviders.forEach((cp, i) => {
        allProviders[`custom_${i}`] = { url: cp.url, name: cp.name, noKey: cp.noKey, key: cp.key };
    });
    return allProviders;
}
const state = { keys: { agnes: localStorage.getItem('ventarys_key_agnes') || '', aqua: localStorage.getItem('ventarys_key_aqua') || '' }, modelId: localStorage.getItem('ventarys_modelId') || '', sessions: JSON.parse(localStorage.getItem('ventarys_sessions') || '[]'), currentSessionId: localStorage.getItem('ventarys_currentSessionId') || null, attachments: [], isGenerating: false, abortController: null };
const els = { chatContainer: document.getElementById('chat-container'), chatInput: document.getElementById('chat-input'), btnSend: document.getElementById('btn-send'), sendIcon: document.getElementById('send-icon'), emptyState: document.getElementById('empty-state'), modal: document.getElementById('settings-modal'), modelSelect: document.getElementById('model-select'), errorBox: document.getElementById('settings-error'), historyList: document.getElementById('history-list'), attachBtn: document.getElementById('btn-attach'), fileUpload: document.getElementById('file-upload'), attachmentsPreview: document.getElementById('attachments-preview') };

if (state.sessions.length === 0) createSession();
else if (!state.sessions.find(s => s.id === state.currentSessionId)) state.currentSessionId = state.sessions[0].id;

function createSession() { const id = 'sess_' + Date.now(); state.sessions.unshift({ id, title: 'New Chat', messages: [], updatedAt: Date.now() }); state.currentSessionId = id; saveHistory(); loadSession(id); }
function deleteSession(id, e) { e.stopPropagation(); if (confirm('Delete this chat?')) { state.sessions = state.sessions.filter(s => s.id !== id); if (state.sessions.length === 0) createSession(); else if (state.currentSessionId === id) loadSession(state.sessions[0].id); else { saveHistory(); updateHistoryUI(); } } }
function loadSession(id) { state.currentSessionId = id; localStorage.setItem('ventarys_currentSessionId', id); els.chatContainer.innerHTML = ''; els.chatContainer.appendChild(els.emptyState); const s = state.sessions.find(x => x.id === id); if (s && s.messages.length > 0) { els.emptyState.classList.add('hidden'); s.messages.filter(m => m.role !== 'system' && m.role !== 'tool').forEach(msg => renderMessage(msg.role, msg.content, false)); injectCodeButtons(els.chatContainer); } else els.emptyState.classList.remove('hidden'); scrollToBottom(); updateHistoryUI(); updateCtx(); }
function getMessages() { return state.sessions.find(s => s.id === state.currentSessionId)?.messages || []; }
function pushMessage(msg) { const s = state.sessions.find(s => s.id === state.currentSessionId); if (s) { s.messages.push(msg); s.updatedAt = Date.now(); } }

function formatTokens(t) { if (t >= 1000000) return (t / 1000000).toFixed(1) + 'M'; if (t >= 1000) return (t / 1000).toFixed(1) + 'k'; return t.toString(); }
function getMaxContext(mId) {
    if (!mId) return 128000;
    const m = mId.toLowerCase();
    if (m.includes('gemini-1.5-pro') || m.includes('2m')) return 2000000;
    if (m.includes('gemini-1.5-flash') || m.includes('1m')) return 1000000;
    if (m.includes('claude-3') || m.includes('gpt-4') || m.includes('128k')) return 128000;
    if (m.includes('32k')) return 32000;
    if (m.includes('16k') || m.includes('gpt-3.5')) return 16000;
    if (m.includes('llama') || m.includes('8k') || m.includes('mixtral')) return 8192;
    return 128000;
}

function updateCtx() {
    let chars = 0;
    const msgs = getMessages();
    if (msgs && msgs.length > 0) chars = JSON.stringify(msgs).length;
    const tokens = Math.ceil(chars / 3.5);
    const maxT = getMaxContext(state.modelId);
    const pct = Math.min(100, (tokens / maxT) * 100);

    document.getElementById('ctx-label').textContent = `${formatTokens(tokens)} / ${formatTokens(maxT)}`;
    const progress = document.getElementById('ctx-progress');
    progress.style.width = `${pct}%`;

    if (pct > 90) progress.className = 'h-full bg-red-500 transition-all duration-300';
    else if (pct > 70) progress.className = 'h-full bg-yellow-500 transition-all duration-300';
    else progress.className = 'h-full bg-blue-500 transition-all duration-300';
}

const getSystemPrompt = () => ({
    role: "system",
    content: "You are Ventarys IDX, an advanced autonomous software engineering agent. You have full access to the user's local machine, terminal, live editor, and operating system. Think step-by-step. Do not ask for permission to explore, modify code, or run GUI automations if necessary; investigate and solve proactively. To interact directly in the user's code as a 'Second Cursor', use 'ide_live_edit'. To automate the OS at the interface level (clicks, macros), use 'run_automation_script'. Your response must be highly technical, professional, and in Markdown.\n\n### LOCAL ENVIRONMENT INFO ###\n" + sysEnvInfo
});

const toolsDefinition = [
    { type: "function", function: { name: "execute_terminal", description: "Executes a command in the user's local terminal.", parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } } },
    { type: "function", function: { name: "execute_git_command", description: "Executes a Git command in the current repository.", parameters: { type: "object", properties: { args: { type: "string", description: "Arguments after 'git '. Ex: 'status' or 'commit -m \"fix\"'" } }, required: ["args"] } } },
    { type: "function", function: { name: "list_directory", description: "Lists local files and folders.", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } } },
    { type: "function", function: { name: "read_file", description: "Reads a local file.", parameters: { type: "object", properties: { file_path: { type: "string" } }, required: ["file_path"] } } },
    { type: "function", function: { name: "write_file", description: "Creates or overwrites a local file with the provided content. Use it to create code directly on the PC.", parameters: { type: "object", properties: { file_path: { type: "string", description: "File path" }, content: { type: "string", description: "File content" } }, required: ["file_path", "content"] } } },
    { type: "function", function: { name: "ide_live_edit", description: "Acts as an AI SECOND CURSOR. Inserts code directly into the user's visible editor in real-time at the specified line.", parameters: { type: "object", properties: { file_path: { type: "string", description: "Path of the file currently being edited." }, line: { type: "number", description: "Line number where the cursor will be positioned to insert." }, code: { type: "string", description: "The code to insert at that line." } }, required: ["file_path", "line", "code"] } } },
    { type: "function", function: { name: "run_automation_script", description: "Creates and runs a local script (Python, Node, PowerShell, Bash) to control and automate the OS (mouse movement, clicks, keyboard). Ideal if the user asks you to create macros or automate tasks.", parameters: { type: "object", properties: { language: { type: "string", enum: ["python", "node", "powershell", "bash"] }, script: { type: "string", description: "The complete automation script." } }, required: ["language", "script"] } } }
];

function showNotification(title, body) { if (Notification.permission === 'granted') new Notification(title, { body, icon: 'assets/logo.png' }); else if (Notification.permission !== 'denied') Notification.requestPermission().then(p => { if (p === 'granted') new Notification(title, { body, icon: 'assets/logo.png' }); }); }

function getFileIcon(filename) {
    const ex = filename.split('.').pop().toLowerCase();
    const m = {
        'js': 'javascript-plain', 'ts': 'typescript-plain', 'jsx': 'react-original', 'tsx': 'react-original',
        'py': 'python-plain', 'html': 'html5-plain', 'css': 'css3-plain', 'json': 'json-plain',
        'java': 'java-plain', 'cpp': 'cplusplus-plain', 'c': 'c-plain', 'php': 'php-plain',
        'md': 'markdown-original', 'xml': 'xml-plain', 'yml': 'yaml-plain', 'yaml': 'yaml-plain',
        'sql': 'mysql-plain', 'sh': 'bash-plain', 'go': 'go-plain', 'rs': 'rust-plain',
        'rb': 'ruby-plain', 'swift': 'swift-plain', 'kt': 'kotlin-plain', 'dart': 'dart-plain',
        'vue': 'vuejs-plain', 'svelte': 'svelte-plain', 'scss': 'sass-original', 'less': 'less-plain-wordmark'
    };
    if (m[ex]) return `<i class="devicon-${m[ex]} colored text-[14px]"></i>`;
    return `<span class="material-symbols-rounded text-[14px] text-gray-400">description</span>`;
}

function renderTabs() {
    const container = document.getElementById('editor-tabs');
    container.innerHTML = '';
    if (openFiles.length === 0) {
        container.innerHTML = '<div class="text-xs text-gray-400 pl-2 py-1.5 italic select-none">No files open</div>';
        document.getElementById('btn-save-file').classList.add('hidden');
        return;
    }
    document.getElementById('btn-save-file').classList.remove('hidden');
    openFiles.forEach(f => {
        const isAct = f.path === activeFilePath;
        const name = path.basename(f.path);
        const tab = document.createElement('div');
        tab.className = `flex items-center gap-2 px-3 h-full cursor-pointer min-w-[100px] max-w-[200px] group select-none rounded-t-lg border border-b-0 transition-colors ${isAct ? 'bg-white border-gray-200 text-gray-800 relative shadow-[0_-2px_0_#3b82f6_inset]' : 'bg-transparent border-transparent hover:bg-gray-200 text-gray-500'}`;
        tab.innerHTML = `<div class="flex items-center gap-2 truncate flex-1" title="${f.path}">${getFileIcon(name)} <span class="truncate text-[12px] font-medium mt-0.5">${name}</span> ${f.isDirty ? '<span class="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>' : ''}</div> <button class="shrink-0 p-0.5 rounded-md hover:bg-gray-300 opacity-0 group-hover:opacity-100 transition ${isAct ? 'opacity-100' : ''}" onclick="closeFile('${f.path.replace(/\\/g, '\\\\')}', event)"><span class="material-symbols-rounded text-[14px]">close</span></button>`;
        tab.onclick = () => { activeFilePath = f.path; renderTabs(); updateEditorToActiveFile(); };
        container.appendChild(tab);
    });
}

window.closeFile = function (fp, e) {
    e.stopPropagation();
    const idx = openFiles.findIndex(f => f.path === fp);
    if (idx > -1) {
        openFiles.splice(idx, 1);
        if (activeFilePath === fp) {
            if (openFiles.length > 0) activeFilePath = openFiles[Math.max(0, idx - 1)].path;
            else activeFilePath = null;
        }
        renderTabs(); updateEditorToActiveFile();
    }
};

function updateEditorToActiveFile() {
    if (!activeFilePath) {
        isEditorUpdating = true; editor.setValue('', -1); editor.setReadOnly(true); isEditorUpdating = false;
        return;
    }
    editor.setReadOnly(false);
    const f = openFiles.find(x => x.path === activeFilePath);
    if (!f) return;

    isEditorUpdating = true;
    const ex = activeFilePath.split('.').pop().toLowerCase();
    let md = "text";
    if (['js', 'ts', 'jsx', 'tsx'].includes(ex)) md = "javascript";
    else if (['html', 'css', 'json', 'xml', 'markdown', 'python', 'php', 'java', 'c_cpp'].includes(ex)) md = ex;
    else if (ex === 'py') md = 'python';
    else if (['c', 'cpp', 'h'].includes(ex)) md = 'c_cpp';

    editor.session.setMode("ace/mode/" + md);
    if (editor.getValue() !== f.content) editor.setValue(f.content, -1);
    isEditorUpdating = false;
}

function openFile(fp) {
    try {
        // Check if file is already open
        let fileEntry = openFiles.find(f => f.path === fp);

        if (!fileEntry) {
            // LRU eviction: if at max capacity, close least recently used files
            if (openFiles.length >= MAX_OPEN_FILES) {
                const lruFile = openFiles.shift();
                fileCache.delete(lruFile.path);
                console.log(`[File Handler] LRU eviction: closed ${path.basename(lruFile.path)}`);
            }

            // Check if file is in cache
            const cached = fileCache.get(fp);
            let content;

            if (cached && Date.now() - cached.timestamp < 30000) {
                content = cached.content;
            } else {
                // Read from disk with size check
                const stats = fs.statSync(fp);
                const fileSize = stats.size;

                if (fileSize > MAX_FILE_SIZE_MEMORY) {
                    if (confirm(`File ${path.basename(fp)} is ${formatFileSize(fileSize)}. Large files may impact performance. Open anyway?`)) {
                        content = fs.readFileSync(fp, 'utf-8');
                    } else {
                        return;
                    }
                } else {
                    content = fs.readFileSync(fp, 'utf-8');
                }

                // Store in cache
                fileCache.set(fp, { content, timestamp: Date.now(), size: fileSize });
                cacheOrder.unshift(fp);

                // Evict oldest cache entries if cache is too large
                while (cacheOrder.length > MAX_CACHE_ENTRIES) {
                    const oldest = cacheOrder.pop();
                    fileCache.delete(oldest);
                }
            }

            fileEntry = { path: fp, content: content, isDirty: false, lastAccessed: Date.now() };
            openFiles.push(fileEntry);
        } else {
            fileEntry.lastAccessed = Date.now();
        }

        activeFilePath = fp;
        renderTabs();
        updateEditorToActiveFile();
    } catch (err) {
        console.error('[File Handler] Error opening file:', err);
        showNotification('Error', `Failed to open: ${path.basename(fp)}`);
    }
}

function saveCurrentFile() {
    if (!isElectron || !activeFilePath) return;

    const fp = activeFilePath;

    // Debounce rapid saves
    if (saveDebounceTimers.has(fp)) {
        clearTimeout(saveDebounceTimers.get(fp));
    }

    saveDebounceTimers.set(fp, setTimeout(() => {
        try {
            const content = editor.getValue();
            fs.writeFileSync(fp, content, 'utf8');

            const f = openFiles.find(x => x.path === fp);
            if (f) {
                f.content = content;
                f.isDirty = false;

                // Update cache
                fileCache.set(fp, { content, timestamp: Date.now(), size: Buffer.byteLength(content) });

                renderTabs();
            }

            const btn = document.getElementById('btn-save-file');
            if (btn) {
                btn.innerHTML = '<span class="material-symbols-rounded text-[14px]">check</span> Saved!';
                setTimeout(() => btn.innerHTML = 'Save (Ctrl+S)', 2000);
            }
        } catch (e) {
            console.error('[File Handler] Save error:', e);
            showNotification('Save Error', `Failed to save: ${e.message}`);
        }
    }, DEBOUNCE_SAVE_DELAY));
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

async function updatePuterUser() { if (typeof puter !== 'undefined' && puter.auth.isSignedIn()) { try { const u = await puter.auth.getUser(); document.getElementById('puter-user').textContent = u.username; } catch (e) { } } }
async function syncWithPuter() {
    const btn = document.getElementById('btn-puter-sync'); btn.innerHTML = '<span class="material-symbols-rounded text-[16px] animate-spin">sync</span>';
    try {
        if (!puter.auth.isSignedIn()) { await puter.auth.signIn(); await updatePuterUser(); }
        const data = JSON.stringify({ sessions: state.sessions, keys: state.keys });
        await puter.fs.write('ventarys_studio_backup.json', data);
        showNotification('Ventarys IDX', 'Successfully synced with Puter.');
    } catch (e) { alert('Sync error: ' + e.message); }
    btn.innerHTML = '<span class="material-symbols-rounded text-[16px]">sync</span>';
}

document.getElementById('btn-vscode').onclick = () => { if (isElectron && currentFolderPath) { cpModule.exec(`code "${currentFolderPath}"`, (err) => { if (err) alert("VSCode was not found in your PATH."); }); } };

function init() {
    initTerminal();
    editor = ace.edit("file-editor");
    editor.setTheme("ace/theme/github_dark");
    editor.setOptions({ fontFamily: "Consolas, monospace", fontSize: "14px", showPrintMargin: false, enableBasicAutocompletion: true, enableLiveAutocompletion: true });
    window.addEventListener('resize', () => editor.resize());
    editor.commands.addCommand({ name: 'save', bindKey: { win: "Ctrl-S", "mac": "Cmd-S" }, exec: saveCurrentFile });

    editor.session.on('change', () => {
        if (isEditorUpdating) return;
        if (activeFilePath) {
            const f = openFiles.find(x => x.path === activeFilePath);
            if (f) {
                const currentVal = editor.getValue();
                if (f.content !== currentVal) { f.content = currentVal; if (!f.isDirty) { f.isDirty = true; renderTabs(); } }
            }
        }
    });

    document.getElementById('btn-save-file').onclick = saveCurrentFile;
    document.getElementById('btn-new-chat').onclick = createSession;
    document.getElementById('btn-puter-sync').onclick = syncWithPuter;
    if (state.modelId && !state.modelId.includes('|')) { state.modelId = ''; localStorage.removeItem('ventarys_modelId'); }

    const switchTab = (t, b) => {
        document.getElementById('tab-explorer').className = 'pb-1.5 tab-inactive hover:text-black transition';
        document.getElementById('tab-history').className = 'pb-1.5 tab-inactive hover:text-black transition';
        document.getElementById('tab-search').className = 'pb-1.5 tab-inactive hover:text-black transition';
        document.getElementById('tab-git').className = 'pb-1.5 tab-inactive hover:text-black transition';
        b.className = 'pb-1.5 tab-active transition';
        document.getElementById('view-explorer').classList.add('hidden');
        document.getElementById('view-history').classList.add('hidden');
        document.getElementById('view-search').classList.add('hidden');
        document.getElementById('view-git').classList.add('hidden');
        document.getElementById(`view-${t}`).classList.remove('hidden');
        document.getElementById(`view-${t}`).classList.add('flex');
    };
    document.getElementById('tab-explorer').onclick = e => switchTab('explorer', e.target);
    document.getElementById('tab-history').onclick = e => switchTab('history', e.target);
    document.getElementById('tab-search').onclick = e => switchTab('search', e.target);
    document.getElementById('tab-git').onclick = e => switchTab('git', e.target);

    // --- SEARCH FUNCTIONALITY ---
    let searchTimeout = null;
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (searchTimeout) clearTimeout(searchTimeout);
            searchTimeout = setTimeout(performSearch, 300);
        });
        document.getElementById('search-case-sensitive').addEventListener('change', () => { if (searchInput.value) performSearch(); });
        document.getElementById('search-regex').addEventListener('change', () => { if (searchInput.value) performSearch(); });
        document.getElementById('search-whole-word').addEventListener('change', () => { if (searchInput.value) performSearch(); });
    }

    function performSearch() {
        const query = searchInput?.value?.trim();
        const resultsDiv = document.getElementById('search-results');
        if (!query || !currentFolderPath || !resultsDiv) return;

        const caseSensitive = document.getElementById('search-case-sensitive')?.checked || false;
        const useRegex = document.getElementById('search-regex')?.checked || false;
        const wholeWord = document.getElementById('search-whole-word')?.checked || false;

        resultsDiv.innerHTML = '<div class="p-2 text-center text-[#8b949e] text-xs">Searching...</div>';

        setTimeout(() => {
            try {
                const results = [];
                const searchInDir = (dirPath) => {
                    try {
                        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
                        entries.forEach(entry => {
                            const fullPath = path.join(dirPath, entry.name);
                            if (entry.isDirectory()) {
                                if (!entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== '.git') {
                                    searchInDir(fullPath);
                                }
                            } else {
                                try {
                                    const content = fs.readFileSync(fullPath, 'utf8');
                                    let match = false;

                                    if (useRegex) {
                                        const flags = caseSensitive ? 'g' : 'gi';
                                        try {
                                            const regex = new RegExp(wholeWord ? `\\b${query}\\b` : query, flags);
                                            if (regex.test(content)) match = true;
                                        } catch (e) {
                                            resultsDiv.innerHTML = `<div class="p-2 text-center text-[#f85149] text-xs">Invalid regex: ${e.message}</div>`;
                                            return;
                                        }
                                    } else {
                                        const searchQuery = caseSensitive ? query : query.toLowerCase();
                                        const searchContent = caseSensitive ? content : content.toLowerCase();
                                        if (wholeWord) {
                                            const regex = new RegExp(`\\b${escapeRegex(searchQuery)}\\b`, 'g');
                                            if (regex.test(searchContent)) match = true;
                                        } else {
                                            if (searchContent.includes(searchQuery)) match = true;
                                        }
                                    }

                                    if (match) {
                                        const lines = content.split('\n');
                                        let lineNum = 0;
                                        let currentLine = '';
                                        let matchLine = -1;

                                        for (let i = 0; i < lines.length; i++) {
                                            const line = caseSensitive ? lines[i] : lines[i].toLowerCase();
                                            const checkQuery = caseSensitive ? query : query.toLowerCase();
                                            if (wholeWord) {
                                                const regex = new RegExp(`\\b${escapeRegex(checkQuery)}\\b`);
                                                if (regex.test(line)) { matchLine = i + 1; currentLine = lines[i].trim(); break; }
                                            } else {
                                                if (line.includes(checkQuery)) { matchLine = i + 1; currentLine = lines[i].trim(); break; }
                                            }
                                        }

                                        if (matchLine !== -1) {
                                            results.push({
                                                file: path.relative(currentFolderPath, fullPath),
                                                line: matchLine,
                                                content: currentLine.substring(0, 100)
                                            });
                                        }
                                    }
                                } catch (e) { }
                            }
                        });
                    } catch (e) { }
                };

                searchInDir(currentFolderPath);

                if (results.length === 0) {
                    resultsDiv.innerHTML = '<div class="p-4 text-center text-[#8b949e] text-xs">No results found</div>';
                } else {
                    resultsDiv.innerHTML = results.slice(0, 100).map(r => `
                        <div class="search-result-item p-2 mb-1 rounded hover:bg-[#21262d] cursor-pointer transition" onclick="goToSearchResult('${r.file.replace(/\\/g, '\\\\')}', ${r.line})">
                            <div class="text-[11px] font-bold text-[#58a6ff] truncate">${r.file}</div>
                            <div class="text-[10px] text-[#8b949e] mt-0.5">Line ${r.line}: ${escapeHtml(r.content)}...</div>
                        </div>
                    `).join('');
                    resultsDiv.innerHTML += results.length > 100 ? `<div class="p-2 text-center text-[#8b949e] text-xs">... and ${results.length - 100} more results</div>` : '';
                }
            } catch (e) {
                resultsDiv.innerHTML = `<div class="p-2 text-center text-[#f85149] text-xs">Search error: ${e.message}</div>`;
            }
        }, 10);
    }

    function escapeRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    function escapeHtml(str) { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    window.goToSearchResult = function (filePath, lineNum) {
        openFile(filePath);
        setTimeout(() => {
            if (editor) {
                editor.gotoLine(lineNum, 0, true);
                editor.selection.selectLine();
            }
        }, 200);
    };

    // --- GIT FUNCTIONALITY ---
    const btnGitStatus = document.getElementById('btn-git-status');
    const btnGitCommit = document.getElementById('btn-git-commit');
    const gitCommitInput = document.getElementById('git-commit-input');
    const gitStatusDiv = document.getElementById('git-status');

    if (btnGitStatus) {
        btnGitStatus.onclick = async () => {
            if (!currentFolderPath) {
                gitStatusDiv.innerHTML = '<div class="p-4 text-center text-[#f85149] text-xs">No folder open</div>';
                return;
            }
            gitStatusDiv.innerHTML = '<div class="p-4 text-center text-[#8b949e] text-xs">Fetching git status...</div>';
            try {
                const result = await new Promise((resolve) => {
                    cpModule.exec(`git status --porcelain`, { cwd: currentFolderPath }, (err, out, stde) => {
                        resolve(out || stde || 'No changes');
                    });
                });
                if (!result.trim()) {
                    gitStatusDiv.innerHTML = '<div class="p-4 text-center text-[#3fb950] text-xs"><span class="material-symbols-rounded text-[20px]">check_circle</span><br>Working tree clean</div>';
                } else {
                    const lines = result.trim().split('\n');
                    gitStatusDiv.innerHTML = lines.map(line => {
                        const status = line.substring(0, 3);
                        const file = line.substring(3).trim();
                        const color = status.includes('A') ? 'text-[#3fb950]' : status.includes('D') ? 'text-[#f85149]' : status.includes('M') ? 'text-[#d29922]' : 'text-[#8b949e]';
                        return `<div class="git-change p-2 mb-1 rounded hover:bg-[#21262d] text-[11px] font-mono"><span class="${color} font-bold">${status}</span> ${file}</div>`;
                    }).join('');
                }
            } catch (e) {
                gitStatusDiv.innerHTML = `<div class="p-4 text-center text-[#f85149] text-xs">Not a git repository or git not available</div>`;
            }
        };
    }

    if (btnGitCommit) {
        btnGitCommit.onclick = () => {
            if (gitCommitInput) {
                gitCommitInput.classList.toggle('hidden');
                if (!gitCommitInput.classList.contains('hidden')) {
                    gitCommitInput.focus();
                }
            }
        };
    }

    if (gitCommitInput) {
        gitCommitInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && gitCommitInput.value.trim()) {
                const message = gitCommitInput.value.trim();
                gitCommitInput.value = '';
                gitCommitInput.classList.add('hidden');

                if (currentFolderPath) {
                    cpModule.exec(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: currentFolderPath }, (err, out, stde) => {
                        if (err) {
                            gitStatusDiv.innerHTML = `<div class="p-4 text-center text-[#f85149] text-xs">Commit failed: ${err.message}</div>`;
                        } else {
                            showNotification('Git', `Committed: ${message}`);
                            if (btnGitStatus) btnGitStatus.click();
                        }
                    });
                }
            } else if (e.key === 'Escape') {
                gitCommitInput.classList.add('hidden');
            }
        });
    }

    // --- MENU HANDLERS ---
    document.getElementById('menu-save-file').onclick = () => { if (isElectron) saveCurrentFile(); };
    document.getElementById('menu-save-all').onclick = () => {
        if (!isElectron) return;
        openFiles.forEach(f => {
            if (f.isDirty && activeFilePath === f.path) saveCurrentFile();
        });
        if (activeFilePath) saveCurrentFile();
    };
    document.getElementById('menu-close-file').onclick = () => {
        if (activeFilePath) {
            const idx = openFiles.findIndex(f => f.path === activeFilePath);
            if (idx > -1) openFiles.splice(idx, 1);
            activeFilePath = openFiles.length > 0 ? openFiles[Math.max(0, idx - 1)].path : null;
            renderTabs();
            updateEditorToActiveFile();
        }
    };
    document.getElementById('menu-find').onclick = () => {
        if (editor) editor.exec('find');
    };
    document.getElementById('menu-select-all').onclick = () => {
        if (editor) editor.selectAll();
    };
    document.getElementById('menu-increase-font').onclick = () => {
        if (editor) {
            const current = parseInt(editor.getFontSize());
            editor.setFontSize(current + 2);
        }
    };
    document.getElementById('menu-decrease-font').onclick = () => {
        if (editor) {
            const current = parseInt(editor.getFontSize());
            editor.setFontSize(Math.max(8, current - 2));
        }
    };
    document.getElementById('menu-toggle-markdown').onclick = () => {
        const modal = document.getElementById('markdown-preview-modal');
        const content = document.getElementById('markdown-preview-content');
        if (modal && content) {
            if (modal.classList.contains('hidden')) {
                const currentContent = activeFilePath ? openFiles.find(f => f.path === activeFilePath)?.content || '' : '';
                content.innerHTML = DOMPurify.sanitize(marked.parse(currentContent || '# Ventarys IDX\n\nOpen a file with markdown content to preview.'));
                modal.classList.remove('hidden');
            } else {
                modal.classList.add('hidden');
            }
        }
    };
    document.getElementById('menu-toggle-fullscreen').onclick = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };
    document.getElementById('menu-about').onclick = () => {
        document.getElementById('about-modal').classList.remove('hidden');
    };
    document.getElementById('btn-close-about').onclick = () => {
        document.getElementById('about-modal').classList.add('hidden');
    };
    document.getElementById('btn-close-markdown-preview').onclick = () => {
        document.getElementById('markdown-preview-modal').classList.add('hidden');
    };
    document.getElementById('btn-close-shortcuts').onclick = () => {
        document.getElementById('shortcuts-modal').classList.add('hidden');
    };
    document.getElementById('menu-shortcuts').onclick = () => {
        document.getElementById('shortcuts-modal').classList.remove('hidden');
    };
    document.getElementById('btn-close-agent-config').onclick = () => {
        document.getElementById('agent-config-modal').classList.add('hidden');
    };
    document.getElementById('menu-agent-config').onclick = () => {
        document.getElementById('agent-config-modal').classList.remove('hidden');
    };
    document.getElementById('btn-save-agent-config').onclick = () => {
        const maxRetries = parseInt(document.getElementById('config-max-retries').value) || 5;
        const retryDelay = parseInt(document.getElementById('config-retry-delay').value) || 1000;
        const autoReloadInterval = parseInt(document.getElementById('config-autoreload-interval').value) || 2000;
        const logOutput = document.getElementById('config-log-output').checked;

        localStorage.setItem('ventarys_maxRetries', maxRetries);
        localStorage.setItem('ventarys_retryDelay', retryDelay);
        localStorage.setItem('ventarys_autoReloadInterval', autoReloadInterval);
        localStorage.setItem('ventarys_logOutput', logOutput);

        MAX_RETRIES = maxRetries;
        RETRY_DELAY = retryDelay;

        document.getElementById('agent-config-modal').classList.add('hidden');
        showNotification('Configuration', 'Agent settings saved');
    };
    document.getElementById('btn-cancel-agent-config').onclick = () => {
        document.getElementById('agent-config-modal').classList.add('hidden');
    };
    document.getElementById('menu-export-chat').onclick = () => {
        const msgs = getMessages().filter(m => m.role !== 'system' && m.role !== 'tool');
        if (msgs.length === 0) return;
        let exportText = '# Ventarys IDX Chat Export\n\n';
        msgs.forEach(m => {
            const role = m.role === 'user' ? 'User' : 'Agent';
            const content = typeof m.content === 'string' ? m.content : (m.content?.[0]?.text || '');
            exportText += `## ${role}\n${content}\n\n---\n\n`;
        });
        const blob = new Blob([exportText], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ventarys-chat-${new Date().toISOString().split('T')[0]}.md`;
        a.click();
        URL.revokeObjectURL(url);
    };
    document.getElementById('menu-git-status').onclick = () => {
        switchTab('git', document.getElementById('tab-git'));
        if (btnGitStatus) btnGitStatus.click();
    };
    document.getElementById('menu-git-commit').onclick = () => {
        switchTab('git', document.getElementById('tab-git'));
        if (btnGitCommit) btnGitCommit.click();
    };
    document.getElementById('menu-git-branch').onclick = () => {
        if (!currentFolderPath) {
            showNotification('No Folder', 'Open a folder first');
            return;
        }
        cpModule.exec(`git branch -a`, { cwd: currentFolderPath }, (err, out, stde) => {
            const result = out || stde || 'No branches';
            const lines = result.trim().split('\n').filter(l => l.trim());
            let branchHtml = '<div class="p-4 space-y-1">';
            lines.forEach(line => {
                const isCurrent = line.startsWith('*');
                const branchName = line.replace('* ', '').trim();
                branchHtml += `<div class="git-branch-item p-2 rounded text-[11px] font-mono ${isCurrent ? 'bg-[rgba(56,139,253,0.15)] text-[#58a6ff] font-bold' : 'text-[#8b949e] hover:bg-[#21262d]'}">${isCurrent ? '<span class="material-symbols-rounded text-[14px] mr-1">radio_button_checked</span>' : '<span class="material-symbols-rounded text-[14px] mr-1 text-[#484f58]">radio_button_unchecked</span>'}${branchName}</div>`;
            });
            branchHtml += '</div>';
            const gitStatusDiv = document.getElementById('git-status');
            if (gitStatusDiv) {
                gitStatusDiv.innerHTML = branchHtml;
            }
        });
    };
    document.getElementById('menu-terminal-clear').onclick = () => {
        if (term) term.clear();
    };
    document.getElementById('menu-toggle-output').onclick = () => {
        toggleOutputPanel();
    };
    document.getElementById('menu-clear-output').onclick = () => {
        clearOutput();
    };
    document.getElementById('btn-output-clear').onclick = () => {
        clearOutput();
    };
    document.getElementById('btn-output-close').onclick = () => {
        toggleOutputPanel();
    };

    // Tools menu handlers
    document.getElementById('menu-run-code').onclick = () => {
        if (!activeFilePath) {
            showNotification('No File', 'Open a file first to run it.');
            return;
        }
        const ext = activeFilePath.split('.').pop().toLowerCase();
        let cmd = '';
        if (['js', 'ts', 'jsx', 'tsx'].includes(ext)) cmd = `node "${activeFilePath}"`;
        else if (ext === 'py') cmd = `python "${activeFilePath}"`;
        else if (ext === 'html') {
            // Open HTML in browser
            if (isElectron) {
                const { shell } = require('electron');
                shell.openExternal('file://' + activeFilePath);
            } else {
                window.open('file://' + activeFilePath, '_blank');
            }
            return;
        }
        else {
            showNotification('Run', `Use terminal to run .${ext} files`);
            return;
        }
        if (cmd && term && ptyProcess) {
            ptyProcess.stdin.write(`${cmd}\r\n`);
            term.focus();
        }
    };

    document.getElementById('menu-run-terminal').onclick = () => {
        if (!activeFilePath) {
            showNotification('No File', 'Open a file first.');
            return;
        }
        const ext = activeFilePath.split('.').pop().toLowerCase();
        let cmd = '';
        if (['js', 'ts', 'jsx', 'tsx'].includes(ext)) cmd = `node "${activeFilePath}"`;
        else if (ext === 'py') cmd = `python "${activeFilePath}"`;
        else if (ext === 'java') cmd = `javac "${activeFilePath}" && java ${path.basename(activeFilePath, '.java')}`;
        else if (ext === 'c') cmd = `gcc "${activeFilePath}" -o output && ./output`;
        else if (ext === 'cpp' || ext === 'cc' || ext === 'cxx') cmd = `g++ "${activeFilePath}" -o output && ./output`;
        else cmd = `echo "Cannot run .${ext} files directly"`;

        if (cmd && term && ptyProcess) {
            addOutputLine(`▶ Running ${path.basename(activeFilePath)}...`, 'info');
            ptyProcess.stdin.write(`${cmd}\r\n`);
            term.focus();
        }
    };

    document.getElementById('menu-copy-path').onclick = () => {
        if (activeFilePath) {
            navigator.clipboard.writeText(activeFilePath);
            showNotification('Copied', 'File path copied to clipboard');
        }
    };

    document.getElementById('menu-reveal-explorer').onclick = () => {
        if (activeFilePath && isElectron) {
            const { shell } = require('electron');
            shell.showItemInFolder(activeFilePath);
        }
    };

    // View menu handlers
    document.getElementById('menu-toggle-minimap').onclick = () => {
        if (editor) {
            const minimap = editor.getOption('enableMinimap');
            editor.setOption('enableMinimap', !minimap);
            showNotification('Minimap', !minimap ? 'Minimap enabled' : 'Minimap disabled');
        }
    };

    document.getElementById('menu-word-wrap').onclick = () => {
        if (editor) {
            const currentWrap = editor.getOption('wordWrap');
            editor.setOption('wordWrap', !currentWrap);
            showNotification('Word Wrap', !currentWrap ? 'Enabled' : 'Disabled');
        }
    };

    document.getElementById('menu-sticky-scroll').onclick = () => {
        if (editor) {
            const current = editor.getOption('stickyScroll');
            editor.setOption('stickyScroll', !current);
            showNotification('Sticky Scroll', !current ? 'Enabled' : 'Disabled');
        }
    };

    // Help menu handlers
    document.getElementById('menu-docs').onclick = () => {
        if (isElectron) {
            const { shell } = require('electron');
            shell.openExternal('https://github.com/Juanoto2012/Ventarys-IDX');
        } else {
            window.open('https://github.com/Juanoto2012/Ventarys-IDX', '_blank');
        }
    };
    document.getElementById('menu-feedback').onclick = () => {
        if (isElectron) {
            const { shell } = require('electron');
            shell.openExternal('https://github.com/Juanoto2012/Ventarys-IDX/discussions');
        } else {
            window.open('https://github.com/Juanoto2012/Ventarys-IDX/discussions', '_blank');
        }
    };
    document.getElementById('menu-report-bug').onclick = () => {
        if (isElectron) {
            const { shell } = require('electron');
            shell.openExternal('https://github.com/Juanoto2012/Ventarys-IDX/issues');
        } else {
            window.open('https://github.com/Juanoto2012/Ventarys-IDX/issues', '_blank');
        }
    };
    document.getElementById('menu-undo').onclick = () => {
        if (editor) editor.exec('undo');
    };
    document.getElementById('menu-redo').onclick = () => {
        if (editor) editor.exec('redo');
    };

    // AI menu handlers
    document.getElementById('menu-agent-config').onclick = () => {
        showNotification('Agent Config', 'Configure agent behavior in Settings');
    };

    document.getElementById('menu-clear-context').onclick = () => {
        if (confirm('Clear all chat messages and context?')) {
            const s = state.sessions.find(s => s.id === state.currentSessionId);
            if (s) {
                s.messages = [];
                s.updatedAt = Date.now();
                saveHistory();
                loadSession(state.currentSessionId);
                addOutputLine(`🧹 Context cleared`, 'system');
                showNotification('Context', 'Chat context cleared');
            }
        }
    };

    document.getElementById('menu-import-chat').onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.md,.json,.txt';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    try {
                        const content = ev.target.result;
                        if (file.name.endsWith('.json')) {
                            const imported = JSON.parse(content);
                            if (imported.sessions) {
                                state.sessions = imported.sessions;
                                saveHistory();
                                updateHistoryUI();
                                showNotification('Imported', `${imported.sessions.length} chats imported`);
                            }
                        } else {
                            pushMessage({ role: 'user', content: content });
                            renderMessage('user', `[Imported from ${file.name}]`);
                            showNotification('Imported', `Chat imported from ${file.name}`);
                        }
                    } catch (err) {
                        showNotification('Import Error', `Failed to import: ${err.message}`);
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    };

    document.getElementById('menu-auto-retry').onclick = () => {
        // Auto retry is always enabled
        showNotification('AI Settings', 'Auto Retry is always enabled (max 5 retries)');
    };
    document.getElementById('menu-auto-reload').onclick = () => {
        autoReloadEnabled = !autoReloadEnabled;
        localStorage.setItem('ventarys_autoReload', autoReloadEnabled);
        const icon = document.getElementById('icon-auto-reload');
        const btn = document.getElementById('menu-auto-reload');
        if (autoReloadEnabled) {
            icon.textContent = 'check_circle';
            btn.innerHTML = '<span class="material-symbols-rounded text-[16px]" id="icon-auto-reload">check_circle</span> Auto Reload (Enabled)';
        } else {
            icon.textContent = 'cancel';
            btn.innerHTML = '<span class="material-symbols-rounded text-[16px]" id="icon-auto-reload">cancel</span> Auto Reload (Disabled)';
        }
        showNotification('AI Settings', `Auto Reload ${autoReloadEnabled ? 'Enabled' : 'Disabled'}`);
    };
    document.getElementById('menu-auto-accept').onclick = () => {
        autoReloadEnabled = !autoReloadEnabled;
        localStorage.setItem('ventarys_autoReload', autoReloadEnabled);
        const icon = document.getElementById('icon-auto-accept');
        const btn = document.getElementById('menu-auto-accept');
        if (autoReloadEnabled) {
            icon.textContent = 'check_circle';
            btn.innerHTML = '<span class="material-symbols-rounded text-[16px]" id="icon-auto-accept">check_circle</span> Auto Accept Changes (Enabled)';
        } else {
            icon.textContent = 'cancel';
            btn.innerHTML = '<span class="material-symbols-rounded text-[16px]" id="icon-auto-accept">cancel</span> Auto Accept Changes (Disabled)';
        }
        showNotification('AI Settings', `Auto Accept ${autoReloadEnabled ? 'Enabled' : 'Disabled'}`);
    };
    document.getElementById('menu-open-folder').onclick = () => document.getElementById('folder-input').click();
    document.getElementById('folder-input').addEventListener('change', handleFolderSelect);
    document.getElementById('btn-refresh-folder').onclick = () => { if (currentFolderPath) refreshFolderTree(); };

    document.getElementById('api-key-agnes').value = state.keys.agnes;
    document.getElementById('api-key-aqua').value = state.keys.aqua;
    document.getElementById('menu-settings').onclick = () => els.modal.classList.remove('hidden');
    document.getElementById('btn-close-settings').onclick = () => els.modal.classList.add('hidden');
    document.getElementById('btn-save-settings').onclick = saveSettings;
    document.getElementById('btn-fetch-models').onclick = fetchModels;

    // Custom Provider handlers
    document.getElementById('btn-add-custom-provider').onclick = () => {
        resetProviderForm();
        document.getElementById('custom-provider-form').classList.remove('hidden');
    };
    document.getElementById('btn-save-custom-provider').onclick = saveCustomProvider;
    document.getElementById('btn-cancel-custom-provider').onclick = resetProviderForm;
    document.getElementById('cp-no-key').addEventListener('change', toggleKeyInput);

    // Render custom providers list
    renderCustomProvidersList();

    els.btnSend.onclick = () => handleSendOrStop(false);
    els.chatInput.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (!els.btnSend.disabled) handleSendOrStop(false); } });
    els.chatInput.addEventListener('input', function () { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 200) + 'px'; updateSendButtonState(); });
    els.attachBtn.onclick = () => els.fileUpload.click();
    els.fileUpload.onchange = handleFileUpload;

    loadSession(state.currentSessionId);
    if (state.keys.agnes || state.keys.aqua) fetchModels(false); else setTimeout(() => els.modal.classList.remove('hidden'), 500);
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') Notification.requestPermission();

    updateCtx();
    updatePuterUser();
    checkForUpdates(); // Check for updates on startup

    // Setup change accept/reject buttons
    setupChangeButtons();

    // Start file change polling for auto-reload
    setInterval(() => {
        if (isElectron && openFiles.length > 0) {
            trackFileChanges();
        }
    }, 2000); // Check every 2 seconds
}

function handleFolderSelect(e) {
    if (!isElectron) return alert("Electron environment required.");
    const f = e.target.files[0];
    if (f && f.path) {
        const rr = f.webkitRelativePath.split('/')[0];
        const ae = f.path.indexOf(path.normalize(rr));
        currentFolderPath = ae !== -1 ? path.join(f.path.substring(0, ae), rr) : path.dirname(f.path);

        document.getElementById('folder-name-label').textContent = path.basename(currentFolderPath);
        document.getElementById('btn-refresh-folder').classList.remove('hidden');
        document.getElementById('btn-vscode').classList.remove('hidden');

        const u = document.getElementById('file-list');
        u.innerHTML = '';

        // Reset state
        fileCache.clear();
        cacheOrder = [];
        openFiles = [];
        activeFilePath = null;
        excludedDirs = new Set(['node_modules', 'bower_components', 'dist', 'build', '.git', '.svn', 'vendor', '__pycache__', '.next', '.nuxt', '.cache', 'coverage', '.idea', '.vscode', '.settings', 'obj', 'Debug', 'Release', '.terraform', 'venv', '.venv', 'env', '.env']);

        // Load .gitignore patterns
        loadGitignore();

        // Show loading state
        u.innerHTML = '<div class="p-4 text-center text-[#8b949e] text-xs"><span class="animate-spin material-symbols-rounded text-[20px]">sync</span><br>Loading project...</div>';

        // Load tree with progress
        setTimeout(() => loadFolderTreeOptimized(currentFolderPath, u, 0), 50);

        if (ptyProcess) {
            ptyProcess.stdin.write(`cd "${currentFolderPath}"\r\nclear\r\n`);
            setTimeout(() => term.scrollToBottom(), 100);
        }
    }
}

function loadGitignore() {
    try {
        const gitignorePath = path.join(currentFolderPath, '.gitignore');
        if (fs.existsSync(gitignorePath)) {
            const content = fs.readFileSync(gitignorePath, 'utf8');
            gitignoreRawPatterns = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

            // Convert glob patterns to simple string set
            gitignorePatterns = new Set();
            gitignoreRawPatterns.forEach(pattern => {
                if (pattern.endsWith('/')) {
                    gitignorePatterns.add(pattern.slice(0, -1));
                } else {
                    gitignorePatterns.add(pattern);
                }
            });
        }
    } catch (e) { /* Ignore gitignore errors */ }
}

function shouldExclude(name, isDir) {
    if (excludedDirs.has(name)) return true;
    if (isDir && name.startsWith('.')) return true;
    if (excludedFiles.has(name)) return true;
    if (gitignorePatterns.has(name)) return true;
    return false;
}

function loadFolderTreeOptimized(fp, cu, depth) {
    if (depth > maxDirectoryDepth) return;
    if (folderLoadProgress.cancelled) return;

    try {
        const entries = fs.readdirSync(fp, { withFileTypes: true });
        const totalItems = entries.length;
        folderLoadProgress.total = totalItems;

        // Sort: directories first, then alphabetically
        entries.sort((a, b) => {
            if (a.isDirectory() && !b.isDirectory()) return -1;
            if (!a.isDirectory() && b.isDirectory()) return 1;
            return a.name.localeCompare(b.name);
        });

        // Use DocumentFragment for batch DOM insertion
        const fragment = document.createDocumentFragment();

        entries.forEach(f => {
            if (shouldExclude(f.name, f.isDirectory())) return;

            const li = document.createElement('li');
            li.className = 'file-tree-item';
            li.dataset.fullPath = path.join(fp, f.name);
            li.dataset.isDir = f.isDirectory();

            if (f.isDirectory()) {
                const indent = depth * 12 + 8;
                li.innerHTML = `
                    <div class="folder-toggle cursor-pointer hover:bg-[#21262d] py-1 px-2 rounded-lg flex items-center gap-2 text-[#e6edf3] font-medium select-none truncate transition text-[13px]" style="padding-left: ${indent}px">
                        <span class="material-symbols-rounded text-[16px] text-[#8b949e]">folder</span>
                        <span class="truncate">${f.name}</span>
                        <span class="folder-count text-[10px] text-[#8b949e] hidden">0</span>
                    </div>
                    <ul class="hidden pl-2 border-l border-[#30363d] ml-1 mt-0.5 space-y-0.5"></ul>`;

                const td = li.querySelector('.folder-toggle');
                const cUl = li.querySelector('ul');
                const countSpan = li.querySelector('.folder-count');

                td.onclick = (e) => {
                    e.stopPropagation();
                    const isOpen = !cUl.classList.contains('hidden');

                    if (isOpen) {
                        cUl.classList.add('hidden');
                        td.classList.remove('text-[#58a6ff]');
                    } else {
                        cUl.classList.remove('hidden');
                        td.classList.add('text-[#58a6ff]');

                        // Lazy load: only load if empty
                        if (!cUl.hasChildNodes()) {
                            cUl.innerHTML = '<div class="p-1 text-[10px] text-[#8b949e]">Loading...</div>';
                            setTimeout(() => {
                                cUl.innerHTML = '';
                                loadFolderTreeOptimized(path.join(fp, f.name), cUl, depth + 1);
                                updateFolderCount(cUl, countSpan);
                            }, 10);
                        } else {
                            updateFolderCount(cUl, countSpan);
                        }
                    }
                };
            } else {
                const indent = depth * 12 + 16;
                li.innerHTML = `
                    <div class="file-toggle cursor-pointer hover:bg-[#21262d] py-1 px-2 rounded-lg flex items-center gap-2 text-[#e6edf3] truncate select-none transition text-[13px]" style="padding-left: ${indent}px">
                        ${getFileIcon(f.name)}
                        <span class="truncate">${f.name}</span>
                    </div>`;

                li.querySelector('.file-toggle').onclick = () => openFile(path.join(fp, f.name));
            }

            fragment.appendChild(li);
        });

        cu.appendChild(fragment);

    } catch (err) {
        console.error('[File Handler] Error loading folder:', err);
    }
}

function updateFolderCount(ul, countSpan) {
    if (!countSpan || !ul) return;
    const count = ul.querySelectorAll('.file-tree-item').length;
    if (count > 0) {
        countSpan.textContent = count;
        countSpan.classList.remove('hidden');
    }
}

// Debounced folder tree loading for refresh
function refreshFolderTree() {
    if (folderLoadTimer) clearTimeout(folderLoadTimer);
    folderLoadTimer = setTimeout(() => {
        if (currentFolderPath) {
            const u = document.getElementById('file-list');
            u.innerHTML = '';
            folderLoadProgress.cancelled = true;
            setTimeout(() => {
                folderLoadProgress.cancelled = false;
                folderLoadProgress.current = 0;
                loadFolderTreeOptimized(currentFolderPath, u, 0);
            }, 100);
        }
    }, 300);
}

function handleFileUpload(e) { Array.from(e.target.files).forEach(f => { const r = new FileReader(); r.onload = ev => { state.attachments.push({ name: f.name, type: f.type.startsWith('image/') ? 'image' : 'file', data: ev.target.result, rawFile: f }); renderAttachmentsPreview(); updateSendButtonState(); }; if (f.type.startsWith('image/')) r.readAsDataURL(f); else r.readAsText(f); }); e.target.value = ''; }
function renderAttachmentsPreview() { els.attachmentsPreview.innerHTML = ''; if (state.attachments.length === 0) { els.attachmentsPreview.classList.add('hidden'); return; } els.attachmentsPreview.classList.remove('hidden'); state.attachments.forEach((a, i) => { const d = document.createElement('div'); d.className = 'relative shrink-0 border border-gray-200 rounded-xl bg-white overflow-hidden shadow-sm flex items-center justify-center w-14 h-14 group'; if (a.type === 'image') d.innerHTML = `<img src="${a.data}" class="w-full h-full object-cover">`; else d.innerHTML = `<div class="text-[9px] font-bold text-center break-all p-1 text-gray-600">${a.name.substring(0, 12)}</div>`; const b = document.createElement('button'); b.className = 'absolute top-0 right-0 bg-white/90 hover:bg-red-500 hover:text-white text-black p-0.5 rounded-bl-lg hidden group-hover:block transition'; b.innerHTML = `<span class="material-symbols-rounded text-[12px]">close</span>`; b.onclick = () => { state.attachments.splice(i, 1); renderAttachmentsPreview(); updateSendButtonState(); }; d.appendChild(b); els.attachmentsPreview.appendChild(d); }); }
function updateSendButtonState() { if (state.isGenerating) els.btnSend.disabled = false; else els.btnSend.disabled = els.chatInput.value.trim().length === 0 && state.attachments.length === 0; }
async function fetchModels(se = true) {
    const k = { agnes: document.getElementById('api-key-agnes').value.trim(), aqua: document.getElementById('api-key-aqua').value.trim() };
    els.modelSelect.innerHTML = '<option value="">Loading Models...</option>';
    let am = [];

    // Fetch from built-in providers
    const ff = async (pk, ks) => {
        if (!ks) return;
        try {
            const r = await fetch(`${providers[pk].url}/models`, { headers: { 'Authorization': `Bearer ${ks}` } });
            if (r.ok) {
                const d = await r.json();
                (d.data || []).forEach(m => {
                    if (m.id.toLowerCase().includes('video')) return;
                    if (pk === 'aqua') {
                        const t = String(m.tier || '').toLowerCase();
                        if (m.tier && !t.includes('standar')) return;
                        if (!m.tier && (m.id.toLowerCase().includes('pro') || m.id.toLowerCase().includes('premium'))) return;
                    }
                    am.push({ id: m.id, provider: pk, label: `[${providers[pk].name}] ${m.id}` });
                });
            }
        } catch (e) { }
    };
    await Promise.all([ff('agnes', k.agnes), ff('aqua', k.aqua)]);

    // Fetch from custom providers
    for (let i = 0; i < customProviders.length; i++) {
        const cp = customProviders[i];
        try {
            const headers = { 'Content-Type': 'application/json' };
            if (!cp.noKey && cp.key) {
                headers['Authorization'] = `Bearer ${cp.key}`;
            }
            const r = await fetch(`${cp.url}/models`, { headers });
            if (r.ok) {
                const d = await r.json();
                (d.data || []).forEach(m => {
                    if (m.id.toLowerCase().includes('video')) return;
                    am.push({ id: m.id, provider: `custom_${i}`, label: `[${cp.name}] ${m.id}` });
                });
            }
        } catch (e) { console.warn(`Failed to fetch from ${cp.name}:`, e); }
    }

    els.modelSelect.innerHTML = '';
    if (am.length === 0) {
        els.modelSelect.innerHTML = '<option value="">No models found</option>';
        if (se) {
            els.errorBox.textContent = 'Error fetching models. Check API Keys.';
            els.errorBox.classList.remove('hidden');
        }
        return;
    }
    am.sort((a, b) => a.label.localeCompare(b.label)).forEach(m => {
        const o = document.createElement('option');
        o.value = `${m.provider}|${m.id}`;
        o.textContent = m.label;
        if (o.value === state.modelId) o.selected = true;
        els.modelSelect.appendChild(o);
    });
    if (!state.modelId || !am.find(m => `${m.provider}|${m.id}` === state.modelId)) state.modelId = els.modelSelect.value;
    updateCtx();
}
function saveSettings() { state.keys.agnes = document.getElementById('api-key-agnes').value.trim(); state.keys.aqua = document.getElementById('api-key-aqua').value.trim(); localStorage.setItem('ventarys_key_agnes', state.keys.agnes); localStorage.setItem('ventarys_key_aqua', state.keys.aqua); state.modelId = els.modelSelect.value; localStorage.setItem('ventarys_modelId', state.modelId); updateCtx(); els.modal.classList.add('hidden'); } els.modelSelect.addEventListener('change', e => { state.modelId = e.target.value; localStorage.setItem('ventarys_modelId', state.modelId); updateCtx(); });
function saveHistory() { try { localStorage.setItem('ventarys_sessions', JSON.stringify(state.sessions)); } catch (e) { state.sessions = state.sessions.slice(0, 10); try { localStorage.setItem('ventarys_sessions', JSON.stringify(state.sessions)); } catch (err) { localStorage.setItem('ventarys_sessions', '[]'); } } updateCtx(); }
marked.setOptions({ highlight: (c, l) => hljs.highlight(c, { language: hljs.getLanguage(l) ? l : 'plaintext' }).value, breaks: true, gfm: true });
function updateHistoryUI() { els.historyList.innerHTML = '';[...state.sessions].sort((a, b) => b.updatedAt - a.updatedAt).forEach(s => { const li = document.createElement('li'); li.className = `truncate py-2 px-3 rounded-lg cursor-pointer text-[12px] font-medium transition flex justify-between items-center group ${s.id === state.currentSessionId ? 'bg-gray-200 text-black' : 'hover:bg-gray-100 text-gray-700'}`; li.innerHTML = `<span class="truncate flex-1">${s.title}</span> <button class="hidden group-hover:block text-red-500 hover:text-red-700 ml-2 p-1 rounded hover:bg-red-50" onclick="deleteSession('${s.id}', event)"><span class="material-symbols-rounded text-[14px]">delete</span></button>`; li.onclick = () => loadSession(s.id); els.historyList.appendChild(li); }); }

function renderMessage(role, c, isS = false) {
    els.emptyState.classList.add('hidden'); const md = document.createElement('div'); let dc = c; if (Array.isArray(c)) dc = c.filter(x => x.type === 'text').map(x => x.text).join('\n') || "[Attached Files]";
    if (role === 'user') {
        md.className = 'bg-gray-200 p-3.5 rounded-2xl rounded-tr-sm text-[14px] text-gray-900 self-end ml-10 whitespace-pre-wrap shadow-sm max-w-[90%] font-medium';
        md.textContent = dc; els.chatContainer.appendChild(md);
    } else {
        md.className = 'w-full text-[14px] text-gray-800 pr-2 flex flex-col gap-3 bg-white p-4 rounded-2xl rounded-tl-sm shadow-sm border border-gray-100 transition-all';
        md.innerHTML = `<div class="markdown-body">${dc ? DOMPurify.sanitize(marked.parse(dc)) : (isS ? '<span class="animate-pulse">● ● ●</span>' : '')}</div><div class="tools-container empty:hidden flex flex-col gap-2"></div>`;
        els.chatContainer.appendChild(md);
    }
    scrollToBottom();
    return md;
}

// --- APPLY CODE SYSTEM (CURSOR VIBE) ---
function injectCodeButtons(container) {
    container.querySelectorAll('pre').forEach(pre => {
        if (pre.querySelector('.actions-wrapper')) return;
        pre.classList.add('relative', 'group');

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'actions-wrapper absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'bg-gray-800/90 text-white text-[10px] px-2 py-1.5 rounded-lg hover:bg-gray-700 transition-all shadow-md font-medium flex items-center gap-1';
        copyBtn.innerHTML = '<span class="material-symbols-rounded text-[14px]">content_copy</span> Copy';
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(pre.querySelector('code').innerText);
            copyBtn.innerHTML = '<span class="material-symbols-rounded text-[14px]">check</span> Copied';
            setTimeout(() => copyBtn.innerHTML = '<span class="material-symbols-rounded text-[14px]">content_copy</span> Copy', 2000);
        };

        const applyBtn = document.createElement('button');
        applyBtn.className = 'bg-blue-600/90 text-white text-[10px] px-2.5 py-1.5 rounded-lg hover:bg-blue-700 transition-all shadow-md font-bold flex items-center gap-1.5';
        applyBtn.innerHTML = '<span class="material-symbols-rounded text-[14px]">edit_document</span> Apply';
        applyBtn.onclick = () => {
            if (!editor || !activeFilePath) { alert('Open a file in the editor to apply the code.'); return; }
            const code = pre.querySelector('code').innerText;
            const sel = editor.getSelectionRange();
            if (sel.isEmpty()) editor.insert(code);
            else editor.session.replace(sel, code);

            applyBtn.innerHTML = '<span class="material-symbols-rounded text-[14px]">check</span> Applied';
            applyBtn.classList.replace('bg-blue-600/90', 'bg-green-600/90');
            setTimeout(() => { applyBtn.innerHTML = '<span class="material-symbols-rounded text-[14px]">edit_document</span> Apply'; applyBtn.classList.replace('bg-green-600/90', 'bg-blue-600/90'); }, 2000);
        };

        actionsDiv.appendChild(copyBtn); actionsDiv.appendChild(applyBtn); pre.appendChild(actionsDiv);
    });
}

function scrollToBottom() { els.chatContainer.scrollTo({ top: els.chatContainer.scrollHeight, behavior: 'smooth' }); }

// --- AUTONOMOUS SYSTEM & SECOND CURSOR TOOLS ---
async function runLocalTool(c) {
    if (!isElectron) return "Critical Error: The user is in the Web version. Local tools require the downloadable Electron version of Ventarys.";
    const n = c.function.name;
    let a = {};
    try { a = JSON.parse(c.function.arguments); } catch (e) {
        addOutputLine(`Error parsing arguments for ${n}: ${e.message}`, 'error');
        return "Error parsing args.";
    }
    const cwd = currentFolderPath || os.homedir();

    // Log tool invocation
    addOutputLine(`🔧 Tool called: ${n}`, 'ai');
    addOutputLine(`   Args: ${JSON.stringify(a).substring(0, 150)}`, 'system');

    if (n === 'execute_terminal') {
        addOutputLine(`⌘ Executing terminal command: ${a.command}`, 'info');
        if (term && ptyProcess) { ptyProcess.stdin.write(`${a.command}\r\n`); term.focus(); }
        return new Promise(res => {
            cpModule.exec(a.command, { cwd }, (err, out, stde) => {
                const result = out || stde || "Command executed.";
                addOutputLine(`✓ Command completed successfully`, 'success');
                if (out) addOutputLine(`   Output: ${out.substring(0, 200)}`, 'system');
                if (err) addOutputLine(`   ⚠ Error: ${err.message}`, 'warning');
                res(result);
            });
        });
    } else if (n === 'execute_git_command') {
        const cmd = `git ${a.args}`;
        addOutputLine(`📦 Executing git command: ${cmd}`, 'info');
        if (term && ptyProcess) { ptyProcess.stdin.write(`${cmd}\r\n`); term.focus(); }
        return new Promise(res => {
            cpModule.exec(cmd, { cwd }, (err, out, stde) => {
                const result = out || stde || "Git command executed.";
                if (err) {
                    addOutputLine(`✗ Git error: ${err.message}`, 'error');
                } else {
                    addOutputLine(`✓ Git command completed`, 'success');
                }
                res(result || "Git command executed.");
            });
        });
    } else if (n === 'list_directory') {
        try {
            const targetPath = path.resolve(cwd, a.path || '.');
            addOutputLine(`📂 Listing directory: ${a.path || '.'}`, 'info');
            const f = fs.readdirSync(targetPath, { withFileTypes: true });
            const result = `Dir of ${a.path || '.'}:\n` + f.map(x => `${x.isDirectory() ? '[DIR] ' : '[FILE]'} ${x.name}`).join('\n');
            addOutputLine(`✓ Listed ${f.length} items`, 'success');
            return result;
        } catch (e) {
            addOutputLine(`✗ List directory error: ${e.message}`, 'error');
            return `Error: ${e.message}`;
        }
    } else if (n === 'read_file') {
        try {
            const targetPath = path.resolve(cwd, a.file_path);
            addOutputLine(`📄 Reading file: ${a.file_path}`, 'info');
            const content = fs.readFileSync(targetPath, 'utf8');
            addOutputLine(`✓ Read ${content.length} bytes from ${path.basename(a.file_path)}`, 'success');
            return content.substring(0, 8000);
        } catch (e) {
            addOutputLine(`✗ Read file error: ${e.message}`, 'error');
            return `Error: ${e.message}`;
        }
    } else if (n === 'write_file') {
        try {
            const tp = path.resolve(cwd, a.file_path);
            addOutputLine(`✏️  Writing file: ${a.file_path}`, 'info');
            addOutputLine(`   Content length: ${a.content.length} bytes`, 'system');
            fs.writeFileSync(tp, a.content, 'utf8');

            // Track this file change for auto-reload
            const existingFile = openFiles.find(f => f.path === tp);
            if (existingFile) {
                existingFile.content = a.content;
                existingFile.isDirty = false;
                if (activeFilePath === tp && editor) {
                    isEditorUpdating = true;
                    editor.setValue(a.content, -1);
                    isEditorUpdating = false;
                    renderTabs();
                    addOutputLine(`🔄 Editor updated with new content`, 'success');
                }
            }

            addOutputLine(`✓ File saved: ${tp}`, 'success');
            return `File successfully saved at ${tp}`;
        } catch (e) {
            addOutputLine(`✗ Write file error: ${e.message}`, 'error');
            return `Write error: ${e.message}`;
        }
    } else if (n === 'ide_live_edit') {
        addOutputLine(`🎯 Second Cursor edit: ${a.file_path} at line ${a.line}`, 'info');
        if (activeFilePath && path.normalize(activeFilePath) === path.normalize(a.file_path) && editor) {
            try {
                isEditorUpdating = true;
                editor.gotoLine(a.line, 0, true);
                editor.insert(a.code + "\n");

                const cursorNode = document.querySelector('.ace_cursor');
                if (cursorNode) {
                    cursorNode.classList.add('ai-cursor');
                    setTimeout(() => cursorNode.classList.remove('ai-cursor'), 2500);
                }
                isEditorUpdating = false;
                saveCurrentFile();
                addOutputLine(`✓ Second cursor inserted code at line ${a.line}`, 'success');
                return `Second cursor executed: Code inserted successfully at line ${a.line}.`;
            } catch (e) {
                isEditorUpdating = false;
                addOutputLine(`✗ IDE edit error: ${e.message}`, 'error');
                return `Error editing in IDE: ${e.message}`;
            }
        } else {
            addOutputLine(`⚠ File not active: ${a.file_path}`, 'warning');
            return `File ${a.file_path} is NOT the active file currently in the IDE. Use the write_file tool instead.`;
        }
    } else if (n === 'run_automation_script') {
        try {
            const ext = a.language === 'python' ? 'py' : a.language === 'node' ? 'js' : a.language === 'powershell' ? 'ps1' : 'sh';
            const tmpPath = path.join(os.tmpdir(), `ventarys_auto_${Date.now()}.${ext}`);
            fs.writeFileSync(tmpPath, a.script, 'utf8');
            addOutputLine(`🤖 Running ${a.language} automation script`, 'info');

            let cmd = '';
            if (a.language === 'python') cmd = `python "${tmpPath}"`;
            else if (a.language === 'node') cmd = `node "${tmpPath}"`;
            else if (a.language === 'powershell') cmd = `powershell -ExecutionPolicy Bypass -File "${tmpPath}"`;
            else cmd = `bash "${tmpPath}"`;

            if (term && ptyProcess) {
                ptyProcess.stdin.write(`\x1b[35m# Starting Agent Automation...\x1b[0m\r\n`);
                ptyProcess.stdin.write(`${cmd}\r\n`);
                term.focus();
            }

            return new Promise(res => {
                cpModule.exec(cmd, { cwd }, (err, out, stde) => {
                    fs.unlink(tmpPath, () => { });
                    if (err) {
                        addOutputLine(`✗ Script error: ${err.message}`, 'error');
                        res(`OS Automation executed with errors.\nOutput: ${out || stde || err.message}`);
                    } else {
                        addOutputLine(`✓ Script executed successfully`, 'success');
                        res(`OS Automation executed.\nOutput: ${out || stde || "Clean execution with no console output."}`);
                    }
                });
            });
        } catch (e) {
            addOutputLine(`✗ Script execution error: ${e.message}`, 'error');
            return `Critical error in automation execution: ${e.message}`;
        }
    }
    addOutputLine(`✗ Unknown tool: ${n}`, 'error');
    return "Unknown tool called by the Agent."
}

async function handleSendOrStop(iAR = false) {
    if (state.isGenerating && !iAR) {
        if (state.abortController) state.abortController.abort();
        state.isGenerating = false;
        els.sendIcon.textContent = 'arrow_upward';
        els.sendIcon.classList.remove('text-red-500');
        updateSendButtonState();
        addOutputLine(`⛔ Agent generation stopped by user`, 'warning');
        return;
    }
    if (!state.modelId) { els.modal.classList.remove('hidden'); return; }
    const [pK, rM] = state.modelId.split('|');

    // Get API key and URL based on provider
    let aK = '', pUrl = '';
    if (pK === 'agnes') { aK = state.keys.agnes; pUrl = providers.agnes.url; }
    else if (pK === 'aqua') { aK = state.keys.aqua; pUrl = providers.aqua.url; }
    else if (pK.startsWith('custom_')) {
        const cpIndex = parseInt(pK.split('_')[1]);
        const cp = customProviders[cpIndex];
        if (cp) {
            pUrl = cp.url;
            if (!cp.noKey) aK = cp.key || '';
        }
    }

    if (!aK && pK !== 'agnes' && pK !== 'aqua' && !pK.startsWith('custom_')) {
        alert('API Key is missing.');
        return;
    }

    const pt = els.chatInput.value.trim();
    if (!pt && state.attachments.length === 0 && !iAR) return;

    if (!iAR) {
        addOutputLine(`💬 User message received: "${pt.substring(0, 50)}..."`, 'info');
        state.isGenerating = true;
        els.sendIcon.textContent = 'square';
        els.sendIcon.classList.add('text-red-500');
        els.chatInput.value = '';
        els.chatInput.style.height = 'auto';
        let uc = pt, cs = "";
        const tf = state.attachments.filter(a => a.type === 'file');
        if (tf.length > 0) {
            addOutputLine(`📎 ${tf.length} file(s) attached`, 'system');
            cs = tf.map(f => `\n--- Attached File: ${f.name} ---\n${f.data}`).join('\n');
        }
        const ec = editor ? editor.getValue() : '', fn = activeFilePath ? path.basename(activeFilePath) : 'None';
        if (ec && activeFilePath) {
            addOutputLine(`📝 Active file included: ${fn} (${ec.length} bytes)`, 'system');
            cs += `\n--- Active File in Editor: ${fn} ---\n${ec.substring(0, 4000)}`;
        }
        if (cs) uc = `${cs}\n\nUser:\n${pt}`;
        const img = state.attachments.filter(a => a.type === 'image');
        let fc = uc;
        if (img.length > 0) {
            addOutputLine(`🖼️ ${img.length} image(s) attached`, 'system');
            fc = [{ type: "text", text: uc }];
            img.forEach(i => fc.push({ type: "image_url", image_url: { url: i.data } }));
        }

        pushMessage({ role: 'user', content: fc });
        const s = state.sessions.find(x => x.id === state.currentSessionId);
        if (s && s.title === 'New Chat') s.title = pt.substring(0, 25) + (pt.length > 25 ? '...' : '');

        renderMessage('user', pt || "[Attached File(s)]");
        updateHistoryUI(); updateCtx();
        state.attachments = [];
        renderAttachmentsPreview();
        updateSendButtonState();
        addOutputLine(`🤖 AI Agent processing...`, 'ai');
    }

    const mn = renderMessage('assistant', '', true), cn = mn.querySelector('.markdown-body'), tn = mn.querySelector('.tools-container');
    state.abortController = new AbortController(); let sR = false;

    try {
        const msgs = getMessages();
        const headers = { 'Content-Type': 'application/json' };
        if (aK) headers['Authorization'] = `Bearer ${aK}`;
        const res = await fetchWithRetry(`${pUrl}/chat/completions`, { method: 'POST', headers, body: JSON.stringify({ model: rM, messages: [getSystemPrompt(), ...msgs], stream: true, tools: toolsDefinition, tool_choice: "auto" }), signal: state.abortController.signal });
        if (!res.ok) throw new Error(`HTTP network error ${res.status}`);
        const rd = res.body.getReader(), dc = new TextDecoder("utf-8");
        let dn = false, bf = "", fr = "", tcD = {};

        while (!dn) {
            const { value, done: rDn } = await rd.read(); dn = rDn;
            if (value) {
                bf += dc.decode(value, { stream: true }); const lns = bf.split('\n'); bf = lns.pop();
                for (let l of lns) {
                    l = l.trim(); if (!l || !l.startsWith('data: ')) continue;
                    const ds = l.substring(6).trim(); if (ds === '[DONE]') { dn = true; break; }
                    try {
                        const p = JSON.parse(ds), dl = p.choices[0]?.delta || {};
                        if (dl.content) { fr += dl.content; cn.innerHTML = DOMPurify.sanitize(marked.parse(fr)); scrollToBottom(); }
                        if (dl.tool_calls) {
                            for (let tc of dl.tool_calls) {
                                if (!tcD[tc.index]) {
                                    const uId = tc.id || `call_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                                    tcD[tc.index] = { id: uId, type: "function", function: { name: tc.function?.name || "", arguments: "" } };
                                    const tU = document.createElement('div'); tU.id = `tool-call-${uId}`;
                                    tU.className = 'p-3 bg-gray-50 border border-gray-200 rounded-xl text-[12px] text-gray-700 flex flex-col gap-2 shadow-sm mt-2 transition-all';
                                    tU.innerHTML = `<div class="flex items-center gap-2 font-bold"><span class="material-symbols-rounded text-[16px] animate-spin text-blue-500" id="tool-icon-${uId}">sync</span><span id="tool-name-${uId}">${tc.function?.name || 'tool'}</span></div><div class="text-[11px] text-gray-500 font-mono bg-white border border-gray-200 p-2 rounded-lg max-h-24 overflow-y-auto" id="tool-args-${uId}">...</div>`;
                                    tn.appendChild(tU);
                                }
                                const cId = tcD[tc.index].id;
                                if (tc.function?.name && !tcD[tc.index].function.name) {
                                    tcD[tc.index].function.name = tc.function.name;
                                    document.getElementById(`tool-name-${cId}`).textContent = tc.function.name;
                                }
                                if (tc.function?.arguments) {
                                    tcD[tc.index].function.arguments += tc.function.arguments;
                                    document.getElementById(`tool-args-${cId}`).textContent = tcD[tc.index].function.arguments;
                                }
                            }
                            scrollToBottom();
                        }
                    } catch (e) { }
                }
            }
        }

        let tca = Object.values(tcD);
        if (tca.length > 0) {
            addOutputLine(`🔀 AI generated ${tca.length} tool call(s)`, 'info');
            pushMessage({ role: 'assistant', content: fr || null, tool_calls: tca });
            for (let c of tca) {
                let rs;
                try {
                    addOutputLine(`⏳ Executing tool: ${c.function.name}`, 'info');
                    rs = await runLocalTool(c);
                } catch (e) {
                    addOutputLine(`✗ Tool execution error: ${e.message}`, 'error');
                    rs = "Local tool failed: " + e.message;
                }

                const ic = document.getElementById(`tool-icon-${c.id}`);
                const box = document.getElementById(`tool-call-${c.id}`);
                if (ic) { ic.classList.remove('animate-spin', 'text-blue-500'); ic.textContent = 'check_circle'; ic.classList.add('text-gray-400'); }
                if (box) { box.classList.remove('bg-gray-50', 'border-gray-200'); box.classList.add('bg-gray-100', 'border-gray-100', 'opacity-60', 'grayscale'); }

                pushMessage({ role: 'tool', tool_call_id: c.id, name: c.function.name, content: String(rs).substring(0, 4000) });
            }
            addOutputLine(`🔄 Continuing agent conversation...`, 'ai');
            sR = true;
        } else {
            addOutputLine(`✅ Agent response completed`, 'success');
            pushMessage({ role: 'assistant', content: fr || "" });
            cn.querySelectorAll('pre code').forEach(b => hljs.highlightElement(b));
            saveHistory();
        }
    } catch (err) {
        addOutputLine(`✗ Agent error: ${err.message}`, 'error');
        if (err.name === 'AbortError') cn.innerHTML += `<br><span class="text-red-500 text-[12px] font-bold">[Stopped by user]</span>`;
        else cn.innerHTML = `<span class="text-red-500 font-bold">Agent Error: ${err.message}</span>`;
    } finally {
        if (!sR) {
            state.isGenerating = false; els.sendIcon.textContent = 'arrow_upward'; els.sendIcon.classList.remove('text-red-500'); els.chatInput.focus(); updateSendButtonState(); updateCtx();
            injectCodeButtons(els.chatContainer);

            const msgs = getMessages();
            if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
                showNotification('Ventarys IDX', 'Agent finished the requested task.');
                addOutputLine(`🏁 Agent task completed`, 'success');
            }
        }
    }
    if (sR) await handleSendOrStop(true);
}

document.addEventListener('DOMContentLoaded', init);