import React from 'react';
import { DownloadCloud, UploadCloud, Shield, AlertTriangle } from 'lucide-react';
import { KEYS } from '../store/localStorage';

export default function SyncAndBackup() {
  const handleExport = () => {
    try {
      const ops = JSON.parse(window.localStorage.getItem(KEYS.OPS) || '[]');
      const divs = JSON.parse(window.localStorage.getItem(KEYS.DIVIDENDS) || '[]');
      const settings = JSON.parse(window.localStorage.getItem(KEYS.SETTINGS) || '{}');
      const snaps = JSON.parse(window.localStorage.getItem(KEYS.SNAPSHOTS) || '[]');
      const goals = JSON.parse(window.localStorage.getItem(KEYS.GOALS) || '{}');
      const token = window.localStorage.getItem(KEYS.BRAPI_TOKEN) || '';
      const fixedIncome = JSON.parse(window.localStorage.getItem(KEYS.FIXED_INCOME) || '[]');
      const fixedIncomeSettings = JSON.parse(window.localStorage.getItem(KEYS.FIXED_INCOME_SETTINGS) || '{}');
      const fixedIncomeSimulations = JSON.parse(window.localStorage.getItem(KEYS.FIXED_INCOME_SIMULATIONS) || '[]');

      // Track backup date
      settings.lastBackupDate = new Date().toISOString();
      window.localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));

      const payload = {
        app: 'InvestK',
        version: '2.0',
        exportedAt: new Date().toISOString(),
        data: {
          operations: ops,
          dividends: divs,
          settings: settings,
          snapshots: snaps,
          goals: goals,
          token: token,
          fixedIncome,
          fixedIncomeSettings,
          fixedIncomeSimulations
        }
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `investk_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { alert('Erro ao exportar backup.'); }
  };

  const handleImport = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsedData = JSON.parse(ev.target.result);
        
        // Strict Validation Schema
        if (parsedData.app !== 'InvestK' || !parsedData.version || !parsedData.data) {
          throw new Error('Arquivo de backup inválido ou sem assinatura do InvestK.');
        }

        const { operations, dividends, settings, snapshots, goals, token, fixedIncome, fixedIncomeSettings, fixedIncomeSimulations } = parsedData.data;

        // Validating types
        if (!Array.isArray(operations) || !Array.isArray(dividends) || typeof settings !== 'object') {
          throw new Error('Estrutura de dados inválida no backup.');
        }
        
        if (!window.confirm('CUIDADO: Restaurar este backup substituirá COMPLETAMENTE seus dados atuais! Deseja mesmo continuar?')) return;
        
        localStorage.setItem(KEYS.OPS, JSON.stringify(operations));
        localStorage.setItem(KEYS.DIVIDENDS, JSON.stringify(dividends));
        localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
        if (snapshots) localStorage.setItem(KEYS.SNAPSHOTS, JSON.stringify(snapshots));
        if (goals) localStorage.setItem(KEYS.GOALS, JSON.stringify(goals));
        if (token) localStorage.setItem(KEYS.BRAPI_TOKEN, token);
        if (fixedIncome) localStorage.setItem(KEYS.FIXED_INCOME, JSON.stringify(fixedIncome));
        if (fixedIncomeSettings) localStorage.setItem(KEYS.FIXED_INCOME_SETTINGS, JSON.stringify(fixedIncomeSettings));
        if (fixedIncomeSimulations) localStorage.setItem(KEYS.FIXED_INCOME_SIMULATIONS, JSON.stringify(fixedIncomeSimulations));
        
        alert('Backup restaurado com sucesso! O app será recarregado.');
        window.location.reload();
      } catch (err) {
        console.error(err);
        alert('Falha ao importar: O arquivo está corrompido, tem estrutura inválida ou não é um backup oficial do InvestK.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div style={{ paddingBottom: 48 }}>
      {/* Header */}
      <div className="mb-8 anim-slide-up">
        <h1 className="page-title">Segurança dos Dados</h1>
        <p className="page-subtitle">Backup e restauração completa do seu portfólio pessoal.</p>
      </div>

      {/* Action cards */}
      <div className="grid grid-2 gap-6 mb-8 anim-slide-up anim-d1">
        {/* Export */}
        <div className="glass glass-interactive p-8 text-center" style={{ cursor: 'pointer' }} onClick={handleExport}>
          <div style={{
            width: 72, height: 72, margin: '0 auto 20px',
            borderRadius: 20, background: 'linear-gradient(135deg, rgba(0,220,130,0.15), rgba(0,220,130,0.06))',
            border: '1px solid rgba(0,220,130,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <DownloadCloud size={30} style={{ color: 'var(--brand)' }} />
          </div>
          <h2 className="fw-700 text-lg mb-2">Exportar Backup</h2>
          <p className="text-sm text-muted mb-6" style={{ lineHeight: 1.6 }}>
            Salva todas as suas operações, proventos, <strong style={{ color: 'var(--brand)' }}>renda fixa</strong> e configurações em um arquivo <strong style={{ color: 'var(--text-primary)' }}>.json</strong> no seu dispositivo.<br/>
            <span style={{ fontSize: '0.85em', color: 'var(--text-tertiary)', display: 'block', marginTop: 8 }}>Antes de grandes atualizações ou troca de dispositivo, baixe um backup completo.</span>
          </p>
          <div className="flex gap-2 justify-center">
            <div className="btn btn-primary" onClick={handleExport}>
              <DownloadCloud size={16} /> Baixar Backup
            </div>
            <div className="btn btn-secondary" onClick={handleExport} title="Baixar um arquivo de backup completo antes de uma atualização ou deploy.">
              Pré-Deploy
            </div>
          </div>
        </div>

        {/* Import */}
        <div className="glass glass-interactive p-8 text-center" style={{ position: 'relative' }}>
          <div style={{
            width: 72, height: 72, margin: '0 auto 20px',
            borderRadius: 20, background: 'linear-gradient(135deg, rgba(79,142,247,0.15), rgba(79,142,247,0.06))',
            border: '1px solid rgba(79,142,247,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <UploadCloud size={30} style={{ color: 'var(--accent-blue)' }} />
          </div>
          <h2 className="fw-700 text-lg mb-2">Restaurar Backup</h2>
          <p className="text-sm text-muted mb-6" style={{ lineHeight: 1.6 }}>
            Carrega um arquivo de backup e <strong style={{ color: 'var(--loss)' }}>substituirá completamente</strong> os dados atuais do navegador.
          </p>
          <input type="file" id="import-file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
          <label htmlFor="import-file" className="btn btn-secondary btn-w-full" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <UploadCloud size={16} /> Selecionar Arquivo
          </label>
        </div>
      </div>

      {/* Info boxes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} className="anim-slide-up anim-d2">
        <div className="notice notice-success">
          <Shield size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong style={{ display: 'block', marginBottom: 4 }}>Privacidade Local</strong>
            Os registros do usuário ficam salvos localmente no seu navegador, no entanto, dados públicos de mercado podem ser buscados em APIs externas na nuvem.
          </div>
        </div>

        <div className="notice notice-warning">
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong style={{ display: 'block', marginBottom: 4 }}>Atenção ao limpar o navegador</strong>
            Se você limpar o histórico/cache do Google Chrome, Safari ou Firefox, <strong>seus dados serão apagados permanentemente</strong>. 
            Faça backups regulares e guarde o arquivo em local seguro (Drive, e-mail pessoal, etc.).
          </div>
        </div>
      </div>
    </div>
  );
}
