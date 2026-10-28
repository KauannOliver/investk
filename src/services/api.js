// services/api.js
import { KEYS, getCachedPrice, setCachedPrice, clearAllQuotesCache } from '../store/localStorage';

const BRAPI_BASE = 'https://brapi.dev/api';

/** Lê o token salvo no localStorage (ou null se não configurado) */
const getToken = () => {
  try {
    return window.localStorage.getItem(KEYS.BRAPI_TOKEN) || null;
  } catch {
    return null;
  }
};

/** Monta a query string com token (se houver) + parâmetros extras */
const buildUrl = (path, params = {}) => {
  const token = getToken();
  const qs = new URLSearchParams(params);
  if (token) qs.set('token', token);
  const query = qs.toString();
  return `${BRAPI_BASE}${path}${query ? '?' + query : ''}`;
};

// Dicionário para deduplicação de requisições simultâneas
const pendingRequests = new Map();

/**
 * Busca cotação atual via BRAPI, com cache de 24h no localStorage e deduplicação de requisições.
 * @param {string} ticker
 * @param {boolean} force  - se true, ignora o cache e busca da API
 */
export const fetchQuote = async (ticker, force = false) => {
  try {
    // 1. Check local cache first
    if (!force) {
      const cached = getCachedPrice(ticker);
      if (cached !== null) {
        return { regularMarketPrice: cached, _fromCache: true };
      }
    }

    // 2. Prevent duplicate concurrent requests (Promise Reuse)
    const requestKey = `${ticker}-${force}`;
    if (pendingRequests.has(requestKey)) {
      return pendingRequests.get(requestKey);
    }

    const url = buildUrl(`/quote/${ticker}`);
    
    // 3. Create the Promise
    const fetchPromise = fetch(url).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const result = data.results?.[0] ?? null;

      if (result?.regularMarketPrice) {
        setCachedPrice(ticker, result.regularMarketPrice);
      }
      return result;
    }).catch((error) => {
      console.error(`Erro ao buscar ticker ${ticker}:`, error);
      return null; // Resolve a promise para os chamadores como null sem causar Exception
    }).finally(() => {
      // 4. Remove promise from deduplication map after it settles
      pendingRequests.delete(requestKey);
    });

    // Save promise so others can await it
    pendingRequests.set(requestKey, fetchPromise);

    return fetchPromise;
  } catch (error) {
    // Tratamento fallback 
    console.error(`Erro crítico em fetchQuote para ${ticker}:`, error);
    return null;
  }
};

/**
 * Busca histórico de preços do ativo (sem cache – usado somente na página de detalhe)
 * @param {string} ticker
 * @param {string} range  (1mo, 3mo, 1y, etc.)
 */
export const fetchHistory = async (ticker, range = '1mo') => {
  try {
    const url = buildUrl(`/quote/${ticker}`, { range, interval: '1d' });
    const res  = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.results?.[0]?.historicalDataPrice ?? [];
  } catch (error) {
    console.error(`Erro ao buscar histórico de ${ticker}:`, error);
    return [];
  }
};

/** Limpa o cache de todas as cotações (chamado pelo botão "Forçar Atualização") */
export { clearAllQuotesCache };
