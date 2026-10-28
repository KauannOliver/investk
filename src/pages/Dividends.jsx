import React, { useState, useEffect } from 'react';
import { useStore } from '../store/StoreContext';
import { formatCurrency } from '../utils/calculations';
import { v4 as uuidv4 } from 'uuid';
import {
  Trash2, Plus, X, CalendarDays, Sparkles, Upload, CheckCircle,
  Clock, PiggyBank, ChevronLeft, ChevronRight, AlertCircle
} from 'lucide-react';

import Pagination from '../components/Pagination';

/* ── Radar baseado no histórico local ── */
const buildRadar = (dividends, positions) => {
  // Agrupa pagamentos por ativo
  const byAsset = {};
  dividends.forEach(d => {
    if (!byAsset[d.assetId]) byAsset[d.assetId] = [];
    const dt = new Date(d.paymentDate + 'T12:00:00');
    byAsset[d.assetId].push({
      day: dt.getDate(),
      date: d.paymentDate,
      amount: d.totalReceived,
    });
  });

  const today = new Date();
  const results = [];

  Object.keys(byAsset).forEach(ticker => {
    // Só mostrar se o ativo ainda está na carteira
    if (!positions[ticker]) return;

    const entries = byAsset[ticker];
    if (entries.length === 0) return;

    // Calcula mediana dos dias de pagamento
    const days = entries.map(e => e.day).sort((a, b) => a - b);
    const mid = Math.floor(days.length / 2);
    const medianDay = days.length % 2 !== 0 ? days[mid] : Math.round((days[mid - 1] + days[mid]) / 2);

    // Último valor recebido
    const sorted = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date));
    const lastAmount = sorted[0].amount;
    const lastDate = sorted[0].date;

    // Calcula próxima data estimada
    const curDay = today.getDate();
    const curMonth = today.getMonth();
    const curYear = today.getFullYear();

    let nextDate;
    if (medianDay > curDay) {
      nextDate = new Date(curYear, curMonth, medianDay);
    } else {
      // Próximo mês
      nextDate = new Date(curYear, curMonth + 1, medianDay);
    }

    const daysLeft = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));

    results.push({
      ticker,
      medianDay,
      nextDate,
      daysLeft,
      lastAmount,
      lastDate,
      totalPayments: entries.length,
    });
  });

  return results.sort((a, b) => a.daysLeft - b.daysLeft);
};

const itemsPerPage = 15;

export default function Dividends() {
  const { dividends, setDividends, portfolioState } = useStore();
  const { positions } = portfolioState;

  const [showForm, setShowForm] = useState(false);
  const [page, setPage]         = useState(1);
  const [form, setForm] = useState({
    assetId: '', paymentDate: new Date().toISOString().split('T')[0], totalReceived: ''
  });

  const change = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const submit = e => {
    e.preventDefault();
    if (!form.assetId || !form.totalReceived) return;
    setDividends([...dividends, {
      id: uuidv4(),
      assetId:      form.assetId.toUpperCase(),
      paymentDate:  form.paymentDate,
      totalReceived: parseFloat(form.totalReceived),
    }]);
    setForm(p => ({ ...p, assetId: '', totalReceived: '' }));
    setShowForm(false);
  };

  const del = id => {
    if (window.confirm('Remover provento?'))
      setDividends(dividends.filter(d => d.id !== id));
  };

  /* ── Stats ── */
  const totalAll = dividends.reduce((s, d) => s + d.totalReceived, 0);
  const now      = new Date();
  const monthTotal = dividends
    .filter(d => {
      const dt = new Date(d.paymentDate + 'T12:00:00');
      return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
    })
    .reduce((s, d) => s + d.totalReceived, 0);

  const sorted = [...dividends].sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
  const paginated = sorted.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  /* ── Radar histórico ── */
  const radar = buildRadar(dividends, positions);

  return (
    <div style={{ paddingBottom: 48 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 anim-slide-up" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title flex items-center gap-3">
            <CalendarDays size={28} style={{ color: 'var(--brand)' }} />
            Proventos
          </h1>
          <p className="page-subtitle">Histórico de dividendos e radar preditivo.</p>
        </div>
        <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => setShowForm(v => !v)}>
            {showForm ? <><X size={14}/> Cancelar</> : <><Plus size={14}/> Lançar Manual</>}
          </button>
          {dividends.length > 0 && (
             <button 
               className="btn btn-secondary flex items-center gap-2" 
               onClick={() => {
                 if (window.confirm('Cuidado! Isso apagará TODOS os proventos. Deseja continuar?')) {
                   setDividends([]);
                 }
               }}
               style={{ color: '#ef4444' }}
               title="Excluir todos os proventos"
             >
               <Trash2 size={14}/> Limpar Todos
             </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-2 gap-4 mb-8 anim-slide-up anim-d1">
        <div className="glass p-6" style={{ borderLeft: '3px solid var(--profit)' }}>
          <p className="text-xs text-muted fw-700 uppercase" style={{ letterSpacing: '0.09em', marginBottom: 8 }}>Total Acumulado</p>
          <p className="text-2xl fw-800 text-profit">{formatCurrency(totalAll)}</p>
        </div>
        <div className="glass p-6" style={{ borderLeft: '3px solid var(--accent-purple)' }}>
          <p className="text-xs text-muted fw-700 uppercase" style={{ letterSpacing: '0.09em', marginBottom: 8 }}>Recebidos este Mês</p>
          <p className="text-2xl fw-800 text-purple">{formatCurrency(monthTotal)}</p>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="form-section mb-8 anim-scale-in">
          <h3 className="fw-700 text-base mb-4 text-brand">Registrar Provento Manual</h3>
          <form onSubmit={submit}>
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
              <div className="form-group m-0">
                <label className="form-label">Ativo</label>
                <input name="assetId" value={form.assetId} onChange={change} className="input" placeholder="MXRF11" required />
              </div>
              <div className="form-group m-0">
                <label className="form-label">Data de Pagamento</label>
                <input type="date" name="paymentDate" value={form.paymentDate} onChange={change} className="input" required />
              </div>
              <div className="form-group m-0">
                <label className="form-label">Valor Recebido (R$)</label>
                <input type="number" step="any" name="totalReceived" value={form.totalReceived} onChange={change} className="input" placeholder="25.00" required />
              </div>
            </div>
            <div className="flex justify-end mt-5">
              <button type="submit" className="btn btn-primary">Salvar Provento</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Radar Histórico ── */}
      <div className="radar-panel mb-8 anim-slide-up anim-d2">
        <div className="flex items-center justify-between mb-4">
          <h2 className="fw-700 text-base flex items-center gap-2">
            <Sparkles size={17} style={{ color: '#d946ef' }} />
            Radar de Dividendos
            <span className="badge badge-future ml-2" style={{ fontWeight: 600 }}>Histórico</span>
          </h2>
          <span className="text-xs text-muted">
            Previsão baseada no histórico de pagamentos
          </span>
        </div>

        <p className="text-sm text-muted mb-5" style={{ maxWidth: 620 }}>
          Estimativa calculada a partir dos dias em que você <strong style={{ color: 'var(--text-primary)' }}>já recebeu</strong> dividendos
          de cada ativo. Quanto mais histórico, mais precisa a previsão.
        </p>

        {dividends.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 0' }}>
            <div className="empty-state-icon" style={{ margin: '0 auto 12px' }}>
              <CalendarDays size={24} />
            </div>
            <h3>Sem histórico</h3>
            <p>Importe sua planilha xlsx ou adicione proventos manualmente para ativar o radar.</p>
          </div>
        ) : radar.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 0' }}>
            <div className="empty-state-icon" style={{ margin: '0 auto 12px' }}>
              <AlertCircle size={24} />
            </div>
            <h3>Nenhum ativo ativo com histórico</h3>
            <p>Os ativos com histórico de dividendos precisam estar na sua carteira atual.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
            {radar.map((r, i) => {
              let badgeClass = 'badge-recent';
              let badgeLabel = 'Aguardando';
              let badgeIcon = <Clock size={9} />;
              if (r.daysLeft <= 5) {
                badgeClass = 'badge-future';
                badgeLabel = 'Próximo!';
              } else if (r.daysLeft <= 15) {
                badgeClass = 'badge-buy';
                badgeLabel = 'Em breve';
              }

              return (
                <div key={r.ticker} className="dividend-card" style={{ minWidth: 180 }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="fw-800" style={{ fontSize: '0.9rem' }}>{r.ticker}</span>
                    <span className={`badge ${badgeClass}`}>
                      {badgeIcon} {badgeLabel}
                    </span>
                  </div>
                  <p className="text-xs text-muted mb-1">
                    Estimado: dia <strong style={{ color: 'var(--text-primary)' }}>{r.medianDay}</strong>
                  </p>
                  <p className="fw-800 text-profit" style={{ fontSize: '1.1rem', marginBottom: 4 }}>
                    {formatCurrency(r.lastAmount)}
                  </p>
                  <p className="text-xs text-muted mb-8">Último recebido</p>
                  <div className="flex items-center justify-between" style={{ fontSize: '0.75rem' }}>
                    <span className="text-muted">
                      {r.daysLeft <= 0
                        ? 'Hoje ou passou'
                        : `em ${r.daysLeft} dia${r.daysLeft !== 1 ? 's' : ''}`}
                    </span>
                    <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                      {r.totalPayments} pagto{r.totalPayments !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* History */}
      <div className="flex items-center justify-between mb-4 anim-slide-up anim-d3">
        <h2 className="fw-700 text-lg">Histórico de Proventos</h2>
        <span className="text-xs text-muted">{dividends.length} registros</span>
      </div>

      <div className="glass overflow-hidden anim-slide-up anim-d3">
        <div className="table-wrap" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          <table className="r-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: 20 }}>Ativo</th>
                <th>Data de Pagamento</th>
                <th style={{ textAlign: 'right', paddingRight: 20 }}>Valor Recebido</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={4}>
                  <div className="table-empty">
                    <div className="empty-state-icon" style={{margin:'0 auto 16px'}}><PiggyBank size={28}/></div>
                    <h3>Nenhum provento lançado</h3>
                    <p>Importe um xlsx ou faça um lançamento manual acima.</p>
                  </div>
                </td></tr>
              ) : paginated.map((d, i) => (
                <tr key={d.id} className="anim-fade-in" style={{ animationDelay: `${i * 0.02}s` }}>
                  <td data-label="Ativo" style={{ paddingLeft: 20 }}>
                    <span className="fw-700">{d.assetId}</span>
                  </td>
                  <td data-label="Data" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {new Date(d.paymentDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </td>
                  <td data-label="Recebido" style={{ textAlign: 'right', paddingRight: 20 }}>
                    <span className="fw-700 text-profit">{formatCurrency(d.totalReceived)}</span>
                  </td>
                  <td style={{ paddingRight: 16 }}>
                    <button onClick={() => del(d.id)} className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--text-tertiary)' }}>
                      <Trash2 size={14}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={page} totalItems={sorted.length} itemsPerPage={itemsPerPage} onPageChange={setPage} />
      </div>
    </div>
  );
}
