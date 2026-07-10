/** @forward-slice Widgets tab — embed gallery (popup only; not content widgetSettings). */

export const WIDGETS_STORAGE_KEYS = Object.freeze({
  ITEMS: 'pc_embed_widgets_v1',
});

export const WIDGET_SIZES = Object.freeze({
  SM: 'sm',
  MD: 'md',
  LG: 'lg',
});

export const WIDGET_SIZE_HEIGHTS = Object.freeze({
  sm: 120,
  md: 220,
  lg: 360,
});

export const WIDGET_MAX_ITEMS = 40;
export const WIDGET_MAX_EMBED_CHARS = 12000;
export const WIDGET_TITLE_MAX = 80;

/** Remote https iframes + blob: documents (blob origin ≠ extension). */
export const WIDGET_IFRAME_SANDBOX =
  'allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox';

/** @deprecated Prefer blob: URLs — opaque srcdoc without same-origin breaks LCW-style widgets. */
export const WIDGET_SRCDOC_SANDBOX =
  'allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox';

export const WIDGET_SOURCE_CATALOG = Object.freeze([
  {
    id: 'livecoinwatch',
    name: 'Live Coin Watch',
    category: 'markets',
    url: 'https://www.livecoinwatch.com/widgets',
    blurb: 'Crypto marquees, coin cards, top-10 lists',
  },
  {
    id: 'coingecko',
    name: 'CoinGecko',
    category: 'markets',
    url: 'https://www.coingecko.com/en/widgets',
    blurb: 'Price charts, tickers, heatmaps',
  },
  {
    id: 'vunelix',
    name: 'Vunelix',
    category: 'markets',
    url: 'https://vunelix.com/widgets',
    blurb: 'Stocks, forex, crypto screeners',
  },
  {
    id: 'arincen',
    name: 'Arincen',
    category: 'markets',
    url: 'https://en.arincen.com/widgets',
    blurb: 'Charts, ticker tape, market overview',
  },
  {
    id: 'nowprice',
    name: 'NowPrice',
    category: 'markets',
    url: 'https://nowprice.io/embed',
    blurb: 'Simple live price iframes',
  },
  {
    id: 'indify',
    name: 'Indify',
    category: 'productivity',
    url: 'https://indify.online/',
    blurb: 'Clocks, weather, countdowns, calendars',
  },
  {
    id: 'blocs',
    name: 'Blocs',
    category: 'productivity',
    url: 'https://blocs.me/blog/best-free-notion-widgets',
    blurb: 'Pomodoro, habits, trackers',
  },
]);

export const WIDGET_SELECTORS = Object.freeze({
  GALLERY: 'widgetsGallery',
  ADD_BTN: 'widgetsAddBtn',
  SOURCES_BTN: 'widgetsSourcesBtn',
  EMPTY: 'widgetsEmptyState',
  PANEL: 'widgetsAddPanel',
  PANEL_CLOSE: 'widgetsAddPanelClose',
  TITLE_INPUT: 'widgetsTitleInput',
  EMBED_INPUT: 'widgetsEmbedInput',
  SIZE_SELECT: 'widgetsSizeSelect',
  PREVIEW: 'widgetsPreviewFrame',
  PREVIEW_WRAP: 'widgetsPreviewWrap',
  SAVE_BTN: 'widgetsSaveBtn',
  CANCEL_BTN: 'widgetsCancelBtn',
  ERROR: 'widgetsFormError',
  SOURCES_PANEL: 'widgetsSourcesPanel',
  SOURCES_CLOSE: 'widgetsSourcesClose',
  SOURCES_LIST: 'widgetsSourcesList',
  EDITING_ID: 'widgetsEditingId',
});
