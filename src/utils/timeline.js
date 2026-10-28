// utils/timeline.js

/**
 * Constrói a linha do tempo detalhada (Ledger/Livro-Caixa) de um ativo específico.
 * Combina operações de compra/venda com recebimento de proventos, ordenados cronologicamente.
 * 
 * Durante a iteração, vai reconstruindo o saldo atual (runningQty), 
 * calculando o carimbo cronológico exato do Preço Médio (runningAveragePrice),
 * e apurando Lucro Realizado nos eventos de Venda para fechar o histórico perfeitamente.
 * 
 * @param {string} assetId 
 * @param {Array} operations 
 * @param {Array} dividends 
 * @returns {Array} - Array cronológico reverso (do mais novo pro mais antigo) com dados injetados.
 */
export const buildAssetTimeline = (assetId, operations = [], dividends = []) => {
  const ops = operations
    .filter(o => o.assetId === assetId)
    .map(o => ({
      ...o,
      normalizedDate: new Date(o.date + 'T12:00:00'),
      eventType: o.type, // 'BUY' ou 'SELL'
    }));

  const divs = dividends
    .filter(d => d.assetId === assetId)
    .map(d => ({
      id: d.id,
      date: d.paymentDate,
      normalizedDate: new Date(d.paymentDate + 'T12:00:00'),
      eventType: 'DIVIDEND',
      qty: 0,
      price: 0,
      taxes: 0,
      totalReceived: d.totalReceived
    }));

  // Ordenação Crescente (Mais antigo primeiro) para reconstruir com exatidão a matemática
  const combined = [...ops, ...divs].sort((a, b) => a.normalizedDate - b.normalizedDate);

  let runningQty = 0;
  let runningInvested = 0;
  let runningAveragePrice = 0;
  let realizedProfitAcc = 0;
  let passiveIncomeAcc = 0;

  const timeline = combined.map(event => {
    let realizedProfit = 0;
    
    if (event.eventType === 'BUY') {
      const cost = (event.qty * event.price) + (event.taxes || 0);
      runningInvested += cost;
      runningQty += event.qty;
      runningAveragePrice = runningInvested / runningQty;
    } else if (event.eventType === 'SELL') {
      const costBasis = event.qty * runningAveragePrice;
      const netValue = (event.qty * event.price) - (event.taxes || 0);
      realizedProfit = netValue - costBasis;
      
      realizedProfitAcc += realizedProfit;
      runningQty -= event.qty;
      runningInvested -= costBasis;
      
      if (runningQty <= 0.0001) {
        runningQty = 0;
        runningInvested = 0;
        runningAveragePrice = 0;
      }
    } else if (event.eventType === 'DIVIDEND') {
      passiveIncomeAcc += event.totalReceived;
    }

    return {
      ...event,
      runningQty,
      runningAveragePrice,
      runningInvested,
      realizedProfit, // o lucro ou prejuízo da venda
      realizedProfitAcc, // lucro acumulado gerado de vendas passadas 
      passiveIncomeAcc // soma de todo retorno passivo recebido até a data
    };
  });

  // Retorna decrescente para visualização da Interface (os mais novos no topo)
  return timeline.reverse();
};
