// Function Key Protection System
// Prevents F3 volume keys and other function keys from causing accidental sign out

(function() {
    'use strict';
    
    console.log('🔒 Initializing function key protection system...');
    
    // Function to handle keyboard events and block problematic keys
    function handleKeyboardProtection(e) {
        // Block function keys F1-F12
        if (e.key && e.key.startsWith('F') && e.key.length <= 3) {
            const keyNumber = parseInt(e.key.substring(1));
            if (keyNumber >= 1 && keyNumber <= 12) {
                console.log(`🔒 BLOCKED: Function key ${e.key} (prevents accidental sign out)`);
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            }
        }
        
        // Block refresh key combinations
        if ((e.key === 'F5') || 
            (e.ctrlKey && e.key === 'r') || 
            (e.metaKey && e.key === 'r') ||
            (e.key === 'BrowserRefresh')) {
            console.log(`🔒 BLOCKED: Refresh key combination "${e.key}" (prevents accidental sign out)`);
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
        }
        
        // Block other potentially problematic keys
        if (e.key === 'F11' || // Fullscreen toggle
            e.key === 'F12' || // Developer tools
            (e.ctrlKey && e.shiftKey && e.key === 'I') || // Dev tools
            (e.metaKey && e.shiftKey && e.key === 'I')) {   // Dev tools on Mac
            console.log(`🔒 BLOCKED: Browser action key "${e.key}" (prevents accidental sign out)`);
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
        }
    }
    
    // Install protection as early as possible
    document.addEventListener('keydown', handleKeyboardProtection, true); // Capture phase
    document.addEventListener('keyup', handleKeyboardProtection, true);   // Also block on keyup
    
    // Install protection when DOM is ready (backup)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            document.addEventListener('keydown', handleKeyboardProtection, true);
            document.addEventListener('keyup', handleKeyboardProtection, true);
            console.log('🔒 Function key protection re-enabled after DOM load');
        });
    }
    
    // Also install on window for maximum coverage
    window.addEventListener('keydown', handleKeyboardProtection, true);
    window.addEventListener('keyup', handleKeyboardProtection, true);
    
    console.log('🔒 Function key protection system active');
    console.log('🔒 Protected keys: F1-F12, F5, Ctrl+R, Cmd+R, and browser shortcuts');
    console.log('🔒 Sign out will only happen through: 1-minute idle timeout, red sign out button, or refresh button');
    
    // Make protection function globally available for debugging
    window.keyboardProtectionEnabled = true;
    window.testKeyboardProtection = function() {
        console.log('🔒 Keyboard protection is active and working');
        console.log('🔒 Try pressing F3 - it should be blocked and logged');
    };
    
})(); 