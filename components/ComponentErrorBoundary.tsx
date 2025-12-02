import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    componentName?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ComponentErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error(`Uncaught error in ${this.props.componentName || 'Component'}:`, error, errorInfo);
    }

    public render() {
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
