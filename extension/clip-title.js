(() => {
  'use strict';

  const MAX_TITLE_LENGTH = 120;

  function normalizeTitle(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_TITLE_LENGTH);
  }

  function getTitle(clip) {
    if (!clip || typeof clip !== 'object') return '';
    return normalizeTitle(clip.title || clip.clip_title || clip.meta?.title || '');
  }

  function getFallbackTitle(clip, maxLength = 42) {
    const text = String(clip?.text || '').replace(/\s+/g, ' ').trim();
    if (!text) return 'Untitled clip';
    return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
  }

  function getDisplayTitle(clip, maxLength = 42) {
    return getTitle(clip) || getFallbackTitle(clip, maxLength);
  }

  function makeAttachment(clip, addedDate = Date.now()) {
    const title = getTitle(clip);
    return {
      type: 'clip',
      id: clip?.id,
      title,
      text: clip?.text || '',
      addedDate
    };
  }

  window.PCClipTitle = {
    MAX_TITLE_LENGTH,
    normalizeTitle,
    getTitle,
    getFallbackTitle,
    getDisplayTitle,
    makeAttachment
  };
})();
