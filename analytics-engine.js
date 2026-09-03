/**
 * Zetamac Analytics Engine
 * - 34-bin Log-Spaced Histograms (0.25s - 20s + under/overflow)
 * - Matched Time-Window Baseline Pooling
 * - Iglewicz-Hoaglin Outlier Filter on Log Scale (with MAD=0 guard)
 * - Log-scale Confidence Intervals (90% CI on geometric mean)
 * - Monotonic PB Timeline Derivation
 * - Canonical JSON Stringifier
 */

(() => {
  'use strict';

  // --- Binning Configuration ---
  const MIN_TIME = 0.25; // 250ms
  const MAX_TIME = 20.0; // 20000ms
  const NUM_EXPONENTIAL_BINS = 32;
  const RATIO = Math.pow(MAX_TIME / MIN_TIME, 1 / NUM_EXPONENTIAL_BINS);
  const TOTAL_BINS = NUM_EXPONENTIAL_BINS + 2; // 0: underflow, 1..32: standard, 33: overflow

  // Pre-calculate bin cutoffs and log midpoints
  const BIN_EDGES = [0];
  for (let i = 0; i <= NUM_EXPONENTIAL_BINS; i++) {
    BIN_EDGES.push(MIN_TIME * Math.pow(RATIO, i));
  }
  // BIN_EDGES has length NUM_EXPONENTIAL_BINS + 2:
  // [0, 0.25, 0.25*r, ..., 20.0]

  const BIN_MIDPOINTS = [];
  const BIN_LOG_MIDPOINTS = [];
  for (let i = 0; i < TOTAL_BINS; i++) {
    let mid;
    if (i === 0) {
      mid = MIN_TIME * 0.8; // underflow representative
    } else if (i === TOTAL_BINS - 1) {
      mid = MAX_TIME * 1.25; // overflow representative
    } else {
      mid = MIN_TIME * Math.pow(RATIO, i - 0.5);
    }
    BIN_MIDPOINTS.push(mid);
    BIN_LOG_MIDPOINTS.push(Math.log(mid));
  }

  function getBinIndex(timeSeconds) {
    if (timeSeconds < MIN_TIME) return 0;
    if (timeSeconds >= MAX_TIME) return TOTAL_BINS - 1;
    const idx = 1 + Math.floor(Math.log(timeSeconds / MIN_TIME) / Math.log(RATIO));
    return Math.min(Math.max(1, idx), NUM_EXPONENTIAL_BINS);
  }

  // --- Canonical JSON Serialization ---
  function canonicalStringify(obj) {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return '[' + obj.map(canonicalStringify).join(',') + ']';
    }
    const keys = Object.keys(obj).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalStringify(obj[k])).join(',') + '}';
  }

  // --- Monotonic Personal Best Timeline ---
  function derivePbTimeline(mergedPbs) {
    if (!Array.isArray(mergedPbs)) return [];
    let max = 0;
    return mergedPbs
      .slice()
      .sort((a, b) => a.timestamp - b.timestamp)
      .filter((pb) => {
        if (pb && typeof pb.score === 'number' && pb.score > max) {
          max = pb.score;
          return true;
        }
        return false;
      });
  }

  // --- Sparse Histogram Utilities ---
  function trimTrailingZeros(bins) {
    if (!Array.isArray(bins)) return [];
    let lastNonZero = -1;
    for (let i = bins.length - 1; i >= 0; i--) {
      if (bins[i] && bins[i] > 0) {
        lastNonZero = i;
        break;
      }
    }
    return lastNonZero === -1 ? [] : bins.slice(0, lastNonZero + 1);
  }

  function expandBins(sparseBins) {
    const bins = new Array(TOTAL_BINS).fill(0);
    if (!Array.isArray(sparseBins)) return bins;
    for (let i = 0; i < Math.min(sparseBins.length, TOTAL_BINS); i++) {
      bins[i] = sparseBins[i] || 0;
    }
    return bins;
  }

  // --- CRDT Histogram Merge ---
  // agg schema: { [deviceId]: { [month]: { [cell]: [sparseBins] } } }
  function mergeAggregates(remoteAgg = {}, localAgg = {}) {
    const merged = {};
    const allDevices = new Set([...Object.keys(remoteAgg || {}), ...Object.keys(localAgg || {})]);

    for (const devId of allDevices) {
      merged[devId] = {};
      const devRemote = (remoteAgg && remoteAgg[devId]) || {};
      const devLocal = (localAgg && localAgg[devId]) || {};
      const allMonths = new Set([...Object.keys(devRemote), ...Object.keys(devLocal)]);

      for (const month of allMonths) {
        merged[devId][month] = {};
        const mRemote = devRemote[month] || {};
        const mLocal = devLocal[month] || {};
        const allCells = new Set([...Object.keys(mRemote), ...Object.keys(mLocal)]);

        for (const cell of allCells) {
          const rBins = expandBins(mRemote[cell]);
          const lBins = expandBins(mLocal[cell]);
          const rCount = rBins.reduce((a, b) => a + b, 0);
          const lCount = lBins.reduce((a, b) => a + b, 0);

          // For the same device, take the version with higher count (G-Counter monotonicity)
          const winningBins = rCount >= lCount ? rBins : lBins;
          const trimmed = trimTrailingZeros(winningBins);
          if (trimmed.length > 0) {
            merged[devId][month][cell] = trimmed;
          }
        }
      }
    }
    return merged;
  }

  // --- Rollup Old Months (older than 12 months) ---
  function rollupOldMonths(agg, currentYearMonth) {
    if (!agg || typeof agg !== 'object') return {};
    const [currY, currM] = currentYearMonth.split('-').map(Number);
    const currTotalMonths = currY * 12 + currM;

    const rolled = {};
    for (const devId of Object.keys(agg)) {
      rolled[devId] = {};
      for (const monthKey of Object.keys(agg[devId])) {
        if (monthKey.startsWith('pre-')) {
          rolled[devId][monthKey] = agg[devId][monthKey];
          continue;
        }
        const [y, m] = monthKey.split('-').map(Number);
        const totalM = y * 12 + m;
        if (currTotalMonths - totalM > 12) {
          const preKey = `pre-${y}`;
          if (!rolled[devId][preKey]) rolled[devId][preKey] = {};
          for (const cell of Object.keys(agg[devId][monthKey])) {
            const existing = expandBins(rolled[devId][preKey][cell]);
            const incoming = expandBins(agg[devId][monthKey][cell]);
            for (let b = 0; b < TOTAL_BINS; b++) {
              existing[b] += incoming[b];
            }
            rolled[devId][preKey][cell] = trimTrailingZeros(existing);
          }
        } else {
          rolled[devId][monthKey] = agg[devId][monthKey];
        }
      }
    }
    return rolled;
  }

  // --- Matched Window Pooling ---
  function getLastNMonths(n = 2) {
    const months = [];
    const now = new Date();
    for (let i = 0; i < n; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      months.push(`${y}-${m}`);
    }
    return months;
  }

  function poolHistograms(agg, cellKey, windowMonths) {
    const pooled = new Array(TOTAL_BINS).fill(0);
    if (!agg) return pooled;

    for (const devId of Object.keys(agg)) {
      for (const month of windowMonths) {
        const cellData = agg[devId]?.[month]?.[cellKey];
        if (cellData) {
          const bins = expandBins(cellData);
          for (let i = 0; i < TOTAL_BINS; i++) {
            pooled[i] += bins[i];
          }
        }
      }
    }
    return pooled;
  }

  // --- Histogram Statistics on Log Scale ---
  function computeHistogramStats(bins) {
    const totalN = bins.reduce((a, b) => a + b, 0);
    if (totalN === 0) return null;

    // Weighted mean and variance of ln(t)
    let sumLog = 0;
    for (let i = 0; i < TOTAL_BINS; i++) {
      sumLog += bins[i] * BIN_LOG_MIDPOINTS[i];
    }
    const meanLog = sumLog / totalN;

    let sumSqDiff = 0;
    for (let i = 0; i < TOTAL_BINS; i++) {
      const diff = BIN_LOG_MIDPOINTS[i] - meanLog;
      sumSqDiff += bins[i] * diff * diff;
    }
    const varLog = totalN > 1 ? sumSqDiff / (totalN - 1) : 0;
    const seLog = Math.sqrt(varLog / totalN);

    // Geometric mean (equivalent to median for log-normal)
    const geoMean = Math.exp(meanLog);
    const ci90Lower = Math.exp(meanLog - 1.645 * seLog);
    const ci90Upper = Math.exp(meanLog + 1.645 * seLog);

    return {
      n: totalN,
      geoMean,
      meanLog,
      seLog,
      ci90Lower,
      ci90Upper
    };
  }

  // --- Iglewicz-Hoaglin Outlier Filter on Log Scale ---
  function filterOutliersIglewiczHoaglin(times, opMedian) {
    if (!times || times.length < 4) return { clean: times, outliers: [] };

    // Standardize by operation median
    const baseMed = opMedian > 0 ? opMedian : 1.5;
    const y = times.map(t => Math.log(Math.max(0.1, t) / baseMed));

    // Median of y
    const sortedY = y.slice().sort((a, b) => a - b);
    const medY = sortedY[Math.floor(sortedY.length / 2)];

    // Median Absolute Deviation (MAD)
    const absDiffs = y.map(v => Math.abs(v - medY)).sort((a, b) => a - b);
    let mad = absDiffs[Math.floor(absDiffs.length / 2)];

    // Guard MAD === 0: Fallback to scaled interquartile dispersion (IQR / 1.349)
    if (mad < 1e-6) {
      const q1 = sortedY[Math.floor(sortedY.length * 0.25)];
      const q3 = sortedY[Math.floor(sortedY.length * 0.75)];
      const iqr = q3 - q1;
      mad = iqr > 1e-6 ? iqr / 1.349 : 0.2; // robust minimum floor
    }

    const clean = [];
    const outliers = [];

    for (let i = 0; i < times.length; i++) {
      const modifiedZ = (0.6745 * Math.abs(y[i] - medY)) / mad;
      if (modifiedZ >= 3.5 || times[i] >= 15.0) {
        outliers.push(times[i]);
      } else {
        clean.push(times[i]);
      }
    }

    return { clean, outliers };
  }

  // --- Cell Identification Helper ---
  function getCellKey(opIndex, a, b) {
    // 0: +, 1: -, 2: *, 3: /
    if (opIndex === 2) { // Multiplication
      const factor = Math.min(a, b);
      if (factor >= 2 && factor <= 12) return `*|${factor}`;
      return `*|other`;
    }
    if (opIndex === 3) { // Division
      // a is dividend, b is divisor, prompt is a / b = ans
      const divisor = b;
      if (divisor >= 2 && divisor <= 12) return `/|${divisor}`;
      return `/|other`;
    }
    if (opIndex === 0) { // Addition
      // Detect carry in ones column
      const carry = (a % 10) + (b % 10) >= 10 || (a + b) >= 100;
      return carry ? `+|carry` : `+|nocarry`;
    }
    if (opIndex === 1) { // Subtraction
      // Detect borrow in ones column
      const borrow = (a % 10) < (b % 10);
      return borrow ? `-|borrow` : `-|noborrow`;
    }
    return `unknown`;
  }

  function getOpName(opIndex) {
    return ['+', '-', '*', '/'][opIndex] || '+';
  }

  // --- Weakness Analysis Diagnosis Generator ---
  function analyzeWeaknesses(agg, monthsWindow = getLastNMonths(2)) {
    const report = {
      windowMonths: monthsWindow,
      totalProblemsInWindow: 0,
      opBaselines: {},
      weaknesses: [],
      strengths: [],
      collectingData: []
    };

    const opKeys = ['+', '-', '*', '/'];

    // 1. Calculate Baselines for each operation from matched window
    opKeys.forEach((op) => {
      const opHist = poolHistograms(agg, `${op}|total`, monthsWindow);
      const stats = computeHistogramStats(opHist);
      if (stats && stats.n > 0) {
        report.opBaselines[op] = stats;
        report.totalProblemsInWindow += stats.n;
      }
    });

    if (report.totalProblemsInWindow === 0) {
      return report;
    }

    // 2. Evaluate Factor & Feature Cells
    const candidateCells = [];

    // Multiplication Factors 2 - 12
    for (let f = 2; f <= 12; f++) {
      candidateCells.push({ key: `*|${f}`, op: '*', label: `×${f} Tables` });
    }
    // Division Divisors 2 - 12
    for (let d = 2; d <= 12; d++) {
      candidateCells.push({ key: `/|${d}`, op: '/', label: `÷${d} Division` });
    }
    // Addition Carries
    candidateCells.push({ key: `+|carry`, op: '+', label: `Addition (with Carry)` });
    candidateCells.push({ key: `+|nocarry`, op: '+', label: `Addition (no Carry)` });
    // Subtraction Borrows
    candidateCells.push({ key: `-|borrow`, op: '-', label: `Subtraction (with Borrow)` });
    candidateCells.push({ key: `-|noborrow`, op: '-', label: `Subtraction (no Borrow)` });

    for (const cand of candidateCells) {
      const cellHist = poolHistograms(agg, cand.key, monthsWindow);
      const stats = computeHistogramStats(cellHist);
      const baseStats = report.opBaselines[cand.op];

      if (!stats || stats.n < 20) {
        report.collectingData.push({
          label: cand.label,
          key: cand.key,
          n: stats ? stats.n : 0,
          required: 20
        });
        continue;
      }

      if (!baseStats || baseStats.n < 20) continue;

      const deltaPercent = Math.round(((stats.geoMean - baseStats.geoMean) / baseStats.geoMean) * 100);
      const ciLowerPercent = Math.round(((stats.ci90Lower - baseStats.geoMean) / baseStats.geoMean) * 100);
      const ciUpperPercent = Math.round(((stats.ci90Upper - baseStats.geoMean) / baseStats.geoMean) * 100);

      // Uncertainty Gating: Only flag weakness if lower bound of 90% CI is >= +15% over baseline
      const isWeakness = stats.ci90Lower >= baseStats.geoMean * 1.15;
      const isStrength = stats.ci90Upper <= baseStats.geoMean * 0.88;

      const item = {
        key: cand.key,
        label: cand.label,
        op: cand.op,
        n: stats.n,
        geoMean: stats.geoMean.toFixed(2),
        baseGeoMean: baseStats.geoMean.toFixed(2),
        deltaPercent: deltaPercent > 0 ? `+${deltaPercent}%` : `${deltaPercent}%`,
        ciLowerPercent: ciLowerPercent > 0 ? `+${ciLowerPercent}%` : `${ciLowerPercent}%`,
        ciUpperPercent: ciUpperPercent > 0 ? `+${ciUpperPercent}%` : `${ciUpperPercent}%`,
        isWeakness,
        isStrength,
        rawRatio: stats.geoMean / baseStats.geoMean
      };

      if (isWeakness) {
        report.weaknesses.push(item);
      } else if (isStrength) {
        report.strengths.push(item);
      }
    }

    // Sort weaknesses descending by severity
    report.weaknesses.sort((a, b) => b.rawRatio - a.rawRatio);
    report.strengths.sort((a, b) => a.rawRatio - b.rawRatio);

    return report;
  }

  // Export module
  window.ZetamacAnalytics = {
    TOTAL_BINS,
    getBinIndex,
    canonicalStringify,
    derivePbTimeline,
    mergeAggregates,
    rollupOldMonths,
    getLastNMonths,
    poolHistograms,
    computeHistogramStats,
    filterOutliersIglewiczHoaglin,
    getCellKey,
    getOpName,
    analyzeWeaknesses
  };

})();
