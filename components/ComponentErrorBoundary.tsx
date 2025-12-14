// @ts-nocheck
// TODO: Fix React class component typing issue with moduleResolution: bundler
import React from 'react';

interface Props {
    children: React.ReactNode;
    fallback?: React.ReactNode;
    componentName?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

// Error boundaries must be class components
export class ComponentErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null
        };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        console.error(`Uncaught error in ${this.props.componentName || 'Component'}:`, error, errorInfo);
    }

    render(): React.ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="p-4 border border-red-500/30 bg-red-900/10 rounded-lg text-red-400 font-mono text-sm">
                    <h3 className="font-bold mb-2">⚠️ Component Error: {this.props.componentName}</h3>
                    <p className="opacity-80">{this.state.error?.message}</p>
                    <button
                        className="mt-3 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded transition-colors text-xs"
                        onClick={() => this.setState({ hasError: false, error: null })}
                    >
                        Retry Component
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
