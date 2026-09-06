# Fábrica de sillones — Sistema de pedidos

MVP: tomar pedidos, verlos y administrar el catálogo de modelos. Ver `CLAUDE.md` para la especificación completa.

## Cómo levantar todo en local

### 1. Base de datos (Postgres con Docker)

```bash
docker compose up -d db
```

Levanta Postgres en `localhost:5432`. Verificá que quedó lista antes de arrancar el
backend — tarda unos segundos en aceptar conexiones:

```bash
docker compose ps          # STATUS tiene que decir "healthy", no solo "running"
```

**La primera vez** (y solo la primera), Postgres corre automáticamente
`sql/schema.sql` y `sql/seed.sql`: crea las tablas, la extensión `pg_trgm`, los
índices y el catálogo inicial de modelos.

> **Esto es lo que más confunde:** esos dos scripts corren **una sola vez**, cuando
> el volumen de datos está vacío. Si editás `sql/schema.sql`, un `docker compose
> restart` **no** lo aplica — Postgres ni lo mira. Hay que borrar el volumen (ver
> abajo). Es comportamiento de la imagen oficial de Postgres, no de este proyecto.

#### Comandos del día a día

```bash
docker compose up -d db      # levantar
docker compose ps            # ver estado y salud
docker compose logs -f db    # ver los logs en vivo (Ctrl+C para salir)
docker compose stop          # parar sin borrar nada
docker compose start         # volver a arrancar lo que estaba parado
```

#### Reiniciar la base desde cero

Borra **todos** los pedidos y modelos cargados, y vuelve a correr `schema.sql` +
`seed.sql`. Es lo que hay que hacer después de tocar el esquema:

```bash
docker compose down -v       # el -v borra el volumen: acá se van los datos
docker compose up -d db
```

Sin el `-v`, los datos sobreviven y el esquema **no** se actualiza.

### 1b. Opcional: correr el backend también en Docker

Para el día a día conviene el backend en el venv (paso 2): recarga sola al guardar un
archivo. Pero antes de desplegar a Railway, vale correr **la misma imagen** que va a
correr allá, para descubrir acá cualquier diferencia:

```bash
docker compose --profile completo up --build
```

Esto levanta base + backend, con las fotos y comprobantes en un volumen persistente
(igual que en Railway) y tomando `JWT_SECRET_KEY`, `GOOGLE_CLIENT_ID` y
`ADMIN_EMAILS` de tu `backend/.env`.

> **Antes de usarlo, pará el uvicorn del venv.** Los dos escuchan en el 8000 y
> Windows los deja convivir a medias: las peticiones caen en uno o en otro sin
> criterio y aparecen errores 500 que no figuran en ningún log. Es uno **o** el
> otro.

Para bajarlo: `docker compose --profile completo down`.

### 2. Backend (FastAPI)

```bash
cd backend
python -m venv venv
./venv/Scripts/activate        # Windows (PowerShell: venv\Scripts\Activate.ps1)
pip install -r requirements.txt
cp .env.example .env           # completar JWT_SECRET_KEY, GOOGLE_CLIENT_ID y ADMIN_EMAILS — ver abajo
uvicorn app.main:app --reload
```

La API queda en `http://localhost:8000/api`. El backend **no arranca** si falta
`JWT_SECRET_KEY`, `GOOGLE_CLIENT_ID` o `ADMIN_EMAILS` — a propósito, para no
quedar corriendo con una configuración insegura por accidente.

Docs interactivas (Swagger): `http://localhost:8000/docs`.

### 3. Frontend (React + Vite, PWA)

```bash
cd frontend
npm install
cp .env.example .env           # VITE_GOOGLE_CLIENT_ID debe coincidir con GOOGLE_CLIENT_ID del backend
npm run dev
```

Queda disponible en `http://localhost:5173`.

> El service worker (PWA) **no** corre con `npm run dev`. Para probar instalación,
> actualización y comportamiento offline hay que usar el build real:
> `npm run build && npm run preview`.

### 3.1 Instalar en la pantalla de inicio (PWA)

La app es una PWA instalable. Requiere HTTPS (Vercel ya lo da) o `localhost`.

- **Android / Chrome**: aparece el banner "Instalá Chaco Living" con botón
  **Instalar**. Si se descartó, se puede instalar desde el menú ⋮ → "Instalar
  aplicación" / "Agregar a pantalla principal".
- **iPhone / iPad (Safari)**: no hay botón automático. Compartir (⎋) → **Agregar
  a inicio**. La app muestra esa instrucción en el banner.
- Una vez instalada abre a pantalla completa (sin barra del navegador) y respeta
  el notch / indicador de inicio del iPhone.

**Actualizaciones**: cuando se despliega una versión nueva, la app muestra abajo
"Hay una versión nueva → Actualizar". No recarga sola (se estaría cargando un
pedido). Config en `frontend/vite.config.js` (`registerType: 'prompt'`).

**Íconos**: se generan desde un único glifo con `npm run icons`
(`frontend/scripts/generar-iconos.mjs`). Editar ahí si cambia la marca y volver
a correr; los PNG resultantes se commitean.

### 4. Configurar el login con Google

La app usa "Iniciar sesión con Google" en vez de usuario/contraseña propios. Pasos
en [Google Cloud Console](https://console.cloud.google.com/):

1. Crear un proyecto (o usar uno existente).
2. **APIs y servicios → Pantalla de consentimiento OAuth**: tipo "Externa", modo
   "Testing" alcanza — no hace falta publicarla ni pasar revisión de Google para
   este uso interno.
3. **Credenciales → Crear credenciales → ID de cliente de OAuth**, tipo
   "Aplicación web". En "Orígenes de JavaScript autorizados" agregar
   `http://localhost:5173` (y, cuando exista, la URL real de producción).
4. Copiar el Client ID (termina en `.apps.googleusercontent.com`, **no es
   secreto**) a `GOOGLE_CLIENT_ID` en `backend/.env` y a `VITE_GOOGLE_CLIENT_ID`
   en `frontend/.env`.
5. Completar `ADMIN_EMAILS` en `backend/.env` con los emails de Google que pueden
   entrar a la app, separados por coma. Cualquier otra cuenta de Google recibe un
   403.

`JWT_SECRET_KEY` se genera una sola vez, local:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

## Notas de implementación

- El precio unitario de cada ítem se congela al guardar el pedido (no se
  recalcula si después cambia el precio del modelo).
- El código de pedido (`P-2026-0001`) se genera en el backend, correlativo por año.
- "Eliminar" un modelo en realidad lo desactiva (`activo = false`); nunca se
  borra físicamente, para no romper pedidos históricos.
- Autenticación con login de Google (ver "Configurar el login con Google" arriba):
  el frontend nunca guarda un secreto fijo, el backend emite su propia sesión
  (JWT, 30 días) recién después de validar el token de Google contra la lista
  blanca `ADMIN_EMAILS`. Reemplaza al token fijo del MVP original (sección 9 del
  CLAUDE.md) — detalle completo en `Arreglos.md`, sección 12.
- El monograma (`favicon.svg`, íconos PWA `pwa-*.png` / `apple-touch-icon.png`
  generados con `npm run icons`, marca del header) es un ícono de sillón autorado
  a partir de la paleta descripta por el dueño (grises/negro + un verde acotado);
  no es el logo real de Chaco Living, que todavía no se entregó como archivo.
  Reemplazar el glifo en `frontend/scripts/generar-iconos.mjs` cuando esté disponible.
- Sistema de diseño documentado en `PRODUCT.md` (contexto de producto) y
  `DESIGN.md` (paleta, tipografía, componentes) usando la skill `impeccable`
  instalada a nivel de proyecto en `.claude/skills/impeccable`.
- Cada modelo del catálogo admite varias fotos opcionales (`modelos.fotos`,
  array de rutas; la primera es la portada), subidas desde "Modelos". Se
  guardan en disco en `backend/app/uploads/` (no versionado) y se sirven en
  `/uploads/<archivo>`, con `Cache-Control` de un año (nunca se sobrescribe un
  archivo, cada subida tiene nombre nuevo). La ruta es configurable con la
  variable `UPLOADS_DIR`: sin ella, cae en `backend/app/uploads/` como en
  desarrollo local; en Railway hay que apuntarla a un volumen persistente,
  porque el disco del contenedor es efímero y se borra en cada redeploy (ver
  CLAUDE.md sección 9, punto 4, para la alternativa de storage S3-compatible).
  El backend expone además `foto_url` (= `fotos[0]` o `null`) para todo lo que
  muestra una sola foto: la miniatura de la lista, los ítems del pedido y el
  comprobante en PDF. Tocar una fila en "Modelos" abre un popup con el detalle
  completo del modelo; Editar y Activar/Desactivar viven ahí adentro.
- "Tomar pedido" y el detalle de "Ver pedidos" muestran la foto del modelo
  elegido en cada ítem (no se suben fotos por ítem/pedido). El paso
  "Confirmar" del wizard lista los ítems en formato factura (modelo, foto,
  detalle, cantidad × precio, subtotal) antes de guardar.
- Mientras se completan los pasos "Cliente" y "Sillones" (y "Confirmar"), el
  formulario se guarda solo en `localStorage` del navegador (clave
  `chaco_pedido_borrador`), para no perder lo cargado si se recarga la
  página o se corta la conexión a mitad de la carga en el galpón. El
  borrador se borra recién cuando el pedido se guardó con éxito en el
  backend.
- Al guardar un pedido, el backend genera automáticamente un comprobante en
  PDF (`comprobante_url` en `pedidos`, servido desde `/uploads/comprobantes/`)
  con los datos del pedido en formato factura. El frontend lo descarga solo
  apenas se guarda (paso 4, "Pedido guardado") y también queda disponible
  para ver/descargar desde el detalle en "Ver pedidos". La generación usa la
  librería `reportlab` (agregada a `backend/requirements.txt` — hace falta
  `pip install -r requirements.txt` de nuevo y reiniciar el backend para que
  tome el nuevo endpoint).

### Nota sobre el auto-reload del backend en esta carpeta

El proyecto vive dentro de OneDrive, y su sincronización en segundo plano
puede hacer que el `--reload` de uvicorn (basado en watchfiles) se cuelgue a
mitad de un reinicio y deje el puerto ocupado por un proceso zombie que no se
puede matar sin reiniciar Windows. Si eso pasa: cambiá de puerto (`--port`) y
actualizá `frontend/.env` (`VITE_API_BASE`), o corré uvicorn sin `--reload` y
reiniciá manualmente el proceso después de cada cambio de código.

## Ramas

- `main`: lo que está desplegado (o listo para desplegarse). No se trabaja
  directo acá.
- `dev`: rama de trabajo para lo nuevo. Se mergea a `main` cuando algo queda
  probado y listo.

Pensado para conectar cada rama a su propio entorno en Railway/Vercel (`dev` →
entorno de pruebas, `main` → producción), para poder probar cambios sin tocar
lo que ya funciona.

## Deploy

Backend + Postgres en **Railway**, frontend en **Vercel**. El orden importa: cada
paso produce un dato que necesita el siguiente.

### 1. Postgres en Railway

Crear el servicio Postgres y **correr el esquema a mano, una vez**:

```bash
psql "<DATABASE_URL que da Railway>" -f sql/schema.sql
psql "<DATABASE_URL que da Railway>" -f sql/seed.sql
```

> Esto no es opcional ni automático. El `docker-entrypoint-initdb.d` que corre
> los scripts en local es una función de la imagen de Postgres, no del Postgres
> administrado de Railway: allá la base arranca vacía. Correr `schema.sql`
> **entero**, que además de las tablas crea la extensión `pg_trgm` y los índices
> del buscador.

> **Base nueva:** `schema.sql` ya trae todo el esquema actual — no corras
> ninguna migración de `sql/`. Las `sql/migracion_*.sql` son solo para
> **actualizar una base que ya tenía datos** (p. ej. el entorno `dev` que se
> creó con un esquema anterior). Cada una corre **una vez**, va dentro de una
> transacción y es idempotente. En orden histórico:
> `migracion_cliente_extendido.sql`, `migracion_medidas_modelo.sql`,
> `migracion_medidas_item.sql`, `migracion_produccion_0_0_3.sql` (junta las tres
> anteriores), `limpieza_medidas_cm.sql`, `migracion_fotos_modelo.sql` (varias
> fotos por modelo, 0.0.4).

### 2. Backend en Railway

Railway detecta `backend/Dockerfile` solo. Hay que configurarle:

- **Root Directory**: `backend` (es un monorepo; sin esto busca el Dockerfile en la raíz).
- **Volumen persistente**, montado por ejemplo en `/datos/uploads`.

Variables de entorno:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | la que genera el Postgres de Railway |
| `JWT_SECRET_KEY` | **una nueva**, distinta a la de desarrollo — `python -c "import secrets; print(secrets.token_hex(32))"` |
| `GOOGLE_CLIENT_ID` | el mismo de Google Cloud Console |
| `ADMIN_EMAILS` | los emails autorizados, separados por coma |
| `UPLOADS_DIR` | la ruta donde montaste el volumen (ej. `/datos/uploads`) |
| `CORS_ORIGINS` | la URL de Vercel — se carga recién en el paso 4 |

No hace falta setear `PORT`: Railway lo inyecta y el Dockerfile ya lo respeta.

### 3. Frontend en Vercel

- **Root Directory**: `frontend`.
- Framework: Vite (lo detecta solo).

Variables de entorno:

| Variable | Valor |
|---|---|
| `VITE_API_BASE` | la URL pública del backend + `/api` |
| `VITE_GOOGLE_CLIENT_ID` | el mismo Client ID |

> Las dos se compilan **dentro** del bundle. Si las cargás después de un deploy,
> hay que volver a desplegar para que tomen efecto — no alcanza con guardarlas.

`frontend/vercel.json` ya trae el rewrite que necesita una SPA: sin él,
entrar directo a `/pedidos/7` o refrescar en el detalle de un pedido daría 404,
porque no existe ningún archivo en esa ruta.

### 4. Cerrar el círculo

Con la URL de Vercel ya existente:

1. Cargar `CORS_ORIGINS` en Railway con esa URL y redesplegar el backend.
2. Agregarla en Google Cloud Console → Credenciales → "Orígenes de JavaScript
   autorizados". **Sin esto el botón de Google no funciona en producción**,
   aunque todo lo demás esté bien: hoy solo está `http://localhost:5173`.

### 5. Probar que el volumen quedó bien

La prueba que importa: tomar un pedido real, confirmar que descarga el PDF,
**hacer un redeploy** y volver a abrir ese pedido. Si el comprobante sigue
disponible, el volumen está bien montado. Si dio 404, `UPLOADS_DIR` no está
apuntando al volumen — y sin eso, cada redeploy borra todas las facturas.

Si eso llegara a pasar, no se pierden: el detalle de cada pedido tiene un botón
para generar el comprobante de nuevo (se reconstruye desde los datos guardados).
