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
cp .env.example .env           # ajustar API_TOKEN si hace falta
uvicorn app.main:app --reload
```

La API queda en `http://localhost:8000/api`. Todas las rutas requieren el header
`Authorization: Bearer <API_TOKEN>` (por defecto `changeme`, definido en `.env`).

Docs interactivas (Swagger): `http://localhost:8000/docs`.

### 3. Frontend (React + Vite, PWA)

```bash
cd frontend
npm install
cp .env.example .env           # VITE_API_TOKEN debe coincidir con el del backend
npm run dev
```

Queda disponible en `http://localhost:5173`.

## Notas de implementación

- El precio unitario de cada ítem se congela al guardar el pedido (no se
  recalcula si después cambia el precio del modelo).
- El código de pedido (`P-2026-0001`) se genera en el backend, correlativo por año.
- "Eliminar" un modelo en realidad lo desactiva (`activo = false`); nunca se
  borra físicamente, para no romper pedidos históricos.
- Autenticación simple con token fijo por variable de entorno, a propósito
  (ver sección 9 del CLAUDE.md) — no es un sistema de usuarios.
- El monograma (`favicon.svg`, `icon-192/512.png`, marca del header) es un ícono de
  sillón autorado a partir de la paleta descripta por el dueño (grises/negro +
  un verde acotado); no es el logo real de Chaco Living, que todavía no se
  entregó como archivo. Reemplazar cuando esté disponible.
- Sistema de diseño documentado en `PRODUCT.md` (contexto de producto) y
  `DESIGN.md` (paleta, tipografía, componentes) usando la skill `impeccable`
  instalada a nivel de proyecto en `.claude/skills/impeccable`.
- Cada modelo del catálogo admite una foto opcional (`foto_url`), subida desde
  "Modelos". Se guarda en disco en `backend/app/uploads/` (no versionado) y se
  sirve en `/uploads/<archivo>`. Pensado como almacenamiento simple para
  desarrollo local — al desplegar en Railway conviene moverlo a un volumen
  persistente o a un storage S3-compatible (ver CLAUDE.md sección 9, punto 4).
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

## Deploy

Pensado para Railway (backend + Postgres) y Railway/Vercel (frontend). No
configurado todavía en esta primera sesión — se hace cuando el flujo local
esté probado y aprobado.
