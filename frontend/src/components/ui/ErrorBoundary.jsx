import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className='p-8 bg-red-50 text-red-900 w-full h-full absolute inset-0 z-50 overflow-auto'>
          <h1 className='text-2xl font-bold mb-4'>React Error</h1>
          <pre className='whitespace-pre-wrap font-mono text-sm'>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
