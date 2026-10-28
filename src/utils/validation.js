// utils/validation.js

export const validateOperation = (op, allOperations = []) => {
  const errors = [];
  
  // 1. Normalização básica e validação de campos
  const rawAssetId = typeof op.assetId === 'string' ? op.assetId.trim().toUpperCase() : '';
  const tickerRegex = /^[A-Z0-9]{4,8}$/;

  if (!rawAssetId) {
    errors.push("O Ticker (Ativo) é obrigatório.");
  } else if (!tickerRegex.test(rawAssetId)) {
    errors.push("Ticker inválido. Use apenas letras maiúsculas e números (ex: PETR4, KNCR11), sem espaços ou caracteres especiais (comprimento entre 4 e 8).");
  }
  
  const ticker = rawAssetId;
  
  if (!['BUY', 'SELL'].includes(op.type)) {
    errors.push("Tipo de operação inválido (deve ser Compra ou Venda).");
  }
  
  if (!op.date || isNaN(new Date(op.date).getTime())) {
    errors.push("Data inválida ou obrigatória.");
  }
  
  if (isNaN(op.qty) || op.qty <= 0) {
    errors.push("Quantidade deve ser maior que zero.");
  }
  
  if (isNaN(op.price) || op.price <= 0) {
    errors.push("Preço unitário deve ser maior que zero.");
  }
  
  if (isNaN(op.taxes) || op.taxes < 0) {
    errors.push("Taxas não podem ser negativas.");
  }

  if (errors.length > 0) return { valid: false, errors };

  // 2. Consistência do tipo de ativo (Não pode ser FII hoje e Ação amanhã pro mesmo Ticker)
  const existingOps = allOperations.filter(o => o.assetId === ticker && o.id !== op.id);
  if (existingOps.length > 0) {
    const existingType = existingOps[0].assetType;
    if (op.assetType && op.assetType !== existingType) {
      errors.push(`O ativo ${ticker} já está cadastrado como ${existingType}. Você enviou como ${op.assetType}.`);
    }
  }

  // 3. Validação Cronológica (Prevenção de Venda a Descoberto)
  if (op.type === 'SELL' || (op.type === 'BUY' && existingOps.some(o => o.type === 'SELL'))) {
    // Para vender tem que ter saldo suficiente NA DATA, e mesmo pra compra no passado pode bagunçar as vendas futuras.
    // Vamos simular a linha do tempo do ativo modificado.
    const simulationOps = [...existingOps, { ...op, assetId: ticker }];
    simulationOps.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let currentQty = 0;
    for (let simOp of simulationOps) {
      if (simOp.type === 'BUY') {
        currentQty += simOp.qty;
      } else if (simOp.type === 'SELL') {
        currentQty -= simOp.qty;
      }
      
      // Checagem de tolerância flutuante devido ao javascript (evitar erros de frações ínfimas)
      if (currentQty < -0.00001) {
        let textData = new Date(simOp.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        errors.push(`Saldo insuficiente em ${textData}. A operação de Venda a Descoberto não é permitida. Qtd requerida ao longo do tempo ficou negativa.`);
        break; // Primeira falha já encerra a simulação
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    normalizedData: {
      ...op,
      assetId: ticker,
      assetType: op.assetType || (existingOps.length ? existingOps[0].assetType : 'FII'),
      qty: parseFloat(op.qty),
      price: parseFloat(op.price),
      taxes: parseFloat(op.taxes || 0),
    }
  };
};
