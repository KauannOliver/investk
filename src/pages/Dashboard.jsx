import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/StoreContext';
import { formatCurrency, formatPercent } from '../utils/calculations';
import { fetchQuote, clearAllQuotesCache } from '../services/api';
import { syncSnapshots } from '../utils/snapshots';
import { checkAlerts } from '../utils/alerts';
import { simulateCdb, parseLocalDate } from '../utils/fixedIncome';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import { exportExcelReport } from '../utils/exportExcel';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, BarChart2,
  Layers, PiggyBank, Target, AlertCircle, RefreshCw, ChevronRight, CheckCircle2, Download, FileSpreadsheet, Landmark
} from 'lucide-react';
import MetricCard from '../components/MetricCard';

const parseExcelDate = (val) => {
  if (!val) return null;
  if (typeof val === 'number') {
    const date = XLSX.SSF.parse_date_code(val);
    if (date) {
      const y = date.y;
      const m = String(date.m).padStart(2, '0');
      const d = String(date.d).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  const str = String(val).trim();
  const parts = str.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  return null;
};

const PALETTE = ['#00dc82', '#4f8ef7', '#fbbf24', '#a78bfa', '#f472b6', '#2dd4bf', '#ff4d6d', '#fb923c'];

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label && <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill, fontWeight: 700, fontSize: '0.9rem' }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { portfolioState, dividends, setDividends, snapshots, setSnapshots, goals, settings, operations, setOperations, fixedIncome, fixedIncomeSettings } = useStore();
  const { positions, salesResult } = portfolioState;

  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState(false);
  const [refreshed, setRefreshed] = useState(false);
  const [alerts, setAlerts] = useState([]);

  /* ── Fetching Data & Snaps ── */
  const loadQuotes = async (force = false) => {
    setLoading(true);
    if (force) clearAllQuotesCache();
    const tickers = Object.keys(positions);
    const next = {};
    for (const t of tickers) {
      try {
        const d = await fetchQuote(t, force);
        if (d?.regularMarketPrice) next[t] = d.regularMarketPrice;
      } catch (err) {
        console.warn(`Pulo de cotação para ${t}: Ativo não encontrado na API ou erro de requisição.`);
      }
    }
    setQuotes(next);
    setLoading(false);
    setRefreshed(true);
    setTimeout(() => setRefreshed(false), 2000);
  };

  useEffect(() => {
    if (Object.keys(positions).length > 0) loadQuotes();
  }, [positions]);

  /* ── Cálculos Globais no Tempo Real ── */
  let totalInvested = 0, totalCurrent = 0, totalFII = 0, totalAcoes = 0;
  const currentAloc = { FII: 0, Ações: 0, BDR: 0, ETF: 0, "Renda Fixa": 0 };
  const chartPie = [];

  Object.entries(positions).forEach(([ticker, pos]) => {
    const price = quotes[ticker] || pos.averagePrice;
    const cur = price * pos.qty;
    totalInvested += pos.totalInvested;
    totalCurrent += cur;
    
    if (pos.type === 'FII') totalFII += cur;
    if (pos.type === 'Ação' || pos.type === 'Ações') totalAcoes += cur;
    
    if (currentAloc[pos.type] !== undefined) currentAloc[pos.type] += cur;
    
    if (cur > 0) chartPie.push({ name: ticker, value: cur });
  });

  // Cálculos de Renda Fixa
  let fixedIncomeInvested = 0;
  let fixedIncomeGrossEstimated = 0;
  let fixedIncomeNetEstimated = 0;
  let fixedIncomeProfitEstimated = 0;
  let nextMaturity = null;
  const assumptions = { cdiAnnual: fixedIncomeSettings?.defaultCdiAnnual || 10.5, ipcaAnnual: fixedIncomeSettings?.defaultIpcaAnnual || 4.5 };

  (fixedIncome || []).forEach(cdb => {
    if (cdb.status === 'ACTIVE') {
      const sim = simulateCdb(cdb, assumptions);
      fixedIncomeInvested += cdb.investedAmount || 0;
      fixedIncomeGrossEstimated += sim.grossAmount || 0;
      fixedIncomeNetEstimated += sim.netAmount || 0;
      fixedIncomeProfitEstimated += sim.netProfit || 0;

      const matDate = parseLocalDate(cdb.maturityDate);
      if (!nextMaturity || matDate < nextMaturity) nextMaturity = matDate;
      
      currentAloc["Renda Fixa"] += sim.netAmount || 0;
    }
  });

  totalInvested += fixedIncomeInvested;
  totalCurrent += fixedIncomeNetEstimated;
  if (fixedIncomeNetEstimated > 0) chartPie.push({ name: 'Renda Fixa', value: fixedIncomeNetEstimated });

  const pl = totalCurrent - totalInvested;
  const plPct = totalInvested > 0 ? (pl / totalInvested) * 100 : 0;
  const isUp = pl >= 0;

  const now = new Date();
  const monthDiv = dividends
    .filter(d => {
      const dt = new Date(d.paymentDate + 'T12:00:00');
      return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
    })
    .reduce((s, d) => s + d.totalReceived, 0);

  /* ── Effect Auto-Snapshot & Alertas ── */
  useEffect(() => {
    if (!loading && Object.keys(positions).length > 0) {
      const consolidated = syncSnapshots(snapshots, {
        totalInvested, patrimony: totalCurrent, passiveIncome: monthDiv
      });
      // Apenas avisa se houve de fato alteração de objeto (len ou val)
      if (JSON.stringify(consolidated) !== JSON.stringify(snapshots)) {
        setSnapshots(consolidated);
      }
    }

    const unreadAlerts = checkAlerts({ positions, dividends, settings, salesResult, operations, fixedIncome: fixedIncome || [], fixedIncomeSettings: fixedIncomeSettings || {} });
    setAlerts(unreadAlerts);
  }, [loading]); // Ocorre sempre após atualizar precificações


  /* ── Metas Allocation Logic ── */
  const alocSugestions = [];
  Object.keys(goals).forEach(cat => {
    const targetPct = goals[cat] || 0;
    if (targetPct > 0) {
      const currentPct = totalCurrent > 0 ? (currentAloc[cat] / totalCurrent) * 100 : 0;
      const diff = targetPct - currentPct;
      alocSugestions.push({ cat, targetPct, currentPct, diff });
    }
  });
  alocSugestions.sort((a, b) => b.diff - a.diff); // Quem ta mais defasado no topo

  /* ── Dividends Chart ── */
  const divByMonth = {};
  dividends.forEach(d => {
    const dt = new Date(d.paymentDate + 'T12:00:00');
    const key = `${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
    divByMonth[key] = (divByMonth[key] || 0) + d.totalReceived;
  });
  const chartBars = Object.entries(divByMonth)
    .map(([m, v]) => ({ mes: m, valor: v }))
    .sort((a, b) => {
      const [ma, ya] = a.mes.split('/');
      const [mb, yb] = b.mes.split('/');
      return new Date(`${ya}-${ma}-01`) - new Date(`${yb}-${mb}-01`);
    })
    .slice(-6);

  /* ── Snaps Chart  ── */
  const chartSnaps = [...snapshots].slice(-12).map(s => ({
    name: s.date.split('-').reverse().join('/'),
    Patrimônio: s.patrimony,
    Aportado: s.invested,
    isGap: s.isEstimated
  }));

  const handleImportExcel = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        
        let newOps = [];
        let newDivs = [];
        let importedOps = 0;
        let importedDivs = 0;

        // Import Operações
        if (wb.SheetNames.includes('Operações')) {
          const wsOps = wb.Sheets['Operações'];
          const rowsOps = XLSX.utils.sheet_to_json(wsOps, { defval: '' });
          rowsOps.forEach(row => {
            const cat = String(row['CATEGORIA'] || '').trim();
            const ticker = String(row['TICKER'] || '').trim().toUpperCase();
            const cv = String(row['C/V'] || '').trim().toUpperCase();
            const dateStr = row['DATA'];
            const qty = parseFloat(row['QUANTIDADE']);
            const price = typeof row['VLR_COTA'] === 'number' ? row['VLR_COTA'] : parseFloat(String(row['VLR_COTA']).replace(',', '.'));
            const taxes = typeof row['TAXAS'] === 'number' ? row['TAXAS'] : parseFloat(String(row['TAXAS'] || '0').replace(',', '.'));
            
            if (!ticker || !dateStr || isNaN(qty) || isNaN(price)) return;
            
            const date = parseExcelDate(dateStr);
            if (!date) return;
            
            let type = 'BUY';
            if (cv === 'V' || cv === 'VENDA') type = 'SELL';
            
            let assetType = 'FII';
            if (cat.toUpperCase() === 'AÇÃO' || cat.toUpperCase() === 'ACAO' || cat.toUpperCase() === 'AÇÕES') assetType = 'Ação';

            newOps.push({
              id: uuidv4(),
              type,
              assetId: ticker,
              assetType,
              date,
              qty,
              price,
              taxes: isNaN(taxes) ? 0 : taxes
            });
            importedOps++;
          });
        }

        // Import Dividendos
        if (wb.SheetNames.includes('Dividendos')) {
          const wsDivs = wb.Sheets['Dividendos'];
          const rowsDivs = XLSX.utils.sheet_to_json(wsDivs, { defval: '' });
          rowsDivs.forEach(row => {
            const ticker = String(row['TICKER'] || '').trim().toUpperCase();
            const dateStr = row['DATA'];
            const valor = typeof row['VLR_RECEBIDO'] === 'number' ? row['VLR_RECEBIDO'] : parseFloat(String(row['VLR_RECEBIDO']).replace(',', '.'));

            if (!ticker || !dateStr || isNaN(valor)) return;

            const date = parseExcelDate(dateStr);
            if (!date) return;

            newDivs.push({
              id: uuidv4(),
              assetId: ticker,
              paymentDate: date,
              totalReceived: valor
            });
            importedDivs++;
          });
        }

        if (newOps.length > 0) setOperations(prev => [...prev, ...newOps]);
        if (newDivs.length > 0) setDividends(prev => [...prev, ...newDivs]);
        
        alert(`Importação concluída!\nOperações importadas: ${importedOps}\nDividendos importados: ${importedDivs}`);
      } catch (err) {
        console.error(err);
        alert('Erro ao importar arquivo Excel. Verifique o formato das colunas e tente novamente.');
      }
      e.target.value = ''; // clear input
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div style={{ paddingBottom: 48 }}>
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between mb-10 anim-slide-up">
        <div>
          <h1 className="page-title">Visão Geral</h1>
          <p className="page-subtitle">Seu patrimônio, suas metas, seus resultados locais.</p>
        </div>
        <div className="flex items-center gap-3">
          <label
            className="btn btn-secondary btn-sm flex items-center gap-2"
            style={{ cursor: 'pointer' }}
            title="Importar Excel (Operações e Dividendos)"
          >
            <FileSpreadsheet size={13} />
            Importar Excel
            <input
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleImportExcel}
            />
          </label>
          <button
            className="btn btn-ghost btn-sm flex items-center gap-2"
            onClick={() => exportExcelReport({ positions, quotes, operations, dividends, salesResult, fixedIncome: fixedIncome || [], fixedIncomeSettings: fixedIncomeSettings || {} })}
            title="Exportar Relatório Excel (.xlsx)"
          >
            <Download size={13} />
            Relatório
          </button>
          
          <button
            className="btn btn-secondary btn-sm flex items-center gap-2"
            onClick={() => loadQuotes(true)}
            disabled={loading}
          >
            <RefreshCw size={13} style={loading ? { animation: 'rotateGlow 1s linear infinite' } : {}} />
            {refreshed ? 'Atualizado!' : loading ? 'Baixando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="mb-8 anim-slide-up">
           <div className="flex gap-4 overflow-x-auto" style={{ paddingBottom: 10 }}>
              {alerts.map(al => (
                <div key={al.id} className="glass p-4" style={{ minWidth: 280, borderLeft: `3px solid var(--${al.type})` }}>
                   <h4 className="fw-700 mb-1" style={{ fontSize: '0.85rem' }}>{al.title}</h4>
                   <p className="text-muted mb-3" style={{ fontSize: '0.75rem', lineHeight: 1.4 }}>{al.desc}</p>
                   <Link to={al.link} className="btn btn-secondary btn-sm" style={{ fontSize: '0.7rem', padding: '4px 10px' }}>
                     {al.linkText}
                   </Link>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* ── Metric Grid ── */}
      <div className="grid grid-4 gap-4 mb-6">
        <MetricCard label="Patrimônio Atual" value={formatCurrency(totalCurrent)} sub={`Aportado: ${formatCurrency(totalInvested)}`} Icon={DollarSign} accent="brand" delay="anim-d1" />
        <MetricCard label="Rentabilidade Global" value={<span className={isUp ? 'text-profit' : 'text-loss'}>{formatCurrency(pl)}</span>} badge={{ type: isUp ? 'profit' : 'loss', dir: isUp ? 'up' : 'down', text: formatPercent(plPct) }} Icon={isUp ? TrendingUp : TrendingDown} accent="blue" delay="anim-d2" />
        <MetricCard label="Total em FIIs" value={<span className="amber">{formatCurrency(totalFII)}</span>} sub={`${totalCurrent > 0 ? ((totalFII / totalCurrent) * 100).toFixed(1) : 0}% do portfólio`} Icon={BarChart2} accent="amber" delay="anim-d3" />
        <MetricCard label="Total em Ações" value={<span className="purple">{formatCurrency(totalAcoes)}</span>} sub={`${totalCurrent > 0 ? ((totalAcoes / totalCurrent) * 100).toFixed(1) : 0}% do portfólio`} Icon={Layers} accent="purple" delay="anim-d4" />
      </div>

      {(fixedIncome || []).length > 0 && (
        <div className="glass p-6 mb-6 anim-slide-up" style={{ borderColor: 'var(--brand)', overflow: 'hidden', position: 'relative' }}>
          {/* Subtle gradient background accent */}
          <div style={{ position: 'absolute', top: 0, right: 0, width: 200, height: 200, background: 'radial-gradient(circle, rgba(0,220,130,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
          
          {/* Header row */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div style={{ background: 'rgba(0, 220, 130, 0.1)', padding: 10, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Landmark size={22} style={{ color: 'var(--brand)' }} />
              </div>
              <div>
                <h3 className="fw-700" style={{ fontSize: '1.05rem', letterSpacing: '-0.02em' }}>Resumo de Renda Fixa</h3>
                <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: 2 }}>Posição consolidada dos títulos ativos</p>
              </div>
            </div>
            <Link to="/renda-fixa" className="btn btn-secondary btn-sm flex items-center gap-2">
              Ver Carteira <ChevronRight size={14} />
            </Link>
          </div>

          {/* Metrics grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Total Aportado</div>
              <div className="fw-700" style={{ fontSize: '1.05rem' }}>{formatCurrency(fixedIncomeInvested)}</div>
            </div>
            <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Líquido Estimado</div>
              <div className="fw-700" style={{ fontSize: '1.05rem', color: 'var(--text-white)' }}>{formatCurrency(fixedIncomeNetEstimated)}</div>
            </div>
            <div style={{ padding: '14px 16px', background: 'rgba(0,220,130,0.04)', borderRadius: 'var(--r-md)', border: '1px solid rgba(0,220,130,0.15)' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Lucro Estimado</div>
              <div className="fw-700 text-profit" style={{ fontSize: '1.05rem' }}>+{formatCurrency(fixedIncomeProfitEstimated)}</div>
            </div>
            <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Próx. Vencimento</div>
              <div className="fw-700" style={{ fontSize: '1.05rem', color: 'var(--accent-purple)' }}>{nextMaturity ? nextMaturity.toLocaleDateString('pt-BR') : '-'}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Graphic Rows ── */}
      <div className="grid gap-4 mb-4 anim-slide-up anim-d3" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
        
        {/* Histórico Patrimonial */}
        <div className="glass p-6">
          <h3 className="fw-700 text-base mb-6 flex items-center gap-2">
            <span style={{ color: 'var(--brand)' }}>◈</span> Evolução do Patrimônio
          </h3>
          {chartSnaps.length > 1 ? (
            <ResponsiveContainer width="100%" height={260} minHeight={260} minWidth={100}>
              <AreaChart data={chartSnaps}>
                <defs>
                  <linearGradient id="colorPat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="var(--brand)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide domain={['dataMin - 100', 'dataMax + 100']} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="Patrimônio" stroke="var(--brand)" fillOpacity={1} fill="url(#colorPat)" />
                <Area type="stepAfter" dataKey="Aportado" stroke="#4f8ef7" fill="none" strokeWidth={2} strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{ height: 260 }}>
              <Layers size={28} />
              <p>Histórico fotográfico em formação.</p>
            </div>
          )}
        </div>

        {/* Metas de Alocação */}
        <div className="glass p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="fw-700 text-base flex items-center gap-2">
              <span style={{ color: 'var(--accent-blue)' }}>◈</span> Radar de Aportes
            </h3>
            <Link to="/metas" className="btn btn-ghost btn-icon" style={{ color: 'var(--brand)' }}><Target size={16} /></Link>
          </div>
          
          {Object.keys(goals).length === 0 || alocSugestions.length === 0 ? (
             <div className="empty-state mt-auto mb-auto" style={{ height: 200 }}>
                <Target size={28} />
                <p>Configure suas metas em Estratégia para ter sugestões prontas aqui onde investir.</p>
             </div>
          ) : (
            <div className="flex-1 flex flex-col gap-4 overflow-y-auto" style={{ maxHeight: 260, paddingRight: 8 }}>
              {alocSugestions.map(aloc => (
                <div key={aloc.cat}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="fw-700">{aloc.cat}</span>
                    <span className="text-muted">{aloc.currentPct.toFixed(1)}% / {aloc.targetPct}%</span>
                  </div>
                  <div className="progress-track" style={{ height: 8 }}>
                    <div 
                      className="progress-fill" 
                      style={{ 
                        width: `${Math.min(100, (aloc.currentPct / aloc.targetPct) * 100)}%`, 
                        background: aloc.diff > 10 ? 'var(--loss)' : aloc.diff > 2 ? 'var(--amber)' : 'var(--profit)' 
                      }}
                    />
                  </div>
                  {aloc.diff > 2 && (
                    <p className="text-xs text-muted mt-1 flex items-center gap-1">
                       <AlertCircle size={10} style={{ color: 'var(--amber)' }}/> Faltando aportar
                    </p>
                  )}
                  {aloc.diff <= 0 && (
                    <p className="text-xs text-profit mt-1 flex items-center gap-1">
                       <CheckCircle2 size={10} style={{ color: 'var(--profit)' }}/> Meta Atingida
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* ── Minor Rows ── */}
      <div className="grid gap-4 anim-slide-up anim-d4" style={{ gridTemplateColumns: '1fr 1fr 340px' }}>
        <div className="glass p-6">
          <h3 className="fw-700 text-base mb-6 flex items-center gap-2">
            <span style={{ color: 'var(--brand)' }}>◈</span> Distribuição
          </h3>
          {chartPie.length > 0 ? (
            <ResponsiveContainer width="100%" height={300} minHeight={300} minWidth={100}>
              <PieChart>
                <Pie data={chartPie} dataKey="value" innerRadius={80} outerRadius={120} paddingAngle={4} cornerRadius={5} stroke="none">
                  {chartPie.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip content={<ChartTip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{ height: 260 }}><Layers size={28} /></div>
          )}
        </div>

        <div className="glass p-6">
          <h3 className="fw-700 text-base mb-6 flex items-center gap-2">
            <span style={{ color: 'var(--accent-purple)' }}>◈</span> Proventos por Mês
          </h3>
          {chartBars.length > 0 ? (
            <ResponsiveContainer width="100%" height={300} minHeight={300} minWidth={100}>
              <BarChart data={chartBars} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="mes" tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} width={60} />
                <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="valor" fill="url(#barGrad2)" radius={[6,6,0,0]} />
                <defs>
                  <linearGradient id="barGrad2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a78bfa" stopOpacity={0.9} /><stop offset="100%" stopColor="#a78bfa" stopOpacity={0.3} /></linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          ) : (
             <div className="empty-state" style={{ height: 260 }}><PiggyBank size={28} /></div>
          )}
        </div>

        <div className="glass p-6 flex flex-col justify-center">
            <div className="flex justify-between text-sm mb-3"><span className="text-muted">Ativos em Custódia</span><span className="fw-700">{Object.keys(positions).length}</span></div>
            <div className="divider" />
            <div className="flex justify-between text-sm mb-3"><span className="text-muted">Renda Passiva Mensal</span><span className="fw-700 text-profit">{formatCurrency(monthDiv)}</span></div>
            <div className="divider" />
            <div className="flex justify-between text-sm mb-3"><span className="text-muted">Rendimento Total PL</span><span className={`fw-700 ${isUp ? 'text-profit' : 'text-loss'}`}>{formatPercent(plPct)}</span></div>
        </div>
      </div>
    </div>
  );
}
