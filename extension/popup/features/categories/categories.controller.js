import * as categoryRender from './categories.render.js';
import * as categoryEvents from './categories.events.js';
import * as categoryState from './categories.state.js';
import * as categoryService from './categories.service.js';
import * as categorySeparatorsService from './categories.separators.service.js';
import * as categorySeparatorsRender from './categories.separators.render.js';
import * as categorySeparatorsDrag from './categories.separators.drag.js';
import * as categorySeparatorsSection from './categories.separators.section.js';

export function initCategoriesFeature(_app) {
  return {
    render: categoryRender,
    events: categoryEvents,
    state: categoryState,
    service: categoryService,
    separators: {
      service: categorySeparatorsService,
      render: categorySeparatorsRender,
      drag: categorySeparatorsDrag,
      section: categorySeparatorsSection,
    },
  };
}
