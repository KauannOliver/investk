import React, { useState, useMemo } from 'react';
import { useStore } from '../store/StoreContext';
import { formatCurrency } from '../utils/calculations';
import { calculateTaxes } from '../utils/taxes';
import { simulateCdb, parseLocalDate, getFixedIncomeTaxRate, diffDays } from '../utils/fixedIncome';
import { Receipt, Info, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Filter, DollarSign, AlertCircle, Landmark } from 'lucide-react';
import MetricCard from '../components/MetricCard';
import Pagination from '../components/Pagination';

export default function Taxes() {
  const { portfolioState, fixedIncome, fixedIncomeSettings } = useStore();
  const { salesResult } = portfolioState;

  const [filterYear, setFilterYear] = useState('ALL');
  const [expanded, setExpanded]     = useState({});
  const [rfPage, setRfPage]         = useState(1);
  const itemsPerPage = 15;

  // Obter consolidações via módulo isolado (Business Logic purificada)
  const taxData = useMemo(() => calculateTaxes(salesResult), [salesResult]);
  
  const { periods, totalProfit, totalLoss, totalAllTime, totalDarf, years } = taxData;

  // Filtro na UI (depois da consolidação para não quebrar a ordem do carry-forward)
  const displayPeriods = useMemo(() => {
    if (filterYear === 'ALL') return periods;
    return periods.filter(p => p.year === parseInt(filterYear));
  }, [periods, filterYear]);

  // Expand / Collapse toggler
  const toggleExpand = (period) =>
    setExpanded(prev => ({ ...prev, [period]: !prev[period] }));

  // Renda Fixa IR calculations
  const assumptions = useMemo(() => ({
    cdiAnnual: fixedIncomeSettings?.defaultCdiAnnual || 10.5,
    ipcaAnnual: fixedIncomeSettings?.defaultIpcaAnnual || 4.5
  }), [fixedIncomeSettings]);

  const rfTaxData = useMemo(() => {
    let totalIREstimatedActive = 0;
    let totalIRRealRedeemed = 0;
    let totalIREstimatedRedeemed = 0;

    const items = (fixedIncome || []).map(cdb => {
      const isRedeemed = cdb.status === 'REDEEMED';
      const targetDate = isRedeemed ? (cdb.redemptionDate || cdb.maturityDate) : cdb.maturityDate;
      const sim = simulateCdb(cdb, assumptions, targetDate);
      
      const startDate = parseLocalDate(cdb.investmentDate);
      const endDate = parseLocalDate(targetDate);
      const days = Math.max(0, diffDays(startDate, endDate));
      const taxRate = cdb.taxExempt ? 0 : getFixedIncomeTaxRate(days);

      if (isRedeemed) {
        const realTax = cdb.redemptionTaxAmount || 0;
        totalIRRealRedeemed += realTax;
        totalIREstimatedRedeemed += sim.taxAmount;
      } else {
        totalIREstimatedActive += sim.taxAmount;
      }

      return {
        ...cdb,
        sim,
        days,
        taxRate,
        isRedeemed,
        realTax: isRedeemed ? (cdb.redemptionTaxAmount || 0) : null
      };
    });

    return {
      items: items.sort((a, b) => {
        if (a.isRedeemed !== b.isRedeemed) return a.isRedeemed ? 1 : -1;
        return parseLocalDate(a.maturityDate) - parseLocalDate(b.maturityDate);
      }),
      totalIREstimatedActive,
      totalIRRealRedeemed,
      totalIREstimatedRedeemed,
      hasData: items.length > 0
    };
  }, [fixedIncome, assumptions]);

  const rfPaginatedItems = useMemo(() => {
    const startIndex = (rfPage - 1) * itemsPerPage;
    return rfTaxData.items.slice(startIndex, startIndex + itemsPerPage);
  }, [rfTaxData.items, rfPage]);

  const formatBrl = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div style={{ paddingBottom: 48 }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8 anim-slide-up" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title flex items-center gap-3">
            <Receipt size={28} style={{ color: 'var(--brand)' }} />
            Imposto de Renda
          </h1>
          <p className="page-subtitle">Apuração mensal de lucros, prejuízos e DARF em alienações de FIIs e Ações.</p>
        </div>

        {years.length > 2 && (
          <div className="flex items-center gap-2">
            <Filter size={14} style={{ color: 'var(--text-tertiary)' }} />
            <span className="text-xs text-muted fw-700">Ano:</span>
            <select
              className="select"
              style={{ minWidth: 100, padding: '6px 12px', fontSize: '0.85rem' }}
              value={filterYear}
              onChange={e => setFilterYear(e.target.value)}
            >
              {years.map(y => (
                <option key={y} value={y}>{y === 'ALL' ? 'Todos' : y}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Summary Cards ── */}
      {salesResult.length > 0 && (
        <div
          className="anim-slide-up anim-d1"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
            marginBottom: 24,
          }}
        >
          {/* Lucros */}
          <div className="glass p-5" style={{ borderTop: '3px solid var(--profit)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'var(--profit-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <TrendingUp size={18} style={{ color: 'var(--profit)' }} />
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>
              Total de Lucros
            </span>
            <p className="fw-800" style={{ fontSize: '1.55rem', color: 'var(--profit)', lineHeight: 1 }}>
              {formatCurrency(totalProfit)}
            </p>
          </div>

          {/* Prejuízos */}
          <div className="glass p-5" style={{ borderTop: '3px solid var(--loss)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'var(--loss-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <TrendingDown size={18} style={{ color: 'var(--loss)' }} />
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>
              Total de Prejuízos
            </span>
            <p className="fw-800" style={{ fontSize: '1.55rem', color: 'var(--loss)', lineHeight: 1 }}>
              {formatCurrency(totalLoss)}
            </p>
          </div>

          {/* Resultado Líquido */}
          <div
            className="glass p-5"
            style={{
              borderTop: `3px solid ${totalAllTime >= 0 ? 'var(--profit)' : 'var(--loss)'}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10,
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: totalAllTime >= 0 ? 'var(--profit-bg)' : 'var(--loss-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <DollarSign size={18} style={{ color: totalAllTime >= 0 ? 'var(--profit)' : 'var(--loss)' }} />
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>
              Resultado Líquido
            </span>
            <p className="fw-800" style={{ fontSize: '1.55rem', color: totalAllTime >= 0 ? 'var(--profit)' : 'var(--loss)', lineHeight: 1 }}>
              {formatCurrency(totalAllTime)}
            </p>
          </div>

          {/* DARF */}
          <div
            className="glass p-5"
            style={{
              borderTop: '3px solid var(--loss)',
              background: totalDarf > 0 ? 'rgba(255,77,109,0.04)' : undefined,
              display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10,
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'var(--loss-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Receipt size={18} style={{ color: 'var(--loss)' }} />
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>
              DARF Total
            </span>
            <p className="fw-800" style={{ fontSize: '1.55rem', color: 'var(--loss)', lineHeight: 1 }}>
              {formatCurrency(totalDarf)}
            </p>
            {totalDarf > 0 && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                Código DARF: <strong style={{ color: 'var(--text-secondary)' }}>6015</strong>
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Notice ── */}
      <div
        className="anim-slide-up anim-d1"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
          padding: '16px 20px',
          borderRadius: 'var(--r-lg)',
          background: 'rgba(255, 184, 0, 0.06)',
          border: '1px solid rgba(255, 184, 0, 0.2)',
          marginBottom: 32,
        }}
      >
        <AlertCircle size={18} style={{ color: '#f5a623', flexShrink: 0, marginTop: 2 }} />
        <div style={{ lineHeight: 1.65, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 4, fontSize: '0.9rem' }}>
            Regras de Imposto de Renda (Ações e FIIs)
          </strong>
          <ul style={{ margin: 0, paddingLeft: 18, marginBottom: 8 }}>
            <li><strong>FIIs:</strong> Alíquota de 20% sobre lucro líquido. Sem isenção.</li>
            <li><strong>Ações:</strong> Alíquota de 15% sobre lucro líquido. Isenção para vendas totais mensais até R$ 20.000.</li>
          </ul>
          O DARF deve ser gerado até o último dia útil do mês seguinte à alienação (código <strong style={{ color: 'var(--text-primary)' }}>6015</strong>).
          Prejuízos passados abatem lucros do mesmo tipo de ativo.
        </div>
      </div>

      {/* ── Periods ── */}
      {displayPeriods.length === 0 ? (
        <div className="glass">
          <div className="empty-state">
            <div className="empty-state-icon" style={{ margin: '0 auto 16px' }}>
              <Receipt size={28}/>
            </div>
            <h3>Sem apurações</h3>
            <p>Registre uma operação de <strong>Venda</strong> para calcular o imposto mensal.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {displayPeriods.map((month, idx) => {
            const darf      = month.darf;
            const isProfit  = month.total >= 0;
            const carry     = month.carryBefore;
            const isOpen    = expanded[month.period] !== false;

            return (
              <div key={month.period} className="glass anim-slide-up" style={{ animationDelay: `${idx * 0.06}s` }}>
                {/* Month header */}
                <button
                  onClick={() => toggleExpand(month.period)}
                  style={{
                    width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                    padding: '20px 24px',
                    borderBottom: isOpen ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: 10,
                        background: isProfit ? 'var(--profit-bg)' : 'var(--loss-bg)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {isProfit
                          ? <TrendingUp size={18} style={{ color: 'var(--profit)' }}/>
                          : <TrendingDown size={18} style={{ color: 'var(--loss)' }}/>
                        }
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <p className="fw-700" style={{ fontSize: '0.95rem' }}>Período: {month.period}</p>
                        <p className="text-xs text-muted">{month.sales.length} alienaç{month.sales.length !== 1 ? 'ões' : 'ão'}</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                      {carry < 0 && (
                        <div style={{ textAlign: 'right' }}>
                          <p className="text-xs text-muted mb-1">Saldo acumulado</p>
                          <p className="fw-700 text-loss" style={{ fontSize: '0.9rem' }}>{formatCurrency(carry)}</p>
                        </div>
                      )}

                      <div style={{ textAlign: 'right' }}>
                        <p className="text-xs text-muted mb-1">Resultado (FII + Ações)</p>
                        <p className={`fw-800 text-lg ${isProfit ? 'text-profit' : 'text-loss'}`}>
                          {formatCurrency(month.total)}
                        </p>
                      </div>

                      {month.isExemptAcoes && (
                         <div style={{
                           textAlign: 'right', padding: '6px 14px',
                           background: 'rgba(0,220,130,0.06)', borderRadius: 'var(--r-md)',
                           border: '1px solid rgba(0,220,130,0.2)',
                         }}>
                           <p className="text-xs text-profit mb-1">Vendas de Ações &lt; 20k</p>
                           <p className="fw-800 text-sm text-profit">Lucro Isento</p>
                         </div>
                      )}

                      {month.darfFII > 0 && (
                        <div style={{
                          textAlign: 'right', padding: '6px 14px',
                          background: 'var(--loss-bg)', borderRadius: 'var(--r-md)',
                          border: '1px solid rgba(255,77,109,0.2)',
                        }}>
                          <p className="text-xs text-muted mb-1">DARF FII (20%)</p>
                          <p className="fw-800 text-lg text-loss">{formatCurrency(month.darfFII)}</p>
                        </div>
                      )}

                      {month.darfAcoes > 0 && (
                        <div style={{
                          textAlign: 'right', padding: '6px 14px',
                          background: 'var(--loss-bg)', borderRadius: 'var(--r-md)',
                          border: '1px solid rgba(255,77,109,0.2)',
                        }}>
                          <p className="text-xs text-muted mb-1">DARF Ações (15%)</p>
                          <p className="fw-800 text-lg text-loss">{formatCurrency(month.darfAcoes)}</p>
                        </div>
                      )}

                      {isOpen ? <ChevronUp size={16} style={{ color: 'var(--text-tertiary)' }}/> : <ChevronDown size={16} style={{ color: 'var(--text-tertiary)' }}/>}
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="table-wrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
                    <table className="r-table">
                      <thead>
                        <tr>
                          <th style={{ paddingLeft: 24 }}>Data</th>
                          <th>Ativo</th>
                          <th style={{ textAlign: 'right' }}>Qtd.</th>
                          <th style={{ textAlign: 'right' }}>Venda Líquida</th>
                          <th style={{ textAlign: 'right' }}>Custo (PM)</th>
                          <th style={{ textAlign: 'right' }}>L / P</th>
                          <th style={{ textAlign: 'right', paddingRight: 24 }}>DARF Relativo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {month.sales.map((s, si) => {
                          const isAcao = s.assetType === 'Ação' || s.assetType === 'Ações';
                          const saleDarf = s.profitLoss > 0 ? (isAcao ? s.profitLoss * 0.15 : s.profitLoss * 0.20) : 0;
                          return (
                            <tr key={si} className="anim-fade-in" style={{ animationDelay: `${si * 0.04}s` }}>
                              <td data-label="Data" style={{ paddingLeft: 24, color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                                {new Date(s.date).toLocaleDateString('pt-BR')}
                              </td>
                              <td data-label="Ativo" style={{ fontWeight: 700 }}>{s.assetId}</td>
                              <td data-label="Qtd." style={{ textAlign: 'right', fontWeight: 600 }}>{s.qty}</td>
                              <td data-label="Venda" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{formatCurrency(s.netSaleValue)}</td>
                              <td data-label="Custo (PM)" style={{ textAlign: 'right', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatCurrency(s.costBasis)}</td>
                              <td data-label="L/P" style={{ textAlign: 'right' }}>
                                <span className={`badge ${s.profitLoss >= 0 ? 'badge-profit' : 'badge-loss'}`} style={{ whiteSpace: 'nowrap' }}>
                                  {formatCurrency(s.profitLoss)}
                                </span>
                              </td>
                              <td data-label="DARF" style={{ textAlign: 'right', paddingRight: 24, whiteSpace: 'nowrap' }}>
                                {saleDarf > 0 && !month.isExemptAcoes
                                  ? <span className="fw-700 text-loss">{formatCurrency(saleDarf)}</span>
                                  : month.isExemptAcoes && (s.assetType === 'Ação' || s.assetType === 'Ações') && s.profitLoss > 0
                                    ? <span className="fw-700 text-profit">ISENTO</span>
                                    : <span className="text-muted" style={{ fontSize: '0.8rem' }}>—</span>
                                }
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
         SEÇÃO: IR RETIDO NA FONTE — RENDA FIXA
         ══════════════════════════════════════════════════════════ */}
      {rfTaxData.hasData && (
        <div className="anim-slide-up" style={{ marginTop: 40 }}>
          {/* Section header */}
          <div className="flex items-center gap-3 mb-6">
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: 'rgba(0,220,130,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Landmark size={20} style={{ color: 'var(--brand)' }} />
            </div>
            <div>
              <h2 className="fw-700" style={{ fontSize: '1.15rem', letterSpacing: '-0.02em' }}>IR Retido na Fonte — Renda Fixa</h2>
              <p className="text-muted" style={{ fontSize: '0.78rem', marginTop: 2 }}>Imposto sobre CDB, LCI, LCA e outros títulos de renda fixa</p>
            </div>
          </div>

          {/* Info notice */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
              padding: '14px 18px',
              borderRadius: 'var(--r-lg)',
              background: 'rgba(0, 220, 130, 0.04)',
              border: '1px solid rgba(0, 220, 130, 0.15)',
              marginBottom: 20,
            }}
          >
            <Info size={16} style={{ color: 'var(--brand)', flexShrink: 0, marginTop: 2 }} />
            <div style={{ lineHeight: 1.6, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>O IR de renda fixa é retido automaticamente na fonte</strong> pelo banco/corretora no momento do resgate. 
              Não é necessário gerar DARF. Os valores abaixo são estimativas baseadas na tabela regressiva do IR e podem 
              divergir ligeiramente do valor final retido.
              <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                <li>Até 180 dias: <strong>22,5%</strong></li>
                <li>181 a 360 dias: <strong>20,0%</strong></li>
                <li>361 a 720 dias: <strong>17,5%</strong></li>
                <li>Acima de 720 dias: <strong>15,0%</strong></li>
              </ul>
            </div>
          </div>

          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
            <MetricCard 
              label="IR Estimado (Ativos)" 
              value={formatBrl(rfTaxData.totalIREstimatedActive)} 
              sub="Será retido no vencimento" 
              accent="amber" 
            />
            <MetricCard 
              label="IR Retido Real (Resgatados)" 
              value={formatBrl(rfTaxData.totalIRRealRedeemed)} 
              sub="Já retido pela instituição" 
              accent="loss" 
            />
            <MetricCard 
              label="Diferença Est. vs Real" 
              value={formatBrl(rfTaxData.totalIRRealRedeemed - rfTaxData.totalIREstimatedRedeemed)} 
              sub="Em resgates realizados" 
              accent="blue" 
            />
          </div>

          {/* Table */}
          <div className="glass p-0" style={{ overflowX: 'auto' }}>
            <table className="r-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 24 }}>CDB</th>
                  <th>Banco</th>
                  <th>Indexador</th>
                  <th className="text-right">Valor Aplicado</th>
                  <th className="text-right">Dias</th>
                  <th className="text-center">Alíquota</th>
                  <th className="text-right">IR Estimado</th>
                  <th className="text-right" style={{ paddingRight: 24 }}>IR Real</th>
                </tr>
              </thead>
              <tbody>
                {rfPaginatedItems.map(item => (
                  <tr key={item.id}>
                    <td style={{ paddingLeft: 24 }} className="fw-600">{item.nickname}</td>
                    <td className="text-muted">{item.issuer}</td>
                    <td>
                      <span className={`badge ${item.indexer === 'CDI' ? 'badge-profit' : item.indexer === 'PRE' ? 'badge-fii' : 'badge-rf'}`}>
                        {item.indexer}
                      </span>
                    </td>
                    <td className="text-right">{formatBrl(item.investedAmount)}</td>
                    <td className="text-right">{item.days}</td>
                    <td className="text-center">
                      <span className="badge">{item.taxRate}%</span>
                    </td>
                    <td className="text-right fw-600" style={{ color: 'var(--accent-amber)' }}>
                      {formatBrl(item.sim.taxAmount)}
                    </td>
                    <td className="text-right fw-600" style={{ paddingRight: 24 }}>
                      {item.isRedeemed 
                        ? <span style={{ color: 'var(--loss)' }}>{formatBrl(item.realTax)}</span>
                        : <span className="text-muted" style={{ fontSize: '0.8rem' }}>—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <Pagination 
              currentPage={rfPage}
              totalItems={rfTaxData.items.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setRfPage}
            />
          </div>
        </div>
      )}
    </div>
  );
}
