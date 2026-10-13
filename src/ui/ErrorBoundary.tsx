import { Component, type ReactNode } from 'react';

interface Props {
  fallback: (retry: () => void) => ReactNode;
  children: ReactNode;
}

/** Keeps one broken panel from taking the whole dashboard down. */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[HelioShield] panel error', error);
  }

  render() {
    return this.state.failed ? this.props.fallback(() => this.setState({ failed: false })) : this.props.children;
  }
}
