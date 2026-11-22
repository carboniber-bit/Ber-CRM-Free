import { Component, type ErrorInfo, type ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro não tratado na interface:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="dot-grid flex min-h-screen items-center justify-center bg-bg p-6">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 text-center">
            <TriangleAlert className="mx-auto mb-4 h-10 w-10 text-lime" />
            <h1 className="mb-2 text-lg font-semibold text-ink">Algo deu errado</h1>
            <p className="mb-6 text-sm text-muted">
              Ocorreu um erro inesperado na interface. Recarregue a página para continuar.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="h-10 rounded-xl bg-ink px-5 text-sm font-medium text-bg transition-colors hover:bg-ink/85"
            >
              Recarregar página
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}