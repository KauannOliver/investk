import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/StoreContext';
import { ArrowLeft, Trash2, CheckCircle, Clock } from 'lucide-react';
import { parseLocalDate, diffDays, simulateCdb, calculateRedemptionComparison } from '../utils/fixedIncome';

import MetricCard from '../components/MetricCard';

export default function FixedIncomeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fixedIncome, setFixedIncome, fixedIncomeSettings } = useStore();

  const cdb = fixedIncome.find(c => c.id === id);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemData, setRedeemData] = useState({
    redemptionDate: new Date().toISOString().split('T')[0],
    redemptionGrossAmount: '',
    redemptionTaxAmount: '',
    redemptionFees: '0',
    redemptionNetAmount: '',
    redemptionNotes: ''
  });

  const assumptions = useMemo(() => ({
    cdiAnnual: fixedIncomeSettings.defaultCdiAnnual || 10.5,
    ipcaAnnual: fixedIncomeSettings.defaultIpcaAnnual || 4.5
  }), [fixedIncomeSettings]);

  if (!cdb) {
    return <div className="p-8 text-center text-muted">CDB não encontrado.</div>;
  }

  const isRedeemed = cdb.status === 'REDEEMED';
  const targetDate = isRedeemed ? (cdb.redemptionDate || cdb.maturityDate) : cdb.maturityDate;
  const sim = simulateCdb(cdb, assumptions, targetDate);

  const formatBrl = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const startDt = parseLocalDate(cdb.investmentDate);
  const endDt = parseLocalDate(cdb.maturityDate);
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const totalDays = diffDays(startDt, endDt);
  let daysPassed = diffDays(startDt, isRedeemed ? parseLocalDate(cdb.redemptionDate) : today);
  if (startDt > today && !isRedeemed) daysPassed = 0;
  if (daysPassed > totalDays && !isRedeemed) daysPassed = totalDays;

  const progress = totalDays > 0 ? (daysPassed / totalDays) * 100 : 100;
  const daysRemaining = totalDays - daysPassed;

  const handleDelete = () => {
    if (window.confirm('Tem certeza que deseja excluir este investimento permanentemente?')) {
      setFixedIncome(fixedIncome.filter(c => c.id !== cdb.id));
      navigate('/renda-fixa');
    }
  };

  const handleConfirmRedeem = (e) => {
    e.preventDefault();
    const net = Number(redeemData.redemptionNetAmount);
    if (isNaN(net) || net <= 0) {
      alert('O valor líquido de resgate é obrigatório e deve ser maior que zero.');
      return;
    }

    const updated = {
      ...cdb,
      status: 'REDEEMED',
      redemptionDate: redeemData.redemptionDate,
      redemptionGrossAmount: Number(redeemData.redemptionGrossAmount) || null,
      redemptionTaxAmount: Number(redeemData.redemptionTaxAmount) || null,
      redemptionFees: Number(redeemData.redemptionFees) || 0,
      redemptionNetAmount: net,
      redemptionNotes: redeemData.redemptionNotes
    };

    setFixedIncome(fixedIncome.map(c => c.id === cdb.id ? updated : c));
    setShowRedeemModal(false);
  };

  let redemptionComparison = null;
  if (isRedeemed) {
    redemptionComparison = calculateRedemptionComparison(cdb, assumptions);
  }

  return (
    <div style={{ paddingBottom: 48 }}>
      {/* Header */}
      <div className="mb-6 anim-slide-up flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <button className="btn btn-secondary" style={{ padding: 8 }} onClick={() => navigate('/renda-fixa')}><ArrowLeft size={16} /></button>
          <div>
            <h1 className="page-title">{cdb.nickname}</h1>
            <p className="page-subtitle">{cdb.issuer} {cdb.broker ? `| Corretora: ${cdb.broker}` : ''}</p>
          </div>
        </div>
        <div className="flex gap-2">

          {!isRedeemed && (
            <button className="btn btn-primary" onClick={() => setShowRedeemModal(true)}>
              <CheckCircle size={14} /> Marcar Resgate
            </button>
          )}
          <button className="btn btn-danger" onClick={handleDelete} title="Excluir"><Trash2 size={14} /></button>
        </div>
      </div>

      {/* Info Core */}
      <div className="glass p-6 mb-6 anim-slide-up anim-d1">
        <div className="grid grid-5 gap-4">
          <div>
            <div className="text-xs text-muted mb-1">Indexador</div>
            <div className="fw-600 text-sm">{cdb.indexer}</div>
          </div>
          <div>
            <div className="text-xs text-muted mb-1">Taxa</div>
            <div className="fw-600 text-sm">{cdb.indexer === 'CDI' ? `${cdb.cdiPercent}%` : cdb.indexer === 'PRE' ? `${cdb.fixedAnnualRate}% a.a.` : `IPCA + ${cdb.ipcaSpreadAnnualRate}%`}</div>
          </div>
          <div>
            <div className="text-xs text-muted mb-1">Status</div>
            <div className="fw-600 text-sm">{isRedeemed ? <span className="text-brand">Resgatado</span> : 'Ativo'}</div>
          </div>
          <div>
            <div className="text-xs text-muted mb-1">Liquidez</div>
            <div className="fw-600 text-sm">{cdb.liquidity === 'DAILY' ? 'Diária' : 'No Vencimento'}</div>
          </div>
          <div>
            <div className="text-xs text-muted mb-1">FGC</div>
            <div className="fw-600 text-sm">{cdb.fgcEligible ? 'Coberto' : 'Não Coberto'}</div>
          </div>
        </div>
      </div>

      {/* Progresso de tempo */}
      {!isRedeemed && (
        <div className="glass p-6 mb-6 anim-slide-up anim-d1">
          <div className="flex justify-between text-sm fw-600 mb-2">
            <span>Aplicação: {startDt.toLocaleDateString('pt-BR')}</span>
            <span>Vencimento: {endDt.toLocaleDateString('pt-BR')}</span>
          </div>
          <div style={{ height: 12, background: 'var(--bg-secondary)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--brand)', width: `${progress}%` }}></div>
          </div>
          <div className="flex justify-between text-xs text-muted mt-2">
            <span>{Math.floor(daysPassed)} dias passados</span>
            <span>{daysRemaining > 0 ? `${daysRemaining} dias restantes` : 'Vencido'}</span>
          </div>
        </div>
      )}

      {/* Resultado Estimado (Cards) */}
      <div className="grid grid-3 gap-6 mb-8 anim-slide-up anim-d2">
        <MetricCard label="Valor Aplicado" value={formatBrl(cdb.investedAmount)} accent="blue" />
        <MetricCard label="Valor Líquido Estimado" value={formatBrl(sim.netAmount)} accent="brand" />
        <MetricCard label="Lucro Líquido Estimado" value={`+${formatBrl(sim.netProfit)}`} accent="brand" />
        <MetricCard label="Rentabilidade Líquida a.a." value={`${sim.netAnnualRate.toFixed(2)}%`} accent="brand" />
        <MetricCard label={`IR Estimado (${sim.taxRate}%)`} value={`-${formatBrl(sim.taxAmount)}`} accent="amber" />
        <MetricCard label="Dias P/ IR" value={`${sim.days} dias`} accent="purple" />
      </div>

      {/* Tabela de Resgate Real */}
      {isRedeemed && redemptionComparison && (
        <div className="glass p-6 anim-slide-up anim-d3 border" style={{ borderColor: 'var(--brand)' }}>
          <h2 className="fw-700 text-base mb-4 flex items-center gap-2">
            <CheckCircle size={18} style={{ color: 'var(--brand)' }} /> 
            Resultado Real do Resgate
          </h2>
          <div className="grid grid-3 gap-4 mb-6">
            <div className="p-4 rounded bg-main">
              <div className="text-xs text-muted mb-1">Data do Resgate</div>
              <div className="fw-600 text-base">{parseLocalDate(cdb.redemptionDate).toLocaleDateString('pt-BR')}</div>
            </div>
            <div className="p-4 rounded bg-main">
              <div className="text-xs text-muted mb-1">Valor Líquido Real</div>
              <div className="fw-600 text-base text-profit">{formatBrl(redemptionComparison.realNetAmount)}</div>
            </div>
            <div className="p-4 rounded bg-main">
              <div className="text-xs text-muted mb-1">Lucro Líquido Realizado</div>
              <div className={`fw-600 text-base ${redemptionComparison.realizedNetProfit >= 0 ? 'text-profit' : 'text-loss'}`}>
                {formatBrl(redemptionComparison.realizedNetProfit)}
              </div>
            </div>
          </div>

          <table className="r-table mb-4">
            <thead>
              <tr>
                <th>Indicador</th>
                <th className="text-right">Estimado (pela premissa)</th>
                <th className="text-right">Realizado</th>
                <th className="text-right">Diferença</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="fw-600">Valor Bruto</td>
                <td className="text-right">{formatBrl(redemptionComparison.expectedGrossAmount)}</td>
                <td className="text-right">{cdb.redemptionGrossAmount ? formatBrl(redemptionComparison.realGrossAmount) : '-'}</td>
                <td className="text-right">-</td>
              </tr>
              <tr>
                <td className="fw-600">IR Retido</td>
                <td className="text-right">{formatBrl(redemptionComparison.expectedTaxAmount)}</td>
                <td className="text-right">{cdb.redemptionTaxAmount ? formatBrl(redemptionComparison.realTaxAmount) : '-'}</td>
                <td className="text-right">-</td>
              </tr>
              <tr>
                <td className="fw-600">Valor Líquido</td>
                <td className="text-right text-profit">{formatBrl(redemptionComparison.expectedNetAmount)}</td>
                <td className="text-right text-profit">{formatBrl(redemptionComparison.realNetAmount)}</td>
                <td className={`text-right fw-600 ${redemptionComparison.differenceAmount >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {redemptionComparison.differenceAmount > 0 ? '+' : ''}{formatBrl(redemptionComparison.differenceAmount)}
                </td>
              </tr>
              <tr>
                <td className="fw-600">Rentabilidade a.a.</td>
                <td className="text-right">{sim.netAnnualRate.toFixed(2)}%</td>
                <td className="text-right">{redemptionComparison.realizedNetAnnualRate.toFixed(2)}%</td>
                <td className="text-right text-muted">{redemptionComparison.statusLabel}</td>
              </tr>
            </tbody>
          </table>
          {cdb.redemptionNotes && (
            <p className="text-sm text-muted mt-2"><strong>Observações:</strong> {cdb.redemptionNotes}</p>
          )}
        </div>
      )}

      {/* Modal Marcar Resgate */}
      {showRedeemModal && ReactDOM.createPortal(
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowRedeemModal(false)}>
          <div className="modal-panel">
            <div className="modal-header">
              <div className="modal-header-icon" style={{ background: 'rgba(0, 220, 130, 0.1)', border: '1px solid rgba(0,220,130,0.2)' }}>
                <CheckCircle size={20} style={{ color: 'var(--brand)' }} />
              </div>
              <div>
                <h2>Marcar como Resgatado</h2>
                <p>Informe os dados reais do resgate para comparar com a simulação.</p>
              </div>
            </div>

            <form onSubmit={handleConfirmRedeem}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Data do Resgate *</label>
                  <input required type="date" className="input" value={redeemData.redemptionDate} onChange={e => setRedeemData({...redeemData, redemptionDate: e.target.value})} />
                </div>

                <div className="form-group">
                  <label className="form-label">Valor Líquido Recebido na Conta (R$) *</label>
                  <input required type="number" step="0.01" className="input" value={redeemData.redemptionNetAmount} onChange={e => setRedeemData({...redeemData, redemptionNetAmount: e.target.value})} placeholder="Ex: 5650.00" />
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 6 }}>O valor exato que caiu na corretora já livre de impostos.</p>
                </div>

                <div className="grid grid-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">Valor Bruto (Opcional)</label>
                    <input type="number" step="0.01" className="input" value={redeemData.redemptionGrossAmount} onChange={e => setRedeemData({...redeemData, redemptionGrossAmount: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">IR Retido (Opcional)</label>
                    <input type="number" step="0.01" className="input" value={redeemData.redemptionTaxAmount} onChange={e => setRedeemData({...redeemData, redemptionTaxAmount: e.target.value})} />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Observações do Resgate (Opcional)</label>
                  <input type="text" className="input" value={redeemData.redemptionNotes} onChange={e => setRedeemData({...redeemData, redemptionNotes: e.target.value})} placeholder="Anotações sobre o resgate" />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRedeemModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Confirmar Resgate</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
