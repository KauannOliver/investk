// utils/taxes.js

/**
 * Agrupa as vendas por mês/ano.
 */
export const groupSalesByPeriod = (salesResult = []) => {
  const byMonth = {};

  salesResult.forEach(s => {
    const dateObj = new Date(s.date + 'T12:00:00');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const periodKey = `${month}/${year}`;

    if (!byMonth[periodKey]) {
      byMonth[periodKey] = {
        period: periodKey,
        sortKey: `${year}-${month}`,
        totalFII: 0,
        totalAcoes: 0,
        grossSalesAcoes: 0,
        sales: [],
        year: year
      };
    }

    // Default to FII if assetType is missing or not Ação/Ações
    const isFII = s.assetType === 'FII' || (s.assetType !== 'Ação' && s.assetType !== 'Ações');
    if (isFII) {
      byMonth[periodKey].totalFII += s.profitLoss;
    } else {
      byMonth[periodKey].totalAcoes += s.profitLoss;
      byMonth[periodKey].grossSalesAcoes += s.netSaleValue;
    }
    byMonth[periodKey].sales.push(s);
  });

  return Object.values(byMonth).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
};

/**
 * Aplica a regra de compensação de prejuízos cronologicamente e calcula o DARF.
 */
export const applyCarryForwardProcess = (chronologicalPeriods) => {
  let carryForwardFII = 0;
  let carryForwardAcoes = 0;
  let totalDarf = 0;

  const periods = chronologicalPeriods.map(p => {
    // 1. FII Logic
    let resultForTaxFII = p.totalFII;
    let carryBeforeFII = carryForwardFII;
    
    if (carryForwardFII < 0) {
      resultForTaxFII += carryForwardFII;
    }

    let darfFII = 0;
    if (resultForTaxFII > 0) {
      darfFII = resultForTaxFII * 0.20;
      carryForwardFII = 0;
    } else {
      carryForwardFII = resultForTaxFII;
    }

    // 2. Ações Logic
    let resultForTaxAcoes = p.totalAcoes;
    let carryBeforeAcoes = carryForwardAcoes;

    if (carryForwardAcoes < 0) {
      resultForTaxAcoes += carryForwardAcoes;
    }

    let darfAcoes = 0;
    let isExemptAcoes = false;
    
    // Regra de isenção para Ações: vendas totais no mês <= 20000
    if (p.grossSalesAcoes <= 20000 && p.totalAcoes > 0) {
      isExemptAcoes = true;
      // Lucro isento não consome prejuízo acumulado, o prejuízo anterior é mantido intacto.
      carryForwardAcoes = carryBeforeAcoes; 
    } else {
      if (resultForTaxAcoes > 0) {
        darfAcoes = resultForTaxAcoes * 0.15;
        carryForwardAcoes = 0;
      } else {
        carryForwardAcoes = resultForTaxAcoes;
      }
    }

    let darfTotal = darfFII + darfAcoes;
    totalDarf += darfTotal;

    return {
      ...p,
      carryBeforeFII,
      resultAfterCarryFII: resultForTaxFII,
      carryForwardFII,
      darfFII,
      
      carryBeforeAcoes,
      resultAfterCarryAcoes: resultForTaxAcoes,
      carryForwardAcoes,
      darfAcoes,
      isExemptAcoes,

      darf: darfTotal,
      total: p.totalFII + p.totalAcoes
    };
  });

  return { periods, totalDarf };
};

/**
 * Calcula totais de lucro, prejuízo, resultado geral e anos únicos.
 */
export const extractTaxTotalsAndYears = (salesResult = []) => {
  const totalProfit = salesResult.filter(s => s.profitLoss > 0).reduce((acc, s) => acc + s.profitLoss, 0);
  const totalLoss = salesResult.filter(s => s.profitLoss < 0).reduce((acc, s) => acc + s.profitLoss, 0);
  const totalAllTime = totalProfit + totalLoss;

  const years = [...new Set(salesResult.map(s => {
    const dateObj = new Date(s.date + 'T12:00:00');
    return dateObj.getFullYear();
  }))].sort((a, b) => b - a);

  return { totalProfit, totalLoss, totalAllTime, years };
};

/**
 * Calcula a apuração de imposto agrupada por meses.
 */
export const calculateTaxes = (salesResult = []) => {
  const chronologicalPeriods = groupSalesByPeriod(salesResult);
  const { periods, totalDarf } = applyCarryForwardProcess(chronologicalPeriods);
  const { totalProfit, totalLoss, totalAllTime, years } = extractTaxTotalsAndYears(salesResult);

  return {
    periods: periods.reverse(), // Mais recente primeiro
    totalProfit,
    totalLoss,
    totalAllTime,
    totalDarf,
    years
  };
};

