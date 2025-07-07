/**
 * Circuit Breaker utility to prevent infinite loops and excessive API calls
 * 
 * This helps protect against:
 * - Infinite render loops
 * - Excessive API calls
 * - Memory leaks from runaway processes
 */

interface CircuitBreakerState {
    calls: number;
    lastReset: number;
    isOpen: boolean;
    failures: number;
}

class CircuitBreaker {
    private state: CircuitBreakerState;
    private readonly maxCalls: number;
    private readonly timeWindow: number;
    private readonly failureThreshold: number;
    private readonly resetTimeout: number;
    private readonly identifier: string;

    constructor(
        identifier: string,
        options: CircuitBreakerOptions = {}
    ) {
        this.identifier = identifier;
        this.maxCalls = options.maxCalls ?? 100; // Max calls per time window
        this.timeWindow = options.timeWindow ?? 5000; // 5 seconds
        this.failureThreshold = options.failureThreshold ?? 5; // Max failures before opening
        this.resetTimeout = options.resetTimeout ?? 30000; // 30 seconds to reset

        this.state = {
            calls: 0,
            lastReset: Date.now(),
            isOpen: false,
            failures: 0
        };
    }

    /**
     * Check if the circuit breaker should allow the operation
     */
    canProceed(): boolean {
        const now = Date.now();

        // Reset if time window has passed
        if (now - this.state.lastReset > this.timeWindow) {
            this.reset();
        }

        // If circuit is open, check if we should reset
        if (this.state.isOpen) {
            if (now - this.state.lastReset > this.resetTimeout) {
                this.reset();
                console.log(`🔄 Circuit breaker [${this.identifier}] reset after timeout`);
            } else {
                console.warn(`🚫 Circuit breaker [${this.identifier}] is OPEN - blocking operation`);
                return false;
            }
        }

        // Check if we've exceeded call limit
        if (this.state.calls >= this.maxCalls) {
            this.open();
            console.warn(`🚫 Circuit breaker [${this.identifier}] OPENED - too many calls (${this.state.calls}/${this.maxCalls} in ${this.timeWindow}ms)`);
            return false;
        }

        // Increment call counter
        this.state.calls++;

        // Log warning if approaching limit
        if (this.state.calls > this.maxCalls * 0.8) {
            console.warn(`⚠️ Circuit breaker [${this.identifier}] warning: ${this.state.calls}/${this.maxCalls} calls in time window`);
        }

        return true;
    }

    /**
     * Record a successful operation
     */
    recordSuccess(): void {
        this.state.failures = 0;
    }

    /**
     * Record a failed operation
     */
    recordFailure(): void {
        this.state.failures++;

        if (this.state.failures >= this.failureThreshold) {
            this.open();
            console.warn(`🚫 Circuit breaker [${this.identifier}] OPENED due to failures (${this.state.failures}/${this.failureThreshold})`);
        }
    }

    /**
     * Open the circuit breaker
     */
    private open(): void {
        this.state.isOpen = true;
        this.state.lastReset = Date.now();
    }

    /**
     * Reset the circuit breaker
     */
    private reset(): void {
        this.state = {
            calls: 0,
            lastReset: Date.now(),
            isOpen: false,
            failures: 0
        };
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            identifier: this.identifier,
            isOpen: this.state.isOpen,
            calls: this.state.calls,
            maxCalls: this.maxCalls,
            failures: this.state.failures,
            timeRemaining: Math.max(0, this.timeWindow - (Date.now() - this.state.lastReset))
        };
    }
}

// Global circuit breakers for common operations
const circuitBreakers = new Map<string, CircuitBreaker>();

interface CircuitBreakerOptions {
    maxCalls?: number;
    timeWindow?: number;
    failureThreshold?: number;
    resetTimeout?: number;
}

/**
 * Get or create a circuit breaker for a specific operation
 */
export function getCircuitBreaker(
    identifier: string,
    options?: CircuitBreakerOptions
): CircuitBreaker {
    if (!circuitBreakers.has(identifier)) {
        circuitBreakers.set(identifier, new CircuitBreaker(identifier, options));
    }
    return circuitBreakers.get(identifier)!;
}

/**
 * Hook to use circuit breaker protection in React components
 */
export function useCircuitBreaker(
    identifier: string,
    options?: CircuitBreakerOptions
) {
    const breaker = getCircuitBreaker(identifier, options);

    return {
        canProceed: () => breaker.canProceed(),
        recordSuccess: () => breaker.recordSuccess(),
        recordFailure: () => breaker.recordFailure(),
        getStatus: () => breaker.getStatus()
    };
}

/**
 * Higher-order function to wrap operations with circuit breaker protection
 */
export function withCircuitBreaker<T extends (...args: any[]) => any>(
    fn: T,
    identifier: string,
    options?: CircuitBreakerOptions
): T {
    const breaker = getCircuitBreaker(identifier, options);

    return ((...args: Parameters<T>) => {
        if (!breaker.canProceed()) {
            throw new Error(`Circuit breaker [${identifier}] is open - operation blocked`);
        }

        try {
            const result = fn(...args);

            // Handle promises
            if (result && typeof result.then === 'function') {
                return result
                    .then((value: any) => {
                        breaker.recordSuccess();
                        return value;
                    })
                    .catch((error: any) => {
                        breaker.recordFailure();
                        throw error;
                    });
            }

            breaker.recordSuccess();
            return result;
        } catch (error) {
            breaker.recordFailure();
            throw error;
        }
    }) as T;
}

/**
 * Reset all circuit breakers (useful for testing or emergency reset)
 */
export function resetAllCircuitBreakers(): void {
    circuitBreakers.clear();
    console.log('🔄 All circuit breakers have been reset');
} 