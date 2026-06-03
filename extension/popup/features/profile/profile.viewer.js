/** Full-screen profile image viewer modal. */

export function setupImageViewer(app) {
  const modal = document.getElementById('imageViewerModal');
  const modalImg = document.getElementById('imageViewerImg');
  const closeBtn = document.getElementById('imageViewerClose');
  const shareBtn = document.getElementById('imageViewerShare');
  const profileImage = document.getElementById('profileImage');
  const topLeftImg = document.getElementById('topLeftProfileImg');

  const showExpandedImage = (imgSrc) => {
    if (!imgSrc || imgSrc === '') return;
    modalImg.src = imgSrc;
    modal.style.display = 'flex';
  };

  if (profileImage) {
    profileImage.addEventListener('click', (e) => {
      e.stopPropagation();
      if (profileImage.style.display !== 'none') {
        showExpandedImage(profileImage.src);
      }
    });
  }

  if (topLeftImg) {
    const topLeftContainer = document.getElementById('topLeftProfileImage');
    if (topLeftContainer) {
      topLeftContainer.onclick = null;
      topLeftImg.addEventListener('click', (e) => {
        e.stopPropagation();
        showExpandedImage(topLeftImg.src);
      });
    }
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }

  if (shareBtn && app) {
    shareBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const imgSrc = modalImg?.src || '';
      app.profileFeature?.socialShare?.showProfileTestimonialShare?.(app, imgSrc);
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') {
      modal.style.display = 'none';
    }
  });
}
