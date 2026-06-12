
  import { createRoot } from "react-dom/client";
  import { Component, ReactNode } from "react";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  class ErrorBoundary extends Component<{children: ReactNode}, {error: Error | null}> {
    constructor(props: any) { super(props); this.state = { error: null }; }
    static getDerivedStateFromError(e: Error) { return { error: e }; }
    render() {
      if (this.state.error) return (
        <div style={{padding:24,background:'#B8001F',color:'white',fontFamily:'monospace',whiteSpace:'pre-wrap'}}>
          <h2>❌ React Error</h2>
          <b>{this.state.error.message}</b>
          <hr/>
          <small>{this.state.error.stack}</small>
        </div>
      );
      return this.props.children;
    }
  }

  createRoot(document.getElementById("root")!).render(
    <ErrorBoundary><App /></ErrorBoundary>
  );
