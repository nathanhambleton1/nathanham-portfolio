import { Component, type ErrorInfo, type ReactNode } from "react";

// Without a boundary, any render error unmounts the whole app and leaves a
// blank black page. This catches it and offers a way back instead. `resetKey`
// (the current path) clears the error when the user navigates elsewhere.

type Props = { children: ReactNode; resetKey: string };
type State = { error: Error | null };

export default class DrunkErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Drunk page crashed:", error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <img src="/drunkopoly/police.webp" alt="" aria-hidden className="h-20 w-20 object-contain" />
        <p className="font-board text-lg font-semibold uppercase tracking-[0.16em]">Something went wrong</p>
        <p className="max-w-xs text-sm text-muted-foreground">That screen hit a snag. Your game is saved, so reload to jump back in.</p>
        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex min-h-10 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background"
          >
            Reload
          </button>
          <a
            href="/drunk/drunkopoly"
            className="inline-flex min-h-10 items-center rounded-full border border-foreground/15 px-5 text-sm text-foreground"
          >
            Lobby
          </a>
        </div>
      </div>
    );
  }
}
