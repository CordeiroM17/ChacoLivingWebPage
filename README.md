# Fábrica de sillones — Sistema de pedidos

MVP: tomar pedidos, verlos y administrar el catálogo de modelos. Ver `CLAUDE.md` para la especificación completa.

## Cómo levantar todo en local

### 1. Base de datos (Postgres con Docker)

```bash
docker compose up -d db
```

Esto levanta Postgres en `localhost:5432` y, la primera vez, corre automáticamente
`sql/schema.sql` y `sql/seed.sql` (catálogo inicial de modelos). Si necesitás
resetear la base desde cero: `docker compose down -v && docker compose up -d db`.

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
- El monograma (`favicon.svg`, `icon-192/512.png`, marca del header) es un ícono de
  sillón autorado a partir de la paleta descripta por el dueño (grises/negro +
  un verde acotado); no es el logo real de Chaco Living, que todavía no se
  entregó como archivo. Reemplazar cuando esté disponible.
- Sistema de diseño documentado en `PRODUCT.md` (contexto de producto) y
  `DESIGN.md` (paleta, tipografía, componentes) usando la skill `impeccable`
  instalada a nivel de proyecto en `.claude/skills/impeccable`.
- Cada modelo del catálogo admite una foto opcional (`foto_url`), subida desde
  "Modelos". Se guarda en disco en `backend/app/uploads/` (no versionado) y se
  sirve en `/uploads/<archivo>`, con `Cache-Control` de un año (nunca se
  sobrescribe un archivo, cada subida tiene nombre nuevo). La ruta es
  configurable con la variable `UPLOADS_DIR`: sin ella, cae en
  `backend/app/uploads/` como en desarrollo local; en Railway hay que
  apuntarla a un volumen persistente, porque el disco del contenedor es
  efímero y se borra en cada redeploy (ver CLAUDE.md sección 9, punto 4, para
  la alternativa de storage S3-compatible).
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

Pensado para Railway (backend + Postgres) y Railway/Vercel (frontend).

Antes del primer deploy hace falta, como mínimo:

1. Correr `sql/schema.sql` y `sql/seed.sql` a mano contra el Postgres de
   Railway (el `docker-entrypoint-initdb.d` que los corre automático es una
   función de la imagen de Postgres en local, no del Postgres administrado
   de Railway).
2. Configurar un volumen persistente en Railway y apuntar `UPLOADS_DIR` ahí.
3. Cargar las variables de entorno del backend (`DATABASE_URL`,
   `JWT_SECRET_KEY`, `GOOGLE_CLIENT_ID`, `ADMIN_EMAILS`, `CORS_ORIGINS`,
   `UPLOADS_DIR`) y del frontend (`VITE_API_BASE`, `VITE_GOOGLE_CLIENT_ID`).
4. Agregar la URL real del frontend como origen autorizado en las credenciales
   OAuth de Google Cloud Console (arriba solo se cargó `localhost:5173`).
