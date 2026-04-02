import { useEffect, useState } from "react";
import { onNetworkChange, isOnline } from "../utils/native";

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    isOnline().then((connected) => setOffline(!connected));

    let cleanup: (() => void) | undefined;
    onNetworkChange((connected) => setOffline(!connected)).then((fn) => {
      cleanup = fn;
    });

    return () => cleanup?.();
  }, []);

  if (!offline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: "fixed",
        top: "env(safe-area-inset-top, 0px)",
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "#dc2626",
        color: "#fff",
        textAlign: "center",
        padding: "8px 16px",
        fontSize: "13px",
        fontWeight: 600,
      }}
    >
      Nessuna connessione — i dati potrebbero non essere aggiornati
    </div>
  );
}
