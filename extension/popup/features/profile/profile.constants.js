export const PROFILE_STORAGE_KEYS = Object.freeze({
  USER_PROFILE: 'userProfile',
  AI_GALLERY: 'aiGallery',
  WIDGET_SETTINGS: 'widgetSettings',
});

export const PROFILE_ELEMENT_IDS = Object.freeze({
  profileModal: 'profileModal',
  profileImage: 'profileImage',
  profileImagePlaceholder: 'profileImagePlaceholder',
  topBar: 'topBar',
  topLeftProfileImage: 'topLeftProfileImage',
  topLeftProfileImg: 'topLeftProfileImg',
  topLeftProfilePlaceholder: 'topLeftProfilePlaceholder',
  topBarFunkyName: 'topBarFunkyName',
  userName: 'userName',
  aiNameValue: 'aiNameValue',
  generateAnimalBtn: 'generateAnimalBtn',
  generateCartoonBtn: 'generateCartoonBtn',
  imageViewerModal: 'imageViewerModal',
  imageViewerImg: 'imageViewerImg',
  imageViewerClose: 'imageViewerClose',
  aiGalleryGrid: 'aiGalleryGrid',
  aiGalleryCount: 'aiGalleryCount',
  aiGalleryPagination: 'aiGalleryPagination',
});

export const PROFILE_DEFAULTS = Object.freeze({
  GALLERY_PAGE_SIZE: 4,
  GALLERY_DEFAULT_PAGE: 1,
});

export { ANIMAL_TYPES_REGEX, FUNKY_ANIMALS, extractAnimalSuffix } from '../../../shared/animal-names.js';
