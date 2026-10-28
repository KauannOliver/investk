import React, { useState, useEffect } from 'react';
import { Settings, AlertOctagon, Moon, Sun, Key, CheckCircle, Eye, EyeOff, Landmark, Bell } from 'lucide-react';
import { KEYS } from '../store/localStorage';
import { useStore } from '../store/StoreContext';
import { requestNotificationPermission } from '../utils/maturityNotifications';

export default function Configs() {
  const { fixedIncomeSettings, setFixedIncomeSettings } = useStore();
  const [token, setToken]         = useState('');
  const [saved, setSaved]         = useState(false);
  const [showToken, setShowToken] = useState(false);

  /* Carrega o token salvo ao montar */
  useEffect(() => {
    const stored = localStorage.getItem(KEYS.BRAPI_TOKEN) || '';
    setToken(stored);
  }, []);

  const handleSaveToken = () => {
    const trimmed = token.trim();
    if (trimmed) {
      localStorage.setItem(KEYS.BRAPI_TOKEN, trimmed);
    } else {
      localStorage.removeItem(KEYS.BRAPI_TOKEN);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleRemoveToken = () => {
    localStorage.removeItem(KEYS.BRAPI_TOKEN);
    setToken('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleWipe = () => {
    const confirm1 = window.confirm('Tem certeza? Esta ação apagará PERMANENTEMENTE todas as suas operações, proventos e configurações do InvestK neste navegador.');
    if (!confirm1) return;
    const input = window.prompt('Para confirmar, digite exatamente: APAGAR TUDO');
    if (input?.trim() !== 'APAGAR TUDO') { alert('Confirmação incorreta. Nenhum dado foi apagado.'); return; }
    [KEYS.OPS, KEYS.DIVIDENDS, KEYS.SETTINGS, KEYS.BRAPI_TOKEN, KEYS.SNAPSHOTS, KEYS.GOALS, KEYS.FIXED_INCOME, KEYS.FIXED_INCOME_SETTINGS, KEYS.FIXED_INCOME_SIMULATIONS, KEYS.FIXED_INCOME_NOTIFIED_MATURITIES].forEach(k => localStorage.removeItem(k));
    alert('Todos os dados foram apagados. O aplicativo será recarregado.');
    window.location.reload();
  };

  const hasToken = token.trim().length > 0;

  return (
    <div style={{ paddingBottom: 48 }}>
      {/* Header */}
      <div className="mb-8 anim-slide-up">
        <h1 className="page-title flex items-center gap-3">
          <Settings size={28} style={{ color: 'var(--brand)' }} />
          Configurações
        </h1>
        <p className="page-subtitle">Preferências e gerenciamento de dados locais.</p>
      </div>

      {/* ── Chave API Brapi ── */}
      <div className="glass p-6 mb-6 anim-slide-up anim-d1" style={{ borderColor: hasToken ? 'rgba(0,220,130,0.2)' : 'var(--border)' }}>
        <div className="flex items-center gap-3 mb-2">
          <Key size={18} style={{ color: hasToken ? 'var(--brand)' : 'var(--text-tertiary)' }} />
          <h2 className="fw-700 text-base">Token da API · brapi.dev</h2>
          {hasToken && (
            <span className="badge badge-profit" style={{ marginLeft: 'auto' }}>
              <CheckCircle size={10} /> Configurado
            </span>
          )}
        </div>

        <p className="text-sm text-muted mb-5" style={{ lineHeight: 1.7, maxWidth: 580 }}>
          Cole aqui o seu token pessoal da <strong style={{ color: 'var(--text-primary)' }}>brapi.dev</strong>.
          Quando preenchido, todas as requisições de cotação e dividendos usarão esse token — eliminando as limitações das cotas públicas.
          Se o campo ficar vazio, a aplicação continua funcionando com as cotas gratuitas anônimas.
        </p>

        {/* Input */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <input
            className="input"
            type={showToken ? 'text' : 'password'}
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="Cole o seu token aqui..."
            style={{ paddingRight: 44, fontFamily: hasToken && !showToken ? 'monospace' : 'inherit' }}
          />
          <button
            type="button"
            onClick={() => setShowToken(v => !v)}
            style={{
              position: 'absolute', right: 12, top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center',
            }}
          >
            {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSaveToken}
          >
            {saved ? <><CheckCircle size={13} /> Salvo!</> : 'Salvar Token'}
          </button>

          {hasToken && (
            <button className="btn btn-danger btn-sm" onClick={handleRemoveToken}>
              Remover Token
            </button>
          )}

          <a
            href="https://brapi.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
          >
            Obter token grátis →
          </a>
        </div>

        {hasToken && (
          <p className="text-xs text-muted mt-3" style={{ fontFamily: 'monospace', opacity: 0.6 }}>
            Token ativo: {token.slice(0, 6)}{'•'.repeat(Math.max(0, token.length - 6))}
          </p>
        )}
      </div>

      {/* App Info */}
      <div className="glass p-6 mb-6 anim-slide-up anim-d2">
        <h2 className="fw-700 text-base mb-4">Sobre o InvestK</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[
            ['Versão', '1.0.0'],
            ['Armazenamento', 'localStorage (local)'],
            ['Dados externos', 'brapi.dev (cotações e dividendos)'],
            ['Token da API', hasToken ? 'Configurado ✓' : 'Cotas públicas (sem token)'],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between" style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <span className="text-sm text-muted">{k}</span>
              <span className="text-sm fw-600" style={k === 'Token da API' ? { color: hasToken ? 'var(--profit)' : 'var(--text-tertiary)' } : {}}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Theme */}
      <div className="glass p-6 mb-6 anim-slide-up anim-d2">
        <h2 className="fw-700 text-base mb-3">Aparência</h2>
        <p className="text-sm text-muted mb-4">O InvestK utiliza tema escuro premium por padrão. Suporte a tema claro em breve.</p>
        <div className="flex gap-3">
          <button className="btn btn-primary btn-sm flex items-center gap-2"><Moon size={13}/> Dark (atual)</button>
          <button className="btn btn-secondary btn-sm flex items-center gap-2" disabled style={{ opacity: 0.4 }}><Sun size={13}/> Light</button>
        </div>
      </div>

      {/* Renda Fixa Settings */}
      <div className="glass p-6 mb-6 anim-slide-up anim-d2">
        <h2 className="fw-700 text-base mb-4 flex items-center gap-2">
          <Landmark size={18} style={{ color: 'var(--brand)' }} />
          Renda Fixa (Premissas e Alertas)
        </h2>
        
        <div className="grid grid-2 gap-4 mb-5">
          <div>
            <label className="text-sm fw-600 block mb-1">CDI Padrão para Simulações (% a.a.)</label>
            <input 
              type="number" step="0.01" className="input" 
              value={fixedIncomeSettings.defaultCdiAnnual}
              onChange={e => setFixedIncomeSettings({ ...fixedIncomeSettings, defaultCdiAnnual: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-sm fw-600 block mb-1">IPCA Padrão para Simulações (% a.a.)</label>
            <input 
              type="number" step="0.01" className="input" 
              value={fixedIncomeSettings.defaultIpcaAnnual}
              onChange={e => setFixedIncomeSettings({ ...fixedIncomeSettings, defaultIpcaAnnual: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-sm fw-600 block mb-1">Limite FGC por Emissor (R$)</label>
            <input 
              type="number" className="input" 
              value={fixedIncomeSettings.fgcLimitPerIssuer}
              onChange={e => setFixedIncomeSettings({ ...fixedIncomeSettings, fgcLimitPerIssuer: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            className={`btn ${fixedIncomeSettings.enableBrowserNotifications ? 'btn-primary' : 'btn-secondary'} btn-sm flex items-center gap-2`}
            onClick={async () => {
              const newState = !fixedIncomeSettings.enableBrowserNotifications;
              if (newState) {
                const granted = await requestNotificationPermission();
                if (!granted) {
                  alert('Permissão para notificações foi negada pelo navegador.');
                  return;
                }
              }
              setFixedIncomeSettings({ 
                ...fixedIncomeSettings, 
                enableBrowserNotifications: newState,
                notificationPermissionAsked: true
              });
            }}
          >
            <Bell size={14} />
            {fixedIncomeSettings.enableBrowserNotifications ? 'Notificações Ativadas' : 'Ativar Notificações'}
          </button>
        </div>
        <p className="text-xs text-muted mt-3" style={{ lineHeight: 1.5 }}>
          Se ativado, o navegador/PWA emitirá notificações para: vencimentos de CDB (1 dia antes e no dia), 
          e proventos possivelmente atrasados (baseado no histórico de pagamentos dos seus ativos).
        </p>
      </div>

      {/* Danger Zone */}
      <div className="glass p-6 anim-slide-up anim-d3" style={{ borderColor: 'rgba(255,77,109,0.25)', background: 'rgba(255,77,109,0.03)' }}>
        <div className="flex items-center gap-3 mb-3">
          <AlertOctagon size={18} style={{ color: 'var(--loss)', flexShrink: 0 }} />
          <h2 className="fw-700 text-base" style={{ color: 'var(--loss)' }}>Zona de Perigo</h2>
        </div>
        <p className="text-sm text-muted mb-5" style={{ lineHeight: 1.7 }}>
          As ações abaixo são <strong style={{ color: 'var(--text-primary)' }}>irreversíveis</strong>.
          Certifique-se de ter um backup exportado antes de prosseguir.
          Seus dados não poderão ser recuperados após a exclusão.
        </p>
        <button onClick={handleWipe} className="btn btn-danger">
          <AlertOctagon size={14}/> Apagar Todos os Dados
        </button>
      </div>
    </div>
  );
}
