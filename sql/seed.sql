-- Datos de ejemplo: catálogo inicial de modelos
-- Ver CLAUDE.md sección 4
-- Nota: el pedido de ejemplo ("Juan Pérez") se carga vía la API, no acá,
-- según lo pedido en el CLAUDE.md (para probar el flujo completo de POST /pedidos).

INSERT INTO modelos (nombre, descripcion, precio_base, profundidad_m, altura_m, ancho_m) VALUES
('Sillón 1 cuerpo "Milán"', 'Sillón individual, líneas rectas', 180000, 0.85, 0.90, 0.80),
('Sillón 2 cuerpos "Bristol"', 'Sofá de dos cuerpos, respaldo alto', 290000, 0.90, 0.95, 1.50),
('Sillón 3 cuerpos "Provenza"', 'Sofá de tres cuerpos, estilo clásico', 380000, 0.90, 0.95, 2.10),
('Esquinero "Oslo"', 'Modular en L, chaise longue', 520000, 1.60, 0.85, 2.50),
('Puff "Nórdico"', 'Puff redondo con base de madera', 65000, 0.60, 0.40, 0.60);
