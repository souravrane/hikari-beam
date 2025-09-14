/**
 * Holt's Linear Trend (Double Exponential) Smoothing for ETA prediction
 * Tracks both level and trend components to predict future throughput
 */

export interface HoltState {
  level: number;
  trend: number;
  initialized: boolean;
  updateCount: number;
}

export interface HoltConfig {
  alpha: number; // Level smoothing parameter (0-1)
  beta: number;  // Trend smoothing parameter (0-1)
}

export class Holt {
  private state: HoltState;
  private config: HoltConfig;
  private residuals: number[];
  private readonly maxResiduals = 60; // Keep last 60 residuals for uncertainty

  constructor(config: Partial<HoltConfig> = {}) {
    this.config = {
      alpha: config.alpha ?? 0.5,
      beta: config.beta ?? 0.3,
    };

    this.state = {
      level: 0,
      trend: 0,
      initialized: false,
      updateCount: 0,
    };

    this.residuals = [];
  }

  /**
   * Update the Holt model with new observation
   * @param value New throughput observation (bytes/second)
   */
  update(value: number): void {
    if (!this.state.initialized) {
      // Initialize with first observation
      this.state.level = value;
      this.state.trend = 0;
      this.state.initialized = true;
    } else {
      // Calculate forecast from previous state (for residual)
      const forecast = this.state.level + this.state.trend;
      const residual = value - forecast;
      
      // Store residual for uncertainty estimation
      this.residuals.push(residual);
      if (this.residuals.length > this.maxResiduals) {
        this.residuals.shift();
      }

      // Update level and trend
      const prevLevel = this.state.level;
      this.state.level = this.config.alpha * value + (1 - this.config.alpha) * (this.state.level + this.state.trend);
      this.state.trend = this.config.beta * (this.state.level - prevLevel) + (1 - this.config.beta) * this.state.trend;
    }

    this.state.updateCount++;
  }

  /**
   * Forecast k steps ahead
   * @param steps Number of steps (seconds) into the future
   * @returns Forecasted value
   */
  forecast(steps: number = 1): number {
    if (!this.state.initialized) {
      return 0;
    }
    return Math.max(0, this.state.level + steps * this.state.trend);
  }

  /**
   * Get prediction confidence bounds using residual standard deviation
   * @param steps Number of steps ahead
   * @returns {low, high} bounds for the forecast
   */
  getForecastBounds(steps: number = 1): { low: number; high: number } {
    const forecast = this.forecast(steps);
    
    if (this.residuals.length < 3) {
      // Not enough data for confidence bounds
      return { low: forecast * 0.8, high: forecast * 1.2 };
    }

    // Calculate standard deviation of residuals
    const mean = this.residuals.reduce((sum, r) => sum + r, 0) / this.residuals.length;
    const variance = this.residuals.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (this.residuals.length - 1);
    const stdDev = Math.sqrt(variance);

    // 1.96 * stdDev gives roughly 95% confidence interval
    const margin = 1.96 * stdDev * Math.sqrt(1 + steps * 0.1); // Slight increase with forecast horizon

    return {
      low: Math.max(0, forecast - margin),
      high: forecast + margin
    };
  }

  /**
   * Check if model is stable (has enough updates to be reliable)
   */
  isStable(): boolean {
    return this.state.updateCount >= 3;
  }

  /**
   * Reset the model state
   */
  reset(): void {
    this.state = {
      level: 0,
      trend: 0,
      initialized: false,
      updateCount: 0,
    };
    this.residuals = [];
  }

  /**
   * Get current model state for debugging
   */
  getState(): HoltState & { residualCount: number; lastResidualStdDev: number } {
    let stdDev = 0;
    if (this.residuals.length > 1) {
      const mean = this.residuals.reduce((sum, r) => sum + r, 0) / this.residuals.length;
      const variance = this.residuals.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (this.residuals.length - 1);
      stdDev = Math.sqrt(variance);
    }

    return {
      ...this.state,
      residualCount: this.residuals.length,
      lastResidualStdDev: stdDev
    };
  }
}

/**
 * Utility functions for ETA formatting
 */
export class ETAFormatter {
  /**
   * Format seconds into human readable ETA
   * @param seconds Seconds remaining
   * @returns Formatted string (mm:ss or hh:mm:ss)
   */
  static formatETA(seconds: number): string {
    if (seconds <= 0 || !isFinite(seconds)) {
      return "--:--";
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  }

  /**
   * Format ETA with uncertainty bounds
   * @param etaLow Low estimate (seconds)
   * @param etaHigh High estimate (seconds)
   * @returns Formatted range string
   */
  static formatETARange(etaLow: number, etaHigh: number): string {
    const lowStr = ETAFormatter.formatETA(etaLow);
    const highStr = ETAFormatter.formatETA(etaHigh);
    return `${lowStr} - ${highStr}`;
  }
}