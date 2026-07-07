/** Capture Tools counter UI + storage sync helpers. */

import {
  formatCaptureToolsCounter,
  formatCaptureToolsTooltip,
  loadCaptureToolsStats,
} from '../capture/capture.stats.js';

export async function loadWidgetCaptureToolsStats(widget) {
  const stats = await loadCaptureToolsStats();
  widget.captureToolsCount = stats.count;
  widget.captureToolsSpotCount = stats.spotCount;
  widget.captureToolsImageCount = stats.imageCount;
  updateWidgetCaptureToolsCounter(widget, stats);
  return stats;
}

export function updateWidgetCaptureToolsCounter(widget, stats) {
  if (!widget?.widget) return;

  const counter = widget.widget.querySelector('[data-field="pc-capture-tools-counter"]');
  const wrap = widget.widget.querySelector('[data-field="pc-widget-capture-wrap"]');

  const payload = stats || {
    count: widget.captureToolsCount || 0,
    spotCount: widget.captureToolsSpotCount || 0,
    imageCount: widget.captureToolsImageCount || 0,
  };

  if (counter) {
    counter.textContent = formatCaptureToolsCounter(payload);
    counter.style.transform = 'scale(1.15)';
    setTimeout(() => {
      counter.style.transform = 'scale(1)';
    }, 200);
  }

  if (wrap) {
    wrap.setAttribute('data-tooltip', formatCaptureToolsTooltip(payload));
  }
}

export function applyCaptureToolsStorageChange(widget, changes) {
  const countKey = 'pc_capture_tools_count_v1';
  const dateKey = 'pc_capture_tools_date_v1';
  const spotKey = 'pc_capture_tools_spot_v1';
  const imageKey = 'pc_capture_tools_image_v1';

  if (!changes[countKey] && !changes[dateKey] && !changes[spotKey] && !changes[imageKey]) {
    return;
  }

  const today = new Date().toDateString();
  const nextDate = changes[dateKey]?.newValue;
  if (nextDate && nextDate !== today) {
    widget.captureToolsCount = 0;
    widget.captureToolsSpotCount = 0;
    widget.captureToolsImageCount = 0;
  } else {
    if (typeof changes[countKey]?.newValue === 'number') {
      widget.captureToolsCount = changes[countKey].newValue;
    }
    if (typeof changes[spotKey]?.newValue === 'number') {
      widget.captureToolsSpotCount = changes[spotKey].newValue;
    }
    if (typeof changes[imageKey]?.newValue === 'number') {
      widget.captureToolsImageCount = changes[imageKey].newValue;
    }
  }

  updateWidgetCaptureToolsCounter(widget);
}
