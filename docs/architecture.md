# Lux Studio - Arquitectura actual

## Decisiones tecnicas

### Base de datos
- Motor: SQLite en `backend/data/lux.db`.
- ORM: SQLAlchemy 2.0 con Alembic para migraciones.
- La base de datos es la unica fuente de verdad del catalogo de luminarias.
- La aplicacion no debe poblar la base de datos escaneando carpetas al arrancar ni al calcular.

### Almacenamiento de luminarias
- Cada luminaria disponible para calculo debe existir como registro en la tabla `luminaires`.
- La DB guarda metadatos y `ldt_path`, que apunta al archivo `.ldt` asociado.
- Los archivos `.ldt` solo se abren cuando un registro de DB los referencia.
- No hay fallback automatico a `backend/ldt/` como catalogo.
- `backend/seed_db.py` es intencionadamente no mutante: ejecutarlo no crea registros.
- Para guardar una luminaria nueva se usa exclusivamente el flujo admin: `/api/admin/luminaires/upload`.
- Se permite cargar un LDT externo temporal desde la pantalla principal para calcular en la sesion actual. Ese LDT no se inserta en DB y no aparece en el catalogo.

### Modelo de datos

```text
Manufacturer
- id: int (PK)
- name: str (UNIQUE)

Luminaire
- id: int (PK)
- manufacturer_id: int (FK -> Manufacturer)
- type: str
- optic_family: str
- name: str
- power: float (W)
- cct: int (K)
- flux: float (lm)
- efficiency: float (lm/W)
- LORL: float
- isym: int
- ldt_path: str (UNIQUE)
- created_at: datetime
- updated_at: datetime
```

### Seleccion de luminaria
1. El frontend carga el catalogo desde `/api/ldt/catalog`, que consulta la DB.
2. El usuario selecciona `Manufacturer`, `Type` y `Lens / Optic`.
3. Esa combinacion selecciona un LDT de referencia mediante `ldt_id`.
4. `Power` y `Temperature` son parametros libres, editables con slider o escribiendo el valor.
5. La casilla numerica y la barra del slider siempre comparten el mismo estado.
6. En el cuadro de referencia se puede cargar o arrastrar un `.ldt` externo para usarlo solo en el calculo actual.
7. Cuando hay un `.ldt` externo activo, `Power` y `Temperature` quedan bloqueados porque se calcula exactamente el LDT cargado.

### Flujo de calculo
1. El frontend envia `ldt_id`, `manufacturer`, `model_family`, `optic_family`, `power`, `cct` y la geometria.
2. El backend obtiene la luminaria de referencia desde la DB.
3. Si `ldt_id` es temporal, el backend usa el `.ldt` externo cargado en la sesion actual; si no, obtiene `ldt_path` desde la DB.
4. El backend abre el `.ldt` indicado y crea `Photometry`.
5. La distribucion fotometrica del LDT de referencia se mantiene como base.
6. Para LDT de DB, el flujo objetivo se estima desde registros DB del mismo fabricante, tipo y optica, interpolando/extrapolando por potencia y CCT cuando existan datos suficientes.
7. Para LDT externo temporal, no se estima ni se adapta nada: se calcula con la fotometria y flujo exactos del archivo cargado, usando escala 1.0.
8. En calculo manual con DB, el motor calcula con `flux_scale = target_flux / reference_flux`.
9. Si no hay suficientes puntos para interpolar en DB, se usa la eficiencia/curva de potencia del LDT de referencia como fallback.

### Comparacion formula vs LDT real
- El boton de prueba calcula variantes registradas en DB para la misma familia y optica.
- El resultado de formula usa el LDT base escalado.
- El resultado real usa el LDT fisico de cada variante con escala 1.0.
- La tabla muestra desviaciones entre formula y real.

### Admin
- `POST /api/admin/parse-ldt`: valida un `.ldt` y devuelve metadatos para revisar.
- `POST /api/admin/luminaires/upload`: guarda luminaria en DB y copia el `.ldt`.
- `GET /api/admin/luminaires`: lista luminarias registradas.
- `PUT /api/admin/luminaires/{id}`: actualiza metadatos.
- `DELETE /api/admin/luminaires/{id}`: elimina el registro y su archivo.

### UI de parametros numericos
- Los controles con slider usan un campo numerico editable.
- Escribir en la casilla actualiza inmediatamente el slider.
- Mover el slider actualiza inmediatamente la casilla.
- Los valores se limitan al rango definido por cada parametro.

### Stack
| Capa | Tecnologia |
|---|---|
| Backend | FastAPI, Uvicorn |
| ORM | SQLAlchemy 2.0 |
| Migraciones | Alembic |
| DB | SQLite |
| Frontend | React 18, Vite, TypeScript, Tailwind |
| Calculos | CIE 140 / EN 13201 |
