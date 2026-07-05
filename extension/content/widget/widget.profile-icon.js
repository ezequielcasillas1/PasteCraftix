import { pastecraftGetURL } from '../shared.js';

export async function getProfileImageForWidget() {
  try {
    const res = await chrome.storage.local.get(['userProfile']);
    const p = res ? res.userProfile : null;
    const url = p && typeof p.profileImageUrl === 'string' ? p.profileImageUrl : '';
    if (url) return url;
    const b64 = p && typeof p.profileImageBase64 === 'string' ? p.profileImageBase64 : '';
    if (b64 && b64.startsWith('data:image/') && b64.length <= 250000) return b64;
    return '';
  } catch (_) {
    return '';
  }
}

export async function applyWidgetIcon(widget) {
  if (!widget.widget) return;
  const logoImg = widget.widget.querySelector('.widget-logo');
  if (!logoImg) return;

  const defaultSrc = pastecraftGetURL('logo.svg');
  const useProfile = !!(widget.settings && widget.settings.widgetIconUseProfileImage);

  if (!useProfile) {
    if (logoImg.src !== defaultSrc) logoImg.src = defaultSrc;
    logoImg.classList.remove('is-profile-icon');
    return;
  }

  const src = await getProfileImageForWidget();
  if (!src) {
    logoImg.src = defaultSrc;
    logoImg.classList.remove('is-profile-icon');
    return;
  }

  logoImg.classList.add('is-profile-icon');
  logoImg.onerror = () => {
    try {
      logoImg.src = defaultSrc;
      logoImg.classList.remove('is-profile-icon');
    } catch (_) {}
  };
  logoImg.src = src;
}
