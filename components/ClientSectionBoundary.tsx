"use client";

import React from "react";

type Props = {
  title: string;
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

export class ClientSectionBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false
  };

  static getDerivedStateFromError() {
    return {
      hasError: true
    };
  }

  componentDidCatch(error: Error) {
    console.error(`[homepage:${this.props.title}]`, error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="surface-card p-6">
          <p className="text-sm text-slate-600">
            {this.props.title} 目前讀取失敗，重新整理後再試一次。
          </p>
        </section>
      );
    }

    return this.props.children;
  }
}
