export default function Aviso({ tipo = "info", mensaje }) {
  if (!mensaje) return null;
  return <div className={`aviso aviso-${tipo}`}>{mensaje}</div>;
}
