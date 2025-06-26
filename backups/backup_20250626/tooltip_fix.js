// Tooltip Fix Script - Run this to clear stuck tooltips

function clearAllStuckTooltips() {
    // Remove all existing tooltips
    const tooltips = document.querySelectorAll('.wordset-preview-tooltip, #wordset-preview-tooltip');
    tooltips.forEach(tooltip => {
        tooltip.remove();
        console.log('Removed stuck tooltip:', tooltip);
    });
    
    if (tooltips.length > 0) {
        console.log(`Cleared ${tooltips.length} stuck tooltip(s)`);
    } else {
        console.log('No stuck tooltips found');
    }
}

// Run immediately
clearAllStuckTooltips();

// Set up improved event handlers to prevent future stuck tooltips
document.addEventListener('click', clearAllStuckTooltips);
document.addEventListener('scroll', clearAllStuckTooltips, true);
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        clearAllStuckTooltips();
    }
});

// Enhanced hideWordSetPreview function
if (typeof window.hideWordSetPreview === 'function') {
    window.originalHideWordSetPreview = window.hideWordSetPreview;
}

window.hideWordSetPreview = function() {
    clearAllStuckTooltips();
};

console.log('Tooltip fix script loaded successfully!');
console.log('Run clearAllStuckTooltips() to manually clear stuck tooltips');

// Make the function globally available
window.clearAllStuckTooltips = clearAllStuckTooltips; 