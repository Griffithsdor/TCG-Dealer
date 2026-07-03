# Arquitectura AWS de Mínimo Coste (100% AWS, escalable)

> **NOTA (decisión posterior):** por seguridad se eligió la **Opción A** (DB
> privada + Fargate + CloudFront + Cognito, al estilo del proyecto owm), con un
> cron de prende/apaga para el coste. La arquitectura vigente y su despliegue
> están en [`04-despliegue-aws.md`](04-despliegue-aws.md). Este documento
> conserva el análisis original del enfoque Lambda ultra-barato como referencia.

> Objetivo: lo **más barato posible dentro de AWS**, pero eficiente y escalable.
> Estrategia: **serverless + scale-to-zero** y evitar todo coste fijo evitable.

---

## 1. Decisiones y por qué

| Área | Elección | Por qué (coste) |
|---|---|---|
| **Base de datos** | **Aurora Serverless v2 con mín. 0 ACU** (scale-to-zero) | AWS-nativo. Auto-pausa en reposo → **solo pagas almacenamiento** (~céntimos). Despierta sola en ~15s. Escala hasta 256 ACU para SaaS sin rediseño. |
| **Cómputo (API)** | **Lambda + Function URL** | Pago por uso, $0 en reposo. **Sin API Gateway** ($0). |
| **Cómputo (jobs)** | **Lambda** (ingesta diaria, catálogo semanal) | Jobs ligeros → free tier. Fargate se reserva para lotes pesados futuros (modelo "mixto"). |
| **Red** | **VPC por defecto, sin NAT** | La BD es públicamente accesible (TLS + credenciales) y las Lambdas van FUERA de la VPC → llegan a la BD y a tcgapi sin NAT. **Evita ~$32/mes de NAT.** |
| **Programación** | **EventBridge Scheduler** | Gratis. |
| **Cola** | **SQS + DLQ** | Free tier 1M req/mes. |
| **Almacenamiento** | **S3** (imágenes, datos crudos) | Céntimos con pocos GB. |
| **Config/secretos** | **SSM Parameter Store** (SecureString) | **Gratis** (Secrets Manager cuesta $0.40/secreto/mes). |
| **Logs** | **CloudWatch** (retención corta) | Free tier 5 GB. |

**Los ahorros que más pesan:** BD que se pausa a $0 de cómputo, **sin NAT**,
**sin API Gateway**, secretos en SSM (gratis).

---

## 2. Estimación de coste mensual (uso personal)

| Servicio | Coste estimado |
|---|---|
| Aurora Serverless v2 — cómputo (pausada casi todo el día) | ~$0–3 |
| Aurora — almacenamiento (pocos GB) | ~$0.20–1 |
| Lambda (jobs + API, dentro de free tier) | $0 |
| Lambda Function URL | $0 |
| EventBridge Scheduler | $0 |
| SQS (free tier) | $0 |
| SSM Parameter Store | $0 |
| CloudWatch Logs | $0 |
| S3 (cientos de MB) | ~$0.02–0.50 |
| **Total** | **≈ $1–5 / mes** |

Prácticamente $0 en reposo; el gasto aparece solo cuando la BD está activa (unos
minutos al día por el job + tus consultas). La API key de tcgapi.dev es **gratis**.

> Alternativa aún más simple si tu cuenta AWS es nueva (<12 meses y elegible):
> **RDS db.t4g.micro** entra en el free tier (750 h/mes, 20 GB) → **$0 durante 12
> meses**, pero es coste fijo después (~$12/mes) y no escala a cero. Aurora
> Serverless v2 es mejor a largo plazo por el scale-to-zero y no depender del free tier.

---

## 3. Por qué es eficiente y escalable (no solo barato)

**Eficiente:** todo escala a cero; pagas solo cuando algo corre. La ingesta es un
batch diario, no streaming → cómputo mínimo y predecible.

**Escalable sin rediseño (mismo modelo):**

- **Aurora Serverless v2** escala de 0 a 256 ACU automáticamente; de personal a
  SaaS es el mismo cluster, solo sube de capacidad.
- **Lambda** escala concurrencia sola; de 10 a 10.000 cartas es el mismo código.
- **SQS** absorbe picos y permite paralelizar la ingesta por lotes.
- **Fargate** entra solo para lotes pesados (backfills masivos, forecast) cuando
  haga falta — el modelo "mixto".

**Trade-off asumido (personal):** la BD es públicamente accesible (protegida por
TLS obligatorio + contraseña fuerte + security group). Es lo que permite evitar el
NAT. Al pasar a SaaS se endurece: Lambdas dentro de la VPC + RDS Proxy + BD privada.

**Caveat de scale-to-zero:** la primera petición tras un rato de inactividad tarda
~15s en despertar la BD. Irrelevante para un job diario; para la API personal es
aceptable (se puede mitigar con un "ping" programado si molesta).

---

## 4. Ruta de escalado (cuándo pagar más)

| Señal | Cambio | Coste incremental |
|---|---|---|
| API con tráfico real | **CloudFront** delante de la Function URL | céntimos + caché |
| Muchas cartas / SaaS | **Fargate** para backfills; ElastiCache para caché | según uso |
| Endurecer seguridad | Lambdas en VPC + **RDS Proxy** + BD privada | RDS Proxy ~$15/mes |
| Datos graded/población | Añadir **Scrydex** ($29/mes) | $29/mes |
| Multiusuario | **Cognito** (free tier 50k MAU) | $0 hasta escalar |

Ninguno exige reescribir: incrementos sobre la misma base serverless.

---

## 5. Qué refleja el Terraform

- ❌ Fuera **VPC propia + NAT Gateway** → se usa la **VPC por defecto** (gratis).
- ✅ **Aurora Serverless v2** (mín. 0 ACU, auto-pausa), públicamente accesible, TLS forzado.
- ➕ **SSM Parameter Store**: `DATABASE_URL` y las API keys (gratis, cifrado).
- ✅ Se mantienen: **S3**, **SQS + DLQ**, **EventBridge**, **rol OIDC de GitHub**.
- ➕ **Rol de ejecución de Lambda** (mínimo privilegio: leer SSM, logs, SQS, S3).

Las funciones Lambda concretas (con código empaquetado) se añaden cuando los
handlers estén listos; la base queda lista y a coste ~$0 en reposo.
