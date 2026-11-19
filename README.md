# SGSU - Sistema de Gestion de Servicios y Solicitudes Universitarias

Proyecto Final de la asignatura **Ingenieria del Software** (docente: Kevin Villarreal Jimenez, entrega 28 de noviembre de 2026).

Aplicacion web que centraliza el registro, asignacion, atencion, seguimiento y reporte de solicitudes de servicios universitarios, con cuatro roles (administrador, estudiante, funcionario y supervisor), ciclo de vida completo de solicitudes, historial trazable, notificaciones internas y estadisticas.

**Repositorio:** https://github.com/wilsonmartines1204-byte/Proyecto-Software

**Demo en linea:** https://sgsu-79gi.onrender.com

**Integrantes:** Mathew Kelsey, Wilson Martinez, Luis Martinez y Jorge Demoya.

## Requisitos

- Node.js 24 o superior (usa el modulo nativo `node:sqlite`)

## Instalacion y uso

```bash
npm install            # instalar dependencias
npm run init-db        # crear y sembrar la base de datos de prueba
npm start              # arrancar en http://localhost:3000
```

### Cuentas de prueba

| Correo                  | Contrasena | Rol            |
|-------------------------|------------|----------------|
| admin@universidad.edu   | Admin123!  | administrador  |
| ana@universidad.edu     | Estu123!   | estudiante     |
| valeria@universidad.edu | Estu123!   | estudiante (sin solicitudes) |
| luis@universidad.edu    | Func123!   | funcionario    |
| maria@universidad.edu   | Super123!  | supervisor     |

## Scripts

| Comando             | Funcion                                          |
|---------------------|--------------------------------------------------|
| `npm start`         | Arrancar el servidor (puerto 3000)               |
| `npm test`          | Ejecutar la suite de pruebas                     |
| `npm run coverage`  | Pruebas con reporte de cobertura                 |
| `npm run init-db`   | Crear/sembrar la base de datos de prueba         |

## Estructura

```
src/
  app.js            Ensamblaje de la app (contenedor de dependencias)
  config.js         Configuracion (puerto, base de datos, sesion)
  routes/           Rutas Express por recurso
  controllers/      Manejo de peticiones/respuestas
  services/         Logica de negocio
  repositories/     Acceso a datos (patron Repository)
  domain/           Maquina de estados y permisos
  middleware/       Autenticacion y control de acceso
  db/               Conexion y seed de SQLite
  views/            Plantillas EJS
public/             Hojas de estilo, scripts e imagenes
tests/
  unit/             Pruebas unitarias
  integration/      Pruebas de flujo completo (RF01-RF11)
scripts/
  init-db.js        Creacion y siembra de la base de datos
```

## Calidad

- **134 pruebas** automatizadas (`node:test`), todas en verde.
- Cobertura: **96.25 %** de lineas, **88.51 %** de ramas, **96.32 %** de funciones.

## Despliegue en Render

El proyecto incluye `render.yaml` (Node >= 24, `npm install` + `npm start`). Al arrancar con la base vacia se siembra sola, asi que el primer acceso ya tiene las cuentas de prueba.

**Servicio desplegado:** https://sgsu-79gi.onrender.com

1. Subir el repositorio a GitHub.
2. En Render: **New > Blueprint** y elegir el repositorio (detecta `render.yaml`), o **New > Web Service** con build `npm install` y start `npm start`.
3. La variable `SESSION_SECRET` se genera automaticamente con el blueprint.
4. Abrir la URL publica.

Notas: el plan gratuito suspende el servicio tras unos minutos sin uso (la primera visita tarda ~30-60 s en despertar) y el disco es efimero, por lo que la base se reinicia en cada redeploy; para conservar datos hay que montar un disco persistente y definir `DB_PATH` (por ejemplo `/var/data/sgsu.db`).
