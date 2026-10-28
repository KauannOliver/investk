import * as XLSX from 'xlsx';
import { calculateTaxes } from './taxes';
import { getUpcomingMaturities, getFgcExposure, simulateCdb } from './fixedIncome';

/**
 * Compila diversas frentes de dados da aplicação em um único arquivo Excel multipáginas
 * e dispara o download automático.
 * 
 * @param {Object} data 
 * @param {Object} data.positions 
 * @param {Object} data.quotes 
 * @param {Array}  data.operations 
 * @param {Array}  data.dividends 
 * @param {Array}  data.salesResult 
 * @param {Array}  data.fixedIncome
 * @param {Object} data.fixedIncomeSettings
 */
export const exportExcelReport = ({ positions, quotes, operations, dividends, salesResult, fixedIncome = [], fixedIncomeSettings = {} }) => {
  const wb = XLSX.utils.book_new();

  // 1. Resumo Global
  let totalInvested = 0;
  let totalCurrent = 0;
  
  Object.keys(positions).forEach(ticker => {
    const p = positions[ticker];
    if (p.qty <= 0) return;
    const price = p.type === 'RF' ? p.averagePrice : (quotes[ticker] || p.averagePrice);
    totalInvested += p.totalInvested;
    totalCurrent += (p.qty * price);
  });

  const plAbsoluta = totalCurrent - totalInvested;
  const plPct = totalInvested > 0 ? (plAbsoluta / totalInvested) : 0;

  const now = new Date();
  const lastYear = new Date();
  lastYear.setFullYear(now.getFullYear() - 1);
  const div12m = dividends
    .filter(d => new Date(d.paymentDate + 'T12:00:00') >= lastYear)
    .reduce((s, d) => s + d.totalReceived, 0);

  const dy12m = totalCurrent > 0 ? (div12m / totalCurrent) : 0;
  
  let totalFixedIncomeInvested = 0;
  let totalFixedIncomeNetEst = 0;
  let totalFixedIncomeRealizedProfit = 0;
  let totalFixedIncomeDiff = 0;
  
  const assumptions = { 
    cdiAnnual: fixedIncomeSettings.defaultCdiAnnual || 10.5, 
    ipcaAnnual: fixedIncomeSettings.defaultIpcaAnnual || 4.5 
  };

  fixedIncome.forEach(cdb => {
    if (cdb.status === 'ACTIVE') {
      const sim = simulateCdb(cdb, assumptions);
      totalFixedIncomeInvested += cdb.investedAmount;
      totalFixedIncomeNetEst += sim.netAmount;
    } else if (cdb.status === 'REDEEMED') {
      const realNet = cdb.redemptionNetAmount || 0;
      const sim = simulateCdb(cdb, assumptions, cdb.redemptionDate || cdb.maturityDate);
      totalFixedIncomeRealizedProfit += (realNet - cdb.investedAmount);
      totalFixedIncomeDiff += (realNet - sim.netAmount);
    }
  });

  const totalPatrimonioCdbIncluido = totalCurrent + totalFixedIncomeNetEst;

  const resumoData = [
    { "Métrica": "Data do Relatório", "Valor": new Date().toLocaleDateString('pt-BR') },
    { "Métrica": "Patrimônio Atual Renda Variável (R$)", "Valor": totalCurrent },
    { "Métrica": "Total Aportado Renda Variável (R$)", "Valor": totalInvested },
    { "Métrica": "Patrimônio Atual Renda Fixa (Líquido Estimado R$)", "Valor": totalFixedIncomeNetEst },
    { "Métrica": "Patrimônio Consolidado (R$)", "Valor": totalPatrimonioCdbIncluido },
    { "Métrica": "Rentabilidade Absoluta Renda Variável R$ (Lucro Não Realizado)", "Valor": plAbsoluta },
    { "Métrica": "Rentabilidade (%) Global Renda Variável", "Valor": `${(plPct * 100).toFixed(2)}%` },
    { "Métrica": "Lucro Estimado na Renda Fixa Ativa (R$)", "Valor": totalFixedIncomeNetEst - totalFixedIncomeInvested },
    { "Métrica": "Lucro Realizado em CDBs Resgatados (R$)", "Valor": totalFixedIncomeRealizedProfit },
    { "Métrica": "Diferença Acumulada Estimado vs Real (R$)", "Valor": totalFixedIncomeDiff },
    { "Métrica": "Renda Passiva (Últimos 12 meses) (R$)", "Valor": div12m },
    { "Métrica": "Dividend Yield Real (Últimos 12 meses)", "Valor": `${(dy12m * 100).toFixed(2)}%` },
    { "Métrica": "Total Ativos Variáveis (Qtd > 0)", "Valor": Object.values(positions).filter(p => p.qty > 0).length }
  ];
  
  const wsResumo = XLSX.utils.json_to_sheet(resumoData);

  // Formatação das larguras de calunas
  wsResumo['!cols'] = [{ wch: 45 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo Global");

  // 2. Carteira Atual
  const posTable = Object.keys(positions)
    .filter(t => positions[t].qty > 0)
    .map(ticker => {
      const p = positions[ticker];
      const price = p.type === 'RF' ? p.averagePrice : (quotes[ticker] || p.averagePrice);
      const saldo = p.qty * price;
      const pl = saldo - p.totalInvested;
      const plP = p.totalInvested > 0 ? pl / p.totalInvested : 0;

      return {
        "Ticker": ticker,
        "Classe": p.type,
        "Quantidade Atual": p.qty,
        "Preço Médio (R$)": p.averagePrice,
        "Cotação Usada (R$)": price,
        "Total Investido (R$)": p.totalInvested,
        "Saldo Bruto Atual (R$)": saldo,
        "Lucro/Prejuízo Atual (R$)": pl,
        "Rentabilidade %": `${(plP * 100).toFixed(2)}%`
      };
    })
    .sort((a, b) => b["Saldo Bruto Atual (R$)"] - a["Saldo Bruto Atual (R$)"]);

  const wsCarteira = XLSX.utils.json_to_sheet(posTable);
  wsCarteira['!cols'] = [{ wch: 10 }, { wch: 8 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, wsCarteira, "Carteira Detalhada");

  // 3. Operações
  const opsTable = [...operations].sort((a,b) => new Date(a.date) - new Date(b.date)).map(o => {
    return {
      "Data da Ordem": new Date(o.date + 'T12:00:00').toLocaleDateString('pt-BR'),
      "Ativo": o.assetId,
      "Movimentação": o.type === 'BUY' ? 'COMPRA' : 'VENDA',
      "Tipo Ativo": o.assetType,
      "Quantidade Negociada": o.qty,
      "Preço Executado (R$)": o.price,
      "Custos/Taxas (R$)": o.taxes || 0,
      "Valor Operado Líquido (R$)": o.type === 'BUY' ? (o.qty * o.price + (o.taxes||0)) : (o.qty * o.price - (o.taxes||0))
    };
  });
  const wsOps = XLSX.utils.json_to_sheet(opsTable);
  wsOps['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 22 }, { wch: 20 }, { wch: 15 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsOps, "Histórico Operações");

  // 4. Proventos
  const divsTable = [...dividends].sort((a,b) => new Date(b.paymentDate) - new Date(a.paymentDate)).map(d => ({
    "Data de Pagamento": new Date(d.paymentDate + 'T12:00:00').toLocaleDateString('pt-BR'),
    "Ativo Gerador": d.assetId,
    "Valor Depositado (R$)": d.totalReceived
  }));
  const wsDivs = XLSX.utils.json_to_sheet(divsTable);
  wsDivs['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsDivs, "Histórico Proventos");

  // 5. Imposto de Renda
  const taxesData = calculateTaxes(salesResult);
  const taxesTable = taxesData.periods.map(p => ({
    "Competência (Mês/Ano)": p.period,
    "Resultado do Mês (R$)": p.total,
    "Prejuízo Acumulado Anterior (R$)": p.carryBefore,
    "Base de Cálculo p/ Imposto (R$)": p.resultAfterCarry,
    "Prejuízo a Transportar (R$)": p.carryForward,
    "Imposto Gerado DARF (R$)": p.darf
  }));
  const wsTaxes = XLSX.utils.json_to_sheet(taxesTable);
  wsTaxes['!cols'] = [{ wch: 22 }, { wch: 20 }, { wch: 30 }, { wch: 30 }, { wch: 25 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsTaxes, "Apuração IR");

  // 6. Renda Fixa
  if (fixedIncome.length > 0) {
    const rfTable = fixedIncome.map(cdb => {
      const isRedeemed = cdb.status === 'REDEEMED';
      const realNet = cdb.redemptionNetAmount || 0;
      
      const targetDate = isRedeemed ? (cdb.redemptionDate || cdb.maturityDate) : cdb.maturityDate;
      const sim = simulateCdb(cdb, assumptions, targetDate);
      
      const realizedProfit = isRedeemed ? (realNet - cdb.investedAmount) : 0;
      const difference = isRedeemed ? (realNet - sim.netAmount) : 0;
      const differencePercent = isRedeemed && sim.netAmount > 0 ? (difference / sim.netAmount) * 100 : 0;
      
      const yearsReal = sim.days > 0 ? sim.days / 365.25 : 0;
      const realizedNetAnnualRate = (isRedeemed && yearsReal > 0 && cdb.investedAmount > 0 && realNet > 0) 
        ? (Math.pow(realNet / cdb.investedAmount, 1 / yearsReal) - 1) * 100 : 0;

      return {
        "Produto": cdb.productType || "CDB",
        "Apelido": cdb.nickname,
        "Banco": cdb.issuer,
        "Conglomerado": cdb.conglomerate || cdb.issuer,
        "Corretora": cdb.broker || "",
        "Indexador": cdb.indexer,
        "Taxa": cdb.indexer === 'CDI' ? `${cdb.cdiPercent}%` : cdb.indexer === 'PRE' ? `${cdb.fixedAnnualRate}%` : `+${cdb.ipcaSpreadAnnualRate}%`,
        "Valor Aplicado": cdb.investedAmount,
        "Data Aplicação": new Date(cdb.investmentDate + 'T12:00:00').toLocaleDateString('pt-BR'),
        "Data Vencimento": new Date(cdb.maturityDate + 'T12:00:00').toLocaleDateString('pt-BR'),
        "Liquidez": cdb.liquidity,
        "Status": cdb.status,
        "Valor Bruto Estimado": sim.grossAmount,
        "IR Estimado": sim.taxAmount,
        "Valor Líquido Estimado": sim.netAmount,
        "Lucro Líquido Estimado": sim.netProfit,
        "Rentabilidade Líquida Estimada a.a.": `${sim.netAnnualRate.toFixed(2)}%`,
        "Data Resgate": isRedeemed && cdb.redemptionDate ? new Date(cdb.redemptionDate + 'T12:00:00').toLocaleDateString('pt-BR') : "-",
        "Valor Bruto Real": cdb.redemptionGrossAmount || "-",
        "IR Real": cdb.redemptionTaxAmount || "-",
        "Taxas": cdb.redemptionFees || "-",
        "Valor Líquido Real": isRedeemed ? realNet : "-",
        "Diferença Estimado vs Real R$": isRedeemed ? difference : "-",
        "Diferença Estimado vs Real %": isRedeemed ? `${differencePercent.toFixed(2)}%` : "-",
        "Lucro Líquido Realizado": isRedeemed ? realizedProfit : "-",
        "Rentabilidade Realizada a.a.": isRedeemed ? `${realizedNetAnnualRate.toFixed(2)}%` : "-",
        "Status da Simulação": isRedeemed ? (Math.abs(differencePercent) <= 0.5 ? "Dentro do esperado" : differencePercent > 0.5 ? "Acima" : "Abaixo") : "Em andamento",
        "Coberto FGC": cdb.fgcEligible ? "SIM" : "NÃO",
        "Observações": cdb.notes || ""
      };
    });
    const wsRF = XLSX.utils.json_to_sheet(rfTable);
    XLSX.utils.book_append_sheet(wb, wsRF, "Renda Fixa");

    // 7. Vencimentos RF
    const upcoming = getUpcomingMaturities(fixedIncome, fixedIncomeSettings);
    const vencTable = upcoming.map(cdb => {
      const sim = simulateCdb(cdb, assumptions);
      return {
        "Data Vencimento": new Date(cdb.maturityDate + 'T12:00:00').toLocaleDateString('pt-BR'),
        "Produto": cdb.nickname,
        "Banco": cdb.issuer,
        "Valor Aplicado": cdb.investedAmount,
        "Valor Líquido Estimado": sim.netAmount,
        "Dias Restantes": cdb.daysLeft,
        "Status": cdb.daysLeft < 0 ? "Vencido não resgatado" : cdb.daysLeft === 0 ? "Vence Hoje" : "A Vencer"
      };
    });
    const wsVenc = XLSX.utils.json_to_sheet(vencTable);
    XLSX.utils.book_append_sheet(wb, wsVenc, "Vencimentos RF");

    // 8. Exposição FGC
    const fgcData = getFgcExposure(fixedIncome, assumptions, fixedIncomeSettings);
    const fgcTable = fgcData.groups.map(g => ({
      "Banco/Conglomerado": g.name,
      "Valor Aplicado": g.invested,
      "Valor Projetado": g.projected,
      "Limite Configurado": g.limit,
      "Excedente Projetado": g.exceeded
    }));
    const wsFGC = XLSX.utils.json_to_sheet(fgcTable);
    XLSX.utils.book_append_sheet(wb, wsFGC, "Exposição FGC");
  }

  // Salvar o arquivo trigando download
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `Relatorio_Completo_InvestK_${dateStr}.xlsx`);
};
