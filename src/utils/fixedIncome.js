// src/utils/fixedIncome.js

export const parseLocalDate = (dateStr) => {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split('-');
  return new Date(year, month - 1, day, 12, 0, 0, 0); // T12:00:00 to avoid timezone bugs
};

export const diffDays = (startDate, endDate) => {
  const diffTime = endDate - startDate;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const getFixedIncomeTaxRate = (days) => {
  if (days <= 180) return 22.5;
  if (days <= 360) return 20.0;
  if (days <= 720) return 17.5;
  return 15.0;
};

export const getAnnualGrossRate = (cdb, assumptions) => {
  if (cdb.indexer === 'CDI') {
    return (assumptions.cdiAnnual / 100) * (cdb.cdiPercent / 100);
  }
  if (cdb.indexer === 'PRE') {
    return cdb.fixedAnnualRate / 100;
  }
  if (cdb.indexer === 'IPCA') {
    return (1 + assumptions.ipcaAnnual / 100) * (1 + cdb.ipcaSpreadAnnualRate / 100) - 1;
  }
  return 0;
};

export const simulateCdb = (cdb, assumptions, targetDate = null) => {
  const startDate = parseLocalDate(cdb.investmentDate);
  const endDate = targetDate ? parseLocalDate(targetDate) : parseLocalDate(cdb.maturityDate);
  
  let days = diffDays(startDate, endDate);
  if (days < 0) days = 0;

  const years = days / 365.25;
  const annualGrossRate = getAnnualGrossRate(cdb, assumptions);
  
  // M = C * (1 + i)^t
  const grossAmount = cdb.investedAmount * Math.pow(1 + annualGrossRate, years);
  const grossProfit = grossAmount - cdb.investedAmount;
  
  const taxRate = cdb.taxExempt ? 0 : getFixedIncomeTaxRate(days);
  const taxAmount = grossProfit * (taxRate / 100);
  
  const netProfit = grossProfit - taxAmount;
  const netAmount = cdb.investedAmount + netProfit;
  
  let netAnnualRate = 0;
  if (years > 0 && cdb.investedAmount > 0) {
    netAnnualRate = (Math.pow(netAmount / cdb.investedAmount, 1 / years) - 1) * 100;
  }

  return {
    grossAmount,
    grossProfit,
    taxRate,
    taxAmount,
    netProfit,
    netAmount,
    netAnnualRate,
    days
  };
};

export const calculateRedemptionComparison = (cdb, assumptions) => {
  const realGrossAmount = cdb.redemptionGrossAmount || 0;
  const realTaxAmount = cdb.redemptionTaxAmount || 0;
  const realFees = cdb.redemptionFees || 0;
  
  let realNetAmount = cdb.redemptionNetAmount;
  if (realNetAmount == null) {
    realNetAmount = realGrossAmount - realTaxAmount - realFees;
  }

  const simulation = simulateCdb(cdb, assumptions, cdb.redemptionDate || cdb.maturityDate);

  const expectedGrossAmount = simulation.grossAmount;
  const expectedTaxAmount = simulation.taxAmount;
  const expectedNetAmount = simulation.netAmount;

  const realizedNetProfit = realNetAmount - cdb.investedAmount;
  const differenceAmount = realNetAmount - expectedNetAmount;
  const differencePercent = expectedNetAmount > 0 ? (differenceAmount / expectedNetAmount) * 100 : 0;

  const startDate = parseLocalDate(cdb.investmentDate);
  const endDate = parseLocalDate(cdb.redemptionDate || cdb.maturityDate);
  let days = diffDays(startDate, endDate);
  if(days < 0) days = 0;
  const years = days / 365.25;

  let realizedNetAnnualRate = 0;
  if (years > 0 && cdb.investedAmount > 0 && realNetAmount > 0) {
    realizedNetAnnualRate = (Math.pow(realNetAmount / cdb.investedAmount, 1 / years) - 1) * 100;
  }

  let statusLabel = 'Dentro do esperado';
  if (differencePercent > 0.5) statusLabel = 'Acima do estimado';
  if (differencePercent < -0.5) statusLabel = 'Abaixo do estimado';

  return {
    expectedGrossAmount,
    expectedTaxAmount,
    expectedNetAmount,
    realGrossAmount,
    realTaxAmount,
    realNetAmount,
    realizedNetProfit,
    differenceAmount,
    differencePercent,
    realizedNetAnnualRate,
    statusLabel
  };
};

export const getFgcExposure = (fixedIncome, assumptions, settings) => {
  const exposureByGroup = {};

  fixedIncome.forEach(cdb => {
    if (cdb.status !== 'ACTIVE' || !cdb.fgcEligible) return;

    const groupName = cdb.conglomerate || cdb.issuer;
    if (!exposureByGroup[groupName]) {
      exposureByGroup[groupName] = {
        name: groupName,
        invested: 0,
        projected: 0,
        limit: settings.fgcLimitPerIssuer,
      };
    }

    const sim = simulateCdb(cdb, assumptions);
    exposureByGroup[groupName].invested += cdb.investedAmount;
    exposureByGroup[groupName].projected += sim.netAmount;
  });

  const list = Object.values(exposureByGroup).map(g => ({
    ...g,
    exceeded: Math.max(0, g.projected - g.limit)
  }));

  list.sort((a, b) => b.projected - a.projected);
  
  const globalProjected = list.reduce((acc, curr) => acc + curr.projected, 0);
  const globalExceeded = Math.max(0, globalProjected - settings.fgcGlobalLimit);

  return {
    groups: list,
    globalProjected,
    globalExceeded
  };
};

export const getUpcomingMaturities = (fixedIncome, settings) => {
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const upcoming = [];
  
  fixedIncome.forEach(cdb => {
    if (cdb.status !== 'ACTIVE') return;

    const maturityDate = parseLocalDate(cdb.maturityDate);
    const daysLeft = diffDays(today, maturityDate);
    
    const isFuture = maturityDate >= today;
    const isToday = maturityDate.getTime() === today.getTime();

    if (isToday) {
      upcoming.push({ ...cdb, daysLeft: 0 });
    } else if (isFuture) {
      if (settings.maturityAlertDays.includes(daysLeft) || daysLeft <= Math.max(...settings.maturityAlertDays)) {
        upcoming.push({ ...cdb, daysLeft });
      }
    } else {
      upcoming.push({ ...cdb, daysLeft: daysLeft }); // negative
    }
  });

  return upcoming.sort((a, b) => a.daysLeft - b.daysLeft);
};
