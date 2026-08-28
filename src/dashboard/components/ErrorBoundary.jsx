import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ERFlow Component Error Caught by ErrorBoundary:", error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    if (this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-red/30 bg-red-tint p-8 text-center shadow-soft my-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-red mb-3">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-navy">Module Component Error</h3>
          <p className="mt-1 max-w-md text-[13.5px] text-navy-muted">
            {this.state.error?.message || "An unexpected error occurred while rendering this module."}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2 text-[13px] font-semibold text-white hover:bg-navy-dark transition-colors"
          >
            <RefreshCw className="h-4 w-4" /> Reset Module State
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
