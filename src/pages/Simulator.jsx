import React, { useState, useMemo } from 'react';
import { useStore } from '../store/StoreContext';
import { formatCurrency } from '../utils/calculations';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Calculator, TrendingUp, PiggyBank, RefreshCw } from 'lucide-react';

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="chart-tooltip">
      <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 6 }}>Ano {label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontWeight: 700, fontSize: '0.9rem' }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

export default function Simulator() {
  const { portfolioState, snapshots, dividends } = useStore();
  const currentTotal = Object.values(portfolioState.positions).reduce((acc, pos) => acc + (pos.qty * pos.averagePrice), 0);

  // Cálculos reiais da carteira para comparação
  const now = new Date();
  const lastYear = new Date();
  lastYear.setFullYear(now.getFullYear() - 1);
  const div12m = dividends
    .filter(d => new Date(d.paymentDate + 'T12:00:00') >= lastYear)
    .reduce((s, d) => s + d.totalReceived, 0);

  const lastSnap = snapshots && snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const snapPatrimony = lastSnap && lastSnap.patrimony > 0 ? lastSnap.patrimony : currentTotal;
  const snapInvested = lastSnap && lastSnap.invested > 0 ? lastSnap.invested : Object.values(portfolioState.positions).reduce((acc, pos) => acc + pos.totalInvested, 0);
  
  const currentRentability = snapInvested > 0 ? ((snapPatrimony - snapInvested) / snapInvested) * 100 : 0;
  const currentDY = snapPatrimony > 0 ? (div12m / snapPatrimony) * 100 : 0;

  const [initialAmount, setInitialAmount] = useState(currentTotal || 0);
  const [monthlyAmount, setMonthlyAmount] = useState(500);
  const [years, setYears]                 = useState(10);
  const [annualYield, setAnnualYield]     = useState(10); // Juros compostos brutos de valorização
  const [dyYield, setDyYield]             = useState(8);  // Dividend yield médio anual

  // Função pura para rodar a máquina de simulação
  const simulation = useMemo(() => {
    let currentCapital = Number(initialAmount) || 0;
    const monthlyDeposit = Number(monthlyAmount) || 0;
    const projectionYears = Number(years) || 1;
    const monthlyRate = (Math.pow(1 + (Number(annualYield)/100), 1/12) - 1);
    
    let totalInvested = currentCapital;
    const points = [];

    // Ano 0 (Hoje)
    points.push({ ano: 0, patrimonio: currentCapital, investido: totalInvested });

    for (let y = 1; y <= projectionYears; y++) {
      for (let m = 1; m <= 12; m++) {
        currentCapital = (currentCapital + monthlyDeposit) * (1 + monthlyRate);
        totalInvested += monthlyDeposit;
      }
      points.push({ ano: y, patrimonio: currentCapital, investido: totalInvested });
    }

    const finalPatrimony = currentCapital;
    const finalPassiveMonthly = (finalPatrimony * (Number(dyYield)/100)) / 12;

    return { points, finalPatrimony, totalInvested, finalPassiveMonthly };
  }, [initialAmount, monthlyAmount, years, annualYield, dyYield]);

  return (
    <div style={{ paddingBottom: 48 }}>
      <div className="mb-8 anim-slide-up">
        <h1 className="page-title flex items-center gap-3">
          <Calculator size={28} style={{ color: 'var(--brand)' }} />
          Simulador de Aportes
        </h1>
        <p className="page-subtitle">Projete o futuro do seu patrimônio com a mágica dos juros compostos. (Apenas estimativa em memória)</p>
      </div>

      <div className="grid gap-6 anim-slide-up anim-d1" style={{ gridTemplateColumns: '320px 1fr', alignItems: 'start' }}>
        {/* Painel Esquerdo (Inputs) */}
        <div className="glass p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="fw-700 text-base flex items-center gap-2">
              <RefreshCw size={16} style={{ color: 'var(--brand)' }} /> Parâmetros
            </h2>
          </div>

          <div className="form-group mb-4">
            <label className="form-label text-xs uppercase" style={{ letterSpacing: '0.05em' }}>Patrimônio Inicial (R$)</label>
            <input type="number" step="any" className="input" value={initialAmount} onChange={e => setInitialAmount(e.target.value)} />
          </div>

          <div className="form-group mb-4">
            <label className="form-label text-xs uppercase" style={{ letterSpacing: '0.05em' }}>Aporte Mensal (R$)</label>
            <input type="number" step="any" className="input" value={monthlyAmount} onChange={e => setMonthlyAmount(e.target.value)} />
          </div>

          <div className="form-group mb-4">
            <label className="form-label text-xs uppercase" style={{ letterSpacing: '0.05em' }}>Prazo de Correção (Anos)</label>
            <input type="number" min="1" max="50" className="input" value={years} onChange={e => setYears(e.target.value)} />
          </div>

          <div className="divider" />

          <div className="form-group mb-4">
            <label className="form-label text-xs uppercase" style={{ letterSpacing: '0.05em' }}>Taxa de Rentabilidade (a.a %)</label>
            <input type="number" step="any" className="input" value={annualYield} onChange={e => setAnnualYield(e.target.value)} />
            <p className="text-xs text-muted mt-2">Valorização bruta e reinvestimento de cupons.</p>
            <div className="mt-2 text-xs p-2 rounded" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
               Sua Rentabilidade Absoluta Atual: <strong className={currentRentability >= 0 ? "text-profit" : "text-loss"}>{currentRentability.toFixed(2)}%</strong>
            </div>
          </div>

          <div className="form-group m-0">
            <label className="form-label text-xs uppercase" style={{ letterSpacing: '0.05em' }}>Previsão Dividend Yield (a.a %)</label>
            <input type="number" step="any" className="input" value={dyYield} onChange={e => setDyYield(e.target.value)} />
            <p className="text-xs text-muted mt-2">Sua expectativa de renda sobre o bolo total.</p>
            <div className="mt-2 text-xs p-2 rounded" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
               Seu DY (últimos 12 meses): <strong className="text-purple">{currentDY.toFixed(2)}%</strong>
            </div>
          </div>
        </div>

        {/* Painel Direito (Resultados) */}
        <div className="flex flex-col gap-6">
          <div className="grid grid-1 gap-4">
            <div className="glass metric-card card-accent-brand flex items-center justify-between" style={{ padding: '24px 30px' }}>
              <div>
                <p className="metric-label" style={{ marginBottom: 8 }}><TrendingUp size={15} /> Patrimônio Final Acumulado</p>
                <p className="metric-value font-mono" style={{ fontSize: '2rem' }}>{formatCurrency(simulation.finalPatrimony)}</p>
              </div>
            </div>
            <div className="glass metric-card card-accent-blue flex items-center justify-between" style={{ padding: '24px 30px' }}>
              <div>
                <p className="metric-label" style={{ marginBottom: 8 }}><PiggyBank size={15} /> Do Próprio Bolso (Aportado)</p>
                <p className="metric-value text-blue font-mono" style={{ fontSize: '2rem' }}>{formatCurrency(simulation.totalInvested)}</p>
              </div>
            </div>
            <div className="glass metric-card flex items-center justify-between" style={{ padding: '24px 30px', borderLeft: '4px solid var(--profit)' }}>
              <div>
                <p className="metric-label" style={{ marginBottom: 8 }}><TrendingUp size={15} /> Diferença (Patrimônio - Aportado)</p>
                <p className="metric-value text-profit font-mono" style={{ fontSize: '2rem' }}>{formatCurrency(simulation.finalPatrimony - simulation.totalInvested)}</p>
              </div>
            </div>
            <div className="glass metric-card card-accent-purple flex items-center justify-between" style={{ padding: '24px 30px' }}>
              <div>
                <p className="metric-label" style={{ marginBottom: 8 }}><Calculator size={15} /> Renda Passiva Estimada / Mês</p>
                <p className="metric-value text-purple font-mono" style={{ fontSize: '2rem' }}>{formatCurrency(simulation.finalPassiveMonthly)}</p>
              </div>
            </div>
          </div>

          <div className="glass p-6 flex-1">
            <h3 className="fw-700 text-base mb-6 flex items-center gap-2">
              <span style={{ color: 'var(--brand)' }}>◈</span> Evolução do Capital vs Aportes
            </h3>
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={simulation.points} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="ano" tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={v => `R$ ${(v/1000).toFixed(0)}k`} width={70} tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
                <Line type="monotone" name="Patrimônio" dataKey="patrimonio" stroke="var(--brand)" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                <Line type="monotone" name="Valor Investido" dataKey="investido" stroke="#4f8ef7" strokeWidth={2} dot={false} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
