// store/localStorage.js

export const getFromStore = (key, defaultValue = []) => {
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn(`Error reading localStorage key "${key}":`, error);
    return defaultValue;
  }
};

export const saveToStore = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Error setting localStorage key "${key}":`, error);
  }
};

export const KEYS = {
  OPS:          'investk_ops',
  DIVIDENDS:    'investk_dividends',
  SETTINGS:     'investk_settings',
  SNAPSHOTS:    'investk_snapshots',
  GOALS:        'investk_goals',
  BRAPI_TOKEN:  'investk_brapi_token',
  CACHE_QUOTES: 'investk_cache_quotes', // { ticker: { price, ts } }
  FIXED_INCOME: 'investk_fixed_income',
  FIXED_INCOME_SETTINGS: 'investk_fixed_income_settings',
  FIXED_INCOME_SIMULATIONS: 'investk_fixed_income_simulations',
  FIXED_INCOME_NOTIFIED_MATURITIES: 'investk_fixed_income_notified_maturities',
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Retorna todo o mapa de cache de cotações */
export const getCacheQuotes = () => {
  return getFromStore(KEYS.CACHE_QUOTES, {});
};

/** Retorna o preço cacheado de um ticker se ainda válido, ou null */
export const getCachedPrice = (ticker) => {
  const cache = getCacheQuotes();
  const entry = cache[ticker];
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) return null; // expirado
  return entry.price;
};

/** Salva o preço de um ticker no cache */
export const setCachedPrice = (ticker, price) => {
  const cache = getCacheQuotes();
  cache[ticker] = { price, ts: Date.now() };
  saveToStore(KEYS.CACHE_QUOTES, cache);
};

/** Invalida o cache de um ticker específico */
export const invalidateCachedPrice = (ticker) => {
  const cache = getCacheQuotes();
  delete cache[ticker];
  saveToStore(KEYS.CACHE_QUOTES, cache);
};

/** Invalida todos os caches de cotações */
export const clearAllQuotesCache = () => {
  saveToStore(KEYS.CACHE_QUOTES, {});
};
