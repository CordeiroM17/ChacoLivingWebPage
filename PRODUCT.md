# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

El dueño de Chaco Living (fábrica de sillones), usando una tableta de pie en el galpón de producción, para levantar pedidos de sillones a medida, consultarlos después y mantener el catálogo de modelos.

## Product Purpose

Reemplazar las notas de pedido en papel. Permite tomar pedidos (cliente, ítems, tela, color, medidas, precio), consultarlos con filtros, y administrar el catálogo de modelos (alta, edición, activar/desactivar). Éxito = ningún pedido se pierde ni se carga mal, y consultarlo después es más rápido que buscar el papel.

## Positioning

Base de datos propia e independiente de la fábrica: no se integra con Dux ni con ningún otro sistema externo. Reemplazo directo del papel, no un ERP.

## Operating Context

Se usa parado, en el piso de producción (galpón), con los dedos posiblemente sucios o con las manos ocupadas — de ahí la prioridad táctil (botones grandes, mínimo tipeo). Se asume wifi disponible en el galpón (no offline-first por ahora). Un solo usuario real (el dueño), sin necesidad de login multiusuario.

## Capabilities and Constraints

Tres secciones: Tomar pedido, Ver pedidos, Gestionar modelos (catálogo). Reglas de negocio ya implementadas en el backend:
- El precio unitario se congela en el ítem al guardar el pedido (no se recalcula si cambia el precio del modelo).
- El total del pedido se calcula siempre en el backend, nunca se confía en el total que mande el frontend.
- Código de pedido correlativo y legible (`P-2026-0001`), generado en el backend.
- Los modelos nunca se borran físicamente: "eliminar" un modelo lo desactiva (`activo=false`); sigue viendo en pedidos históricos.
- Autenticación simple con token fijo por variable de entorno (no es un sistema de usuarios).
- Explícitamente fuera de este MVP: producción por etapas, materia prima/despiece, entregas/logística, KPIs/dashboards, usuarios múltiples con roles, fotos de modelo (sin manejo de archivos todavía).
- Moneda en pesos argentinos, fechas DD/MM/AAAA.

## Brand Commitments

Nombre real: **Chaco Living**. Existe un logo con paleta de grises, negro y un poco de verde — el dueño no está seguro de que el verde quede bien y pidió usarlo con moderación (poco protagonismo) en vez de como color dominante.

## Evidence on Hand

Catálogo semilla ya cargado en la base: Sillón 1 cuerpo "Milán" ($180.000), Sillón 2 cuerpos "Bristol" ($290.000), Sillón 3 cuerpos "Provenza" ($380.000), Esquinero "Oslo" ($520.000), Puff "Nórdico" ($65.000). Pedido de ejemplo ya creado vía API (cliente Juan Pérez, P-2026-0001). No hay fotos de los modelos todavía (fuera de alcance del MVP). No hay logo en archivo digital entregado aún — solo la descripción de su paleta.

## Product Principles

1. Táctil primero: se usa parado, en el taller, con el dedo — botones grandes, mínimo tipeo, sin scroll horizontal.
2. Nunca perder un pedido: guardar tiene que ser simple, rápido y con confirmación clara; los errores de validación se explican en español simple.
3. Precisión de datos por sobre flexibilidad: precios congelados, totales calculados por el servidor, nunca por el cliente.
4. Historial intacto: el catálogo cambia (modelos se desactivan) pero los pedidos pasados nunca pierden información.
5. Independencia: sistema propio, no depende ni se integra con Dux ni otros sistemas externos.
