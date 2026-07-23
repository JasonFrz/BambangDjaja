function calculateEfficiency(currentA, currentB, currentC) {
  // Constant data from user's provided specification (Photo 2)
  const cosPhi = 1;
  const noLoadLoss = 150; // W
  const capacity = 100; // kVA
  const ratedCurrentLowVoltage = 144; // A
  const fullLoadLoss = 1200; // W

  // Parse currents safely
  const iA = parseFloat(currentA) || 0;
  const iB = parseFloat(currentB) || 0;
  const iC = parseFloat(currentC) || 0;
  const iAvg = (iA + iB + iC) / 3;

  // loadLoss formula: (Iavg / Irated)^2 * fullLoadLoss
  // (Using the squared load fraction as per standard electrical engineering efficiency calculations)
  const loadLoss = Math.pow(iAvg / ratedCurrentLowVoltage, 2) * fullLoadLoss;

  // inputPower = (capacity * cosPhi * 1000) + noLoadLoss + loadLoss
  const inputPower = (capacity * cosPhi * 1000) + noLoadLoss + loadLoss;
  
  // result = (1 - (noLoadLoss + loadLoss) / inputPower) * 100
  let result = (1 - (noLoadLoss + loadLoss) / inputPower) * 100;

  // Prevent NaN or Infinity if inputPower is 0 somehow (though it won't be since capacity=100k)
  if (isNaN(result) || !isFinite(result)) result = 0;

  // Return Math.floor(result * 100) / 100
  return Math.floor(result * 100) / 100;
}

module.exports = { calculateEfficiency };
