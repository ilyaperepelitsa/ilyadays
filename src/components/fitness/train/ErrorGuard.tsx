"use client";
/**
 * Keeps a rendering error on the train or home screen from blanking the page (stream 04): a short message and a
 * Reload button instead of an empty screen. Logged sets are already saved by the store, so nothing is lost.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import type { Lang } from "@/lib/fitness/types";
import { pick } from "@/lib/fitness/i18n";

type Props = { lang: Lang; children: ReactNode };
type State = { failed: boolean };

export class ErrorGuard extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("fitness: this screen failed to render", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const { lang } = this.props;
    return (
      <div className="fit-note warn trk-crash" role="alert">
        <p>
          {pick(
            lang,
            "This screen hit an error. Everything you logged is saved in this browser; reloading usually fixes it.",
            "На этом экране произошла ошибка. Всё записанное сохранено в этом браузере; обычно помогает перезагрузка.",
          )}
        </p>
        <button type="button" className="fit-button" onClick={() => window.location.reload()}>
          {pick(lang, "Reload", "Перезагрузить")}
        </button>
      </div>
    );
  }
}
