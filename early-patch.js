// Early patch: loaded BEFORE any Electron initialization via `node -r`
// This polyfills process.activateUvLoop before browser_init tries to use it.

if (typeof process.activateUvLoop !== 'function') {
  // The real activateUvLoop in Electron:
  // 1. Gets the default uv loop via uv_default_loop()
  // 2. Calls uv_run(loop, UV_RUN_DEFAULT) to start processing
  // 3. "Wakes up" the uv loop to process pending events
  //
  // In our context, the uv loop is already running (we're executing JS),
  // so this function just needs to signal that the loop is live.
  // The Chromium message pump integration happens separately.

  process.activateUvLoop = function() {
    // The uv loop is already active and running (we're inside it right now)
    // This function is called to "hand over" control from Node.js init
    // to Chromium's message loop. Since we're already running, this is a no-op.
    // console.log('[early-patch] activateUvLoop called - loop already active');
  };

  console.log('[early-patch] process.activateUvLoop polyfill installed');
}

// Also check for any other missing functions that browser_init might need
if (typeof process.deactivateUvLoop !== 'function') {
  process.deactivateUvLoop = function() {};
}

console.log('[early-patch] Patch complete, Electron should initialize now');
