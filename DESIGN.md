---
name: Chaco Living - Pedidos
description: Herramienta táctil de piso de fábrica para tomar y consultar pedidos de sillones
colors:
  ink-900: "#14171a"
  ink-700: "#3a4046"
  ink-500: "#676f77"
  ink-400: "#8b929a"
  ink-300: "#b9bfc4"
  ink-200: "#dde1e3"
  ink-100: "#eef0f1"
  paper: "#f5f6f6"
  white: "#ffffff"
  accent-700: "#253f34"
  accent-600: "#37564a"
  accent-500: "#3f6153"
  accent-100: "#e3ebe7"
  estado-pendiente-bg: "#faf0d7"
  estado-pendiente-fg: "#7a5c14"
  estado-en-proceso-bg: "#dbe7f6"
  estado-en-proceso-fg: "#204b83"
  estado-listo-bg: "#dcefe6"
  estado-listo-fg: "#1c6b4f"
  estado-cancelado-bg: "#f6dfd9"
  estado-cancelado-fg: "#8a3820"
typography:
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  heading-lg:
    fontFamily: "{typography.body.fontFamily}"
    fontSize: "1.625rem"
    fontWeight: 700
    letterSpacing: "-0.01em"
  heading-md:
    fontFamily: "{typography.body.fontFamily}"
    fontSize: "1.3125rem"
    fontWeight: 700
    letterSpacing: "-0.01em"
  label:
    fontFamily: "{typography.body.fontFamily}"
    fontSize: "0.9375rem"
    fontWeight: 600
rounded:
  sm: "8px"
  md: "12px"
  pill: "999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.accent-600}"
    textColor: "{colors.white}"
    rounded: "{rounded.sm}"
    padding: "1rem"
  button-primary-hover:
    backgroundColor: "{colors.accent-700}"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.accent-700}"
    rounded: "{rounded.sm}"
    padding: "0.8rem"
  card:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.md}"
    padding: "1.1rem"
---

# Design System: Chaco Living - Pedidos

## Overview

**Creative North Star: "El cuaderno de pedidos del galpón"**

Reemplaza el cuaderno de notas de papel de la fábrica, así que se comporta como uno: rápido de leer de un vistazo, sin decoración que compita con los datos, con una sola acción que siempre se destaca (guardar el pedido). Es un sistema **Operate** — el usuario está haciendo una tarea, de pie, en el taller — no una pieza de marketing. La paleta es gris/negro con un verde contenido (el verde real de la marca Chaco Living), usado únicamente donde importa: la acción primaria, la selección/estado actual y las cifras de dinero.

Rechazo visual confirmado: nada de tarjetas anidadas, nada de iconos-emoji, nada de sombras decorativas sin profundidad real, nada de un segundo color saturado compitiendo con el verde de marca.

**Key Characteristics:**
- Restrained: neutros primero, el acento verde reservado a acción primaria / selección / cifras de total.
- Una sola familia tipográfica (stack de sistema), sin fuente display.
- Densidad estructural: tarjetas apiladas en tablet/mobile, tabla real en desktop — no tipografía fluida.
- Iconografía propia, mínima, de un solo trazo (nunca emoji).

## Colors

Paleta restringida: negro/gris para casi todo, un verde de marca reservado a acción y estado.

### Primary
- **Verde Chaco** (`#3f6153` / `accent-500`): color de marca, usado en el ícono/monograma y como base del acento interactivo (`accent-600` `#37564a` para botones y navegación activa, `accent-700` `#253f34` para hover/texto sobre tinte).

### Neutral
- **Tinta** (`#14171a` / `ink-900`): texto principal, fondo del encabezado superior.
- **Grafito** (`#3a4046` / `ink-700`), **Piedra** (`#676f77` / `ink-500`): texto secundario y etiquetas.
- **Niebla** (`#dde1e3` / `ink-200`): bordes de tarjetas, inputs, separadores.
- **Papel** (`#f5f6f6` / `paper`): fondo de página.
- **Blanco** (`#ffffff`): superficie de tarjetas, encabezados de tabla.

### Named Rules
**La regla del acento único.** El verde de marca aparece solo en: el monograma, el botón primario, el ítem activo de navegación, el foco de campos y el estado "Entregado". En ningún otro lugar decora la superficie.

## Typography

**Body/UI Font:** stack de sistema (`-apple-system, "Segoe UI", Roboto, Arial, sans-serif`)

**Character:** una sola familia para todo — títulos, botones, etiquetas, datos — típica de una interfaz de producto (Operate); no hay fuente display, para que nada compita con los números y el estado del pedido.

### Hierarchy
- **Heading-lg** (700, 1.625rem): título de página (`<h1>`).
- **Heading-md** (700, 1.3125rem): título de sección dentro de una tarjeta (`<h2>`).
- **Label** (600, 0.9375rem): etiquetas de campo, texto de navegación.
- **Body** (400, 1rem): texto de formulario e ítems.
- **Small** (400/700, 0.8125–0.9375rem): metadatos secundarios (fecha, precio unitario en filas).

## Layout

Lienzo principal: **tablet** (768–1024px), de pie, uso táctil. Se adapta hacia abajo (teléfono angosto) y hacia arriba (desktop de escritorio) con cambios **estructurales**, no con tipografía fluida.

- **< 420px:** los pares de campos (`fila-2`) colapsan a una sola columna para que no se aprieten.
- **≥ 700px (tablet):** el contenido central se limita a 680px para que el formulario no se estire de más.
- **≥ 1024px (desktop):** la barra inferior de navegación se convierte en un riel lateral fijo de 220px; las listas de pedidos y modelos pasan de tarjetas apiladas a una tabla real con encabezado de columnas (`--cols-lista`, `--cols-modelos`), aprovechando el ancho disponible con densidad de datos.

## Elevation & Depth

Sistema mayormente plano con una sombra suave y consistente en tarjetas y filas clicables (`--shadow-card`), nunca sombras de bloque duro ni halos de color con offset cero.

### Shadow Vocabulary
- **card** (`0 1px 2px rgba(20,23,26,.04), 0 6px 16px rgba(20,23,26,.05)`): toda tarjeta (`.tarjeta`) y fila de lista clicable.

### Named Rules
**La regla de la sombra honesta.** Toda sombra lleva offset y blur reales; nunca decoración de brillo puro.

## Shapes

Esquinas redondeadas moderadas: 12px en tarjetas (`--radius-md`), 8px en botones/inputs (`--radius-sm`), píldora completa en las etiquetas de estado. Bordes de 1px en `ink-200` en vez de contornos gruesos. Sin `border-left` de color en tarjetas ni alertas.

## Components

### Buttons
- **Shape:** radius 8px en los tres tipos.
- **Primario:** fondo `accent-600`, texto blanco, peso 700; hover `accent-700`; active `scale(0.99)`; disabled `opacity:.55`.
- **Secundario:** fondo blanco, borde 1.5px `accent-600`, texto `accent-700`; hover fondo `accent-100`.
- **Texto/ghost:** sin fondo ni borde, color `accent-600`; hover fondo `ink-100`.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** blanco sobre fondo `paper`.
- **Shadow Strategy:** ver Elevation & Depth.
- **Border:** 1px `ink-200`.
- **Internal Padding:** ~1.1rem.

### Inputs / Fields
- **Style:** borde 1px `ink-300`, radius 8px, fondo blanco.
- **Hover:** borde `ink-400`.
- **Focus:** borde `accent-500` + anillo `0 0 0 3px accent-100`.

### Navigation
- **Mobile/tablet:** barra inferior fija, 3 destinos (ícono + etiqueta), indicador activo = barra superior de 3px en `accent-500` + color de texto `accent-600`.
- **Desktop (≥1024px):** riel lateral izquierdo, mismos íconos en fila horizontal ícono+etiqueta, activo = fondo `accent-100` + indicador lateral de 3px.
- **Íconos:** trazo propio de 1.75px, sin relleno, `currentColor` (nuevo pedido = documento con "+"; ver pedidos = lista de líneas; modelos = grilla 2×2). Nunca emoji.

### Estado badges (pedidos)
Píldora con punto de color a la izquierda (`::before`, `currentColor`), un par bg/fg por estado: pendiente (ámbar), en_proceso (azul), listo (verde-azulado), entregado (verde de marca), cancelado (terracota). El mismo componente se reutiliza para "Activo/Inactivo" en modelos.

## Do's and Don'ts

### Do:
- **Do** reservar el verde de marca (`accent-*`) para acción primaria, selección/nav activa, foco y estado "Entregado"/"Activo".
- **Do** usar la tabla real (`--cols-lista` / `--cols-modelos`) en desktop en vez de estirar las tarjetas de mobile.
- **Do** mantener un solo stack tipográfico de sistema; no introducir una fuente display.
- **Do** dar estados hover/focus/active/disabled a todo control interactivo nuevo.

### Don't:
- **Don't** anidar tarjetas dentro de tarjetas.
- **Don't** usar emoji ni glifos Unicode como iconografía; los íconos se autoran en SVG con el mismo trazo de 1.75px.
- **Don't** aplicar `opacity` baja a una fila entera para marcar "inactivo" (reduce el contraste); usar la píldora de estado + fondo `paper` en su lugar.
- **Don't** agregar un segundo color saturado que compita con el verde de marca.
