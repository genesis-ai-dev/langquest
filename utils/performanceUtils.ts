/**
 * Performance monitoring utilities for tracking app performance
 * Inspired by SpaceX's telemetry systems - measure everything that matters
 */

import React from 'react';

interface PerformanceMetric {
    name: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    metadata?: Record<string, unknown>;
}

class PerformanceMonitor {
    private metrics = new Map<string, PerformanceMetric>();
    private navigationMetrics: PerformanceMetric[] = [];
    private queryMetrics: PerformanceMetric[] = [];
    private renderCounts = new Map<string, number>();

    // Start tracking a metric
    startMetric(name: string, metadata?: Record<string, unknown>): void {
        this.metrics.set(name, {
            name,
            startTime: performance.now(),
            metadata
        });
    }

    // End tracking a metric
    endMetric(name: string): number | null {
        const metric = this.metrics.get(name);
        if (!metric) {
            console.warn(`Performance metric "${name}" not found`);
            return null;
        }

        metric.endTime = performance.now();
        metric.duration = metric.endTime - metric.startTime;

        // Categorize metrics
        if (name.includes('navigation')) {
            this.navigationMetrics.push(metric);
        } else if (name.includes('query')) {
            this.queryMetrics.push(metric);
        }

        this.metrics.delete(name);

        if (__DEV__) {
            console.log(`⏱️ ${name}: ${metric.duration.toFixed(2)}ms`, metric.metadata);
        }

        return metric.duration;
    }

    // Track component renders
    trackRender(componentName: string): void {
        const count = (this.renderCounts.get(componentName) || 0) + 1;
        this.renderCounts.set(componentName, count);

        if (__DEV__ && count % 10 === 0) {
            console.warn(`🔄 ${componentName} has rendered ${count} times`);
        }
    }

    // Get performance summary
    getSummary() {
        const avgNavigationTime = this.getAverageTime(this.navigationMetrics);
        const avgQueryTime = this.getAverageTime(this.queryMetrics);

        return {
            navigation: {
                count: this.navigationMetrics.length,
                averageTime: avgNavigationTime,
                lastFive: this.navigationMetrics.slice(-5).map(m => ({
                    name: m.name,
                    duration: m.duration?.toFixed(2)
                }))
            },
            queries: {
                count: this.queryMetrics.length,
                averageTime: avgQueryTime,
                lastFive: this.queryMetrics.slice(-5).map(m => ({
                    name: m.name,
                    duration: m.duration?.toFixed(2)
                }))
            },
            renders: Array.from(this.renderCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([name, count]) => ({ name, count }))
        };
    }

    private getAverageTime(metrics: PerformanceMetric[]): number {
        if (metrics.length === 0) return 0;
        const total = metrics.reduce((sum, m) => sum + (m.duration || 0), 0);
        return total / metrics.length;
    }

    // Clear all metrics
    clear(): void {
        this.metrics.clear();
        this.navigationMetrics = [];
        this.queryMetrics = [];
        this.renderCounts.clear();
    }
}

// Global instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for tracking component renders
export function useRenderTracking(componentName: string) {
    React.useEffect(() => {
        performanceMonitor.trackRender(componentName);
    });
}

// Wrapper for async operations with performance tracking
export async function trackAsync<T>(
    name: string,
    operation: () => Promise<T>,
    metadata?: Record<string, unknown>
): Promise<T> {
    performanceMonitor.startMetric(name, metadata);
    try {
        const result = await operation();
        performanceMonitor.endMetric(name);
        return result;
    } catch (error) {
        performanceMonitor.endMetric(name);
        throw error;
    }
}

// Navigation performance tracking
export function trackNavigation(from: string, to: string) {
    const name = `navigation:${from}->${to}`;
    performanceMonitor.startMetric(name, { from, to });

    return () => {
        performanceMonitor.endMetric(name);
    };
}

// Query performance tracking
export function trackQuery(queryKey: readonly unknown[]) {
    const name = `query:${JSON.stringify(queryKey)}`;
    performanceMonitor.startMetric(name, { queryKey });

    return () => {
        performanceMonitor.endMetric(name);
    };
}

// Simple hook to track render counts and detect loops
export function useRenderCounter(componentName: string, threshold = 10) {
    const renderCount = React.useRef(0);
    const lastResetTime = React.useRef(Date.now());

    renderCount.current++;

    // Reset counter every 5 seconds
    const now = Date.now();
    if (now - lastResetTime.current > 5000) {
        if (renderCount.current > threshold) {
            console.warn(`🔥 ${componentName} rendered ${renderCount.current} times in 5 seconds - possible render loop!`);
        }
        renderCount.current = 0;
        lastResetTime.current = now;
    }

    return renderCount.current;
}

// Hook to track query performance
export function useQueryPerformanceTracker(queryKey: string[]) {
    const startTime = React.useRef(performance.now());

    React.useEffect(() => {
        const duration = performance.now() - startTime.current;
        if (duration > 100) { // Log slow queries
            console.log(`🐌 Slow query [${queryKey.join(',')}]: ${duration.toFixed(2)}ms`);
        }
    });
}

export default performanceMonitor;