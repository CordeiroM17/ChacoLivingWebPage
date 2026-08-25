-- Datos de ejemplo: catálogo inicial de modelos
-- Ver CLAUDE.md sección 4
-- Nota: el pedido de ejemplo ("Juan Pérez") se carga vía la API, no acá,
-- según lo pedido en el CLAUDE.md (para probar el flujo completo de POST /pedidos).

INSERT INTO modelos (nombre, descripcion, precio_base, profundidad_cm, altura_cm, ancho_cm) VALUES
('Sillón 1 cuerpo "Milán"', 'Sillón individual, líneas rectas', 180000, 85, 90, 80),
('Sillón 2 cuerpos "Bristol"', 'Sofá de dos cuerpos, respaldo alto', 290000, 90, 95, 150),
('Sillón 3 cuerpos "Provenza"', 'Sofá de tres cuerpos, estilo clásico', 380000, 90, 95, 210),
('Esquinero "Oslo"', 'Modular en L, chaise longue', 520000, 160, 85, 250),
('Puff "Nórdico"', 'Puff redondo con base de madera', 65000, 60, 40, 60);
