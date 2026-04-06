import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[CGA] Uncaught render error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-24">
          <p className="text-gold font-mono text-4xl font-bold mb-4">!</p>
          <h1 className="text-darktext font-serif text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-gray-500 font-sans text-sm mb-6">An unexpected error occurred. Try refreshing the page.</p>
          <button
            className="btn-primary"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
