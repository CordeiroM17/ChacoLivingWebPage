# Preguntas para el cliente — reestructuración v0.0.4+

Dudas que fueron surgiendo al planificar las solapas / clientes / listas de precio
(conversación en `Conversacion_V004.md`). Van agrupadas por tema; ninguna bloquea
las primeras fases, pero conviene cerrarlas antes de la Fase 3–5.

## Representaciones / comprobante

1. **Comprobante de Representaciones.** Por ahora los pedidos de la solapa
   "Representaciones Matías Salvador Sykora" **no generan comprobante PDF**.
   ¿Hace falta alguno (nota de pedido, remito, presupuesto)? ¿A nombre de quién
   sale — "Representaciones M. S. Sykora" o la empresa cuya lista se usó? ¿Lleva
   numeración propia?
2. **Datos de facturación por empresa.** ¿La ficha de cada empresa representada
   necesita CUIT, condición frente al IVA, dirección, logo? ¿Aparecen en el
   comprobante de Chaco Living cuando la empresa no es "Chaco Living"?

## Precios e impuestos

3. **Formato del Excel/CSV de las listas.** ¿Qué columnas manda cada proveedor
   exactamente? ¿Siempre las mismas (código, nombre, precio) o cada uno a su
   manera? ¿Vienen en una sola hoja o varias? ¿Traen rubro/categoría, unidad,
   moneda, % de recargo?
4. **IVA.** ¿Los precios de las listas son finales o + IVA? ¿El pedido/comprobante
   tiene que discriminar IVA o percepciones? (Hoy el total es la suma simple de
   los subtotales.)
5. **Historial de precios.** Al reemplazar o borrar una lista, ¿querés poder
   consultar qué precio tenía antes un producto, o no importa?

## Productos / colchones

6. **Colchones.** Chaco Living vende living **y** colchones. ¿Los colchones
   necesitan campos propios (medidas estándar 1 plaza / 2 plazas / queen / king,
   densidad, altura) distintos de los sillones, o alcanza con nombre + medidas
   libres como ahora?

## Clientes

7. **Duplicados del backfill.** Al pasar los pedidos viejos a la lista de
   clientes, los nombres escritos distinto ("Juan Perez" vs "Juan Pérez") quedan
   como dos clientes. ¿Hace falta una herramienta para unirlos, o alcanza con
   corregirlos a mano en la sección Clientes? ¿Hay alguna clave para dedup (CUIT,
   teléfono)?
8. **Clientes por solapa.** La lista de clientes es única para las dos solapas.
   ¿Representaciones necesita ver solo "sus" clientes, o está bien ver todos?

## Operación / usuarios

9. **Estados del pedido en Representaciones.** ¿Los mismos 5 que Chaco Living
   (pendiente / en proceso / listo / entregado / cancelado), o un circuito
   distinto (enviado al proveedor / facturado / cobrado)?
10. **Multiusuario.** Hoy cualquier mail autorizado ve todo. ¿En algún momento
    entra alguien que **no** debería ver Chaco Living (o viceversa)? Si sí, hay
    que agregar permisos por solapa antes de que eso pase. (El sistema ya guarda
    quién cargó cada pedido, pero no lo usa para restringir nada.)
11. **Nuevas solapas.** ¿Se prevén más contextos además de "Chaco Living" y
    "Representaciones"? Hoy se agregarían por SQL, sin pantalla.
12. **Prefijos de código de pedido.** Propuesta: `CL-2026-0001` para Chaco Living,
    `RMS-2026-0001` para Representaciones. ¿Confirmás, o preferís otros?

## PWA

13. **Nombre de la app instalada.** Hoy la PWA en el iPhone dice "Chaco Living".
    Con la solapa de Representaciones adentro, ¿se deja así, o querés un nombre
    más general?
