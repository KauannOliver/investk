import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store/StoreContext';
import { formatCurrency, formatPercent } from '../utils/calculations';
import { buildAssetTimeline } from '../utils/timeline';
import { ArrowLeft, TrendingUp, TrendingDown, Clock, MoveDownRight, MoveUpRight, Info } from 'lucide-react';

export default function AssetDetail() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const { portfolioState, operations, dividends } = useStore();
  const { allPositions } = portfolioState;

  const ticker = id.toUpperCase();
  const pos    = allPositions[ticker];

  if (!pos) {
    return (
      <div style={{ paddingBottom: 48 }}>
        <button className="btn btn-secondary mb-6 flex items-center gap-2" onClick={() => navigate(-1)}>
          <ArrowLeft size={15}/> Voltar
        </button>
        <div className="empty-state glass">
          <h3>Ativo {ticker} não encontrado</h3>
          <p>Verifique se existem operações registradas para este ticker.</p>
        </div>
      </div>
    );
  }

  const timeline = buildAssetTimeline(ticker, operations, dividends);
  
  // Realized info
  const lastEvent = timeline[0]; // Como é reverso, o 0 é o saldo final
  const totalRealized = lastEvent ? lastEvent.realizedProfitAcc : 0;
  const passiveTotal = lastEvent ? lastEvent.passiveIncomeAcc : 0;
  
  const currentQtd = pos.qty;
  const curValue = currentQtd * pos.averagePrice;

  return (
    <div style={{ paddingBottom: 48 }}>
      <button className="btn btn-secondary mb-6 flex items-center gap-2 anim-fade-in" onClick={() => navigate(-1)}>
        <ArrowLeft size={15}/> Voltar para Carteira
      </button>

      {/* Hero */}
      <div className="glass p-8 mb-6 anim-slide-up" style={{ background: 'linear-gradient(135deg, rgba(0,220,130,0.06), rgba(79,142,247,0.03))' }}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: pos.type === 'FII' ? 'var(--fii-bg)' : 'var(--rf-bg)',
              border: `1px solid ${pos.type === 'FII' ? 'rgba(251,191,36,0.25)' : 'rgba(167,139,250,0.25)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', fontWeight: 800,
              color: pos.type === 'FII' ? 'var(--fii-color)' : 'var(--rf-color)',
            }}>
              {ticker.slice(0, 4)}
            </div>
            <div>
              <h1 className="page-title">{ticker}</h1>
              <span className={`badge badge-${pos.type.toLowerCase()}`}>{pos.type}</span>
            </div>
          </div>

          <div>
            <p className="text-xs text-muted fw-700 uppercase mb-1" style={{ letterSpacing: '0.09em' }}>Posição Atual</p>
            <p className="fw-800 text-xl">{pos.qty} cotas</p>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-4 gap-4 mb-6 anim-slide-up anim-d1">
        <div className="glass metric-card">
          <p className="metric-label">Preço Médio Atual</p>
          <p className="metric-value">{formatCurrency(pos.averagePrice)}</p>
          <p className="metric-sub">Capital aportado ÷ Volume</p>
        </div>
        <div className="glass metric-card" style={totalRealized > 0 ? { borderLeft: '3px solid var(--profit)' } : totalRealized < 0 ? { borderLeft: '3px solid var(--loss)' } : {}}>
          <p className="metric-label">Lucro Realizado (Vendas)</p>
          <p className={`metric-value ${totalRealized > 0 ? 'text-profit' : totalRealized < 0 ? 'text-loss' : ''}`}>{formatCurrency(totalRealized)}</p>
          <p className="metric-sub">Dinheiro livre no bolso</p>
        </div>
        <div className="glass metric-card" style={passiveTotal > 0 ? { borderLeft: '3px solid var(--accent-purple)' } : {}}>
          <p className="metric-label">Renda Passiva Histórica</p>
          <p className={`metric-value ${passiveTotal > 0 ? 'text-purple' : ''}`}>{formatCurrency(passiveTotal)}</p>
          <p className="metric-sub">Total de proventos coletados</p>
        </div>
        <div className="glass metric-card">
          <p className="metric-label">Linha do Tempo</p>
          <p className="metric-value">{timeline.length}</p>
          <p className="metric-sub">Eventos registrados</p>
        </div>
      </div>

      {/* History */}
      <div className="glass overflow-hidden anim-slide-up anim-d2">
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <h2 className="fw-700 text-base">Histórico de Movimentações</h2>
        </div>
        <div className="table-wrap">
          <table className="r-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: 24, minWidth: 100 }}>Data</th>
                <th style={{ minWidth: 120 }}>Evento</th>
                <th style={{ textAlign: 'right', minWidth: 120 }}>Movimentação</th>
                <th style={{ textAlign: 'center', minWidth: 60 }}><Info size={12} title="Efeito exato do lucro/prejuízo no momento exato do evento"/></th>
                <th style={{ textAlign: 'right', minWidth: 100 }}>Qtd. Carteira</th>
                <th style={{ textAlign: 'right', minWidth: 100 }}>Preço Médio</th>
                <th style={{ textAlign: 'right', paddingRight: 24, minWidth: 110 }}>Balanço (R$)</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((op, i) => {
                const total = op.eventType === 'DIVIDEND' 
                  ? op.totalReceived 
                  : (op.qty * op.price + (op.eventType === 'BUY' ? (op.taxes||0) : -(op.taxes||0)));
                
                return (
                  <tr key={op.id || `evt-${i}`} className="anim-fade-in" style={{ animationDelay: `${i * 0.03}s` }}>
                    <td data-label="Data" style={{ paddingLeft: 24, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {new Date(op.normalizedDate).toLocaleDateString('pt-BR')}
                    </td>
                    <td data-label="Evento">
                      {op.eventType === 'BUY' && <span className="badge badge-buy"><MoveUpRight size={10} style={{marginRight:4}}/> Compra</span>}
                      {op.eventType === 'SELL' && <span className="badge badge-sell"><MoveDownRight size={10} style={{marginRight:4}}/> Venda</span>}
                      {op.eventType === 'DIVIDEND' && <span className="badge" style={{background: 'rgba(167,139,250,0.1)', color: '#d946ef', border: '1px solid rgba(167,139,250,0.2)'}}><Clock size={10} style={{marginRight:4}}/> Provento</span>}
                    </td>
                    <td data-label="Valor" style={{ textAlign: 'right', fontWeight: 600 }}>
                      {op.eventType === 'DIVIDEND' ? (
                        <span className="text-purple">+{formatCurrency(total)}</span>
                      ) : (
                        <span>{op.eventType === 'SELL' ? '-' : '+'}{op.qty} un a {formatCurrency(op.price)}</span>
                      )}
                    </td>
                    <td data-label="Realizado" style={{ textAlign: 'center' }}>
                      {op.eventType === 'SELL' ? (
                        <span className={`badge ${op.realizedProfit >= 0 ? 'badge-profit' : 'badge-loss'}`}>
                          {op.realizedProfit >= 0 ? '+' : ''}{formatCurrency(op.realizedProfit)}
                        </span>
                      ) : <span className="text-muted" style={{opacity: 0.3}}>-</span>}
                    </td>
                    <td data-label="Qtd Atual" style={{ textAlign: 'right', fontWeight: 700 }}>{op.runningQty}</td>
                    <td data-label="P. Médio" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(op.runningAveragePrice)}</td>
                    <td data-label="Balanço (R$)" style={{ textAlign: 'right', paddingRight: 24, fontWeight: 700 }}>{formatCurrency(op.runningInvested)}</td>
                  </tr>
                );
              })}
              {timeline.length === 0 && (
                <tr><td colSpan={7}><div className="table-empty">Nenhuma movimentação encontrada.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
