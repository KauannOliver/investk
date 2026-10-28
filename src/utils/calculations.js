// utils/calculations.js

/**
 * Recalcula a carteira baseada no histórico de operações
 * Retorna um mapa de posições atuais e o sumário de prejuízos de vendas
 * @param {Array} operations - Lista de operações { id, type, assetId, assetType, date, qty, price, taxes }
 */
export const recalculatePortfolio = (operations = []) => {
  // Sort chronologically (oldest to newest) to correctly replay history
  const sortedOps = [...operations].sort((a, b) => new Date(a.date + 'T12:00:00') - new Date(b.date + 'T12:00:00'));

  const positions = {}; // ticker -> { qty, averagePrice, totalInvested, sales... }
  const salesResult = []; // history of profit/loss on sales

  sortedOps.forEach(op => {
    if (!positions[op.assetId]) {
      positions[op.assetId] = { 
        qty: 0, averagePrice: 0, totalInvested: 0, type: op.assetType, totalSoldInfo: 0 
      };
    }
    
    let pos = positions[op.assetId];

    if (op.type === 'BUY') {
      const operationCost = (op.qty * op.price) + (op.taxes || 0);
      pos.totalInvested += operationCost;
      pos.qty += op.qty;
      // Recalculates PM
      pos.averagePrice = pos.totalInvested / pos.qty;
    } 
    else if (op.type === 'SELL') {
      const costBasis = op.qty * pos.averagePrice;
      const netSaleValue = (op.qty * op.price) - (op.taxes || 0);
      const profitLoss = netSaleValue - costBasis;
      
      salesResult.push({
        id: op.id,
        date: op.date,
        assetId: op.assetId,
        assetType: op.assetType,
        qty: op.qty,
        price: op.price,
        costBasis,
        netSaleValue,
        profitLoss
      });

      pos.qty -= op.qty;
      pos.totalInvested -= costBasis;
      pos.totalSoldInfo += netSaleValue;
      
      // Floating point correction for js
      if (pos.qty <= 0.0001) {
        pos.qty = 0;
        pos.averagePrice = 0;
        pos.totalInvested = 0;
      }
    }
  });

  // Extract active positions clearly
  const activePositions = {};
  for (let key in positions) {
    if (positions[key].qty > 0) {
      activePositions[key] = positions[key];
    }
  }

  return { positions: activePositions, allPositions: positions, salesResult };
};

export const formatCurrency = (val) => {
  if (isNaN(val)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

export const formatPercent = (val) => {
  if (isNaN(val)) return '0,00%';
  return new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val / 100);
};
