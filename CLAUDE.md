CLAUDE.md — Sistema de gestión de pedidos, Fábrica de sillones

Este archivo es la especificación y el punto de partida del proyecto. Léelo completo antes de escribir código. Es la fuente de verdad: ante cualquier duda de alcance, volvé a este documento antes de inventar algo nuevo.

0. Instrucciones para Claude Code (leer primero)

Este es el arranque de un proyecto nuevo. Objetivo de esta primera sesión: dejar el proyecto corriendo localmente (API + base + frontend) para poder probarlo, con el catálogo de ejemplo cargado.

Hacé esto en orden, y confirmá cada paso antes de seguir al siguiente:

Armá la estructura de carpetas del proyecto (ver sección 8).
Backend: FastAPI + SQLAlchemy + PostgreSQL. Empezá con el esquema SQL (sección 3) y el script de seed (sección 4).
Levantá Postgres localmente con Docker Compose para poder desarrollar sin depender de Railway todavía. Railway se usa recién para el deploy final.
Backend: implementá los endpoints de modelos primero, probalos, después los de pedidos (sección 5).
Frontend: React como PWA. Primero la sección Modelos, después Tomar pedido, después Ver pedidos (sección 2).
Dejá un README.md corto con cómo levantar todo local (docker compose up, comando del backend, comando del frontend).
No implementes nada de la sección 10 ("hacia dónde crece"). Si te parece necesario para lo que estás haciendo, avisame primero en vez de agregarlo.
Si algo de este documento es ambiguo, preferí la opción más simple y dejá una nota en el código o en el README, en vez de preguntar y frenar el avance. Las decisiones grandes ya están tomadas en la sección 9.

No hace falta que preguntes por cada micro-decisión de implementación (nombres de archivos, estructura interna de carpetas del backend, etc.): usá tu criterio y avisá qué elegiste.

1. Qué es la aplicación

Una aplicación web instalable en una tableta (PWA) para que la fábrica tome pedidos de sillones, los consulte y administre su catálogo de modelos, guardando todo en una base de datos propia.

Reemplaza las notas de pedido en papel. No se integra con Dux ni con ningún otro sistema: es una base independiente.

Quién lo usa: el dueño de la fábrica, desde una tableta, para levantar pedidos y consultarlos.

Qué NO incluye este MVP (ver sección 10): producción por etapas, materia prima/despiece, entregas y logística, KPIs y dashboards, usuarios múltiples con roles.

2. Alcance del MVP: tres secciones
   Sección 1 — Tomar pedido

Pantalla principal, optimizada para uso táctil (dedo, parado, en el galpón).

Cliente: nombre (obligatorio) y contacto/teléfono (opcional).
Fecha del pedido (default: hoy) y fecha prometida de entrega (opcional).
Agregar uno o más sillones al pedido. Por cada ítem:
Modelo (select, solo modelos activos)
Tela (select con opciones fijas + opción "otra" que habilita texto libre)
Color y medidas (texto libre)
Cantidad (default 1)
Precio unitario (autocompletado con el precio del modelo, editable)
Subtotal por ítem y total del pedido, calculados en vivo.
Notas / observaciones (texto libre).
Botón grande "Guardar pedido". Confirmación visible al guardar, error claro si falla.

Reglas:

Mínimo un ítem y nombre de cliente para poder guardar.
El precio_unitario se congela en el ítem al guardar: no se recalcula después aunque cambie el precio del modelo.
Código de pedido correlativo y legible: P-2026-0001.
Sección 2 — Ver pedidos
Lista ordenada por fecha, más recientes primero.
Columnas: código, cliente, fecha, estado, total.
Buscador por nombre de cliente o código.
Filtros por estado y por rango de fechas.
Detalle al tocar un pedido: todos sus ítems y datos completos.
Desde el detalle, cambiar el estado del pedido (select).
Sección 3 — Gestionar modelos (catálogo)
Lista de modelos: nombre, precio, activo/inactivo.
Crear modelo nuevo.
Editar modelo (nombre, descripción, precio_base).
Activar / desactivar (botón "eliminar" que en realidad desactiva).

Regla importante: nunca DELETE físico de modelos. Solo activo = false. Un modelo inactivo desaparece del selector de "Tomar pedido" pero se sigue viendo en los pedidos históricos que lo usaron.

3. Esquema de base de datos (PostgreSQL)
   sql
   CREATE TABLE modelos (
   id SERIAL PRIMARY KEY,
   nombre TEXT NOT NULL,
   descripcion TEXT,
   precio_base NUMERIC(12,2) NOT NULL,
   activo BOOLEAN NOT NULL DEFAULT true,
   creado_en TIMESTAMP NOT NULL DEFAULT now()
   );

CREATE TABLE pedidos (
id SERIAL PRIMARY KEY,
codigo TEXT UNIQUE NOT NULL,
cliente_nombre TEXT NOT NULL,
cliente_contacto TEXT,
fecha_pedido DATE NOT NULL DEFAULT CURRENT_DATE,
fecha_prometida DATE,
estado TEXT NOT NULL DEFAULT 'pendiente'
CHECK (estado IN ('pendiente','en_proceso','listo','entregado','cancelado')),
total NUMERIC(12,2) NOT NULL DEFAULT 0,
notas TEXT,
creado_en TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE pedido_items (
id SERIAL PRIMARY KEY,
pedido_id INT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
modelo_id INT NOT NULL REFERENCES modelos(id),
cantidad INT NOT NULL DEFAULT 1,
tela TEXT,
color TEXT,
medidas TEXT,
precio_unitario NUMERIC(12,2) NOT NULL,
subtotal NUMERIC(12,2) NOT NULL
);

CREATE INDEX idx_pedidos_fecha ON pedidos(fecha_pedido);
CREATE INDEX idx_pedidos_estado ON pedidos(estado);
CREATE INDEX idx_pedido_items_pedido ON pedido_items(pedido_id);

Decisiones de diseño ya tomadas (no las reabras):

pedido_items separado desde el día uno → soporta varios sillones por pedido.
precio_unitario vive en el ítem, congelado al momento de la venta.
estado y fecha_prometida existen desde ahora aunque se usen poco: son el enganche de la futura fase de producción, para no migrar después.
codigo legible, independiente del id interno. 4. Datos de ejemplo (seed)
sql
INSERT INTO modelos (nombre, descripcion, precio_base) VALUES
('Sillón 1 cuerpo "Milán"', 'Sillón individual, líneas rectas', 180000),
('Sillón 2 cuerpos "Bristol"', 'Sofá de dos cuerpos, respaldo alto', 290000),
('Sillón 3 cuerpos "Provenza"','Sofá de tres cuerpos, estilo clásico', 380000),
('Esquinero "Oslo"', 'Modular en L, chaise longue', 520000),
('Puff "Nórdico"', 'Puff redondo con base de madera', 65000);

Telas para el select ("otra" habilita texto libre): chenille, pana, lino, ecocuero.

Pedido de ejemplo a insertar vía la API (no por SQL directo), para probar el flujo completo: cliente "Juan Pérez", ítems 1× Bristol (chenille, gris)

1× Puff Nórdico (pana, gris). 5. API

Base: /api. Todas las respuestas en JSON. Autenticación: header Authorization: Bearer <token> con un token fijo por variable de entorno (ver sección 9, punto 3) — simple a propósito, no es un sistema de usuarios.

Método Ruta Qué hace
GET /modelos Lista modelos. Query ?activos=true filtra solo activos.
POST /modelos Crea un modelo.
PATCH /modelos/{id} Edita nombre, descripción, precio_base o activo.
GET /pedidos Lista pedidos. Filtros: ?buscar=, ?estado=, ?desde=, ?hasta=.
POST /pedidos Crea un pedido con sus ítems en una sola llamada.
GET /pedidos/{id} Detalle del pedido con sus ítems.
PATCH /pedidos/{id} Cambia estado u otros datos de cabecera.

Reglas de negocio en el backend (no confiar en lo que manda el cliente):

POST /pedidos recibe cabecera + array de ítems. El backend calcula subtotal de cada ítem y total del pedido — nunca se toma el total que mande el frontend.
Generar el codigo correlativo en el backend (ej: contar pedidos del año
1, formateado P-{año}-{secuencia con padding 4}).
Todo el alta de pedido + ítems va en una sola transacción de base de datos.
Validar: al menos un ítem, cantidad > 0, nombre de cliente no vacío.
PATCH /modelos/{id} con intención de "borrar" solo setea activo = false. 6. Stack técnico
Base de datos: PostgreSQL. Local con Docker Compose para desarrollo, Railway para producción.
Backend: Python + FastAPI + SQLAlchemy + Pydantic. Servidor con Uvicorn.
Frontend: React (Vite), como PWA instalable (manifest + service worker básico + ícono). Mobile-first.
Deploy final: backend y base en Railway; frontend en Railway o Vercel.

Por qué PWA y no APK: un APK es exclusivo de Android, no instala en iPad. La PWA anda igual en ambos (en iPad: Safari → Compartir → Agregar a inicio). Si más adelante hace falta un .apk real, se envuelve esta misma web con Capacitor o TWA, sin rehacer nada.

7. Requisitos de interfaz
   Mobile-first / táctil: botones grandes, campos amplios, mínimo tipeo.
   Tres accesos claros en la navegación: Tomar pedido / Ver pedidos / Modelos.
   Feedback visible al guardar; errores de validación claros y en español.
   Moneda en pesos argentinos ($ con separador de miles), fechas DD/MM/AAAA.
   Sin necesidad de scroll horizontal en ninguna pantalla.
8. Estructura de carpetas sugerida
   /backend
   /app
   main.py
   models.py # SQLAlchemy
   schemas.py # Pydantic
   routers/
   modelos.py
   pedidos.py
   database.py
   requirements.txt
   Dockerfile
   /sql
   schema.sql
   seed.sql

/frontend
/src
/pages
TomarPedido.jsx
VerPedidos.jsx
Modelos.jsx
/components
/api # cliente HTTP
App.jsx
manifest.json
package.json

docker-compose.yml # Postgres local
CLAUDE.md # este archivo
README.md 9. Decisiones ya tomadas para este arranque

Estos son los supuestos con los que arrancamos. Son fáciles de cambiar si no van — están marcados dónde tocar en cada caso:

Backend en Python/FastAPI. Motivo: el resto del roadmap (pronóstico de demanda, informes) también va a vivir en Python, y así se comparte librerías y forma de trabajar.
Online simple, no offline-first todavía. Se asume que hay wifi donde se toma el pedido. Si en la práctica hay zonas sin señal en el galpón, avisar: se agrega guardado local (localStorage/IndexedDB) + cola de sincronización en el frontend, sin tocar el backend ni la base.
Token simple fijo en vez de login de usuarios (variable de entorno API_TOKEN, se guarda una vez en el frontend). Si se necesita distinguir quién carga cada pedido, se cambia por login real en una fase posterior.
Sin foto de modelo en este MVP, para no meter manejo de archivos todavía. Se puede sumar como campo foto_url + subida a un storage (ej: Railway volumes o S3-compatible) sin romper el esquema actual.
Tela como select con opción "otra": ordena los datos más comunes sin trabar el ingreso de casos raros. 10. Hacia dónde crece (NO implementar todavía)

El modelo de datos está pensado para que esto entre sin rehacer nada. Mencionar solo si se pregunta por el roadmap, no construir:

Fase 2 — Producción: etapas por sillón (corte → armado de estructura → costura y espuma → tapizado → terminación y control → despacho), con historial de quién y cuándo hizo cada cambio de etapa.
Fase 3 — Materia prima: despiece (BOM) por modelo, stock de materiales, cálculo automático de qué comprar, registro de merma.
Fase 4 — Entregas: estados posteriores al despacho (en ruta, entregado), prueba de entrega, seguimiento para el cliente.
Fase 5 — Indicadores: tablero de KPIs, pronóstico de demanda con estacionalidad, informes periódicos.
