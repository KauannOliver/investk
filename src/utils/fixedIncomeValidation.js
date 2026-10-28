// src/utils/fixedIncomeValidation.js
import { v4 as uuidv4 } from 'uuid';

export const validateFixedIncomeInvestment = (investment) => {
  const errors = [];
  
  if (!investment.issuer || investment.issuer.trim() === '') {
    errors.push('Banco emissor é obrigatório.');
  }

  if (!investment.indexer) {
    errors.push('Indexador é obrigatório (CDI, PRE ou IPCA).');
  }

  const investedAmount = Number(investment.investedAmount);
  if (isNaN(investedAmount) || investedAmount <= 0) {
    errors.push('Valor aplicado deve ser maior que zero.');
  }

  if (!investment.investmentDate) {
    errors.push('Data de aplicação é obrigatória.');
  }

  if (!investment.maturityDate) {
    errors.push('Data de vencimento é obrigatória.');
  }

  if (investment.investmentDate && investment.maturityDate && investment.investmentDate > investment.maturityDate) {
    errors.push('Data de aplicação não pode ser maior que a data de vencimento.');
  }

  if (investment.indexer === 'CDI') {
    const rate = Number(investment.cdiPercent);
    if (isNaN(rate) || rate <= 0) errors.push('Taxa do CDI deve ser maior que zero.');
  } else if (investment.indexer === 'PRE') {
    const rate = Number(investment.fixedAnnualRate);
    if (isNaN(rate) || rate <= 0) errors.push('Taxa Prefixada deve ser maior que zero.');
  } else if (investment.indexer === 'IPCA') {
    const rate = Number(investment.ipcaSpreadAnnualRate);
    if (isNaN(rate) || rate <= 0) errors.push('Taxa do IPCA+ deve ser maior que zero.');
  }

  if (investment.status === 'REDEEMED' && investment.redemptionNetAmount == null) {
    errors.push('Valor líquido de resgate é obrigatório ao marcar como resgatado.');
  }

  let nickname = investment.nickname || '';
  if (!nickname.trim()) {
    const issuer = investment.issuer || 'Banco';
    if (investment.indexer === 'CDI') {
      nickname = `CDB ${issuer} ${investment.cdiPercent}% CDI`;
    } else if (investment.indexer === 'PRE') {
      nickname = `CDB ${issuer} ${investment.fixedAnnualRate}% a.a.`;
    } else if (investment.indexer === 'IPCA') {
      nickname = `CDB ${issuer} IPCA + ${investment.ipcaSpreadAnnualRate}%`;
    }
  }

  const normalizedData = {
    ...investment,
    id: investment.id || uuidv4(),
    productType: investment.productType || 'CDB',
    nickname,
    conglomerate: investment.conglomerate || investment.issuer,
    broker: investment.broker || '',
    investedAmount: Number(investment.investedAmount),
    cdiPercent: investment.indexer === 'CDI' ? Number(investment.cdiPercent) : null,
    fixedAnnualRate: investment.indexer === 'PRE' ? Number(investment.fixedAnnualRate) : null,
    ipcaSpreadAnnualRate: investment.indexer === 'IPCA' ? Number(investment.ipcaSpreadAnnualRate) : null,
    liquidity: investment.liquidity || 'MATURITY',
    fgcEligible: investment.fgcEligible !== undefined ? Boolean(investment.fgcEligible) : true,
    taxExempt: Boolean(investment.taxExempt),
    status: investment.status || 'ACTIVE',
    createdAt: investment.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  return {
    valid: errors.length === 0,
    errors,
    normalizedData
  };
};
