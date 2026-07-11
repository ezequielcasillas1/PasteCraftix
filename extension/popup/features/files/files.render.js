import { FILES_ELEMENT_IDS, FILES_COLORS } from './files.constants.js';

export function renderFiles(app, searchQuery = '') {
  const track = document.getElementById(FILES_ELEMENT_IDS.CAROUSEL_TRACK);
  const backToListBtn = document.getElementById(FILES_ELEMENT_IDS.BACK_TO_LIST_BTN);
  if (!track) return;

  track.classList.remove('files-carousel-track--tab-loading');
  track.removeAttribute('aria-busy');

  // Show/hide back button based on selection
  if (backToListBtn) {
    backToListBtn.style.display = app.selectedFileId ? 'flex' : 'none';
  }

  track.innerHTML = '';
  
  let filesToRender = app.categoryFiles || [];
  
  if (searchQuery) {
    const lowerQuery = searchQuery.toLowerCase();
    filesToRender = filesToRender.filter(f => f.name.toLowerCase().includes(lowerQuery));
  }

  filesToRender.forEach(file => {
    const box = document.createElement('div');
    box.className = `file-box ${app.selectedFileId === file.id ? 'selected' : ''}`;
    box.style.setProperty('--file-accent', file.colorAccent || '#3b82f6');
    box.title = file.name;
    
    box.innerHTML = `
      <i data-lucide="folder" class="file-box-icon"></i>
      <div class="file-box-name">${app.escapeHtml(file.name)}</div>
      <div class="file-box-actions">
        <button class="file-box-action-btn edit-file" title="Edit File">
          <i data-lucide="pencil-line"></i>
        </button>
        <button class="file-box-action-btn manage-cats" title="Manage Categories">
          <i data-lucide="list"></i>
        </button>
        <button class="file-box-action-btn delete-file" title="Delete File">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    `;

    box.addEventListener('click', (e) => {
      if (e.target.closest('.file-box-actions')) return;
      
      if (app.selectedFileId === file.id) {
        app.selectedFileId = null; // deselect
      } else {
        app.selectedFileId = file.id;
      }
      app.filesFeature.render.renderFiles(app, document.getElementById(FILES_ELEMENT_IDS.SEARCH_INPUT)?.value || '');
      app.categoriesFeature.render.renderCategories(app);
    });

    const editBtn = box.querySelector('.edit-file');
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openFileModal(app, file);
    });

    const manageBtn = box.querySelector('.manage-cats');
    manageBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openManageCategoriesModal(app, file);
    });

    const deleteBtn = box.querySelector('.delete-file');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Are you sure you want to delete the file "${file.name}"?`)) {
        app.filesFeature.service.deleteCategoryFile(app, file.id).then(() => {
          app.filesFeature.render.renderFiles(app, document.getElementById(FILES_ELEMENT_IDS.SEARCH_INPUT)?.value || '');
          app.categoriesFeature.render.renderCategories(app);
        });
      }
    });

    track.appendChild(box);
  });

  if (!window.__pcPopupLucideBooting) {
    window.renderLucideIconsSync?.(track);
  }

  updateCarouselArrows();
}

export function updateCarouselArrows() {
  const track = document.getElementById(FILES_ELEMENT_IDS.CAROUSEL_TRACK);
  const prevBtn = document.getElementById(FILES_ELEMENT_IDS.PREV_BTN);
  const nextBtn = document.getElementById(FILES_ELEMENT_IDS.NEXT_BTN);
  
  if (!track || !prevBtn || !nextBtn) return;

  const showPrev = track.scrollLeft > 0;
  const showNext = track.scrollLeft < (track.scrollWidth - track.clientWidth - 1);

  prevBtn.style.display = showPrev ? 'flex' : 'none';
  nextBtn.style.display = showNext ? 'flex' : 'none';
}

export function openFileModal(app, file = null) {
  const modal = document.getElementById(FILES_ELEMENT_IDS.MODAL);
  const title = document.getElementById(FILES_ELEMENT_IDS.MODAL_TITLE);
  const nameInput = document.getElementById(FILES_ELEMENT_IDS.NAME_INPUT);
  const colorInput = document.getElementById(FILES_ELEMENT_IDS.COLOR_INPUT);
  const customColorInput = document.getElementById(FILES_ELEMENT_IDS.CUSTOM_COLOR_INPUT);
  const grid = document.getElementById('fileColorPickerGrid');
  
  app._editingFileId = file ? file.id : null;
  title.textContent = file ? 'Edit File' : 'Create File';
  nameInput.value = file ? file.name : '';
  
  const selectedColor = file ? (file.colorAccent || FILES_COLORS[0]) : FILES_COLORS[0];
  colorInput.value = selectedColor;

  const isPresetColor = FILES_COLORS.includes(selectedColor);
  
  customColorInput.value = selectedColor;
  if (!isPresetColor) {
    customColorInput.classList.add('selected');
  } else {
    customColorInput.classList.remove('selected');
  }

  grid.innerHTML = '';
  FILES_COLORS.forEach(color => {
    const swatch = document.createElement('div');
    swatch.className = `color-swatch ${color === selectedColor ? 'selected' : ''}`;
    swatch.style.backgroundColor = color;
    swatch.addEventListener('click', () => {
      grid.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      customColorInput.classList.remove('selected');
      swatch.classList.add('selected');
      colorInput.value = color;
      customColorInput.value = color; // Sync custom picker visually
    });
    grid.appendChild(swatch);
  });

  // Handle custom color selection
  customColorInput.addEventListener('input', (e) => {
    grid.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    customColorInput.classList.add('selected');
    colorInput.value = e.target.value;
  });

  modal.style.display = 'flex';
  nameInput.focus();
}

export function closeFileModal() {
  const modal = document.getElementById(FILES_ELEMENT_IDS.MODAL);
  if (modal) modal.style.display = 'none';
}

export function openManageCategoriesModal(app, file) {
  const modal = document.getElementById(FILES_ELEMENT_IDS.MANAGE_CATEGORIES_MODAL);
  const title = document.getElementById(FILES_ELEMENT_IDS.MANAGE_CATEGORIES_TITLE);
  const list = document.getElementById(FILES_ELEMENT_IDS.MANAGE_CATEGORIES_LIST);
  
  app._managingFileId = file.id;
  title.textContent = `Manage Categories for "${file.name}"`;
  list.innerHTML = '';

  const fileCatIds = new Set((app.fileCategories || [])
    .filter(fc => fc.fileId === file.id)
    .map(fc => String(fc.categoryId)));

  (app.categories || []).forEach(cat => {
    const item = document.createElement('label');
    item.className = 'manage-category-item';
    
    const isChecked = fileCatIds.has(String(cat.id));
    
    item.innerHTML = `
      <input type="checkbox" value="${cat.id}" ${isChecked ? 'checked' : ''}>
      <div class="manage-category-info">
        <span class="manage-category-icon">${cat.icon || '📁'}</span>
        <span class="manage-category-name">${app.escapeHtml(cat.name)}</span>
      </div>
    `;
    
    list.appendChild(item);
  });

  modal.style.display = 'flex';
}

export function closeManageCategoriesModal() {
  const modal = document.getElementById(FILES_ELEMENT_IDS.MANAGE_CATEGORIES_MODAL);
  if (modal) modal.style.display = 'none';
}
