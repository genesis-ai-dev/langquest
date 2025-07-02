/**
 * Enhanced performance profiler for debugging navigation and render bottlenecks
 */

class DebugProfiler {
    private enabled = __DEV__;
    private navigationStartTimes = new Map<string, number>();
    private renderCounts = new Map<string, number>();
    private queryTimes = new Map<string, number>();

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

    // Query performance tracking  
    startQuery(queryKey: string[]) {
        if (!this.enabled) return;

        const key = JSON.stringify(queryKey);
        this.queryTimes.set(key, performance.now());
        console.log(`📡 [QUERY] Starting:`, queryKey);
    }

    endQuery(queryKey: string[], fromCache = false) {
        if (!this.enabled) return;

        const key = JSON.stringify(queryKey);
        const startTime = this.queryTimes.get(key);
        if (!startTime) return;

        const duration = performance.now() - startTime;
        this.queryTimes.delete(key);

        const source = fromCache ? '(cache)' : '(fetch)';
        console.log(`✅ [QUERY] Completed ${source}:`, queryKey, `in ${duration.toFixed(2)}ms`);

        if (!fromCache && duration > 300) {
            console.warn(`⚠️ [QUERY] Slow query:`, queryKey, `took ${duration.toFixed(2)}ms`);
        }
    }

    // Main thread blocking detection
    startBlockingDetection() {
        if (!this.enabled) return;

        let lastTime = performance.now();

        const checkBlocking = () => {
            const currentTime = performance.now();
            const delta = currentTime - lastTime;

            if (delta > 20) { // More than 20ms = likely blocking
                console.warn(`🚫 [BLOCKING] Main thread blocked for ${delta.toFixed(2)}ms`);
            }

            lastTime = currentTime;
            setTimeout(checkBlocking, 0); // Use setTimeout to avoid RAF queue backup
        };

        checkBlocking();
    }

    // Get current stats
    getStats() {
        if (!this.enabled) return null;

        return {
            activeNavigations: this.navigationStartTimes.size,
            activeQueries: this.queryTimes.size,
            topRenderedComponents: Array.from(this.renderCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
        };
    }

    reset() {
        this.navigationStartTimes.clear();
        this.renderCounts.clear();
        this.queryTimes.clear();
        console.log('🔄 [PROFILER] Reset all tracking data');
    }
}

// Global instance  
export const profiler = new DebugProfiler();

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