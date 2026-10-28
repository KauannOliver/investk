import React, { useState, useMemo } from 'react';
import { ArrowLeft, Plus, Trophy, AlertTriangle, CalendarDays, TrendingUp, Trash2, Bookmark, Medal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/StoreContext';
import { simulateCdb } from '../utils/fixedIncome';
import { validateFixedIncomeInvestment } from '../utils/fixedIncomeValidation';

const MEDAL_COLORS = ['var(--brand)', 'var(--accent-amber)', 'var(--accent-blue)'];

export default function FixedIncomeSimulator() {
  const { fixedIncome, setFixedIncome, fixedIncomeSettings } = useStore();
  const navigate = useNavigate();

  const [globals, setGlobals] = useState({
    investedAmount: 10000,
    cdiAnnual: fixedIncomeSettings.defaultCdiAnnual || 10.5,
    ipcaAnnual: fixedIncomeSettings.defaultIpcaAnnual || 4.5
  });

  const getFutureDate = (years) => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + years);
    return d.toISOString().split('T')[0];
  };
  const todayStr = new Date().toISOString().split('T')[0];

  const [options, setOptions] = useState([
    { id: 'sim-1', indexer: 'CDI', cdiPercent: 110, fixedAnnualRate: null, ipcaSpreadAnnualRate: null, investmentDate: todayStr, maturityDate: getFutureDate(1) },
    { id: 'sim-2', indexer: 'PRE', cdiPercent: null, fixedAnnualRate: 13.5, ipcaSpreadAnnualRate: null, investmentDate: todayStr, maturityDate: getFutureDate(2) },
    { id: 'sim-3', indexer: 'IPCA', cdiPercent: null, fixedAnnualRate: null, ipcaSpreadAnnualRate: 6.5, investmentDate: todayStr, maturityDate: getFutureDate(3) }
  ]);

  const [newOption, setNewOption] = useState({ 
    indexer: 'CDI', 
    rate: 100,
    investmentDate: todayStr,
    maturityDate: getFutureDate(1)
  });

  const handleAddOption = (e) => {
    e.preventDefault();
    const opt = { 
      id: `sim-${Date.now()}`, 
      indexer: newOption.indexer, 
      cdiPercent: null, fixedAnnualRate: null, ipcaSpreadAnnualRate: null,
      investmentDate: newOption.investmentDate,
      maturityDate: newOption.maturityDate
    };
    if (newOption.indexer === 'CDI') opt.cdiPercent = Number(newOption.rate);
    if (newOption.indexer === 'PRE') opt.fixedAnnualRate = Number(newOption.rate);
    if (newOption.indexer === 'IPCA') opt.ipcaSpreadAnnualRate = Number(newOption.rate);
    setOptions([...options, opt]);
  };

  const removeOption = (id) => setOptions(options.filter(o => o.id !== id));

  const formatBrl = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const results = useMemo(() => {
    if (globals.investedAmount <= 0) return [];

    const simResults = options.map(opt => {
      const cdbMock = {
        investedAmount: Number(globals.investedAmount),
        investmentDate: opt.investmentDate,
        maturityDate: opt.maturityDate,
        indexer: opt.indexer,
        cdiPercent: opt.cdiPercent,
        fixedAnnualRate: opt.fixedAnnualRate,
        ipcaSpreadAnnualRate: opt.ipcaSpreadAnnualRate,
        taxExempt: false
      };
      
      const sim = simulateCdb(cdbMock, { cdiAnnual: Number(globals.cdiAnnual), ipcaAnnual: Number(globals.ipcaAnnual) });
      
      let name = '';
      if (opt.indexer === 'CDI') name = `${opt.cdiPercent}% CDI`;
      if (opt.indexer === 'PRE') name = `Prefixado ${opt.fixedAnnualRate}%`;
      if (opt.indexer === 'IPCA') name = `IPCA + ${opt.ipcaSpreadAnnualRate}%`;

      const profitPct = cdbMock.investedAmount > 0 ? (sim.netProfit / cdbMock.investedAmount * 100) : 0;

      return { id: opt.id, opt, name, sim, profitPct };
    });

    return simResults.sort((a, b) => b.sim.netAmount - a.sim.netAmount);
  }, [globals, options]);

  const handleSaveAsCDB = (res) => {
    const item = {
      productType: 'CDB',
      nickname: `Simulação ${res.name}`,
      issuer: 'Banco Simulação',
      conglomerate: 'Banco Simulação',
      broker: '',
      indexer: res.opt.indexer,
      cdiPercent: res.opt.cdiPercent,
      fixedAnnualRate: res.opt.fixedAnnualRate,
      ipcaSpreadAnnualRate: res.opt.ipcaSpreadAnnualRate,
      investedAmount: Number(globals.investedAmount),
      investmentDate: res.opt.investmentDate,
      maturityDate: res.opt.maturityDate,
      liquidity: 'MATURITY',
      fgcEligible: true,
      status: 'ACTIVE',
      notes: 'Gerado a partir do simulador'
    };

    const { valid, normalizedData } = validateFixedIncomeInvestment(item);
    if (valid) {
      setFixedIncome([...fixedIncome, normalizedData]);
      alert('Simulação salva como CDB com sucesso!');
      navigate('/renda-fixa');
    }
  };

  const indexerBadge = (idx) => {
    if (idx === 'CDI') return 'badge-profit';
    if (idx === 'PRE') return 'badge-fii';
    return 'badge-rf';
  };

  return (
    <div style={{ paddingBottom: 48 }}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 anim-slide-up">
        <button className="btn btn-secondary btn-icon" onClick={() => navigate('/renda-fixa')}><ArrowLeft size={18} /></button>
        <div>
          <h1 className="page-title">Simulador de Renda Fixa</h1>
          <p className="page-subtitle">Compare opções reais de mercado, variando períodos e taxas.</p>
        </div>
      </div>

      {/* Aviso Legal */}
      <div className="notice notice-warning anim-slide-up anim-d1 mb-6">
        <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: '0.82rem' }}>
          <strong>Aviso Legal — </strong>
          Simulação matemática baseada nas premissas informadas. Não configura recomendação financeira.
        </div>
      </div>

      {/* Premissas Globais */}
      <div className="glass p-6 mb-6 anim-slide-up anim-d1">
        <h2 className="fw-700 text-base mb-4 flex items-center gap-2">
          <span style={{ color: 'var(--brand)' }}>◈</span> Premissas da Simulação
        </h2>
        <div className="grid grid-3 gap-4">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Aporte (R$)</label>
            <input type="number" className="input" value={globals.investedAmount} onChange={e => setGlobals({...globals, investedAmount: e.target.value})} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">CDI Projetado (% a.a.)</label>
            <input type="number" step="0.01" className="input" value={globals.cdiAnnual} onChange={e => setGlobals({...globals, cdiAnnual: e.target.value})} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">IPCA Projetado (% a.a.)</label>
            <input type="number" step="0.01" className="input" value={globals.ipcaAnnual} onChange={e => setGlobals({...globals, ipcaAnnual: e.target.value})} />
          </div>
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid gap-6 anim-slide-up anim-d2" style={{ gridTemplateColumns: '340px 1fr', alignItems: 'start' }}>
        
        {/* Left panel: Add option */}
        <div className="glass p-6" style={{ position: 'sticky', top: 24 }}>
          <h2 className="fw-700 text-base mb-5 flex items-center gap-2">
            <span style={{ color: 'var(--accent-blue)' }}>◈</span> Adicionar ao Comparativo
          </h2>
          <form onSubmit={handleAddOption}>
            <div className="form-group">
              <label className="form-label">Indexador</label>
              <select className="select" value={newOption.indexer} onChange={e => setNewOption({...newOption, indexer: e.target.value})}>
                <option value="CDI">Pós-fixado (CDI)</option>
                <option value="PRE">Prefixado</option>
                <option value="IPCA">Híbrido (IPCA+)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">
                {newOption.indexer === 'CDI' ? 'Percentual do CDI (%)' : newOption.indexer === 'PRE' ? 'Taxa Fixa (% a.a.)' : 'Spread Real (% a.a.)'}
              </label>
              <input required type="number" step="0.01" className="input" value={newOption.rate} onChange={e => setNewOption({...newOption, rate: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Data de Aplicação</label>
              <input required type="date" className="input" value={newOption.investmentDate} onChange={e => setNewOption({...newOption, investmentDate: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Data de Vencimento</label>
              <input required type="date" className="input" value={newOption.maturityDate} onChange={e => setNewOption({...newOption, maturityDate: e.target.value})} />
            </div>
            <button type="submit" className="btn btn-primary btn-w-full" style={{ marginTop: 4 }}>
              <Plus size={15}/> Simular
            </button>
          </form>
        </div>

        {/* Right panel: Results Ranking */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="fw-700 text-base flex items-center gap-2">
              <span style={{ color: 'var(--profit)' }}>◈</span> Ranking de Rentabilidade
            </h2>
            {results.length > 0 && (
              <span className="text-xs text-muted">{results.length} opções comparadas</span>
            )}
          </div>
          
          {results.length === 0 ? (
            <div className="glass p-8">
              <div className="empty-state" style={{ padding: '40px 20px' }}>
                <div className="empty-state-icon"><Trophy size={28} /></div>
                <h3>Nenhuma simulação configurada</h3>
                <p>Adicione opções no painel ao lado para comparar.</p>
              </div>
            </div>
          ) : results.map((res, i) => {
            const isWinner = i === 0 && results.length > 1;
            const medalColor = MEDAL_COLORS[i] || 'var(--text-tertiary)';

            return (
              <div 
                key={res.id} 
                className={`glass p-6 ${isWinner ? 'glass-glow' : ''}`}
                style={isWinner ? { borderColor: 'rgba(0, 220, 130, 0.3)' } : {}}
              >
                {/* Top row: Rank + Name + Lucro */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: `${medalColor}15`,
                      border: `1px solid ${medalColor}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: medalColor, fontWeight: 800, fontSize: i < 3 ? '0.85rem' : '0.75rem'
                    }}>
                      {i === 0 ? <Trophy size={18} /> : `#${i + 1}`}
                    </div>
                    <div>
                      <div className="flex items-center gap-2" style={{ marginBottom: 2 }}>
                        <span className="fw-700" style={{ fontSize: '1.05rem' }}>{res.name}</span>
                        <span className={`badge ${indexerBadge(res.opt.indexer)}`}>{res.opt.indexer}</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted" style={{ fontSize: '0.75rem' }}>
                        <CalendarDays size={12} />
                        <span>{res.sim.days} dias · {new Date(res.opt.investmentDate).toLocaleDateString('pt-BR')} → {new Date(res.opt.maturityDate).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="fw-800 text-profit" style={{ fontSize: '1.35rem', lineHeight: 1 }}>
                      +{formatBrl(res.sim.netProfit)}
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.72rem', marginTop: 4 }}>
                      +{res.profitPct.toFixed(2)}% total
                    </div>
                  </div>
                </div>

                {/* Stats Row */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--border)'
                }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 4 }}>Bruto</div>
                    <div className="fw-600" style={{ fontSize: '0.88rem' }}>{formatBrl(res.sim.grossAmount)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 4 }}>IR ({res.sim.taxRate}%)</div>
                    <div className="fw-600 text-loss" style={{ fontSize: '0.88rem' }}>-{formatBrl(res.sim.taxAmount)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 4 }}>Líquido</div>
                    <div className="fw-700" style={{ fontSize: '0.88rem', color: 'var(--text-white)' }}>{formatBrl(res.sim.netAmount)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 4 }}>Rent. a.a.</div>
                    <div className="fw-700 text-brand" style={{ fontSize: '0.88rem' }}>{res.sim.netAnnualRate.toFixed(2)}%</div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex justify-end gap-2 mt-4">
                  <button className="btn btn-ghost btn-sm" onClick={() => removeOption(res.id)}>
                    <Trash2 size={13} /> Remover
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleSaveAsCDB(res)}>
                    <Bookmark size={13} /> Salvar na Carteira
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
