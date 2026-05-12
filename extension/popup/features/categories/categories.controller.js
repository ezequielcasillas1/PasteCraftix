import * as categoryRender from './categories.render.js';
import * as categoryEvents from './categories.events.js';
import * as categoryState from './categories.state.js';
import * as categoryService from './categories.service.js';

export function initCategoriesFeature(_app) {
  return {
    render: categoryRender,
    events: categoryEvents,
    state: categoryState,
    service: categoryService,
  };
}
