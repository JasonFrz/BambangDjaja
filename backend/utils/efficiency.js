function calculateEfficiency(currentA, currentB, currentC) {
  
  const cosPhi = 1;
  const noLoadLoss = 150; 
  const capacity = 100; 
  const ratedCurrentLowVoltage = 144; 
  const fullLoadLoss = 1200; 

  const iA = parseFloat(currentA) || 0;
  const iB = parseFloat(currentB) || 0;
  const iC = parseFloat(currentC) || 0;
  const iAvg = (iA + iB + iC) / 3;

  const loadLoss = Math.pow(iAvg / ratedCurrentLowVoltage, 2) * fullLoadLoss;

  const inputPower = (capacity * cosPhi * 1000) + noLoadLoss + loadLoss;

  let result = (1 - (noLoadLoss + loadLoss) / inputPower) * 100;

  if (isNaN(result) || !isFinite(result)) result = 0;

  return Math.floor(result * 100) / 100;
}

module.exports = { calculateEfficiency };
