// src/utils/maturityNotifications.js

import { getFromStore, saveToStore, KEYS } from '../store/localStorage';
import { getUpcomingMaturities } from './fixedIncome';

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.warn('Este navegador não suporta notificações de desktop');
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

const dispatchNotification = (title, body, tag) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    const notification = new Notification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag,
      requireInteraction: true,
      silent: false
    });
    notification.onclick = () => {
      window.focus();
    };
  } catch (e) {
    // Fallback for environments where Notification constructor is not allowed (e.g. some mobile browsers)
    // Try using service worker registration
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, {
          body,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          tag,
          requireInteraction: true
        });
      }).catch(() => {});
    }
  }
};

// ─── Maturity Notifications (CDB Vencimento) ───

export const showMaturityNotification = (cdb) => {
  const title = cdb.daysLeft === 0 
    ? '🔔 CDB Vencendo Hoje' 
    : `⏳ CDB Vence em ${cdb.daysLeft} dia${cdb.daysLeft > 1 ? 's' : ''}`;
  
  const body = `${cdb.nickname} (${cdb.issuer}) — R$ ${cdb.investedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Verifique sua corretora.`;

  dispatchNotification(title, body, `maturity-${cdb.id}-${cdb.daysLeft}`);
};

export const checkAndNotifyMaturities = (fixedIncome, settings) => {
  if (!settings.enableBrowserNotifications) return;

  const notified = getFromStore(KEYS.FIXED_INCOME_NOTIFIED_MATURITIES, []);
  const upcoming = getUpcomingMaturities(fixedIncome, settings);

  let newNotified = false;

  upcoming.forEach(item => {
    // Notify if maturing today, tomorrow, or overdue (up to 3 days overdue)
    if (item.daysLeft <= 1 && item.daysLeft >= -3) {
      const notifyKey = `${item.id}-${item.daysLeft}`;
      if (!notified.includes(notifyKey)) {
        showMaturityNotification(item);
        notified.push(notifyKey);
        newNotified = true;
      }
    }
  });

  if (newNotified) {
    saveToStore(KEYS.FIXED_INCOME_NOTIFIED_MATURITIES, notified);
  }
};

// ─── Dividend Notifications (Proventos Atrasados) ───

const NOTIFIED_DIVIDENDS_KEY = 'investk_notified_dividends';

export const checkAndNotifyDividends = (positions, dividends, settings) => {
  if (!settings.enableBrowserNotifications) return;

  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Build per-asset dividend history
  const byAsset = {};
  dividends.forEach(d => {
    if (!byAsset[d.assetId]) byAsset[d.assetId] = [];
    const dt = new Date(d.paymentDate + 'T12:00:00');
    byAsset[d.assetId].push({ day: dt.getDate(), month: dt.getMonth(), year: dt.getFullYear() });
  });

  const notified = getFromStore(NOTIFIED_DIVIDENDS_KEY, []);
  const monthKey = `${currentMonth}-${currentYear}`;
  let newNotified = false;
  const missingTickers = [];

  Object.keys(positions).forEach(ticker => {
    const pos = positions[ticker];
    if (pos.qty === 0) return;

    const entries = byAsset[ticker] || [];
    if (entries.length < 3) return; // Need at least 3 months of history for prediction

    // Calculate median payment day
    const days = entries.map(e => e.day).sort((a, b) => a - b);
    const mid = Math.floor(days.length / 2);
    const medianDay = days.length % 2 !== 0 ? days[mid] : Math.round((days[mid - 1] + days[mid]) / 2);

    const hasThisMonth = entries.some(e => e.month === currentMonth && e.year === currentYear);

    // If today is past the median payment day and no dividend was registered this month
    if (medianDay <= today.getDate() && !hasThisMonth) {
      const notifyKey = `${ticker}-${monthKey}`;
      if (!notified.includes(notifyKey)) {
        missingTickers.push(ticker);
        notified.push(notifyKey);
        newNotified = true;
      }
    }
  });

  // Send a single grouped notification for all missing dividends
  if (missingTickers.length > 0) {
    const title = '👀 Proventos Possivelmente Atrasados';
    const tickersList = missingTickers.slice(0, 4).join(', ');
    const extra = missingTickers.length > 4 ? ` e mais ${missingTickers.length - 4}` : '';
    const body = `${tickersList}${extra} costumam pagar dividendos até esta data do mês. Verifique se já foram creditados.`;
    
    dispatchNotification(title, body, `div-missing-${monthKey}`);
  }

  if (newNotified) {
    saveToStore(NOTIFIED_DIVIDENDS_KEY, notified);
  }
};
