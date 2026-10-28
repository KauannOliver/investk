import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/StoreContext';
import { formatCurrency, formatPercent } from '../utils/calculations';
import { fetchQuote, clearAllQuotesCache } from '../services/api';
import { Search, TrendingUp, TrendingDown, RefreshCw, Wallet } from 'lucide-react';
import { simulateCdb } from '../utils/fixedIncome';
import Pagination from '../components/Pagination';

export default function Portfolio() {
  const { portfolioState, fixedIncome = [], fixedIncomeSettings = {} } = useStore();
  const { positions } = portfolioState;

  const [quotes, setQuotes]   = useState({});
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [refreshed, setRefreshed] = useState(false);
  const [page, setPage]       = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    setPage(1);
  }, [search, filter]);

  const load = async (force = false) => {
    setLoading(true);
    if (force) clearAllQuotesCache();
    const next = {};
    for (const t of Object.keys(positions)) {
      const d = await fetchQuote(t, force);
      if (d?.regularMarketPrice) next[t] = d.regularMarketPrice;
    }
    setQuotes(next);
    setLoading(false);
    if (force) {
      setRefreshed(true);
      setTimeout(() => setRefreshed(false), 2000);
    }
  };

  useEffect(() => {
    if (Object.keys(positions).length) load();
  }, [positions]);

  const assumptions = { cdiAnnual: fixedIncomeSettings?.defaultCdiAnnual || 10.5, ipcaAnnual: fixedIncomeSettings?.defaultIpcaAnnual || 4.5 };

  const baseRows = Object.keys(positions).map(ticker => {
    const pos   = positions[ticker];
    const price = quotes[ticker] || pos.averagePrice;
    const cur   = price * pos.qty;
    const pl    = cur - pos.totalInvested;
    const plPct = pos.totalInvested > 0 ? (pl / pos.totalInvested) * 100 : 0;
    return { ticker, ...pos, currentPrice: price, currentValue: cur, pl, plPct, isRF: false };
  });

  const rfRows = fixedIncome.filter(cdb => cdb.status === 'ACTIVE').map(cdb => {
    const sim = simulateCdb(cdb, assumptions);
    return {
      ticker: cdb.nickname || cdb.issuer,
      type: 'RF',
      qty: 1,
      averagePrice: cdb.investedAmount,
      currentPrice: sim.netAmount,
      totalInvested: cdb.investedAmount,
      currentValue: sim.netAmount,
      pl: sim.netProfit,
      plPct: cdb.investedAmount > 0 ? (sim.netProfit / cdb.investedAmount) * 100 : 0,
      isRF: true,
      cdbId: cdb.id
    };
  });

  const filteredSortedRows = [...baseRows, ...rfRows]
    .filter(row => {
      const matchSearch = row.ticker.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === 'ALL' || row.type === filter;
      return matchSearch && matchFilter;
    })
    .sort((a, b) => b.currentValue - a.currentValue);

  const paginatedRows = filteredSortedRows.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const totalValue = filteredSortedRows.reduce((s, r) => s + r.currentValue, 0);

  return (
    <div style={{ paddingBottom: 48 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 anim-slide-up">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <Wallet size={28} style={{ color: 'var(--brand)' }} />
            Minha Carteira
          </h1>
          <p className="page-subtitle">Clique em um ativo para ver detalhes completos.</p>
        </div>
        <button
          className="btn btn-secondary btn-sm flex items-center gap-2"
          onClick={() => load(true)}
          disabled={loading}
        >
          <RefreshCw size={13} style={loading ? { animation: 'rotateGlow 1s linear infinite' } : {}} />
          {refreshed ? 'Atualizado!' : loading ? 'Carregando...' : 'Atualizar Preços'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap anim-slide-up anim-d1">
        <div className="relative flex-1" style={{ minWidth: 200 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input
            className="input"
            style={{ paddingLeft: 38 }}
            placeholder="Buscar por ticker..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {['ALL','FII','Ação','RF'].map(f => (
          <button
            key={f}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(f)}
          >
            {f === 'ALL' ? 'Todos' : f === 'Ação' ? 'Ações' : f === 'RF' ? 'Renda Fixa' : f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass overflow-hidden anim-slide-up anim-d2">
        <div className="table-wrap" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <table className="r-table" style={{ minWidth: 700 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <tr>
                <th style={{ paddingLeft: 20, minWidth: 160 }}>Ativo</th>
                <th style={{ textAlign: 'right', minWidth: 60 }}>Qtd.</th>
                <th style={{ textAlign: 'right', minWidth: 110 }}>Preço Médio</th>
                <th style={{ textAlign: 'right', minWidth: 110 }}>Cotação</th>
                <th style={{ textAlign: 'right', minWidth: 110 }}>Investido</th>
                <th style={{ textAlign: 'right', minWidth: 110 }}>Saldo Atual</th>
                <th style={{ textAlign: 'right', paddingRight: 20, minWidth: 130 }}>L / P</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="table-empty">
                      <div className="empty-state-icon" style={{ margin: '0 auto 16px' }}>
                        <Wallet size={28} />
                      </div>
                      <h3 style={{ color: 'var(--text-secondary)', marginBottom: 6 }}>Carteira vazia</h3>
                      <p>Registre suas primeiras compras em <strong>Operações</strong>.</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedRows.map((row, i) => {
                const isUp = row.pl >= 0;
                const pct  = totalValue > 0 ? ((row.currentValue / totalValue) * 100).toFixed(1) : '0.0';
                return (
                  <tr key={row.isRF ? `rf-${row.cdbId}` : row.ticker} className="anim-fade-in" style={{ animationDelay: `${i * 0.04}s` }}>
                    <td data-label="Ativo" style={{ paddingLeft: 20 }}>
                      <Link to={row.isRF ? `/renda-fixa/${row.cdbId}` : `/ativo/${row.ticker}`} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                          background: row.type === 'FII'
                            ? 'linear-gradient(135deg,rgba(251,191,36,0.15),rgba(251,191,36,0.05))'
                            : row.type === 'RF'
                            ? 'linear-gradient(135deg,rgba(167,139,250,0.15),rgba(167,139,250,0.05))'
                            : 'linear-gradient(135deg,rgba(79,142,247,0.15),rgba(79,142,247,0.05))',
                          border: `1px solid ${row.type === 'FII' ? 'rgba(251,191,36,0.2)' : row.type === 'RF' ? 'rgba(167,139,250,0.2)' : 'rgba(79,142,247,0.2)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.6rem', fontWeight: 800,
                          color: row.type === 'FII' ? 'var(--fii-color)' : row.type === 'RF' ? 'var(--rf-color)' : 'var(--accent-blue)',
                        }}>
                          {row.type}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-white)', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>{row.ticker}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{pct}% da carteira</div>
                        </div>
                      </Link>
                    </td>
                    <td data-label="Qtd." style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{row.qty}</td>
                    <td data-label="P. Médio" style={{ textAlign: 'right', color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{formatCurrency(row.averagePrice)}</td>
                    <td data-label="Cotação" style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{formatCurrency(row.currentPrice)}</td>
                    <td data-label="Investido" style={{ textAlign: 'right', color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{formatCurrency(row.totalInvested)}</td>
                    <td data-label="Saldo" style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{formatCurrency(row.currentValue)}</td>
                    <td data-label="L/P" style={{ textAlign: 'right', paddingRight: 20 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                        <span style={{ fontWeight: 700, color: isUp ? 'var(--profit)' : 'var(--loss)', display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap', fontSize: '0.88rem' }}>
                          {isUp ? <TrendingUp size={11}/> : <TrendingDown size={11}/>}
                          {formatCurrency(row.pl)}
                        </span>
                        <span className={`badge ${isUp ? 'badge-profit' : 'badge-loss'}`} style={{ fontSize: '0.68rem' }}>{formatPercent(row.plPct)}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          <Pagination 
            currentPage={page}
            totalItems={filteredSortedRows.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setPage}
          />
        </div>
      </div>
    </div>
  );
}
