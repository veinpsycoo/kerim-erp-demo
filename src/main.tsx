import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./style.css";
class Boundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="boot">
        <h1>Çalışma alanı açılamadı</h1>
        <p>
          Sayfayı yenileyerek tekrar deneyin. Tarayıcınızda depolama erişiminin
          açık olduğundan emin olun.
        </p>
        <button onClick={() => location.reload()}>Tekrar dene</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <Boundary>
    <App />
  </Boundary>,
);
if ("serviceWorker" in navigator)
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(import.meta.env.BASE_URL + "sw.js")
      .catch(() => {
        /* App remains usable with no service worker. */
      });
  });
