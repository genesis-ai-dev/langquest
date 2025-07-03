/**
 * Enhanced performance profiler for debugging navigation and render bottlenecks
 */

interface BlockingEvent {
    duration: number;
    timestamp: number;
    stack?: string;
    memoryUsage?: number;
    activeQueries: string[];
    recentStateUpdates: string[];
    recentEffects: string[];
}

interface EffectExecution {
    componentName: string;
    effectId: string;
    duration: number;
    timestamp: number;
    dependencies?: unknown[];
}

interface StateUpdate {
    componentName: string;
    stateName: string;
    timestamp: number;
    oldValue?: unknown;
    newValue?: unknown;
}

class DebugProfiler {
    private enabled = __DEV__;
    private navigationStartTimes = new Map<string, number>();
    private renderCounts = new Map<string, number>();
    private queryTimes = new Map<string, number>();
    private blockingEvents: BlockingEvent[] = [];
    private recentEffects: EffectExecution[] = [];
    private recentStateUpdates: StateUpdate[] = [];
    private activeQueries = new Set<string>();
    private isCapturingStack = false;

    // Navigation timing
    startNavigation(route: string) {
        if (!this.enabled) return;

        const timestamp = performance.now();
        this.navigationStartTimes.set(route, timestamp);
        console.log(`🚀 [NAV] Starting navigation to: ${route} at ${timestamp.toFixed(2)}ms`);
    }

    endNavigation(route: string) {
        if (!this.enabled) return;

        const startTime = this.navigationStartTimes.get(route);
        if (!startTime) return;

        const duration = performance.now() - startTime;
        this.navigationStartTimes.delete(route);

        console.log(`🏁 [NAV] Navigation to ${route} completed in ${duration.toFixed(2)}ms`);

        if (duration > 500) {
            console.warn(`⚠️ [NAV] Slow navigation detected: ${route} took ${duration.toFixed(2)}ms`);
        }
    }

    // Component render tracking
    trackRender(componentName: string, props?: Record<string, unknown>) {
        if (!this.enabled) return;

        const count = (this.renderCounts.get(componentName) || 0) + 1;
        this.renderCounts.set(componentName, count);

        if (count <= 5 || count % 10 === 0) {
            console.log(`🔄 [RENDER] ${componentName} #${count}`, props ? { propKeys: Object.keys(props) } : '');
        }

        if (count > 20) {
            console.warn(`⚠️ [RENDER] ${componentName} has rendered ${count} times - potential issue!`);
        }
    }

    // useEffect tracking
    trackEffect(componentName: string, effectId: string, dependencies?: unknown[], duration?: number) {
        if (!this.enabled) return;

        const execution: EffectExecution = {
            componentName,
            effectId,
            duration: duration || 0,
            timestamp: performance.now(),
            dependencies
        };

        this.recentEffects.push(execution);

        // Keep only last 50 effects
        if (this.recentEffects.length > 50) {
            this.recentEffects.shift();
        }

        if (duration && duration > 16) { // More than one frame
            console.warn(`⚠️ [EFFECT] Slow useEffect in ${componentName}:${effectId} took ${duration.toFixed(2)}ms`);
        }

        console.log(`🎯 [EFFECT] ${componentName}:${effectId}`, {
            duration: duration?.toFixed(2) + 'ms',
            deps: dependencies?.length || 0
        });
    }

    // State update tracking
    trackStateUpdate(componentName: string, stateName: string, oldValue?: unknown, newValue?: unknown) {
        if (!this.enabled) return;

        const update: StateUpdate = {
            componentName,
            stateName,
            timestamp: performance.now(),
            oldValue,
            newValue
        };

        this.recentStateUpdates.push(update);

        // Keep only last 50 updates
        if (this.recentStateUpdates.length > 50) {
            this.recentStateUpdates.shift();
        }

        // Detect rapid state updates (potential infinite loops)
        const recentSameUpdates = this.recentStateUpdates
            .filter(u => u.componentName === componentName && u.stateName === stateName)
            .filter(u => performance.now() - u.timestamp < 100); // Last 100ms

        if (recentSameUpdates.length > 5) {
            console.error(`🔥 [STATE] Rapid state updates detected in ${componentName}.${stateName} - ${recentSameUpdates.length} updates in 100ms!`);
        }

        console.log(`📊 [STATE] ${componentName}.${stateName} updated`, {
            from: typeof oldValue,
            to: typeof newValue,
            rapid: recentSameUpdates.length > 2
        });
    }

    // Query performance tracking  
    startQuery(queryKey: string[]) {
        if (!this.enabled) return;

        const key = JSON.stringify(queryKey);
        this.queryTimes.set(key, performance.now());
        this.activeQueries.add(key);
        console.log(`📡 [QUERY] Starting:`, queryKey);
    }

    endQuery(queryKey: string[], fromCache = false) {
        if (!this.enabled) return;

        const key = JSON.stringify(queryKey);
        const startTime = this.queryTimes.get(key);
        if (!startTime) return;

        const duration = performance.now() - startTime;
        this.queryTimes.delete(key);
        this.activeQueries.delete(key);

        const source = fromCache ? '(cache)' : '(fetch)';
        console.log(`✅ [QUERY] Completed ${source}:`, queryKey, `in ${duration.toFixed(2)}ms`);

        if (!fromCache && duration > 300) {
            console.warn(`⚠️ [QUERY] Slow query:`, queryKey, `took ${duration.toFixed(2)}ms`);
        }
    }

    // Memory usage helper
    private getMemoryUsage(): number {
        if (typeof performance !== 'undefined' && 'memory' in performance) {
            const memory = (performance as unknown as { memory: { usedJSHeapSize: number } }).memory;
            return memory.usedJSHeapSize / 1024 / 1024; // MB
        }
        return 0;
    }

    // Enhanced blocking detection with cause analysis
    startBlockingDetection() {
        if (!this.enabled) return;

        let lastTime = performance.now();
        let consecutiveBlocks = 0;
        let totalBlockingInLastSecond = 0;
        let lastSecondReset = performance.now();
        let profilerPaused = false;

        const checkBlocking = () => {
            if (profilerPaused) {
                // Profiler is paused, just wait longer before checking again
                setTimeout(checkBlocking, 1000);
                return;
            }

            if (this.isCapturingStack) {
                // Skip this check if we're already capturing stack to avoid recursion
                setTimeout(checkBlocking, 100); // Much less aggressive
                return;
            }

            const currentTime = performance.now();
            const delta = currentTime - lastTime;

            // Circuit breaker: Reset counters every second and check for runaway blocking
            if (currentTime - lastSecondReset > 1000) {
                if (totalBlockingInLastSecond > 3000 || consecutiveBlocks > 20) {
                    console.error(`🚨 [CIRCUIT BREAKER] Excessive blocking detected: ${totalBlockingInLastSecond.toFixed(1)}ms in 1s or ${consecutiveBlocks} consecutive blocks. Pausing profiler for 10 seconds.`);
                    profilerPaused = true;
                    setTimeout(() => {
                        profilerPaused = false;
                        consecutiveBlocks = 0;
                        totalBlockingInLastSecond = 0;
                        lastSecondReset = performance.now();
                        lastTime = performance.now();
                    }, 10000);
                    return;
                }
                totalBlockingInLastSecond = 0;
                lastSecondReset = currentTime;
            }

            // Only check for blocking if delta is reasonable (not too large due to pausing)
            if (delta > 50 && delta < 10000) { // Ignore huge deltas that might be from pausing
                consecutiveBlocks++;
                totalBlockingInLastSecond += delta;

                const blockingEvent: BlockingEvent = {
                    duration: delta,
                    timestamp: currentTime,
                    memoryUsage: this.getMemoryUsage(),
                    activeQueries: Array.from(this.activeQueries),
                    recentStateUpdates: this.recentStateUpdates
                        .filter(u => currentTime - u.timestamp < 100)
                        .map(u => `${u.componentName}.${u.stateName}`),
                    recentEffects: this.recentEffects
                        .filter(e => currentTime - e.timestamp < 100)
                        .map(e => `${e.componentName}:${e.effectId}`)
                };

                // Try to capture stack trace (may cause additional blocking, so be careful)
                if (delta > 100 && !this.isCapturingStack) {
                    this.isCapturingStack = true;
                    try {
                        blockingEvent.stack = new Error().stack?.split('\n').slice(1, 6).join('\n');
                    } catch {
                        // Ignore stack capture errors
                    } finally {
                        this.isCapturingStack = false;
                    }
                }

                this.blockingEvents.push(blockingEvent);

                // Keep only last 20 blocking events
                if (this.blockingEvents.length > 20) {
                    this.blockingEvents.shift();
                }

                console.warn(`🚫 [BLOCKING] Main thread blocked for ${delta.toFixed(2)}ms`);

                // Provide context about what might have caused it
                if (blockingEvent.activeQueries.length > 0) {
                    console.warn(`   Active queries: ${blockingEvent.activeQueries.length}`);
                }
                if (blockingEvent.recentStateUpdates.length > 0) {
                    console.warn(`   Recent state updates: ${blockingEvent.recentStateUpdates.join(', ')}`);
                }
                if (blockingEvent.recentEffects.length > 0) {
                    console.warn(`   Recent effects: ${blockingEvent.recentEffects.join(', ')}`);
                }
                if (blockingEvent.memoryUsage && blockingEvent.memoryUsage > 100) {
                    console.warn(`   Memory usage: ${blockingEvent.memoryUsage.toFixed(1)}MB`);
                }

                // If we have severe blocking, show more details
                if (delta > 1000) {
                    console.error(`🔥 [SEVERE BLOCKING] ${delta.toFixed(2)}ms - This is causing noticeable lag!`);
                    if (blockingEvent.stack) {
                        console.error('   Stack trace:\n' + blockingEvent.stack);
                    }
                }

                // Detect blocking patterns
                if (consecutiveBlocks > 10) {
                    console.error(`🔥 [BLOCKING PATTERN] ${consecutiveBlocks} consecutive blocks detected - investigate immediately!`);
                    this.analyzeBlockingPatterns();
                }
            } else {
                consecutiveBlocks = 0; // Reset counter for clean periods
            }

            lastTime = currentTime;
            setTimeout(checkBlocking, 100); // Much less aggressive - check every 100ms instead of 5ms
        };

        checkBlocking();
    }

    // Analyze patterns in blocking events
    private analyzeBlockingPatterns() {
        if (this.blockingEvents.length < 5) return;

        const recent = this.blockingEvents.slice(-10);

        // Analyze common causes
        const queryCounts = new Map<string, number>();
        const stateCounts = new Map<string, number>();
        const effectCounts = new Map<string, number>();

        recent.forEach(event => {
            event.activeQueries.forEach(query => {
                queryCounts.set(query, (queryCounts.get(query) || 0) + 1);
            });
            event.recentStateUpdates.forEach(state => {
                stateCounts.set(state, (stateCounts.get(state) || 0) + 1);
            });
            event.recentEffects.forEach(effect => {
                effectCounts.set(effect, (effectCounts.get(effect) || 0) + 1);
            });
        });

        console.group('🔍 [BLOCKING ANALYSIS]');

        if (queryCounts.size > 0) {
            console.log('Most frequent queries during blocking:');
            Array.from(queryCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .forEach(([query, count]) => console.log(`  ${count}x: ${query}`));
        }

        if (stateCounts.size > 0) {
            console.log('Most frequent state updates during blocking:');
            Array.from(stateCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .forEach(([state, count]) => console.log(`  ${count}x: ${state}`));
        }

        if (effectCounts.size > 0) {
            console.log('Most frequent effects during blocking:');
            Array.from(effectCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .forEach(([effect, count]) => console.log(`  ${count}x: ${effect}`));
        }

        console.groupEnd();
    }

    // Get current stats with enhanced details
    getStats() {
        if (!this.enabled) return null;

        return {
            activeNavigations: this.navigationStartTimes.size,
            activeQueries: this.activeQueries.size,
            topRenderedComponents: Array.from(this.renderCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10),
            recentBlockingEvents: this.blockingEvents.slice(-5),
            memoryUsage: this.getMemoryUsage(),
            totalBlockingTime: this.blockingEvents.reduce((sum, event) => sum + event.duration, 0)
        };
    }

    // Get detailed diagnostic report
    getDiagnosticReport() {
        if (!this.enabled) return null;

        const now = performance.now();
        const recentTime = 5000; // Last 5 seconds

        return {
            summary: {
                totalBlockingEvents: this.blockingEvents.length,
                totalBlockingTime: this.blockingEvents.reduce((sum, event) => sum + event.duration, 0),
                averageBlockingTime: this.blockingEvents.length > 0
                    ? this.blockingEvents.reduce((sum, event) => sum + event.duration, 0) / this.blockingEvents.length
                    : 0,
                memoryUsage: this.getMemoryUsage()
            },
            recentActivity: {
                effects: this.recentEffects.filter(e => now - e.timestamp < recentTime),
                stateUpdates: this.recentStateUpdates.filter(s => now - s.timestamp < recentTime),
                activeQueries: Array.from(this.activeQueries)
            },
            worstBlockingEvents: this.blockingEvents
                .sort((a, b) => b.duration - a.duration)
                .slice(0, 5)
        };
    }

    reset() {
        this.navigationStartTimes.clear();
        this.renderCounts.clear();
        this.queryTimes.clear();
        this.blockingEvents = [];
        this.recentEffects = [];
        this.recentStateUpdates = [];
        this.activeQueries.clear();
        console.log('🔄 [PROFILER] Reset all tracking data');
    }
}

// Global instance  
export const profiler = new DebugProfiler();

// Helper functions for easy integration
export const trackEffect = (componentName: string, effectId: string, dependencies?: unknown[]) => {
    const start = performance.now();
    return () => {
        const duration = performance.now() - start;
        profiler.trackEffect(componentName, effectId, dependencies, duration);
    };
};

export const trackStateUpdate = (componentName: string, stateName: string, oldValue?: unknown, newValue?: unknown) => {
    profiler.trackStateUpdate(componentName, stateName, oldValue, newValue);
};

// Start blocking detection immediately
if (__DEV__) {
    profiler.startBlockingDetection();
}

// Make available globally for debugging
declare global {
    interface Window {
        profiler?: typeof profiler;
    }
}

if (__DEV__ && typeof window !== 'undefined') {
    window.profiler = profiler;
}