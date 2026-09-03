import { useRegisterSW } from "virtual:pwa-register/react";

// Aviso discreto cuando el service worker bajó una versión nueva. El usuario
// decide cuándo recargar (ver registerType: 'prompt' en vite.config.js).
export default function ActualizarApp() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="toast-actualizar" role="status">
      <span>Hay una versión nueva.</span>
      <div className="toast-actualizar-acciones">
        <button type="button" onClick={() => updateServiceWorker(true)}>
          Actualizar
        </button>
        <button
          type="button"
          className="toast-actualizar-cerrar"
          onClick={() => setNeedRefresh(false)}
          aria-label="Cerrar aviso"
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}
