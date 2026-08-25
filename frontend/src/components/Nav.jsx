import { NavLink } from "react-router-dom";

function IconNuevoPedido() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3.5" width="16" height="17" rx="2" />
      <path d="M8 8h5M8 12h3" />
      <circle cx="16.5" cy="15.5" r="3.25" />
      <path d="M16.5 13.9v3.2M14.9 15.5h3.2" />
    </svg>
  );
}

function IconLista() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="4" width="17" height="16" rx="2" />
      <path d="M7 8.5h10M7 12h10M7 15.5h6" />
    </svg>
  );
}

function IconCatalogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.75" y="3.75" width="7" height="7" rx="1.5" />
      <rect x="13.25" y="3.75" width="7" height="7" rx="1.5" />
      <rect x="3.75" y="13.25" width="7" height="7" rx="1.5" />
      <rect x="13.25" y="13.25" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function IconLibro() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5.5c0-1 .8-1.75 1.75-1.75H12v15.5H5.75A1.75 1.75 0 0 0 4 21" />
      <path d="M20 5.5c0-1-.8-1.75-1.75-1.75H12v15.5h6.25A1.75 1.75 0 0 1 20 21" />
    </svg>
  );
}

const links = [
  { to: "/", label: "Tomar pedido", end: true, Icon: IconNuevoPedido },
  { to: "/pedidos", label: "Ver pedidos", Icon: IconLista },
  { to: "/modelos", label: "Modelos", Icon: IconCatalogo },
  { to: "/catalogos", label: "Catálogos", Icon: IconLibro },
];

export default function Nav() {
  return (
    <nav className="nav">
      {links.map(({ to, label, end, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `nav-link${isActive ? " nav-link-activo" : ""}`}
        >
          <Icon />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
