# YardLedger — Guía de la Aplicación

## Descripción General

YardLedger es una aplicación de gestión para yardas de metales reciclados, construida con Expo (React Native). Maneja la compra de metal de clientes, seguimiento de inventario, registro de ventas a recicladores más grandes y generación de reportes de negocio.

**Distribución**: Instalación directa / Expo Go únicamente (no App Store).

---

## Roles de Usuario

| Rol            | Capacidades                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Admin**      | Gestionar metales y precios, aprobar usuarios, ver todos los recibos/ventas, acceder a reportes, generar códigos |
| **Trabajador** | Crear recibos de compra, registrar ventas, ver sus transacciones, solicitar cambios de precio (con código)       |

Las cuentas nuevas requieren aprobación de un administrador antes de obtener acceso.

---

## Flujos Principales

### 1. Compra de Metal (Pestaña Transacciones)

1. Toca **+ Nueva Compra** para iniciar un recibo.
2. Ingresa el nombre del cliente y teléfono opcional.
3. Agrega líneas: selecciona una categoría, luego un metal, luego ingresa el peso.
   - El precio se llena automáticamente desde la tabla de metales.
   - Toca un precio para cambiarlo (requiere un código de acceso reutilizable del admin).
4. Recolecta la firma del cliente.
5. Guarda el recibo. El inventario se actualiza automáticamente mediante un trigger de Postgres (costo promedio ponderado).

Los números de recibo se generan automáticamente: `YL-YYYYMMDD-NNNN`.

### 2. Inventario (Pestaña Inventario)

- Vista de solo lectura del stock actual por metal.
- Muestra el peso disponible y el costo promedio por libra.
- Se actualiza automáticamente cuando se guardan recibos de compra o se registran ventas.

### 3. Venta de Metal (Pestaña Ventas)

Las ventas representan cargas salientes a recicladores más grandes. Para registrar una venta:

1. Toca **+ Nueva Venta**.
2. Opcionalmente ingresa el nombre del comprador (reciclador).
3. Selecciona un metal del inventario (solo aparecen metales con stock > 0).
4. Ingresa el peso vendido (validado contra el stock disponible) y el precio de venta por libra (del recibo del reciclador).
5. Aparece una vista previa en vivo de ingresos/ganancia mientras ingresas valores.
6. Guarda. El inventario se deduce automáticamente mediante un trigger de Postgres.

La pestaña de Ventas también muestra:

- **Ganancia Total** de todas las ventas.
- Desglose de **Ganancia por Categoría** (ingresos, costo, ganancia por categoría).

### 4. Reportes (Pestaña Reportes — Solo Admin)

Cuatro reportes disponibles:

#### Resumen Diario

- Total comprado (peso + dólares), total vendido (peso + ingresos), ganancia bruta, cantidad de recibos.
- Top 5 metales comprados por peso.
- Filtrable por Hoy / Esta Semana / Este Mes.

#### Valuación de Inventario

- Comparación por metal del valor de costo vs valor de mercado actual.
- Tarjetas resumen: valor total de costo, valor total de mercado, ganancia/pérdida no realizada.
- Codificado por colores: verde para ganancias, rojo para pérdidas.

#### Rentabilidad

- Desglose por metal del peso comprado, costo de compra, peso vendido, ingresos, ganancia y margen %.
- Resumen general: ingresos totales, COGS (costo de bienes vendidos), ganancia y margen.
- Filtrable por Hoy / Esta Semana / Este Mes.

#### Merma

- Compara el inventario esperado (total comprado - total vendido) contra el inventario actual.
- Discrepancia mostrada en libras y porcentaje.
- Severidad codificada por colores: verde (< 2%), amarillo (2-5%), rojo (> 5%).
- Ayuda a identificar robos, pérdidas de procesamiento o errores de captura.

### 5. Administración (Pestaña Admin — Solo Admin)

- **Usuarios**: Aprobar cuentas pendientes, promover a admin, desactivar usuarios.
- **Precios**: Editar precios base de metales directamente (no requiere código — el admin ya está autenticado).

### 6. Cambios de Precio (Códigos de Acceso)

Los administradores generan códigos de acceso reutilizables de 6 dígitos. Los trabajadores ingresan estos códigos al cambiar el precio de una línea durante una transacción de compra. El cambio se registra en la línea (`is_price_override`, `override_approved_by`).

### 7. Lista de Precios

Los trabajadores pueden ver los precios actuales de metales desde la pantalla de Transacciones mediante el botón **Precios** (esquina inferior izquierda). Esto abre un modal de solo lectura agrupado por categoría.

---

## Esquema de Base de Datos

| Tabla              | Propósito                                                         |
| ------------------ | ----------------------------------------------------------------- |
| `metals`           | Tipos de metal con precio_por_lb, categoría, estado activo        |
| `metal_categories` | Categorías (Ferroso, No Ferroso, etc.)                            |
| `users`            | Cuentas basadas en roles (admin/trabajador)                       |
| `receipts`         | Encabezados de transacciones de compra (cliente, subtotal, firma) |
| `line_items`       | Líneas de recibo (metal, peso, precio, seguimiento de cambios)    |
| `inventory`        | Stock actual por metal (auto-actualizado por triggers)            |
| `sales`            | Ventas salientes con seguimiento de ganancias                     |
| `access_codes`     | Códigos reutilizables para cambios de precio                      |

### Triggers Clave

- **Recibo de compra guardado** → el `weight` de inventario aumenta, `avg_cost_per_lb` se recalcula (promedio ponderado).
- **Venta registrada** → el `weight` de inventario disminuye.
- **Restricción de inventario** → `weight >= 0` se aplica a nivel de base de datos (no se puede vender más de lo disponible).

---

## Stack Tecnológico

- **Frontend**: Expo (React Native) + TypeScript
- **Backend**: Supabase (Postgres, Auth, RLS, Edge Functions)
- **BD Local**: WatermelonDB (offline-first SQLite con sincronización)
- **Estado**: Redux Toolkit
- **Navegación**: React Navigation v7 (native-stack + bottom-tabs)
- **i18n**: Inglés y Español

---

## Estructura del Proyecto

```
src/
  components/     Componentes de UI compartidos (Button, Card, Input, Modals, etc.)
  config/         Configuración del cliente Supabase
  constants/      Tema (colores, espaciado, tamaño de fuente, bordes)
  db/             Esquema de WatermelonDB, modelos, sincronización
  hooks/          Hooks de obtención de datos (useMetals, useReceipts, etc.)
  i18n/           Archivos de traducción (en.ts, es.ts)
  navigation/     Navegadores de React Navigation
  screens/        Componentes de pantalla agrupados por funcionalidad
  services/       Capa de acceso a datos de Supabase
  store/          Slices de Redux Toolkit (auth, app)
  types/          Tipos compartidos de TypeScript
  utils/          Funciones utilitarias puras
```

### Regla de Arquitectura

```
Migración de BD → Servicio → Store/Hook → Pantalla
```

Nunca llames a Supabase directamente desde las pantallas. Los servicios envuelven todas las consultas.
