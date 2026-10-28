// store/StoreContext.jsx
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { getFromStore, saveToStore, KEYS } from './localStorage';
import { recalculatePortfolio } from '../utils/calculations';

const StoreContext = createContext();

export const useStore = () => useContext(StoreContext);

export const StoreProvider = ({ children }) => {
  const [operations, setOperations] = useState([]);
  const [dividends, setDividends] = useState([]);
  const [settings, setSettings] = useState({});
  const [snapshots, setSnapshots] = useState([]);
  const [goals, setGoals] = useState({ FII: 0, Ações: 0, 'Renda Fixa': 0 });

  const defaultFixedIncomeSettings = {
    defaultCdiAnnual: 10.5,
    defaultIpcaAnnual: 4.5,
    maturityAlertDays: [30, 7, 1, 0],
    enableBrowserNotifications: false,
    notificationPermissionAsked: false,
    fgcLimitPerIssuer: 250000,
    fgcGlobalLimit: 1000000
  };

  const [fixedIncome, setFixedIncome] = useState([]);
  const [fixedIncomeSettings, setFixedIncomeSettings] = useState(defaultFixedIncomeSettings);
  const [fixedIncomeSimulations, setFixedIncomeSimulations] = useState([]);

  const [isLoaded, setIsLoaded] = useState(false);

  // Carregar ao iniciar
  useEffect(() => {
    setOperations(getFromStore(KEYS.OPS, []));
    setDividends(getFromStore(KEYS.DIVIDENDS, []));
    setSettings(getFromStore(KEYS.SETTINGS, { theme: 'dark' }));
    setSnapshots(getFromStore(KEYS.SNAPSHOTS, []));
    setGoals(getFromStore(KEYS.GOALS, { FII: 0, Ações: 0, 'Renda Fixa': 0 }));
    setFixedIncome(getFromStore(KEYS.FIXED_INCOME, []));
    setFixedIncomeSettings({
      ...defaultFixedIncomeSettings,
      ...getFromStore(KEYS.FIXED_INCOME_SETTINGS, {})
    });
    setFixedIncomeSimulations(getFromStore(KEYS.FIXED_INCOME_SIMULATIONS, []));
    setIsLoaded(true);
  }, []);

  // Sync no LocalStorage em cada mudança
  useEffect(() => { if (isLoaded) saveToStore(KEYS.OPS, operations); }, [operations, isLoaded]);
  useEffect(() => { if (isLoaded) saveToStore(KEYS.DIVIDENDS, dividends); }, [dividends, isLoaded]);
  useEffect(() => { if (isLoaded) saveToStore(KEYS.SETTINGS, settings); }, [settings, isLoaded]);
  useEffect(() => { if (isLoaded) saveToStore(KEYS.SNAPSHOTS, snapshots); }, [snapshots, isLoaded]);
  useEffect(() => { if (isLoaded) saveToStore(KEYS.GOALS, goals); }, [goals, isLoaded]);
  useEffect(() => { if (isLoaded) saveToStore(KEYS.FIXED_INCOME, fixedIncome); }, [fixedIncome, isLoaded]);
  useEffect(() => { if (isLoaded) saveToStore(KEYS.FIXED_INCOME_SETTINGS, fixedIncomeSettings); }, [fixedIncomeSettings, isLoaded]);
  useEffect(() => { if (isLoaded) saveToStore(KEYS.FIXED_INCOME_SIMULATIONS, fixedIncomeSimulations); }, [fixedIncomeSimulations, isLoaded]);

  // Recálculo automático da carteira toda vez que `operations` mudar
  const portfolioState = useMemo(() => {
    return recalculatePortfolio(operations);
  }, [operations]);

  const value = {
    operations, setOperations,
    dividends, setDividends,
    settings, setSettings,
    snapshots, setSnapshots,
    goals, setGoals,
    fixedIncome, setFixedIncome,
    fixedIncomeSettings, setFixedIncomeSettings,
    fixedIncomeSimulations, setFixedIncomeSimulations,
    portfolioState, // { positions, allPositions, salesResult }
  };

  if (!isLoaded) return null;

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  );
};
