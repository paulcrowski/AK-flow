// @ts-nocheck
// Known issue: React class components have typing issues with moduleResolution: bundler
import { Component, ReactNode, ErrorInfo } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    componentName?: string;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary - łapie błędy JavaScript w renderze dzieci
 * 
 * Użycie:
 *   <ComponentErrorBoundary componentName="NeuroMonitor">
 *     <NeuroMonitor />
 *   </ComponentErrorBoundary>
 */
export class ComponentErrorBoundary extends Component<Props, State> {
    constructor(props: any) {
        super(props as Props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        const componentName = this.props.componentName || 'Unknown';
        
        // Log error with full context
        console.error(`[ErrorBoundary] ${componentName} crashed:`, error);
        console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
        
        // Store errorInfo for display
        this.setState({ errorInfo });
        
        // Call optional error handler
        this.props.onError?.(error, errorInfo);
    }

    handleReset = (): void => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="p-4 border border-red-500/30 bg-red-900/10 rounded-lg text-red-400 font-mono text-sm m-2">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">⚠️</span>
                        <h3 className="font-bold">
                            {this.props.componentName || 'Komponent'} — błąd
                        </h3>
                    </div>
                    <p className="opacity-80 mb-3 text-xs">
                        {this.state.error?.message || 'Nieznany błąd'}
                    </p>
                    <div className="flex gap-2">
                        <button
                            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded transition-colors text-xs font-bold"
                            onClick={this.handleReset}
                        >
                            Spróbuj ponownie
                        </button>
                        <button
                            className="px-3 py-1.5 bg-gray-500/20 hover:bg-gray-500/30 rounded transition-colors text-xs text-gray-400"
                            onClick={() => window.location.reload()}
                        >
                            Odśwież stronę
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ComponentErrorBoundary;
