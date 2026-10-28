import React, { useState, useEffect } from 'react';
import { useStore } from '../store/StoreContext';
import { Target, CheckCircle, PieChart, AlertCircle } from 'lucide-react';

const MACRO_CATEGORIES = ['FII', 'Ações', 'Renda Fixa']; // As tipologias do InvestK

export default function Goals() {
  const { goals, setGoals } = useStore();
  
  const [localGoals, setLocalGoals] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const defaultGoals = { FII: 0, Ações: 0, 'Renda Fixa': 0, ...goals };
    setLocalGoals(defaultGoals);
  }, [goals]);

  const handleChange = (cat, val) => {
    let num = parseInt(val || '0', 10);
    if (num < 0) num = 0;
    if (num > 100) num = 100;
    setLocalGoals(p => ({ ...p, [cat]: num }));
  };

  const totalPercentage = Object.values(localGoals).reduce((s, v) => s + (Number(v) || 0), 0);
  const isValid = totalPercentage === 100;

  const save = () => {
    if (isValid) {
      setGoals(localGoals);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  return (
    <div style={{ paddingBottom: 48 }}>
      <div className="mb-8 anim-slide-up">
        <h1 className="page-title flex items-center gap-3">
          <Target size={28} style={{ color: 'var(--brand)' }} />
          Metas de Alocação
        </h1>
        <p className="page-subtitle">Defina o planejamento alvo da sua carteira para rebalanceamentos.</p>
      </div>

      <div className="glass p-6 mb-6 anim-slide-up anim-d1 border-left-brand">
        <div className="flex items-start gap-4">
          <PieChart size={24} style={{ color: 'var(--brand)', flexShrink: 0, marginTop: 4 }} />
          <div>
            <h2 className="fw-700 text-lg mb-2">Configure o Destino do Patrimônio</h2>
            <p className="text-sm text-muted mb-6" style={{ maxWidth: 650, lineHeight: 1.6 }}>
              Estabeleça a fatia ideal que cada classe de ativo deve representar na sua carteira.
              A soma de todos os alvos deve totalizar <strong>exatamente 100%</strong>. Depois de salvar,
              o Dashboard avisará onde estão suas maiores defasagens para guiar os próximos aportes.
            </p>

            <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              {MACRO_CATEGORIES.map(cat => (
                <div key={cat} className="glass glass-interactive p-4" style={{ display: 'flex', flexDirection: 'column' }}>
                  <label className="text-sm fw-700 text-muted mb-3 flex items-center justify-between">
                    <span>{cat}</span>
                    <span style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>{localGoals[cat] || 0}%</span>
                  </label>
                  <input
                    type="range"
                    min="0" max="100" step="1"
                    value={localGoals[cat] || 0}
                    onChange={(e) => handleChange(cat, e.target.value)}
                    style={{ width: '100%', accentColor: 'var(--brand)' }}
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between flex-wrap gap-4" style={{ padding: '20px', background: 'rgba(0,0,0,0.15)', borderRadius: 12 }}>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted uppercase fw-700">Total Distribuído:</span>
                <span className={`fw-800 text-xl flex items-center gap-2 ${isValid ? 'text-profit' : totalPercentage > 100 ? 'text-loss' : 'text-amber'}`}>
                  {totalPercentage}%
                  {!isValid && <AlertCircle size={16} />}
                </span>
              </div>
              
              <button 
                className="btn btn-primary" 
                onClick={save} 
                disabled={!isValid}
                title={!isValid ? "A soma total precisa ser 100%" : ""}
              >
                {saved ? <><CheckCircle size={15}/> Salvo!</> : <><Target size={15}/> Gravar Metas</>}
              </button>
            </div>
            
            {!isValid && (
              <p className="text-xs text-loss mt-3">
                * Para salvar corretamente, a soma dos percentuais tem que bater o limite exato de 100 (Atualmente está batendo {totalPercentage}).
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
