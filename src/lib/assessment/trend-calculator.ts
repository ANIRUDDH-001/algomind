import {  } from '@/types/assessment';

export interface TrendAnalysis {
    trend: 'improving' | 'stable' | 'declining';
    change: number; // percentage change
    confidence: number;
}

/**
 * Calculates a trend based on a series of scores using simple linear regression (slope)
 */
export function calculateTrend(scores: number[]): TrendAnalysis {
    if (scores.length < 2) {
        return { trend: 'stable', change: 0, confidence: 0 };
    }

    const n = scores.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += scores[i];
        sumXY += i * scores[i];
        sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    // Calculate percentage change between first and last (smoothed)
    const first = scores[0];
    const last = scores[n - 1];
    const change = first === 0 ? 0 : ((last - first) / first) * 100;

    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (slope > 0.15) trend = 'improving';
    else if (slope < -0.15) trend = 'declining';

    return {
        trend,
        change: Math.round(change),
        confidence: Math.min(n / 10, 1.0) // higher confidence with more data points
    };
}
