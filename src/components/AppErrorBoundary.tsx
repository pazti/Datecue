import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean }

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[v0] Datecue application error', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f2ea] px-5 py-10 text-[#17252b] dark:bg-[#0d171b] dark:text-[#f6f2ea]">
        <section className="w-full max-w-md rounded-3xl border border-[#17252b]/15 bg-white p-7 shadow-xl dark:border-white/15 dark:bg-[#16242a]">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#df6b58]">Datecue</p>
          <h1 className="font-serif text-3xl font-bold">Something went wrong</h1>
          <p className="mt-3 text-sm leading-6 opacity-75">The app hit an unexpected error. Reload Datecue to reconnect safely and return to your room.</p>
          <button className="button-dark mt-6 rounded-full px-5 py-3 text-sm font-bold" onClick={() => window.location.reload()}>Reload Datecue</button>
        </section>
      </main>
    )
  }
}
