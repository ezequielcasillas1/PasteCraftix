import { FILES_ELEMENT_IDS } from './files.constants.js';

export function setupFilesEvents(app) {
  const searchInput = document.getElementById(FILES_ELEMENT_IDS.SEARCH_INPUT);
  const track = document.getElementById(FILES_ELEMENT_IDS.CAROUSEL_TRACK);
  const prevBtn = document.getElementById(FILES_ELEMENT_IDS.PREV_BTN);
  const nextBtn = document.getElementById(FILES_ELEMENT_IDS.NEXT_BTN);
  const backToListBtn = document.getElementById(FILES_ELEMENT_IDS.BACK_TO_LIST_BTN);
  const createBtn = document.getElementById(FILES_ELEMENT_IDS.CREATE_BTN);
  
  const fileModal = document.getElementById(FILES_ELEMENT_IDS.MODAL);
  const fileModalClose = document.getElementById('fileModalCloseBtn');
  const cancelFileBtn = document.getElementById(FILES_ELEMENT_IDS.CANCEL_BTN);
  const saveFileBtn = document.getElementById(FILES_ELEMENT_IDS.SAVE_BTN);
  const fileNameInput = document.getElementById(FILES_ELEMENT_IDS.NAME_INPUT);
  const fileColorInput = document.getElementById(FILES_ELEMENT_IDS.COLOR_INPUT);

  const manageModal = document.getElementById(FILES_ELEMENT_IDS.MANAGE_CATEGORIES_MODAL);
  const manageModalClose = document.getElementById('manageFileCategoriesCloseBtn');
  const cancelManageBtn = document.getElementById(FILES_ELEMENT_IDS.MANAGE_CATEGORIES_CANCEL);
  const saveManageBtn = document.getElementById(FILES_ELEMENT_IDS.MANAGE_CATEGORIES_SAVE);

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      app.filesFeature.render.renderFiles(app, e.target.value);
    });
  }

  if (track) {
    track.addEventListener('scroll', () => {
      app.filesFeature.render.updateCarouselArrows();
    });
  }

  if (prevBtn && track) {
    prevBtn.addEventListener('click', () => {
      track.scrollBy({ left: -200, behavior: 'smooth' });
    });
  }

  if (nextBtn && track) {
    nextBtn.addEventListener('click', () => {
      track.scrollBy({ left: 200, behavior: 'smooth' });
    });
  }

  if (backToListBtn) {
    backToListBtn.addEventListener('click', () => {
      app.selectedFileId = null;
      app.filesFeature.render.renderFiles(app, searchInput?.value || '');
      app.categoriesFeature.render.renderCategories(app);
    });
  }

  if (createBtn) {
    createBtn.addEventListener('click', () => {
      app.filesFeature.render.openFileModal(app);
    });
  }

  const closeFile = () => app.filesFeature.render.closeFileModal();
  if (fileModalClose) fileModalClose.addEventListener('click', closeFile);
  if (cancelFileBtn) cancelFileBtn.addEventListener('click', closeFile);

  if (saveFileBtn) {
    saveFileBtn.addEventListener('click', async () => {
      const name = fileNameInput.value.trim();
      if (!name) return;
      
      const fileData = {
        id: app._editingFileId,
        name,
        colorAccent: fileColorInput.value
      };
      
      await app.filesFeature.service.saveCategoryFile(app, fileData);
      closeFile();
      app.filesFeature.render.renderFiles(app, searchInput?.value || '');
    });
  }

  const closeManage = () => app.filesFeature.render.closeManageCategoriesModal();
  if (manageModalClose) manageModalClose.addEventListener('click', closeManage);
  if (cancelManageBtn) cancelManageBtn.addEventListener('click', closeManage);

  if (saveManageBtn) {
    saveManageBtn.addEventListener('click', async () => {
      console.log('📁 Save file categories clicked');
      const fileId = app._managingFileId;
      if (!fileId) {
        console.warn('No file ID found for managing categories');
        return;
      }

      const list = document.getElementById(FILES_ELEMENT_IDS.MANAGE_CATEGORIES_LIST);
      const checkedBoxes = Array.from(list.querySelectorAll('input[type="checkbox"]:checked'));
      const categoryIds = checkedBoxes.map(cb => cb.value);
      
      console.log('📁 Saving categories:', { fileId, categoryIds });

      await app.filesFeature.service.saveFileCategories(app, fileId, categoryIds);
      closeManage();
      app.categoriesFeature.render.renderCategories(app);
    });
  } else {
    console.warn('saveManageBtn not found in DOM');
  }
}
