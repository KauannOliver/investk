import { calculateTaxes } from './taxes';
import { getUpcomingMaturities, getFgcExposure } from './fixedIncome';

/**
 * Motor autônomo offline de emissão de Alertas úteis do portfólio.
 * Avalia Backup Pendente, DARF não gerado, Ausência de Pagamentos e Inconsistências na linha do tempo.
 * 
 * @param {Object} data - Contexto global do app
 * @returns {Array} - Lista padronizada com alertas acionáveis para o usuário
 */
export const checkAlerts = ({ positions, dividends, settings, salesResult, operations = [], fixedIncome = [], fixedIncomeSettings = {} }) => {
  const alerts = [];
  const today = new Date();
  
  // 1. Missing Backup (> 30 dias ou inexistente)
  const lastBackup = settings.lastBackupDate ? new Date(settings.lastBackupDate) : null;
  const daysSinceBackup = lastBackup ? (today - lastBackup) / (1000 * 60 * 60 * 24) : Infinity;
  
  if (daysSinceBackup > 20) {
    alerts.push({
      id: 'backup_delayed',
      type: 'loss',
      title: '⚠️ Backup de Segurança Atrasado',
      desc: lastBackup 
        ? `Já faz ${Math.round(daysSinceBackup)} dias desde seu último backup. Seus dados estão vulneráveis se você limpar o cache.` 
        : 'Você nunca exportou seus dados! Proteja seu patrimônio.',
      link: '/backup',
      linkText: 'Exportar Agora'
    });
  }

  // 2. DARF do mês corrente (Vendas com Lucro)
  const taxesData = calculateTaxes(salesResult);
  const currentMonthStr = `${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  const thisMonthTax = taxesData.periods.find(p => p.period === currentMonthStr);
  
  if (thisMonthTax && thisMonthTax.darf > 0) {
    alerts.push({
      id: 'darf_pending',
      type: 'profit', // ou brand
      title: '📄 DARF Tributável Detectado',
      desc: `Atenção: Houveram lucros nas vendas deste mês que geraram pagamento de Imposto no valor de R$ ${thisMonthTax.darf.toFixed(2)}.`,
      link: '/imposto',
      linkText: 'Revisar DARF'
    });
  }

  // 3. Proventos Esperados Atrasados (Histórico Preditivo)
  const byAsset = {};
  dividends.forEach(d => {
    if (!byAsset[d.assetId]) byAsset[d.assetId] = [];
    const dt = new Date(d.paymentDate + 'T12:00:00');
    byAsset[d.assetId].push({ day: dt.getDate(), month: dt.getMonth(), year: dt.getFullYear() });
  });

  const missingDividends = [];
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  Object.keys(positions).forEach(ticker => {
    const pos = positions[ticker];
    if (pos.qty === 0) return; 
    
    const entries = byAsset[ticker] || [];
    if (entries.length < 2) return; 

    const days = entries.map(e => e.day).sort((a,b) => a - b);
    const mid = Math.floor(days.length / 2);
    const medianDay = days.length % 2 !== 0 ? days[mid] : Math.round((days[mid - 1] + days[mid]) / 2);

    const hasThisMonth = entries.some(e => e.month === currentMonth && e.year === currentYear);
    
    // Se hoje é pelo menos o da mediana histórica E até agora não foi pingado o recebimento deste mês
    if (medianDay <= today.getDate() && !hasThisMonth) {
      missingDividends.push(ticker);
    }
  });

  if (missingDividends.length > 0) {
    alerts.push({
      id: 'expected_dividend',
      type: 'purple',
      title: '👀 Proventos Históricos Atrasados',
      desc: `Ativos como ${missingDividends.slice(0,2).join(' e ')} costumam pagar até esta data do mês, mas parecem não ter sido registrados na carteira ainda.`,
      link: '/proventos',
      linkText: 'Cadastrar'
    });
  }
  
  // 4. Inconsistência de Ativo Zerado com Pendências Futuras
  const zeroedWithFuture = [];
  const futureDivs = dividends.filter(d => new Date(d.paymentDate + 'T12:00:00') > today);
  
  futureDivs.forEach(d => {
    // Se ele nunca existiu em posicões ou a qtd atual for exatamente zero (e tem dividendo vindo)
    const pos = positions[d.assetId];
    if ((!pos || pos.qty === 0) && !zeroedWithFuture.includes(d.assetId)) {
      zeroedWithFuture.push(d.assetId);
    }
  });
  
  if (zeroedWithFuture.length > 0) {
    alerts.push({
      id: 'zeroed_events',
      type: 'brand',
      title: '🛎️ Ativo Zerado mas com Eventos',
      desc: `Há proventos agendados futuramente para ativos que já foram totalmente liquidados (${zeroedWithFuture.join(', ')}). Acompanhe o resquício.`,
      link: '/proventos',
      linkText: 'Conferir Tabela'
    });
  }

  // 5. Alertas de Renda Fixa (CDB)
  const upcomingMaturities = getUpcomingMaturities(fixedIncome, fixedIncomeSettings);
  
  upcomingMaturities.forEach(cdb => {
    if (cdb.daysLeft === 0) {
      alerts.push({
        id: `cdb_today_${cdb.id}`,
        type: 'profit',
        title: '🔔 CDB Vencendo Hoje',
        desc: `O CDB "${cdb.nickname}" (${cdb.issuer}) vence hoje.`,
        link: `/renda-fixa/${cdb.id}`,
        linkText: 'Ver Detalhes'
      });
    } else if (cdb.daysLeft > 0) {
      alerts.push({
        id: `cdb_soon_${cdb.id}`,
        type: 'purple',
        title: '⏳ CDB Vencendo em Breve',
        desc: `O CDB "${cdb.nickname}" vence em ${cdb.daysLeft} dias.`,
        link: `/renda-fixa/${cdb.id}`,
        linkText: 'Planejar Resgate'
      });
    } else if (cdb.daysLeft < 0) {
      alerts.push({
        id: `cdb_overdue_${cdb.id}`,
        type: 'loss',
        title: '⚠️ CDB Vencido Não Resgatado',
        desc: `O CDB "${cdb.nickname}" venceu há ${Math.abs(cdb.daysLeft)} dias e ainda consta como ativo.`,
        link: `/renda-fixa/${cdb.id}`,
        linkText: 'Marcar Resgate'
      });
    }
  });

  // 6. Exposição FGC
  if (fixedIncome.length > 0 && fixedIncomeSettings.fgcLimitPerIssuer) {
    const assumptions = { 
      cdiAnnual: fixedIncomeSettings.defaultCdiAnnual || 10.5, 
      ipcaAnnual: fixedIncomeSettings.defaultIpcaAnnual || 4.5 
    };
    const fgcData = getFgcExposure(fixedIncome, assumptions, fixedIncomeSettings);
    
    fgcData.groups.forEach(group => {
      if (group.exceeded > 0) {
        alerts.push({
          id: `fgc_${group.name}`,
          type: 'loss',
          title: '🚨 Limite FGC Excedido',
          desc: `A exposição projetada no banco/conglomerado ${group.name} (R$ ${group.projected.toFixed(2)}) ultrapassou o limite configurado de R$ ${group.limit.toFixed(2)}.`,
          link: '/renda-fixa',
          linkText: 'Ver Renda Fixa'
        });
      }
    });
  }

  return alerts;
};
