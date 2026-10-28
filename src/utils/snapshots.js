// utils/snapshots.js

/**
 * Sincroniza e registra os Snapshots (fotografias mensais do patrimônio).
 * Preenche lacunas de meses vazios com dados estimados (repetindo o último patrimônio)
 * para manter a continuidade do gráfico, conforme solicitado pela regra de negócio.
 * 
 * @param {Array} currentSnapshots - Lista atual salva em `investk_snapshots`
 * @param {Object} currentData - { totalInvested, patrimony, passiveIncome } (O passive income é o do mês atual)
 * @returns {Array} - Nova lista consolidada
 */
export const syncSnapshots = (currentSnapshots = [], currentData) => {
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const snaps = [...currentSnapshots].sort((a, b) => a.date.localeCompare(b.date));

  const newSnapshot = {
    id: `snap_${currentMonthStr}`,
    date: currentMonthStr,
    invested: currentData.totalInvested || 0,
    patrimony: currentData.patrimony || 0,
    passiveIncome: currentData.passiveIncome || 0,
    isEstimated: false
  };

  if (snaps.length === 0) {
    // Se a carteira estiver zerada, nem cria snapshot inicial (evita sujeira)
    if (newSnapshot.invested === 0 && newSnapshot.patrimony === 0) return [];
    return [newSnapshot];
  }

  const lastSnap = snaps[snaps.length - 1];
  
  if (lastSnap.date === currentMonthStr) {
    // Atualiza com o dado mais fresco do mês rotativo
    snaps[snaps.length - 1] = newSnapshot;
    return snaps;
  }
  
  if (lastSnap.date > currentMonthStr) {
    // Impedimento de viagem no tempo por alguma anomalia no relógio do SO do usuário
    return snaps;
  }

  const [lastYear, lastMonth] = lastSnap.date.split('-').map(Number);
  const [currYear, currMonth] = currentMonthStr.split('-').map(Number);
  
  let iterYear = lastYear;
  let iterMonth = lastMonth + 1;
  
  if (iterMonth > 12) {
    iterMonth = 1;
    iterYear++;
  }

  // Varredura de GAPs (Meses Inativos que o usuário não abriu o App)
  while (iterYear < currYear || (iterYear === currYear && iterMonth < currMonth)) {
    const gapDate = `${iterYear}-${String(iterMonth).padStart(2, '0')}`;
    snaps.push({
      id: `snap_${gapDate}`,
      date: gapDate,
      invested: lastSnap.invested,
      patrimony: lastSnap.patrimony, 
      passiveIncome: 0, // Como não abriu/não contabilizou, renda passiva isolada do mês fica 0 pro gráfico não mostrar repetição irreal
      isEstimated: true
    });
    
    iterMonth++;
    if (iterMonth > 12) {
      iterMonth = 1;
      iterYear++;
    }
  }

  // Insere o mês corrente fresco
  snaps.push(newSnapshot);
  return snaps;
};
