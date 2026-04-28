// Implements Sensitivity Analysis and Probabilistic Forecast generation

export interface DataPoint {
  value: number;
  timestamp: number;
}

export interface ConfidenceInterval {
  mean: number;
  lowerBound: number;
  upperBound: number;
  variance: number;
  confidenceLevel: number;
}

export class SensitivityAnalysis {
  /**
   * Calculates the mean and variance of a dataset to produce a 95% confidence interval.
   * Based on the normal distribution assumption (Z-score for 95% is ~1.96).
   */
  public calculateConfidenceInterval(data: DataPoint[]): ConfidenceInterval {
    if (data.length === 0) {
      throw new Error("Cannot calculate confidence interval on empty dataset");
    }

    if (data.length === 1) {
      return {
        mean: data[0].value,
        lowerBound: data[0].value,
        upperBound: data[0].value,
        variance: 0,
        confidenceLevel: 95
      };
    }

    const n = data.length;
    const mean = data.reduce((sum, d) => sum + d.value, 0) / n;

    const squaredDiffs = data.map(d => Math.pow(d.value - mean, 2));
    const variance = squaredDiffs.reduce((sum, sq) => sum + sq, 0) / (n - 1); // Sample variance
    
    const stdDev = Math.sqrt(variance);
    const standardError = stdDev / Math.sqrt(n);

    // 95% confidence interval Z-score is 1.96
    const zScore = 1.96;
    const marginOfError = zScore * standardError;

    return {
      mean,
      lowerBound: mean - marginOfError,
      upperBound: mean + marginOfError,
      variance,
      confidenceLevel: 95
    };
  }

  /**
   * Assess if the current data stream has high variance, triggering probabilistic mode.
   * Threshold can be tuned based on the parameter (e.g., density vs speed).
   */
  public isVarianceHigh(ci: ConfidenceInterval, threshold: number): boolean {
    return ci.variance > threshold;
  }
}
