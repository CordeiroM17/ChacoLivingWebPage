# Arreglos aplicados — Chaco Living

Registro de los ajustes de rendimiento y reducción de peticiones que salieron de la
auditoría de red del 18/08/2026. Cada sección documenta el problema, el arreglo y cómo
se verificó.

---

## 1. Compresión gzip en el backend

**Fecha:** 18/08/2026
**Archivo:** `backend/app/main.py`

### El problema

La API respondía siempre sin comprimir. El JSON de listas (pedidos, modelos) es texto
repetitivo — comprime muy bien — y ese ahorro crece con cada pedido nuevo que se agregue
a la base.

### El arreglo

Una línea: se agregó `GZipMiddleware` (de `fastapi.middleware.gzip`) con
`minimum_size=500`, para no gastar CPU comprimiendo respuestas chicas donde no vale la
pena (como `/api/health`).

### Verificación

Medido contra el backend reiniciado, con y sin `Accept-Encoding: gzip`:

| Endpoint | Sin comprimir | Con gzip | Ahorro |
|---|---|---|---|
| `GET /api/pedidos` | 2375 bytes | 490 bytes | 79% |
| `GET /api/modelos` | 1096 bytes | 389 bytes | 65% |
| `GET /api/modelos?activos=true` | 946 bytes | 351 bytes | 63% |
| `GET /api/health` | 15 bytes | sin comprimir | esperado — por debajo de `minimum_size=500` |

El header `content-encoding: gzip` aparece en las respuestas que superan los 500 bytes,
y no se activa en respuestas mínimas donde comprimir agregaría overhead sin beneficio.
Sumado al fix de `127.0.0.1` de la auditoría (evita el peaje de resolución IPv6 de
`localhost` en Windows), cada petición de lista quedó rápida y liviana.

### Re-verificación (18/08/2026, cierre de jornada)

Se volvió a probar todo contra el backend en ejecución:

- **Compresión activa** en los tres endpoints de lista, con `vary: Accept-Encoding`
  presente (correcto para que los cachés intermedios no sirvan una respuesta comprimida
  a un cliente que no la acepta).
- **CORS intacto por encima de gzip**: el orden de los middleware es el correcto
  (`CORSMiddleware` envuelve a `GZipMiddleware`). El preflight `OPTIONS` responde 200 con
  sus `access-control-*`, y las respuestas simples traen `access-control-allow-origin`
  junto al `content-encoding: gzip`.
- **JSON íntegro**: descomprimido devuelve los 9 pedidos con las 11 claves esperadas.
- **Latencia medida en el momento**: `127.0.0.1` → 0,0057 s contra `localhost` → 0,2172 s.
  El fix de la auditoría sigue en efecto.

---

## 2. Filtro en tiempo real de "Ver pedidos" — corrección de condición de carrera

**Fecha:** 18/08/2026
**Archivos:** `frontend/src/pages/VerPedidos.jsx`, `frontend/src/api/client.js`, `frontend/src/api/pedidos.js`

### El problema

Al sacar el botón "Filtrar" (cambio anterior) quedaron tres fallas:

1. **Condición de carrera real**: si el usuario escribía rápido ("j" → "ju" → "jua" → "juan"), cada tecla disparaba una petición nueva sin cancelar la anterior. Si la respuesta de "j" tardaba más en volver que la de "juan" (típico con latencia de red variable), la pantalla terminaba mostrando los resultados de "j" — una búsqueda vieja pisando a la actual.
2. Estado y fechas (selects/inputs de fecha) pasaban por el mismo debounce de 300ms que el texto, aunque son selecciones discretas que no necesitan esperar.
3. La carga inicial al entrar a la página esperaba 300ms sin motivo, antes de traer la primera lista.

### El arreglo

- **`buscarDebounced`**: el texto tipeado (`buscar`) se mantiene responsive en el input, pero solo dispara la búsqueda 300ms después de que el usuario deja de tipear, vía un estado separado (`buscarDebounced`). Estado y fechas disparan la carga al instante, sin pasar por ese debounce.
- **`AbortController`**: cada `cargarPedidos()` cancela la petición anterior antes de lanzar la nueva, y además chequea si la petición que acaba de resolver sigue siendo la vigente antes de aplicar su resultado al estado (`if (controladorRef.current === controlador)`). Esto es lo que realmente cierra la condición de carrera: aunque una respuesta vieja llegue después que una nueva, nunca se aplica.
- `api/client.js` y `api/pedidos.js` ahora aceptan un segundo parámetro de opciones (`{ signal }`) que se pasa directo al `fetch`.

### Verificación

Se probó el patrón exacto contra un script Node que reproduce el escenario real (petición vieja con más latencia que la nueva, llegando después):

| | Código viejo (sin abort/guard) | Código nuevo |
|---|---|---|
| Resultado final en pantalla tras "j" (200ms) → "juan" (20ms) | `resultados_de_j` ❌ | `resultados_de_juan` ✓ |

También se corrió una simulación de tipeo rápido contra el backend real (`127.0.0.1:8000`), confirmando que las peticiones intermedias se cancelan o se ignoran correctamente y que solo el último texto tipeado queda aplicado.

Build de frontend verificado limpio (`npm run build`, sin warnings nuevos). Los scripts de prueba fueron temporales y se borraron al terminar; no se creó ni modificó ningún pedido real en la base.

**Efecto colateral positivo:** al entrar a "Ver pedidos" la primera carga ya no espera los 300ms artificiales — se dispara apenas monta el componente.

---

## 3. No recargar la lista de modelos después de guardar/activar uno

**Fecha:** 18/08/2026
**Archivo:** `frontend/src/pages/Modelos.jsx`

### El problema

`guardar()` (crear o editar un modelo) y `alternarActivo()` (activar/desactivar) hacían
su `POST`/`PATCH` y después llamaban `cargarModelos()`, que vuelve a pedir la lista
completa — aunque el backend ya había devuelto el modelo actualizado en la respuesta del
mismo `POST`/`PATCH`. Dos peticiones para lo que se puede resolver con una.

### El arreglo

Ambas funciones ahora usan directamente el objeto que devuelve `POST`/`PATCH` para
actualizar el estado local (`setModelos`) en vez de volver a pedir la lista:

- **Guardar** (crear o editar): reemplaza el modelo por `id` en el array y vuelve a
  ordenar por nombre (mismo criterio que usa el backend en `GET /modelos`), para que un
  cambio de nombre reordene la fila igual que si se hubiera recargado.
- **Activar/desactivar**: reemplaza el modelo por `id` con la respuesta del `PATCH`, sin
  necesidad de reordenar (el nombre no cambia).

### Verificación

Contra el backend real (`127.0.0.1:8000`), confirmando que la respuesta de `POST` y
`PATCH` trae todos los campos que la UI necesita:

```
POST /api/modelos  -> { nombre, descripcion, precio_base, foto_url, id, activo, creado_en }
PATCH /api/modelos/7 -> { nombre, descripcion, precio_base, foto_url, id, activo: false, creado_en }
```

| Acción | Peticiones antes | Peticiones después |
|---|---|---|
| Guardar modelo (crear o editar) | 2 (`POST`/`PATCH` + `GET`) | 1 |
| Activar / desactivar modelo | 2 (`PATCH` + `GET`) | 1 |

Build de frontend verificado limpio (`npm run build`). El modelo de prueba creado para
la verificación (`ZZ_TEST_SinRefetch`) se borró de la base al terminar; no queda rastro
en el catálogo real.

---

## 4. Catálogo de modelos en memoria, respaldado en localStorage

**Fecha:** 18/08/2026
**Archivos:** `frontend/src/context/CatalogoContext.jsx` (nuevo), `frontend/src/context/catalogo.js` (nuevo), `frontend/src/App.jsx`, `frontend/src/pages/TomarPedido.jsx`, `frontend/src/pages/Modelos.jsx`

### El problema

El catálogo de modelos cambia poco pero lo necesitan dos pantallas, y cada una lo
pedía por su cuenta cada vez que se entraba:

- "Tomar pedido" pedía `GET /modelos?activos=true` en cada montaje.
- "Modelos" pedía `GET /modelos` en cada montaje.

Navegar entre secciones (algo constante en una tableta) repetía esas peticiones una
y otra vez, y cada entrada mostraba "Cargando..." aunque los datos fueran los mismos
de treinta segundos antes.

### El arreglo

Un `CatalogoProvider` en la raíz de la app (dentro de `App.jsx`, por fuera de las
rutas) que mantiene el catálogo en memoria y lo respalda en localStorage bajo la
clave `chaco_catalogo_modelos_v1`. La estrategia es *stale-while-revalidate*:

1. Al abrir la app, el estado se hidrata **sincrónicamente** desde localStorage: la
   pantalla aparece llena, sin spinner ni parpadeo.
2. Se dispara **una sola** revalidación por sesión de app (`GET /modelos`, la lista
   completa), protegida por un ref para que no se repita al navegar.
3. Guardar, editar o activar/desactivar un modelo actualiza el catálogo compartido
   con la respuesta del `POST`/`PATCH` (sigue valiendo el arreglo 3), y eso se
   persiste en localStorage.

Una sola petición sirve a las dos pantallas: "Tomar pedido" deriva `modelosActivos`
filtrando en memoria, en vez de pedir `?activos=true` aparte.

El hook `useCatalogo` vive en `catalogo.js`, separado del provider, porque React
Fast Refresh solo funciona si un archivo `.jsx` exporta únicamente componentes (el
linter lo marcaba).

### Efecto colateral: borradores que apuntan a un modelo dado de baja

El borrador del pedido también vive en localStorage y puede quedar días abierto. Si
mientras tanto se desactiva un modelo, el ítem quedaba apuntando a algo que ya no
existe en el selector. Ahora, al llegar el catálogo, "Tomar pedido" limpia esos
ítems, avisa en español y devuelve al usuario al paso de sillones. El backend valida
lo mismo del lado del servidor (ver sección 5), así que no depende de que el
navegador se porte bien.

### Verificación

| Acción | Peticiones antes | Peticiones después |
|---|---|---|
| Abrir la app | 1 (`?activos=true`) | 1 (lista completa, sirve a ambas pantallas) |
| Ir a "Modelos" | 1 | 0 |
| Volver a "Tomar pedido" | 1 | 0 |
| Cada navegación posterior entre las dos | 1 por entrada | 0 |

Queda **una sola** llamada a `modelosApi.listar` en todo el frontend, dentro del
provider y protegida por un ref (verificado por búsqueda en `frontend/src`). En la
segunda apertura de la app la lista se pinta desde localStorage antes de que vuelva
la revalidación.

`npm run lint` sin warnings y `npm run build` limpio (37 módulos, 256,82 kB / 79,99 kB gzip).

---

## 5. Validación en el backend de todo lo que manda el cliente

**Fecha:** 18/08/2026
**Archivos:** `backend/app/schemas.py`, `backend/app/errores.py` (nuevo), `backend/app/main.py`, `backend/app/routers/pedidos.py`, `backend/app/routers/modelos.py`, `backend/app/comprobantes.py`

### El problema

Con el borrador y el catálogo guardados en localStorage, el navegador dejó de ser una
fuente confiable: cualquiera puede abrir la consola, editar esos valores y mandarlos a
la API. El backend ya calculaba bien los subtotales y el total, pero aceptaba sin
chistar:

- Precios negativos, `Infinity` o `NaN` en `precio_unitario` y `precio_base`.
- Cantidades de 0, negativas o de siete cifras.
- Montos por encima del tope de `NUMERIC(12,2)`, que reventaban en la base con un 500.
- Modelos **dados de baja**: solo se validaba que el modelo existiera, no que estuviera activo.
- Textos sin límite de largo en nombre, notas, tela, color y medidas.
- `foto_url` apuntando a cualquier dominio externo, o con `../` en la ruta.
- Fechas de pedido de cualquier año, que además arman el código correlativo (`P-{año}-{secuencia}`).
- Entregas prometidas anteriores a la fecha del pedido.
- `null` explícito en campos `NOT NULL` vía `PATCH`, que terminaba en 500.

Y dos problemas más que aparecieron al probar:

- **El PDF podía romper el alta.** `Paragraph` de reportlab interpreta un subconjunto
  de HTML: un cliente llamado `Casa <i>del</b> Sillón` lanzaba `ValueError`. Como el
  comprobante se genera después del primer commit, el pedido quedaba guardado pero la
  respuesta era un 500.
- **Los errores de validación llegaban ilegibles.** FastAPI devuelve `detail` como
  lista de objetos técnicos en inglés; `client.js` hace `throw new Error(data.detail)`,
  así que el usuario veía `[object Object]`.

### El arreglo

**Formato y rangos (`schemas.py`)** — todo acotado con `Field`: montos entre 0 y
9.999.999.999,99 con `allow_inf_nan=False`, cantidad entre 1 y 1000, máximo 50 ítems
por pedido, largos máximos en cada texto, y validadores propios que hacen `strip()` y
rechazan strings que quedan vacíos. `foto_url` solo acepta la forma que devuelve el
endpoint de subida (`/uploads/{nombre}.{jpg|jpeg|png|webp|gif}`).

**Reglas de negocio (`routers/pedidos.py`)** — lo que solo se puede verificar contra la
base: que los modelos existan, que **estén activos** (con el nombre del modelo caído en
el mensaje), que el total entre en la columna, y que la fecha del pedido caiga en una
ventana razonable (hasta un año atrás, no futura).

**Nulls explícitos en `PATCH`** — los campos `NOT NULL` ignoran un `null` explícito en
vez de intentar escribirlo; los nullables se siguen pudiendo vaciar.

**PDF a prueba de texto raro (`comprobantes.py`)** — el texto del cliente se escapa
antes de entrar en un `Paragraph`, y la generación del comprobante quedó envuelta en un
`try/except`: si falla, el pedido igual se guarda y se registra el error en el log, en
vez de perder la venta.

**Errores en español (`errores.py`)** — un handler de `RequestValidationError` traduce
la lista de Pydantic a una sola frase legible, con concordancia de número ("Las notas
**superan** el máximo...") y el número de ítem cuando corresponde.

### Verificación

36 pruebas automatizadas contra una base SQLite en memoria (no se tocó la base real),
más una pasada por HTTP levantando el backend en un puerto aparte:

```
A.  Formato y rangos ......................... 17 casos, todos pasan
A2. Modelos (catálogo) .......................  5 casos, todos pasan
B.  Reglas de negocio contra la base .........  6 casos, todos pasan
C.  El total lo calcula el servidor ..........  2 casos, todos pasan
D.  Comprobante PDF con texto hostil .........  1 caso,  pasa
E.  PATCH con nulls explícitos ...............  5 casos, todos pasan
```

Mensajes devueltos por la API, probados por HTTP real:

| Payload manipulado | Respuesta |
|---|---|
| `precio_unitario: -99999` | Ítem 1 · El precio unitario no puede ser menor que cero. |
| `cantidad: 0` | Ítem 1 · La cantidad debe ser mayor que cero. |
| `cantidad: 999999` | Ítem 1 · La cantidad no puede superar 1000. |
| `cliente_nombre: "   "` | El nombre del cliente no puede quedar sin completar. |
| `items: []` | El pedido debe tener al menos un ítem. |
| `notas` de 3000 caracteres | Las notas superan el máximo de 2000 caracteres. |
| `precio_unitario: 1e400` | Ítem 1 · El precio unitario debe ser un número válido. |
| modelo desactivado | Estos modelos ya no están disponibles: Discontinuado. Actualizá el pedido antes de confirmarlo. |
| `fecha_pedido: "ayer"` | La fecha del pedido tiene un formato inválido. |
| `foto_url: "https://rastreador.example/p.png"` | La foto debe ser una imagen subida a este servidor. |
| `foto_url: "/uploads/../../../etc/passwd"` | La foto debe ser una imagen subida a este servidor. |
| `estado: "facturado"` en `PATCH` | El estado debe ser uno de: pendiente, en_proceso, listo, entregado, cancelado. |

El total se recalcula siempre en el servidor: con 2×100.000 + 1×50.000,555 el pedido
guardó 250.000,56 y los subtotales 200.000,00 y 50.000,56. Un campo `total` mandado por
el cliente se descarta en el esquema (no existe en `PedidoCreate`).

Sobre el PDF: se confirmó que reportlab **sí** rompe con marcado mal formado
(`"Juan <b Perez"` y `"Casa <i>del</b> Sillón"` lanzan `ValueError`) y que con el escape
el texto se dibuja literal. Un `&` suelto o un `<` seguido de espacio no rompían, pero
se escapan igual.

Los servidores de prueba y la base SQLite se dieron de baja al terminar, y el
comprobante que generó la prueba (`P-2026-0001.pdf`) se borró: en
`backend/app/uploads/comprobantes/` quedan solo los tres reales (0007, 0008, 0009).

### Lo que a propósito NO se valida

`precio_unitario` puede diferir del `precio_base` del modelo, incluso ser 0. Es
deliberado: la spec dice que el precio se autocompleta pero es **editable**, y en la
fábrica hace falta para bonificaciones y ajustes. El backend solo garantiza que sea un
número no negativo y dentro del rango de la columna. Si más adelante se quiere acotar
(por ejemplo, no permitir más de X% de descuento sin marcarlo), es una regla nueva a
definir, no un agujero que quedó abierto.

### Pendiente conocido

`_generar_codigo` cuenta los pedidos del año y le suma 1. Con dos altas simultáneas
ambas podrían calcular el mismo código y una fallaría por la restricción `UNIQUE`. Con
un solo usuario en una tableta no se da, pero conviene resolverlo (reintento ante
`IntegrityError`, o una secuencia en la base) antes de que haya más de una persona
cargando pedidos.

---

## 6. Capa de esquemas y DTO con Zod en el frontend

**Fecha:** 19/08/2026
**Archivos:** `frontend/src/schemas/` (nuevo: `limites.js`, `comunes.js`, `modelo.js`, `pedido.js`, `borrador.js`, `pruebas.mjs`), `frontend/src/api/modelos.js`, `frontend/src/api/pedidos.js`, `frontend/src/pages/*.jsx`, `frontend/src/context/CatalogoContext.jsx`, `backend/app/schemas.py`, `backend/app/errores.py`

### Nota sobre la herramienta

Zod es una librería de JavaScript: no puede correr en el backend, que es Python. El
equivalente exacto en Python es **Pydantic**, que ya cumple ese rol desde la sección 5.
Así que la validación quedó espejada: Zod en el frontend, Pydantic en el backend, con
los mismos límites en ambos lados. `frontend/src/schemas/limites.js` los duplica a
propósito y lo dice en un comentario — si cambia uno hay que cambiar el otro.

**El backend sigue siendo la autoridad.** Zod mejora la experiencia (el error aparece
mientras se carga el pedido, no al confirmar) pero es salteable: corre en el navegador.

### El problema

El frontend no tenía ninguna validación. En concreto:

- El cuerpo de `POST /pedidos` se armaba a mano en `TomarPedido.jsx`, mezclando el
  estado de la UI con el formato de la API.
- `Number(item.precio_unitario) || 0` convertía un precio vacío o mal tipeado en **0**
  en silencio: se guardaba un sillón regalado sin que nadie se enterara.
- `Number(item.cantidad) || 1` hacía lo mismo con la cantidad.
- El borrador de localStorage entraba al estado de React con un `JSON.parse` pelado,
  sin verificar la forma.
- Las respuestas de la API se usaban tal cual: un cambio de forma en el backend se
  manifestaba como un `undefined` reventando en medio del render.

### El arreglo

**Los DTO.** Un solo lugar convierte el formulario en el cuerpo de la petición:
`construirPedidoDto()` y `construirModeloDto()`. Toman el estado crudo de la pantalla
(todo strings) y devuelven exactamente lo que espera la API, con los tipos convertidos,
los espacios recortados y los vacíos normalizados a `null`.

Los campos que son solo de la UI (`key`, `telaOtra`) **se descartan solos**: `z.object`
se queda únicamente con lo declarado. Y el `.pipe()` final contra un `z.strictObject`
falla si algo se coló, así que no es una promesa sino una garantía verificada. La
opción `"otra"` del selector de tela se resuelve dentro del DTO, en vez de en el JSX.

**Los montos se redondean a centavos** en el DTO, porque la columna es `NUMERIC(12,2)`:
antes se podía mandar `65000.555` y guardar `65000.56`, o sea mostrar un número y
guardar otro.

**El borrador de localStorage** pasa por un esquema deliberadamente tolerante: valida la
forma, no que esté completo. Usa `.catch()` por campo, así un borrador editado a mano o
de una versión vieja de la app **repone el campo roto** en lugar de perderse entero. Y
acota: un borrador manipulado no puede meter 5000 ítems ni un texto de un mega en el
estado de React.

**Las respuestas de la API** se validan contra su esquema antes de entrar a la app, y la
caché del catálogo en localStorage usa el mismo esquema que la respuesta.

**En el backend**, los esquemas de entrada pasaron a `extra="forbid"`: si llega un campo
que no declaramos, se rechaza en vez de ignorarlo en silencio. Es la contraparte exacta
del `strictObject` de Zod.

### Verificación

**35 pruebas de los esquemas** (`npm run test:schemas`, sin navegador ni backend):

```
A. DTO del pedido: arma el cuerpo correcto ....  5 casos
B. DTO del pedido: rechaza lo inválido ........ 14 casos
C. DTO de modelo ..............................  4 casos
D. Borrador de localStorage ...................  7 casos
E. Validación de respuestas de la API .........  5 casos
                                        total:  35 pasan, 0 fallan
```

**40 pruebas del backend** (subieron de 36 al agregar los casos de `extra="forbid"`).

**Prueba de integración Zod ↔ Pydantic**, con el DTO real saliendo del formulario y
entrando al backend por HTTP:

| | |
|---|---|
| Formulario | `modelo_id: "1"`, `cantidad: "2"`, `precio_unitario: "65000.555"`, `tela: "otra"` + `telaOtra: "gamuza"`, `key: "k2"` |
| DTO enviado | `{"modelo_id":1,"cantidad":2,"tela":"gamuza","color":null,"medidas":null,"precio_unitario":65000.56}` |
| Respuesta | `HTTP 201`, total 645.000,56 — coincide con el calculado |

Campos inyectados en el cuerpo, rechazados por el backend:

| Inyectado | Respuesta |
|---|---|
| `total` en la cabecera | `total no es un campo que este pedido acepte.` |
| `estado` en la cabecera | `El estado no es un campo que este pedido acepte.` |
| `subtotal` en un ítem | `Ítem 1 · subtotal no es un campo que este pedido acepte.` |

Y las cuatro respuestas del backend (`POST /pedidos`, `GET /pedidos`,
`GET /pedidos/{id}`, `GET /modelos`) validan contra los esquemas del frontend.

Casos que antes pasaban en silencio y ahora se rechazan con mensaje:

| Entrada | Antes | Ahora |
|---|---|---|
| precio vacío | se guardaba **0** | *El precio unitario es un dato obligatorio.* |
| precio `"carísimo"` | se guardaba **0** | *El precio unitario debe ser un número válido.* |
| cantidad `"2.5"` | se guardaba 2,5 | *La cantidad debe ser un número entero.* |
| borrador con JSON roto | reventaba el arranque | se descarta y arranca limpio |

### El costo

El bundle pasó de **79,99 kB a 99,40 kB gzip** (+19,4 kB). Es real y va en contra de la
auditoría de rendimiento, así que conviene tenerlo dicho: en una PWA instalada el
service worker cachea el bundle, con lo cual es un costo de una sola vez y no por
apertura. Si molesta, `zod/mini` baja bastante ese número a cambio de una API más
verbosa (`z.string().check(z.minLength(1))` en vez de `z.string().min(1)`).

---

## 7. Cache-Control permanente para las fotos y comprobantes

**Fecha:** 19/08/2026
**Archivo:** `backend/app/main.py`

### El problema

`/uploads` sirve las fotos de los modelos y los comprobantes en PDF a través de
`StaticFiles`, sin ningún header de caché propio. Cada vez que se muestra la foto de
un modelo en una pantalla, o se vuelve a abrir el comprobante de un pedido, el
navegador vuelve a pedirlo — aunque ese archivo, por diseño, nunca cambia de
contenido.

### El arreglo

Un middleware de una función que agrega `Cache-Control: public, max-age=31536000,
immutable` a cualquier respuesta 200 o 304 bajo `/uploads/`. Es seguro marcarlo como
inmutable porque ningún archivo ahí se sobrescribe: las fotos se guardan con nombre
`{uuid}.{extensión}` y "cambiar la foto" de un modelo sube un archivo nuevo con otra
URL, no reescribe el viejo; los comprobantes se guardan una sola vez, con nombre
`{codigo}.pdf`, al confirmar el pedido.

El resto de la API (`/api/...`) no se toca: sigue sin caché, porque esas respuestas sí
cambian.

### Verificación

Contra el backend real (Postgres, sin escribir nada — todas lecturas):

| Ruta | Cache-Control |
|---|---|
| `GET /uploads/comprobantes/P-2026-0007.pdf` | `public, max-age=31536000, immutable` |
| `GET /uploads/comprobantes/no-existe.pdf` (404) | ninguno |
| `GET /api/health` | ninguno |
| `GET /api/modelos` | ninguno |
| Petición condicional con `If-None-Match` → `304 Not Modified` | `public, max-age=31536000, immutable` |

El 404 y las rutas de `/api` quedaron sin el header, tal como corresponde: solo se
cachea lo que efectivamente existe y no cambia.

---

## 8. Paginación de `GET /pedidos`

**Fecha:** 19/08/2026
**Archivos:** `backend/app/routers/pedidos.py`, `backend/app/schemas.py`, `frontend/src/api/pedidos.js`, `frontend/src/schemas/pedido.js`, `frontend/src/pages/VerPedidos.jsx`, `frontend/src/App.css`

### El problema

`GET /pedidos` devolvía *todos* los pedidos que hubiera, sin límite. Con 9 pedidos son
2,4 KB y no se nota; a medida que la fábrica acumule años de historial, cada apertura de
"Ver pedidos" y cada tecla del buscador (que ya dispara una petición en tiempo real, ver
sección 2) va a traer una lista cada vez más pesada.

### El arreglo

`GET /pedidos` ahora acepta `?limit=&offset=` (por defecto 50, máximo 200) y devuelve
`{ items, total }` en vez de un array pelado — `total` se calcula con los mismos filtros
pero sin paginar, para poder mostrar "50 de 1240" sin traer los 1240 pedidos a contarlos.
El orden de página también se volvió estable: además de `fecha_pedido DESC` se agregó
`id DESC` como desempate, porque dos pedidos con la misma fecha en distinta página, sin
un segundo criterio de orden, podían aparecer repetidos o directamente perderse entre
una página y la siguiente.

En el frontend, "Ver pedidos" pasó de "traer todo de una" a un botón **"Cargar más"** al
pie de la lista, con el texto "Mostrando 50 de 1240". Cualquier cambio de filtro (texto,
estado, fechas) vuelve a la primera página y reemplaza la lista; "Cargar más" pide la
página siguiente y la agrega al final. Las dos rutas comparten el mismo
`AbortController` de la sección 2, así que si el usuario cambia un filtro mientras
"Cargar más" está en vuelo, la respuesta vieja se descarta igual que antes.

El esquema Zod de la respuesta (`pedidosPaginadosSchema`) se actualizó a la misma forma
`{ items, total }`, así que un cambio futuro de contrato se detecta ahí antes de llegar a
la pantalla.

### Verificación

Contra el Postgres real del proyecto (dentro de una transacción revertida al final: no
quedó ningún pedido ni modelo de prueba):

| Caso | Resultado |
|---|---|
| 7 pedidos de prueba, páginas de 3 | página 1 y 2 traen 3, página 3 trae 1 — sin repetidos, cubren los 7 |
| Sin filtro | `total` cuenta *todos* los pedidos de la base, no solo los de la búsqueda activa |
| `limit` respetado | pedido de 5 trae exactamente 5 |

Y por HTTP real, contra el backend en ejecución:

| Petición | Respuesta |
|---|---|
| `GET /pedidos?limit=2` | `{"items": [...2], "total": 10}` |
| `GET /pedidos?limit=500` | `422` — *limit no puede superar 200.* |
| `GET /pedidos?limit=0` | `422` — *limit no puede ser menor que 1.* |
| `GET /pedidos?offset=-1` | `422` — *offset no puede ser menor que cero.* |
| `GET /pedidos` (sin parámetros) | `limit` por defecto = 50 |

---

## 9. N+1 y doble serialización al crear un pedido

**Fecha:** 19/08/2026
**Archivo:** `backend/app/routers/pedidos.py`

### El problema

Medido en la auditoría original con el log de Postgres: un pedido de 3 ítems con
modelos distintos disparaba **12 SELECT en 3 transacciones**, de los cuales 7 iban a la
tabla `modelos`. Dos causas, ambas en `crear_pedido`:

1. **Doble commit.** Se guardaba el pedido, se hacía `commit()` + `refresh()`, recién
   ahí se generaba el comprobante y se volvía a hacer `commit()` + `refresh()`. Cada
   `commit()` expira todos los atributos de los objetos en la sesión (incluidos los
   modelos ya cargados), así que el segundo commit forzaba a recargar todo de nuevo.
2. **N+1 al serializar.** Después del segundo commit, devolver el pedido dispara la
   serialización de `item.modelo` para cada ítem — con los modelos ya expirados, cada
   acceso a `item.modelo` es una consulta aparte, una por ítem (o por modelo distinto,
   según qué tan expirado esté cada uno).

### El arreglo

- **El PDF se genera antes de guardar, no después.** Todo lo que necesita
  (`pedido.codigo`, cliente, ítems con su subtotal ya calculado, total) ya está armado en
  memoria antes del primer `commit()` — no hace falta ir y volver a la base para
  construirlo. Si falla, no se pierde la venta: el pedido se guarda igual, sin
  comprobante (mismo criterio que ya existía).
- **Un solo `commit()`.**
- **Una recarga acotada en vez de accesos perezosos.** Se extrajo
  `_cargar_pedido_completo()` (el mismo patrón `selectinload` que ya usaba
  `GET /pedidos/{id}`) y se usa después del commit, en `crear_pedido`, `obtener_pedido` y
  `editar_pedido` por igual: siempre son **3 consultas acotadas** (pedido, ítems,
  modelos con `IN`), sin importar si el pedido tiene 1 ítem o 50.
- **Un detalle que apareció al medir**: acceder a `pedido.id` justo después del
  `commit()` dispara una consulta de más, porque el commit expira también ese atributo.
  Se corrigió capturando el id (o reutilizando el que ya se tenía, en el caso del
  `PATCH`) en una variable de Python *antes* del commit.

### Verificación

Contra el Postgres real del proyecto (transacción revertida, con el log de sentencias
SQL activado para contar consultas reales — no estimadas):

| Métrica | Antes (medido en la auditoría) | Ahora (medido) |
|---|---|---|
| Consultas a `modelos` al crear un pedido de 3 ítems / 2 modelos distintos | 7 | **2** (validación inicial + recarga final, sin importar cuántos ítems) |
| `commit()` | 2 | **1** |
| `item.modelo` ya cargado al serializar | no (lazy, por ítem) | sí, para los 3 ítems |
| Consultas al recargar `GET /pedidos/{id}` | 3 (ya era así) | 3 (sin cambios) |
| Consultas al `PATCH /pedidos/{id}` | — | 7 (fetch + update + commit + 3 de la recarga), sin refresh de sobra |

También se confirmó por separado que el PDF sigue generándose correctamente (existe en
disco, con el contenido esperado) y que la base quedó exactamente igual que antes de
correr las pruebas.

### Pendiente conocido, sin cambios

`_generar_codigo` sigue contando pedidos del año y sumando 1 — el riesgo de colisión con
altas simultáneas que ya estaba anotado en la sección 5 no se tocó en esta tanda.

---

## 10. Corrección: el pedido se guarda antes de generar el comprobante, no después

**Fecha:** 20/08/2026
**Archivo:** `backend/app/routers/pedidos.py`

### El problema

En la sección 9 (recién arriba) moví la generación del PDF a *antes* del `commit()`,
para lograr un solo commit y evitar el N+1. Eso resolvía el problema de rendimiento pero
abría uno de integridad: si el `commit()` fallaba *después* de generado el PDF (una
restricción violada, una colisión de código, cualquier error de escritura), quedaba un
archivo PDF en disco para un pedido que **nunca llegó a existir** en la base. Correcto
señalamiento: no tiene sentido que pueda existir un comprobante sin el pedido que
describe.

### El arreglo

Se invirtió el orden: primero se guarda el pedido (un solo `commit()`, como ya estaba),
y **recién con el pedido guardado** se genera el comprobante, usando los mismos datos que
ya se habían armado en memoria — no hace falta volver a pedirlos a la base. Si el
`commit()` del pedido falla, la ejecución nunca llega a `generar_comprobante()`: no puede
quedar un PDF de un pedido que no se guardó. Si en cambio el pedido se guarda bien y es
la generación del PDF la que falla, el pedido queda guardado igual, sin comprobante — se
puede regenerar más adelante, sin perder la venta (mismo criterio que ya existía).

Esto reintroduce un segundo `commit()` (uno para el pedido, otro para grabar la URL del
comprobante una vez generado), a cambio de la garantía de integridad. Es un costo
aceptado a propósito: unas pocas consultas más por alta de pedido, nunca un documento
inconsistente con lo que hay en la base.

También se revisaron, a pedido, dos lugares del frontend que asumían que el comprobante
siempre existía:

- **"Tomar pedido" (paso "Factura")**: si `comprobante_url` viene `null`, ya no se
  muestra un botón "Descargar comprobante" que al tocarlo no hacía nada — se reemplaza
  por un aviso explicando que el pedido se guardó pero el comprobante no se pudo generar.
- **"Ver pedidos" (detalle)**: si el pedido no tiene comprobante, se muestra una nota en
  vez de dejar ese espacio vacío sin explicación.

### Verificación

Contra el Postgres real del proyecto (transacción revertida, sin dejar rastro):

| Caso | Resultado |
|---|---|
| Alta normal | pedido guardado, comprobante generado, ambos coinciden |
| El pedido existe en la base **antes** de tocar el PDF | confirmado explícitamente |
| El `commit()` del pedido falla (código duplicado forzado) | `IntegrityError` propagada, **cero PDFs generados**, el pedido no quedó en la base |
| La generación del PDF falla (forzado) *después* de guardar el pedido | el pedido queda guardado igual, `comprobante_url = null` |

11 de 11 verificaciones pasan. Base intacta al finalizar (10 pedidos antes y después).

---

## 11. Índice de texto para el buscador (pg_trgm)

**Fecha:** 20/08/2026
**Archivos:** `sql/schema.sql`, base de datos real (aplicado directamente — ver nota)

### El problema

El buscador de "Ver pedidos" filtra con `ILIKE '%texto%'` sobre `cliente_nombre` y
`codigo`. Ningún índice B-tree común puede aprovechar ese patrón (el `%` al principio
impide usarlo), así que cada búsqueda hacía `Seq Scan`: leer la tabla entera. Con 10
pedidos no se nota; la auditoría original lo dejó anotado como "más adelante".

### El arreglo

Se habilitó la extensión `pg_trgm` y se crearon dos índices GIN:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_pedidos_cliente_trgm ON pedidos USING GIN (cliente_nombre gin_trgm_ops);
CREATE INDEX idx_pedidos_codigo_trgm ON pedidos USING GIN (codigo gin_trgm_ops);
```

**Nota importante sobre cómo se aplicó:** `sql/schema.sql` solo se ejecuta la primera
vez que se crea el contenedor de Postgres (`docker-entrypoint-initdb.d` no vuelve a
correr si el volumen ya tiene datos). Como la base del proyecto ya existe con pedidos
reales, el cambio se aplicó **directamente contra la base en ejecución** además de
actualizar `schema.sql` — así una instalación nueva del proyecto ya nace con el índice,
y la base actual también lo tiene. Es una migración chica y seguramente sea la última
vez que hace falta hacerlo a mano: si el proyecto suma más cambios de esquema, conviene
una herramienta de migraciones (Alembic) en vez de editar `schema.sql` y aplicar a mano.

### Verificación

Confirmado contra la base real: la extensión y los dos índices quedaron creados
(`pg_indexes` los lista), sin tocar ninguna fila de datos.

Con los 10 pedidos reales, el planner sigue eligiendo `Seq Scan` — **es lo correcto**:
para una tabla así de chica, leerla entera es más barato que usar el índice, y forzar lo
contrario sería peor. Para confirmar que el índice de verdad funciona a la escala en la
que hace falta, se insertaron pedidos sintéticos dentro de una transacción revertida al
final (no quedó ninguno en la base real) y se midió en qué momento el planner empieza a
elegirlo:

| Pedidos en la tabla | Plan elegido |
|---|---|
| 1.000 | usa el índice (`Bitmap Heap Scan`) |
| 5.000 | usa el índice |
| 10.000 | Seq Scan (variación normal del muestreo de `ANALYZE` a ese tamaño) |
| 20.000 | usa el índice |
| 40.000 | usa el índice |
| 80.000 | usa el índice |

El cruce no es una línea perfectamente recta —depende de las estadísticas que junta
`ANALYZE`, no es un número mágico fijo— pero el índice ya se activa desde un volumen
bastante más bajo de lo que decía la auditoría original ("menos de mil no se nota"): en
la práctica, entre mil y unos pocos miles de pedidos.

**Detalle de método:** la primera versión de esta prueba insertaba de a mucho y después
borraba filas para simular una tabla más chica, y el resultado daba que el índice se
usaba incluso con muy pocas filas. Eso era un artefacto: un `DELETE` no libera las
páginas de disco hasta que corre `VACUUM`, así que la tabla seguía pesando lo mismo que
antes de borrar, y eso favorecía al índice de manera artificial. La medición de la tabla
de arriba es la corregida: siempre creciendo, nunca borrando, para que el tamaño físico
de la tabla en cada paso sea el real.
