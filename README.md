<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

Backend de **Terroir** (e‑commerce de café) construido con [NestJS](https://github.com/nestjs/nest) + Prisma + PostgreSQL.

## Puesta en marcha (Docker, desarrollo)

```bash
cp .env.example .env          # completa los valores (al menos POSTGRES_PASSWORD y JWT_SECRET)
make up-dev                   # levanta postgres + pgadmin + mailpit + backend
make migrate-dev              # crea/aplica migraciones de Prisma (y genera el cliente)
```

> **PostGIS (diferido)**: la ubicación se guarda hoy en `latitude`/`longitude`. La
> columna geográfica `addresses.location` está **comentada** en `schema.prisma`
> porque requiere la extensión `postgis` (la imagen `postgres` no la incluye).
> Para reactivarla: usa una imagen `postgis/postgis` (o `CREATE EXTENSION postgis`),
> descomenta la columna en el schema y el bloque en `orders.service`, y vuelve a
> migrar. Ver [`sql/bcv_postgis.sql`](sql/bcv_postgis.sql).

Comandos útiles: `make logs-backend`, `make restart-backend`, `make migrate-dev`,
`make studio` (Prisma Studio), `make shell` / `make shell-db`. Ver `make help`.

## Variables de entorno

Todas viven en `.env` (copia de `.env.example`). En desarrollo, `docker-compose.dev.yml`
construye `DATABASE_URL` a partir de las variables `POSTGRES_*`.

### Base de datos (PostgreSQL)

| Variable | Req. | Default | Descripción |
|---|---|---|---|
| `POSTGRES_USER` | sí | `terroir_user` | Usuario de la base de datos |
| `POSTGRES_PASSWORD` | sí | — | Contraseña de la base de datos |
| `POSTGRES_DB` | sí | `terroir_db` | Nombre de la base de datos |
| `POSTGRES_EXT_PORT` | no | `5432` | Puerto de Postgres expuesto al host |
| `TZ` | no | `America/Caracas` | Zona horaria del contenedor |
| `DATABASE_URL` | auto | — | URL de conexión Prisma. La arma docker-compose; defínela solo si corres sin Docker |

### Backend / API

| Variable | Req. | Default | Descripción |
|---|---|---|---|
| `PORT` | no | `3000` | Puerto interno de Nest |
| `BACKEND_PORT` | no | `3000` | Puerto del backend expuesto al host |
| `CORS_ORIGIN` | sí | `http://localhost:7050` | Orígenes permitidos, separados por coma |
| `JWT_SECRET` | sí | — | Secreto para firmar los JWT (usa uno largo y aleatorio en producción) |

### Email (SMTP — en dev apunta a Mailpit)

| Variable | Req. | Default | Descripción |
|---|---|---|---|
| `SMTP_HOST` | sí | `mailpit` | Host SMTP |
| `SMTP_PORT` | sí | `1025` | Puerto SMTP |
| `SMTP_USER` / `SMTP_PASS` | no | `mailpit` | Credenciales SMTP |
| `SMTP_FROM` | no | `noreply@terroir.local` | Remitente de los correos |
| `MAILPIT_*` | no (dev) | — | Config del contenedor Mailpit (UI en `:8025`) |
| `PGADMIN_*` | no (dev) | — | Credenciales/puerto de pgAdmin (UI en `:5050`) |

### Almacenamiento de archivos

| Variable | Req. | Default | Descripción |
|---|---|---|---|
| `STORAGE_TYPE` | no | `local` | `local` (disco), `s3` o `gcs` |
| `UPLOAD_ROOT` | no | `<cwd>/uploads` | Carpeta local (si `STORAGE_TYPE=local`) |
| `BACKEND_PUBLIC_URL` | no | — | URL pública del backend para servir archivos locales |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET` | si `s3` | — | Credenciales/bucket S3 (o compatible: Spaces/MinIO con `AWS_S3_ENDPOINT`, `AWS_S3_FORCE_PATH_STYLE`) |
| `GCS_BUCKET_NAME`, `GCP_PROJECT_ID` | si `gcs` | — | Bucket y proyecto de Google Cloud Storage |
| `GOOGLE_APPLICATION_CREDENTIALS` / `GCS_CREDENTIALS_JSON` / `GCS_KEY_FILE` | si `gcs` | — | Credenciales GCS (ruta al JSON, JSON inline, o alias). `GCS_PUBLIC_BASE_URL` opcional |

### Pagos — Webhook de R4 (pago móvil)

| Variable | Req. | Default | Descripción |
|---|---|---|---|
| `R4_WEBHOOK_TOKEN` | sí (para webhooks) | — | Token (UUID) que R4 envía en `Authorization` a `POST /api/webhooks/r4/notifica` y `/consulta`. **Bloqueante**: si falta o no coincide, el webhook responde 401 y no confirma el pago |
| `R4_BASE_URL`, `R4_COMMERCE_ID`, `R4_CUENTA_BANCO`, `R4_CUENTA_CEDULA`, `R4_CUENTA_TELEFONO` | futuro | — | Integración R4 **saliente** (consultas/cobros directos). Aún no usada por el código |

### Tasa BCV (USD→VES)

Sin variables de entorno: la tasa se obtiene de un API público gratuito
(`open.er-api.com`, sin API key), se cachea en la tabla `bcv_rates` y puede
fijarse manualmente desde el dashboard de admin (`/admin/bcv`). El checkout
calcula `bcvRate`/`amountVes` en el servidor con esta tasa.

---

> Lo que sigue es la documentación genérica del starter de NestJS.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
