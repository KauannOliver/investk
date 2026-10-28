import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Landmark, Plus, PieChart, BarChart2 } from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { simulateCdb, parseLocalDate } from '../utils/fixedIncome';
import { validateFixedIncomeInvestment } from '../utils/fixedIncomeValidation';

import { PieChart as RechartsPie, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import MetricCard from '../components/MetricCard';
import Pagination from '../components/Pagination';

export default function FixedIncome() {
  const { fixedIncome, setFixedIncome, fixedIncomeSettings } = useStore();
  const navigate = useNavigate();

  const [filter, setFilter] = useState('ACTIVE'); // ALL, ACTIVE, OVERDUE, REDEEMED, CDI, PRE, IPCA
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const itemsPerPage = 15;
  
  // Form state
  const [formData, setFormData] = useState({
    nickname: '', issuer: '', conglomerate: '', broker: '', indexer: 'CDI',
    cdiPercent: '', fixedAnnualRate: '', ipcaSpreadAnnualRate: '',
    investedAmount: '', investmentDate: new Date().toISOString().split('T')[0],
    maturityDate: '', liquidity: 'MATURITY', fgcEligible: true, notes: ''
  });

  const assumptions = {
    cdiAnnual: fixedIncomeSettings.defaultCdiAnnual || 10.5,
    ipcaAnnual: fixedIncomeSettings.defaultIpcaAnnual || 4.5
  };

  const handleSave = (e) => {
    e.preventDefault();
    const { valid, errors, normalizedData } = validateFixedIncomeInvestment(formData);
    if (!valid) {
      alert(errors.join('\\n'));
      return;
    }
    setFixedIncome([...fixedIncome, normalizedData]);
    setShowForm(false);
    // Reset form
    setFormData({
      nickname: '', issuer: '', conglomerate: '', broker: '', indexer: 'CDI',
      cdiPercent: '', fixedAnnualRate: '', ipcaSpreadAnnualRate: '', investedAmount: '',
      investmentDate: new Date().toISOString().split('T')[0], maturityDate: '',
      liquidity: 'MATURITY', fgcEligible: true, notes: ''
    });
  };



  const today = new Date();
  today.setHours(12, 0, 0, 0);

  // Cards globais
  let totalInvestedActive = 0;
  let totalNetEst = 0;
  let totalProfitEst = 0;
  let nextMaturity = null;

  // Histórico
  let redeemedCount = 0;
  let redeemedInvested = 0;
  let redeemedRealNet = 0;
  let redeemedProfit = 0;
  let differenceAcc = 0;
  let hitCount = 0;

  const processedData = useMemo(() => {
    return fixedIncome.map(cdb => {
      const isRedeemed = cdb.status === 'REDEEMED';
      const targetDate = isRedeemed ? (cdb.redemptionDate || cdb.maturityDate) : cdb.maturityDate;
      const sim = simulateCdb(cdb, assumptions, targetDate);
      
      const maturityDate = parseLocalDate(cdb.maturityDate);
      let isOverdue = false;
      if (!isRedeemed && maturityDate < today) isOverdue = true;

      // Stats globais
      if (!isRedeemed) {
        totalInvestedActive += cdb.investedAmount;
        totalNetEst += sim.netAmount;
        totalProfitEst += sim.netProfit;
        if (!nextMaturity || maturityDate < nextMaturity) {
          nextMaturity = maturityDate;
        }
      } else {
        redeemedCount++;
        const realNet = cdb.redemptionNetAmount || 0;
        redeemedInvested += cdb.investedAmount;
        redeemedRealNet += realNet;
        redeemedProfit += (realNet - cdb.investedAmount);
        differenceAcc += (realNet - sim.netAmount);
        
        const diffPercent = sim.netAmount > 0 ? ((realNet - sim.netAmount) / sim.netAmount) * 100 : 0;
        if (Math.abs(diffPercent) <= 0.5) hitCount++;
      }

      return { ...cdb, sim, isOverdue };
    }).sort((a,b) => parseLocalDate(a.maturityDate) - parseLocalDate(b.maturityDate));
  }, [fixedIncome, assumptions]);

  const filteredData = useMemo(() => {
    return processedData.filter(d => {
      if (filter === 'ALL') return true;
      if (filter === 'ACTIVE') return d.status === 'ACTIVE' && !d.isOverdue;
      if (filter === 'OVERDUE') return d.status === 'ACTIVE' && d.isOverdue;
      if (filter === 'REDEEMED') return d.status === 'REDEEMED';
      if (filter === 'CDI') return d.indexer === 'CDI';
      if (filter === 'PRE') return d.indexer === 'PRE';
      if (filter === 'IPCA') return d.indexer === 'IPCA';
      return true;
    });
  }, [processedData, filter]);

  const paginatedData = useMemo(() => {
    const startIndex = (page - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, page]);

  React.useEffect(() => {
    setPage(1);
  }, [filter]);

  // Gráficos
  const chartIndexer = [
    { name: 'CDI', value: 0, fill: '#3b82f6' },
    { name: 'PRE', value: 0, fill: '#10b981' },
    { name: 'IPCA+', value: 0, fill: '#8b5cf6' }
  ];
  
  const chartYearsObj = {};
  const chartBankObj = {};

  processedData.filter(d => d.status === 'ACTIVE').forEach(d => {
    if (d.indexer === 'CDI') chartIndexer[0].value += d.sim.netAmount;
    if (d.indexer === 'PRE') chartIndexer[1].value += d.sim.netAmount;
    if (d.indexer === 'IPCA') chartIndexer[2].value += d.sim.netAmount;

    const y = parseLocalDate(d.maturityDate).getFullYear();
    chartYearsObj[y] = (chartYearsObj[y] || 0) + d.sim.netAmount;

    const b = d.conglomerate || d.issuer;
    chartBankObj[b] = (chartBankObj[b] || 0) + d.sim.netAmount;
  });

  const chartYears = Object.keys(chartYearsObj).map(y => ({ year: y, value: chartYearsObj[y] }));
  const chartBank = Object.keys(chartBankObj).map(b => ({ name: b, value: chartBankObj[b] })).sort((a,b) => b.value - a.value).slice(0, 5);

  const formatBrl = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div style={{ paddingBottom: 48 }}>
      <div className="mb-6 anim-slide-up flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <Landmark size={28} style={{ color: 'var(--brand)' }} />
            Renda Fixa
          </h1>
          <p className="page-subtitle">Controle local de CDBs, vencimentos e rentabilidade estimada.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => navigate('/renda-fixa/simulador')}>
            Simular Aporte
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={16} /> Novo CDB
          </button>
        </div>
      </div>

      {/* Resumo Ativo */}
      <div className="grid grid-4 gap-4 mb-6 anim-slide-up anim-d1">
        <MetricCard label="Total Aplicado Ativo" value={formatBrl(totalInvestedActive)} accent="blue" />
        <MetricCard label="Valor Líquido Estimado" value={formatBrl(totalNetEst)} accent="brand" />
        <MetricCard label="Lucro Líquido Estimado" value={`+${formatBrl(totalProfitEst)}`} accent="brand" />
        <MetricCard label="Próximo Vencimento" value={nextMaturity ? nextMaturity.toLocaleDateString('pt-BR') : '-'} accent="purple" />
      </div>

      {/* Histórico Resgates */}
      {redeemedCount > 0 && (
        <div className="glass p-5 mb-8 anim-slide-up anim-d2">
          <h2 className="text-base fw-600 mb-4">Histórico de resgates ({redeemedCount})</h2>
          <div className="grid grid-5 gap-4">
            <div>
              <div className="text-muted text-xs mb-1">Total Aplicado</div>
              <div className="fw-600 text-sm">{formatBrl(redeemedInvested)}</div>
            </div>
            <div>
              <div className="text-muted text-xs mb-1">Total Líquido Recebido</div>
              <div className="fw-600 text-sm">{formatBrl(redeemedRealNet)}</div>
            </div>
            <div>
              <div className="text-muted text-xs mb-1">Lucro Realizado</div>
              <div className={`fw-600 text-sm ${redeemedProfit >= 0 ? 'text-profit' : 'text-loss'}`}>{formatBrl(redeemedProfit)}</div>
            </div>
            <div>
              <div className="text-muted text-xs mb-1">Diferença vs Estimado</div>
              <div className={`fw-600 text-sm ${differenceAcc >= 0 ? 'text-profit' : 'text-loss'}`}>{formatBrl(differenceAcc)}</div>
            </div>
            <div>
              <div className="text-muted text-xs mb-1">Acerto de Simulação</div>
              <div className="fw-600 text-sm">{((hitCount/redeemedCount)*100).toFixed(0)}% (margem 0,5%)</div>
            </div>
          </div>
        </div>
      )}

      {/* Gráficos */}
      {totalInvestedActive > 0 && (
        <div className="grid grid-3 gap-4 mb-8 anim-slide-up anim-d2">
          <div className="glass p-4">
            <h3 className="text-sm fw-600 mb-4 text-center">Por Indexador</h3>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%" minHeight={180}>
                <RechartsPie>
                  <Pie data={chartIndexer.filter(d => d.value > 0)} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={60}>
                    {chartIndexer.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatBrl(v)} />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="glass p-4">
            <h3 className="text-sm fw-600 mb-4 text-center">Vencimentos por Ano</h3>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%" minHeight={180}>
                <BarChart data={chartYears}>
                  <XAxis dataKey="year" fontSize={12} stroke="var(--text-muted)" />
                  <Tooltip formatter={(v) => formatBrl(v)} cursor={{fill: 'var(--hover)'}} />
                  <Bar dataKey="value" fill="var(--brand)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="glass p-4">
            <h3 className="text-sm fw-600 mb-4 text-center">Exposição por Emissor</h3>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%" minHeight={180}>
                <BarChart data={chartBank} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={80} fontSize={10} stroke="var(--text-muted)" />
                  <Tooltip formatter={(v) => formatBrl(v)} cursor={{fill: 'var(--hover)'}} />
                  <Bar dataKey="value" fill="var(--accent-blue)" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Header Tabela e Filtros */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-4 anim-slide-up anim-d3">
        <div className="flex gap-2 flex-wrap">
          {['ALL', 'ACTIVE', 'OVERDUE', 'REDEEMED', 'CDI', 'PRE', 'IPCA'].map(f => (
            <button 
              key={f}
              className={`badge ${filter === f ? 'badge-profit' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => setFilter(f)}
            >
              {f === 'ALL' ? 'Todos' : f === 'ACTIVE' ? 'Ativos' : f === 'OVERDUE' ? 'Vencidos' : f === 'REDEEMED' ? 'Resgatados' : f}
            </button>
          ))}
        </div>

      </div>

      <div className="glass p-0 anim-slide-up anim-d3" style={{ overflowX: 'auto' }}>
        <table className="r-table">
          <thead>
            <tr>
              <th>CDB</th>
              <th>Banco</th>
              <th>Indexador</th>
              <th>Taxa</th>
              <th className="text-right">Valor Aplicado</th>
              <th className="text-right">V. Líquido (Est.)</th>
              <th className="text-center">Vencimento</th>
              <th className="text-center">Status</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr><td colSpan="9" className="text-center text-muted py-6">Nenhum investimento encontrado nesta categoria.</td></tr>
            ) : paginatedData.map(cdb => (
              <tr key={cdb.id}>
                <td className="fw-600">{cdb.nickname}</td>
                <td className="text-muted">{cdb.issuer}</td>
                <td>{cdb.indexer}</td>
                <td>{cdb.indexer === 'CDI' ? `${cdb.cdiPercent}%` : cdb.indexer === 'PRE' ? `${cdb.fixedAnnualRate}%` : `+${cdb.ipcaSpreadAnnualRate}%`}</td>
                <td className="text-right">{formatBrl(cdb.investedAmount)}</td>
                <td className="text-right fw-600 text-profit">{formatBrl(cdb.sim.netAmount)}</td>
                <td className="text-center">{parseLocalDate(cdb.maturityDate).toLocaleDateString('pt-BR')}</td>
                <td className="text-center">
                  {cdb.status === 'REDEEMED' ? <span className="badge">Resgatado</span> : 
                   cdb.isOverdue ? <span className="badge badge-loss">Vencido</span> : 
                   <span className="badge badge-profit">Ativo</span>}
                </td>
                <td className="text-right">
                  <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/renda-fixa/${cdb.id}`)}>Detalhes</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <Pagination 
          currentPage={page}
          totalItems={filteredData.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setPage}
        />
      </div>

      {/* Form Modal */}
      {showForm && ReactDOM.createPortal(
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-panel">
            <div className="modal-header">
              <div className="modal-header-icon" style={{ background: 'var(--brand-bg)', border: '1px solid rgba(0,220,130,0.2)' }}>
                <Plus size={20} style={{ color: 'var(--brand)' }} />
              </div>
              <div>
                <h2>Novo Investimento</h2>
                <p>Cadastre um CDB, LCI, LCA ou título de renda fixa.</p>
              </div>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Banco Emissor</label>
                  <input required type="text" className="input" value={formData.issuer} onChange={e => setFormData({...formData, issuer: e.target.value})} placeholder="Ex: Banco Master" />
                </div>

                <div className="form-group">
                  <label className="form-label">Indexador</label>
                  <select className="select" value={formData.indexer} onChange={e => setFormData({...formData, indexer: e.target.value})}>
                    <option value="CDI">Pós-fixado (CDI)</option>
                    <option value="PRE">Prefixado</option>
                    <option value="IPCA">Híbrido (IPCA+)</option>
                  </select>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 6 }}>
                    {formData.indexer === 'CDI' ? "Acompanha uma porcentagem do CDI. Se os juros caírem, o rendimento tende a cair." : 
                     formData.indexer === 'PRE' ? "Trava uma taxa anual fixa se levado ao vencimento." : 
                     "Busca proteger contra inflação e pagar uma taxa real acima dela."}
                  </p>
                </div>
                
                <div className="grid grid-2 gap-4">
                  {formData.indexer === 'CDI' && (
                    <div className="form-group">
                      <label className="form-label">Taxa CDI (%)</label>
                      <input required type="number" step="0.01" className="input" value={formData.cdiPercent} onChange={e => setFormData({...formData, cdiPercent: e.target.value})} placeholder="Ex: 110" />
                    </div>
                  )}
                  {formData.indexer === 'PRE' && (
                    <div className="form-group">
                      <label className="form-label">Taxa Pré (% a.a.)</label>
                      <input required type="number" step="0.01" className="input" value={formData.fixedAnnualRate} onChange={e => setFormData({...formData, fixedAnnualRate: e.target.value})} placeholder="Ex: 13.5" />
                    </div>
                  )}
                  {formData.indexer === 'IPCA' && (
                    <div className="form-group">
                      <label className="form-label">Taxa Real (% a.a.)</label>
                      <input required type="number" step="0.01" className="input" value={formData.ipcaSpreadAnnualRate} onChange={e => setFormData({...formData, ipcaSpreadAnnualRate: e.target.value})} placeholder="Ex: 6.5" />
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Valor Aplicado (R$)</label>
                    <input required type="number" step="0.01" className="input" value={formData.investedAmount} onChange={e => setFormData({...formData, investedAmount: e.target.value})} placeholder="Ex: 5000" />
                  </div>
                </div>

                <div className="grid grid-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">Data Aplicação</label>
                    <input required type="date" className="input" value={formData.investmentDate} onChange={e => setFormData({...formData, investmentDate: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Data Vencimento</label>
                    <input required type="date" className="input" value={formData.maturityDate} onChange={e => setFormData({...formData, maturityDate: e.target.value})} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Apelido (Opcional)</label>
                  <input type="text" className="input" value={formData.nickname} onChange={e => setFormData({...formData, nickname: e.target.value})} placeholder="Será gerado automaticamente se vazio" />
                </div>

                <label className="checkbox-wrap" style={{ marginBottom: 0 }}>
                  <input type="checkbox" checked={formData.fgcEligible} onChange={e => setFormData({...formData, fgcEligible: e.target.checked})} />
                  <span>Coberto pelo FGC</span>
                </label>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar Investimento</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
