import React, { useState } from 'react';
import { useStore } from '../store/StoreContext';
import { v4 as uuidv4 } from 'uuid';
import { formatCurrency } from '../utils/calculations';
import { validateOperation } from '../utils/validation';
import {
  Trash2, Plus, X, ArrowRightLeft, ArrowUpCircle, ArrowDownCircle,
  ChevronLeft, ChevronRight
} from 'lucide-react';

const EMPTY = {
  type: 'BUY', assetId: '', assetType: 'FII',
  date: new Date().toISOString().split('T')[0],
  qty: '', price: '', taxes: ''
};

import Pagination from '../components/Pagination';

const itemsPerPage = 15;

export default function Operations() {
  const { operations, setOperations } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(EMPTY);
  const [filter, setFilter]     = useState('ALL');
  const [page, setPage]         = useState(1);

  const change = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const submit = e => {
    e.preventDefault();
    const { valid, errors, normalizedData } = validateOperation(form, operations);
    
    if (!valid) {
      alert('Erros de validação:\n' + errors.join('\n'));
      return;
    }

    setOperations([...operations, {
      id: uuidv4(),
      ...normalizedData
    }]);
    setForm(EMPTY);
    setShowForm(false);
    setPage(1);
  };

  const del = id => {
    if (window.confirm('Excluir esta operação? O preço médio será recalculado.'))
      setOperations(operations.filter(o => o.id !== id));
  };

  const sorted = [...operations]
    .filter(o => filter === 'ALL' || o.type === filter)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const paginated = sorted.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const handleFilterChange = (f) => {
    setFilter(f);
    setPage(1);
  };

  return (
    <div style={{ paddingBottom: 48 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 anim-slide-up">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <ArrowRightLeft size={28} style={{ color: 'var(--brand)' }} />
            Operações
          </h1>
          <p className="page-subtitle">Histórico completo de negociações · {operations.length} registros</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? <><X size={15}/> Cancelar</> : <><Plus size={15}/> Nova Operação</>}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="form-section mb-8 anim-scale-in">
          <h2 className="fw-700 text-base mb-6 flex items-center gap-2" style={{ color: 'var(--brand)' }}>
            <Plus size={18}/> Lançar Negociação
          </h2>

          <form onSubmit={submit}>
            {/* Type selector */}
            <div className="flex gap-3 mb-6">
              {[['BUY','Compra','var(--accent-blue)'],['SELL','Venda','var(--loss)']].map(([v,l,c]) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => setForm(p => ({ ...p, type: v }))}
                  className="flex-1 py-3 rounded-lg fw-700 text-sm transition-all"
                  style={{
                    border: `2px solid ${form.type === v ? c : 'var(--border)'}`,
                    background: form.type === v ? `${c}18` : 'transparent',
                    color: form.type === v ? c : 'var(--text-secondary)',
                  }}
                >
                  {form.type === v ? (v === 'BUY' ? <ArrowUpCircle size={14} style={{display:'inline',marginRight:6}}/> : <ArrowDownCircle size={14} style={{display:'inline',marginRight:6}}/>) : null}
                  {l}
                </button>
              ))}
            </div>

            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <div className="form-group m-0">
                <label className="form-label">Categoria</label>
                <select name="assetType" value={form.assetType} onChange={change} className="select">
                  <option value="FII">FII</option>
                  <option value="Ação">Ação</option>
                </select>
              </div>
              <div className="form-group m-0">
                <label className="form-label">Ticker / Código</label>
                <input name="assetId" value={form.assetId} onChange={change} className="input" placeholder="Ex: KNCR11" required />
              </div>
              <div className="form-group m-0">
                <label className="form-label">Data</label>
                <input type="date" name="date" value={form.date} onChange={change} className="input" required />
              </div>
              <div className="form-group m-0">
                <label className="form-label">Quantidade</label>
                <input type="number" step="any" name="qty" value={form.qty} onChange={change} className="input" placeholder="100" required />
              </div>
              <div className="form-group m-0">
                <label className="form-label">Preço Unitário (R$)</label>
                <input type="number" step="any" name="price" value={form.price} onChange={change} className="input" placeholder="98.50" required />
              </div>
              <div className="form-group m-0">
                <label className="form-label">Taxas / Emolumentos</label>
                <input type="number" step="any" name="taxes" value={form.taxes} onChange={change} className="input" placeholder="0.30" />
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button type="submit" className="btn btn-primary btn-lg">Salvar Operação</button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 anim-slide-up anim-d1">
        <span className="text-xs text-muted fw-700" style={{ letterSpacing: '0.09em', textTransform: 'uppercase' }}>Filtrar:</span>
        {[['ALL','Todas'],['BUY','Compras'],['SELL','Vendas']].map(([v,l]) => (
          <button key={v} className={`btn btn-sm ${filter===v ? 'btn-primary' : 'btn-secondary'}`} onClick={() => handleFilterChange(v)}>{l}</button>
        ))}
        <span className="text-xs text-muted ml-auto">{sorted.length} operações</span>
      </div>

      {/* Table */}
      <div className="glass overflow-hidden anim-slide-up anim-d2">
        <div className="table-wrap" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          <table className="r-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: 20 }}>Data</th>
                <th>Tipo</th>
                <th>Ativo</th>
                <th style={{ textAlign: 'right' }}>Quantidade</th>
                <th style={{ textAlign: 'right' }}>Preço Un.</th>
                <th style={{ textAlign: 'right' }}>Taxas</th>
                <th style={{ textAlign: 'right', paddingRight: 20 }}>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={8}>
                  <div className="empty-state">
                    <div className="empty-state-icon" style={{ margin: '0 auto 16px' }}><ArrowRightLeft size={28}/></div>
                    <h3>Sem operações</h3>
                    <p>Clique em <strong>Nova Operação</strong> para registrar sua primeira compra.</p>
                  </div>
                </td></tr>
              ) : paginated.map((op, i) => {
                const total = (op.qty * op.price) + (op.type === 'BUY' ? (op.taxes||0) : -(op.taxes||0));
                const isBuy = op.type === 'BUY';
                return (
                  <tr key={op.id} className="anim-fade-in" style={{ animationDelay: `${i * 0.03}s` }}>
                    <td data-label="Data" style={{ paddingLeft: 20, color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {new Date(op.date).toLocaleDateString('pt-BR')}
                    </td>
                    <td data-label="Tipo">
                      <span className={`badge ${isBuy ? 'badge-buy' : 'badge-sell'}`}>
                        {isBuy ? '↑ Compra' : '↓ Venda'}
                      </span>
                    </td>
                    <td data-label="Ativo">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700 }}>{op.assetId}</span>
                        <span className={`badge badge-${(op.assetType||'fii').toLowerCase()}`}>{op.assetType || 'FII'}</span>
                      </div>
                    </td>
                    <td data-label="Qtd." style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{op.qty}</td>
                    <td data-label="Preço" style={{ textAlign: 'right', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatCurrency(op.price)}</td>
                    <td data-label="Taxas" style={{ textAlign: 'right', color: 'var(--text-tertiary)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{formatCurrency(op.taxes||0)}</td>
                    <td data-label="Total" style={{ textAlign: 'right', fontWeight: 700, paddingRight: 20, whiteSpace: 'nowrap' }}>{formatCurrency(total)}</td>
                    <td style={{ paddingRight: 16 }}>
                      <button onClick={() => del(op.id)} className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--text-tertiary)' }}>
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={page} totalItems={sorted.length} itemsPerPage={itemsPerPage} onPageChange={setPage} />
      </div>
    </div>
  );
}
