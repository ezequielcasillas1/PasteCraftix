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

// Shared regex for parsing animal type out of an AI-generated funky animal name.
// Kept as a module-level constant so render + generators can share the same source.
export const ANIMAL_TYPES_REGEX = /(Rabbit|Tiger|Dragon|Fox|Wolf|Bear|Panda|Lion|Eagle|Phoenix|Unicorn|Owl|Cat|Dog|Monkey|Penguin|Koala|Raccoon|Shark|Dolphin|Cheetah|Leopard|Panther|Otter|Lynx|Jaguar|Cougar|Sloth|Badger|Moose|Bison|Rhino|Elephant|Giraffe|Zebra|Kangaroo|Platypus|Hamster|Ferret|Squirrel|Chipmunk|Hawk|Falcon|Raven|Crow|Parrot|Toucan|Flamingo|Peacock|Swan|Hummingbird|Octopus|Whale|Orca|Seal|Walrus|Seahorse|Stingray|Snake|Gecko|Chameleon|Turtle|Crocodile|Alligator|Griffin|Hydra|Pegasus|Kraken)$/i;
