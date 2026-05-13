import { PROFILE_ELEMENT_IDS, ANIMAL_TYPES_REGEX } from './profile.constants.js';
import * as sel from './profile.selectors.js';

// ── updateTopBarIdentity ────────────────────────────────────────────────────
// Updates top bar with user name/email, handles marquee overflow, profile image with fallback

export function updateTopBarIdentity(app, imageUrlOverride = undefined) {
  const topBar = sel.getTopBar();
  const topLeftContainer = sel.getTopLeftProfileImage();
  const topLeftImg = sel.getTopLeftProfileImg();
  const topLeftPlaceholder = sel.getTopLeftProfilePlaceholder();
  const nameEl = sel.getTopBarFunkyName();
  const nameSection = nameEl?.closest?.('.top-bar-name-section') || null;

  if (!topBar || !topLeftContainer) return;

  topBar.style.display = 'flex';
  topLeftContainer.style.display = 'flex';

  const profileImageUrl =
    (typeof imageUrlOverride === 'string' ? imageUrlOverride : null) ??
    app.userProfile?.profileImageUrl ??
    '';

  if (!profileImageUrl) {
    if (topLeftImg) {
      topLeftImg.src = '';
      topLeftImg.style.display = 'none';
    }
    if (topLeftPlaceholder) topLeftPlaceholder.style.display = 'flex';
  } else if (topLeftImg) {
    topLeftImg.src = profileImageUrl;
    topLeftImg.style.display = 'block';
    if (topLeftPlaceholder) topLeftPlaceholder.style.display = 'none';

    topLeftImg.onerror = () => {
      try {
        const b = typeof app.userProfile?.profileImageBase64 === 'string' ? app.userProfile.profileImageBase64 : '';
        if (b && b.startsWith('data:image/') && topLeftImg.src !== b) {
          topLeftImg.src = b;
          topLeftImg.style.display = 'block';
          if (topLeftPlaceholder) topLeftPlaceholder.style.display = 'none';
          return;
        }
      } catch (_) {}
      topLeftImg.style.display = 'none';
      if (topLeftPlaceholder) topLeftPlaceholder.style.display = 'flex';
    };
  }

  const userName = typeof app.userProfile?.userName === 'string' ? app.userProfile.userName.trim() : '';
  const funkyName = typeof app.userProfile?.aiGeneratedName === 'string' ? app.userProfile.aiGeneratedName.trim() : '';
  const emailPrefix = typeof app.currentUser?.email === 'string' ? app.currentUser.email.split('@')[0] : '';
  const displayName = funkyName || userName || emailPrefix || (app._isFreemiumGuest ? 'Guest' : '');

  if (nameEl) {
    nameEl.textContent = displayName;
    nameEl.style.display = displayName ? 'inline-block' : 'none';
  }

  if (nameSection) {
    const prevMarqueeName = nameSection.dataset.pcMarqueeName || '';
    if (nameSection.classList.contains('is-marquee') && displayName && prevMarqueeName === displayName) {
      // Already animating this name — do nothing.
    } else {
      nameSection.classList.remove('is-marquee');
      nameSection.style.removeProperty('--pc-marquee-distance');
      nameSection.style.removeProperty('--pc-marquee-duration');
      nameSection.dataset.pcMarqueeName = '';

      if (displayName && nameEl) {
        const applyMarquee = (retryCount = 0) => {
          const available = nameSection.clientWidth;
          const needed = nameEl.scrollWidth;
          if (available === 0 && retryCount < 2) {
            setTimeout(() => applyMarquee(retryCount + 1), 120);
            return;
          }
          const distance = Math.max(0, needed - available);
          if (distance > 6) {
            const duration = Math.min(18, Math.max(8, distance / 30));
            nameSection.style.setProperty('--pc-marquee-distance', String(distance));
            nameSection.style.setProperty('--pc-marquee-duration', `${duration}s`);
            nameSection.classList.add('is-marquee');
            nameSection.dataset.pcMarqueeName = displayName;
          }
        };
        requestAnimationFrame(() => {
          requestAnimationFrame(() => applyMarquee(0));
        });
      }
    }
  }
}

// ── showProfileModal ────────────────────────────────────────────────────────
// Opens the profile modal, sets up scroll listener lifecycle

export function showProfileModal(app) {
  const profileModal = sel.getProfileModal();
  if (profileModal) profileModal.style.display = 'flex';

  try {
    const profileToggle = document.getElementById('profileDarkModeToggle');
    if (profileToggle) profileToggle.checked = app.theme === 'dark';
  } catch (_) {}

  try {
    const widgetIconToggle = document.getElementById('widgetIconUseProfileToggle');
    if (widgetIconToggle) {
      chrome.storage.local.get(['widgetSettings'], (res) => {
        const ws = res && res.widgetSettings && typeof res.widgetSettings === 'object' ? res.widgetSettings : {};
        widgetIconToggle.checked = !!ws.widgetIconUseProfileImage;
      });
    }
  } catch (_) {}

  if (app.userProfile) {
    const userNameEl = sel.getUserName();
    if (userNameEl && app.userProfile.userName) {
      userNameEl.value = app.userProfile.userName;
    }
    if (app.userProfile.aiGeneratedName) {
      const aiNameEl = sel.getAiNameValue();
      if (aiNameEl) aiNameEl.textContent = app.userProfile.aiGeneratedName;
      const aiNameDisplay = document.getElementById('aiNameDisplay');
      if (aiNameDisplay) aiNameDisplay.style.display = 'flex';
    }
    if (app.userProfile.profileImageUrl) {
      const profileImg = sel.getProfileImage();
      const placeholder = sel.getProfileImagePlaceholder();
      if (profileImg) {
        profileImg.src = app.userProfile.profileImageUrl;
        profileImg.style.display = 'block';
      }
      if (placeholder) placeholder.style.display = 'none';
    }
  }

  updateAIGenerateButtonState(app);
  app.setupProfileModalEvents();

  const modalBody = document.querySelector('#profileModal .modal-body');
  const imageContainer = document.querySelector('.profile-image-container');

  if (modalBody && imageContainer) {
    modalBody.removeEventListener('scroll', app.profileScrollHandler);

    app.profileScrollHandler = () => {
      if (modalBody.scrollTop > 50) {
        imageContainer.classList.add('scrolled');
      } else {
        imageContainer.classList.remove('scrolled');
      }
    };

    modalBody.addEventListener('scroll', app.profileScrollHandler);
    console.log('📌 Profile image sticky scroll behavior enabled');
  }
}

// ── hideProfileModal ────────────────────────────────────────────────────────
// Closes the profile modal

export function hideProfileModal() {
  const profileModal = sel.getProfileModal();
  if (profileModal) profileModal.style.display = 'none';
}

// ── updateAIGenerateButtonState ─────────────────────────────────────────────
// Updates AI generate button based on premium status, quota, regex for credits parsing

export function updateAIGenerateButtonState(app) {
  const generateAnimalBtn = sel.getGenerateAnimalBtn();
  const generateCartoonBtn = sel.getGenerateCartoonBtn();

  console.log('🔄 Updating button states...');
  console.log('AI Generated Name:', app.userProfile?.aiGeneratedName);
  console.log('Photo uploaded:', !!app.userProfile?.profileImageBase64);

  if (app.userProfile && app.userProfile.aiGeneratedName) {
    const match = app.userProfile.aiGeneratedName.match(ANIMAL_TYPES_REGEX);
    console.log('Animal match found:', match ? match[1] : 'none');
    if (match) {
      generateAnimalBtn.disabled = false;
      generateAnimalBtn.classList.remove('btn-disabled');
      generateAnimalBtn.textContent = `🐾 ${match[1]} Avatar`;
      generateAnimalBtn.title = `Generate funky ${match[1]} avatar`;
      console.log(`✅ Animal Avatar button enabled for ${match[1]}`);
    } else {
      generateAnimalBtn.disabled = true;
      generateAnimalBtn.classList.add('btn-disabled');
      generateAnimalBtn.title = 'No animal detected in funky animal name';
      console.log('⚠️ AI name has no animal type');
    }
  } else {
    generateAnimalBtn.disabled = true;
    generateAnimalBtn.classList.add('btn-disabled');
    generateAnimalBtn.title = 'Generate funky animal name first';
    console.log('⚠️ No AI name generated yet');
  }

  if (app.userProfile && app.userProfile.profileImageBase64) {
    generateCartoonBtn.disabled = false;
    generateCartoonBtn.classList.remove('btn-disabled');
    generateCartoonBtn.title = 'Generate cartoon from your photo';
  } else {
    generateCartoonBtn.disabled = true;
    generateCartoonBtn.classList.add('btn-disabled');
    generateCartoonBtn.title = 'Upload a photo first';
  }
}

// ── displayImageTopLeft ─────────────────────────────────────────────────────
// Displays profile image in top-left area

export function displayImageTopLeft(app, imageUrl) {
  console.log('🖼️ displayImageTopLeft() called with URL:', imageUrl);
  updateTopBarIdentity(app, imageUrl);
  console.log('✅ Top bar identity updated');
}

// ── toggleSection ───────────────────────────────────────────────────────────
// Toggle collapse/expand for profile modal sections

export function toggleSection(contentId, toggleBtnId) {
  const content = document.getElementById(contentId);
  const toggleBtn = document.getElementById(toggleBtnId);

  if (content.classList.contains('collapsed')) {
    content.classList.remove('collapsed');
    toggleBtn.classList.remove('collapsed');
    toggleBtn.textContent = '▼';
  } else {
    content.classList.add('collapsed');
    toggleBtn.classList.add('collapsed');
    toggleBtn.textContent = '▶';
  }
}

// ── autoCollapseNameSection ─────────────────────────────────────────────────
// Auto-collapse profile name section after generation

export function autoCollapseNameSection() {
  const content = document.getElementById('nameRegContent');
  const toggleBtn = document.getElementById('nameToggleBtn');
  const timer = document.getElementById('nameCountdownTimer');

  if (content && toggleBtn && !content.classList.contains('collapsed')) {
    if (timer) timer.style.display = 'none';

    content.classList.add('collapsed');
    toggleBtn.classList.add('collapsed');
    toggleBtn.textContent = '▶';

    console.log('📦 Name section auto-collapsed');
  }
}

// ── startNameSectionCollapse ────────────────────────────────────────────────
// Start 10-second countdown with visible timer before collapsing name section

export function startNameSectionCollapse(app) {
  const timer = document.getElementById('nameCountdownTimer');
  const countdownValue = document.getElementById('nameCountdownValue');

  if (!timer || !countdownValue) return;

  let timeLeft = 10;
  timer.style.display = 'flex';
  countdownValue.textContent = timeLeft;

  console.log(`⏱️ Starting 10-second visible countdown for name section`);

  if (app.nameCollapseInterval) {
    clearInterval(app.nameCollapseInterval);
  }

  app.nameCollapseInterval = setInterval(() => {
    timeLeft--;
    countdownValue.textContent = timeLeft;
    console.log(`⏱️ Name section collapse in ${timeLeft}s...`);

    if (timeLeft <= 0) {
      clearInterval(app.nameCollapseInterval);
      app.nameCollapseInterval = null;
      autoCollapseNameSection();
    }
  }, 1000);
}

// ── autoCollapsePhotoSection ────────────────────────────────────────────────
// Auto-collapse profile photo section after generation

export function autoCollapsePhotoSection() {
  const content = document.getElementById('photoCreationContent');
  const toggleBtn = document.getElementById('photoToggleBtn');
  const timer = document.getElementById('photoCountdownTimer');

  if (content && toggleBtn && !content.classList.contains('collapsed')) {
    if (timer) timer.style.display = 'none';

    content.classList.add('collapsed');
    toggleBtn.classList.add('collapsed');
    toggleBtn.textContent = '▶';

    console.log('📦 Photo section auto-collapsed');
  }
}

// ── startProfileImageCollapse ───────────────────────────────────────────────
// Start 10-second countdown with visible timer before collapsing profile image section

export function startProfileImageCollapse(app) {
  const timer = document.getElementById('photoCountdownTimer');
  const countdownValue = document.getElementById('photoCountdownValue');

  if (!timer || !countdownValue) return;

  let timeLeft = 10;
  timer.style.display = 'flex';
  countdownValue.textContent = timeLeft;

  console.log(`⏱️ Starting 10-second visible countdown for photo section`);

  if (app.profileCollapseInterval) {
    clearInterval(app.profileCollapseInterval);
  }

  app.profileCollapseInterval = setInterval(() => {
    timeLeft--;
    countdownValue.textContent = timeLeft;
    console.log(`⏱️ Photo section collapse in ${timeLeft}s...`);

    if (timeLeft <= 0) {
      clearInterval(app.profileCollapseInterval);
      app.profileCollapseInterval = null;
      autoCollapsePhotoSection();
    }
  }, 1000);
}
