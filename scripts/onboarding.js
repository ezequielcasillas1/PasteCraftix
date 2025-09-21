// PasteCraft Onboarding Flow
let currentScreen = 0;
const screens = document.querySelectorAll('.screen');
const progressDots = document.querySelectorAll('.progress-dot');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    updateHistorySlider();
});

function setupEventListeners() {
    // History slider
    const historySlider = document.getElementById('history-size');
    if (historySlider) {
        historySlider.addEventListener('input', updateHistorySlider);
    }
    
    // Progress dots
    progressDots.forEach((dot, index) => {
        dot.addEventListener('click', () => goToScreen(index));
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'Enter') {
            nextScreen();
        } else if (e.key === 'ArrowLeft') {
            previousScreen();
        }
    });
}

function updateHistorySlider() {
    const slider = document.getElementById('history-size');
    const display = document.getElementById('current-size');
    if (slider && display) {
        display.textContent = slider.value;
    }
}

function nextScreen() {
    if (currentScreen < screens.length - 1) {
        goToScreen(currentScreen + 1);
    }
}

function previousScreen() {
    if (currentScreen > 0) {
        goToScreen(currentScreen - 1);
    }
}

function goToScreen(screenIndex) {
    if (screenIndex < 0 || screenIndex >= screens.length) return;
    
    // Hide current screen
    screens[currentScreen].classList.remove('active');
    progressDots[currentScreen].classList.remove('active');
    
    // Show new screen
    currentScreen = screenIndex;
    screens[currentScreen].classList.add('active');
    progressDots[currentScreen].classList.add('active');
}

async function finishSetup() {
    // Collect preferences
    const delimiter = document.querySelector('input[name="delimiter"]:checked')?.value || 'comma';
    const autoDedupe = document.getElementById('auto-dedupe')?.checked || false;
    const autoSort = document.getElementById('auto-sort')?.checked || false;
    const historySize = parseInt(document.getElementById('history-size')?.value) || 500;
    
    const preferences = {
        delimiter,
        autoDedupe,
        autoSort,
        historySize,
        onboardingComplete: true
    };
    
    // Save preferences
    try {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            await chrome.storage.local.set({ preferences });
        } else {
            localStorage.setItem('pastecraft_preferences', JSON.stringify(preferences));
        }
        console.log('Preferences saved:', preferences);
    } catch (error) {
        console.error('Failed to save preferences:', error);
    }
    
    // Show success screen
    nextScreen();
}

function closeOnboarding() {
    // Add celebration animation
    document.body.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    
    // Confetti effect
    createConfetti();
    
    // Close after animation
    setTimeout(() => {
        if (window.close) {
            window.close();
        } else {
            // Redirect to extension popup or dashboard
            window.location.href = 'popup.html';
        }
    }, 2000);
}

function createConfetti() {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    const container = document.body;
    
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.style.cssText = `
                position: fixed;
                width: 8px;
                height: 8px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                left: ${Math.random() * 100}vw;
                top: -10px;
                border-radius: 50%;
                pointer-events: none;
                z-index: 9999;
                animation: confetti-fall 3s linear forwards;
            `;
            
            container.appendChild(confetti);
            
            setTimeout(() => confetti.remove(), 3000);
        }, i * 50);
    }
}

// Add confetti animation
const style = document.createElement('style');
style.textContent = `
    @keyframes confetti-fall {
        0% {
            transform: translateY(-10px) rotate(0deg);
            opacity: 1;
        }
        100% {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
