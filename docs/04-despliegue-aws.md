# Despliegue en AWS — Opción A (segura) con prende/apaga

> Arquitectura al estilo owm: **DB privada**, compute en **Fargate** (sin exponer),
> **CloudFront + header secreto**, **Cognito** + gate por API-key, y cron de
> **encendido/apagado** para el coste. Build de imagen en **GitHub Actions** (sin
> Docker en tu Mac). Ver seguridad/coste en [`03-aws-costos.md`](03-aws-costos.md).

## Arquitectura

```
CloudFront (HTTPS) ──► ALB (solo con header secreto) ──► Fargate API
                                                            │
   Aurora Serverless v2 (PRIVADA, SG-a-SG, scale-to-zero) ◄─┤
   Jobs (EventBridge → ECS RunTask puntual): precios, análisis, catálogo
   Cognito (auth) · SSM (secretos) · S3 (imágenes) · ECR (imagen)
```

- **DB privada**: `publicly_accessible=false`, solo accesible desde el SG de las
  tareas. Nada de puertos abiertos a internet.
- **API no expuesta directa**: el ALB responde 403 salvo que la petición traiga
  el header secreto que inyecta CloudFront. Además, gate por `X-API-Key`.
- **Sin NAT**: las tareas van en subredes públicas con IP pública (salen a
  tcgapi) y llegan a la DB privada por SG. S3 por gateway endpoint (gratis).

## Requisitos

- AWS CLI configurado en tu Mac (solo para bootstrap). Docker no hace falta.
- Terraform ≥ 1.6.

---

## Paso 1 — Bootstrap del state (local, una vez)

```bash
cd terraform/bootstrap
terraform init && terraform apply     # anota state_bucket y lock_table
```

## Paso 2 — Crear solo el rol OIDC (local, sin Docker)

```bash
cd ..
cp backend.hcl.example backend.hcl    # rellena bucket/tabla del paso 1
cp terraform.tfvars.example terraform.tfvars
terraform init -backend-config=backend.hcl
terraform apply -target=aws_iam_role.github_actions -auto-approve
terraform output -raw github_actions_role_arn
```

## Paso 3 — Configurar el repo en GitHub

Settings → Secrets and variables → Actions:

- **Secret** `AWS_ROLE_ARN` = `github_actions_role_arn` (paso 2)
- **Variable** `TF_STATE_BUCKET` = `state_bucket` (paso 1)
- **Variable** `TF_LOCK_TABLE` = `lock_table` (paso 1)
- **Variable** `AWS_REGION` = `us-east-1`
- **Variable** `TF_NAME` = `tcg-dev` (usado por env-up/env-down)

## Paso 4 — Desplegar todo (CI construye la imagen)

Actions → **Deploy** → Run workflow (o push a `main`). Crea ECR → build+push →
`terraform apply` (Aurora + ECS + ALB + CloudFront ~10-15 min). Imprime la URL.

## Paso 5 — Cargar API key y aplicar el esquema

```bash
# 1) tu API key de tcgapi.dev
aws ssm put-parameter --name /tcg-dev/tcgapi-key --type SecureString \
  --overwrite --value tcg_live_TU_KEY

# 2) esquema: como la DB es PRIVADA, se aplica con un job dentro de la VPC
SUBNET=$(aws ec2 describe-subnets --query 'Subnets[0].SubnetId' --output text)
SG=$(aws ec2 describe-security-groups --filters Name=group-name,Values=tcg-dev-app \
     --query 'SecurityGroups[0].GroupId' --output text)
aws ecs run-task --cluster tcg-dev-cluster --launch-type FARGATE \
  --task-definition tcg-dev-jobs \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET],securityGroups=[$SG],assignPublicIp=ENABLED}" \
  --overrides '{"containerOverrides":[{"name":"job","command":["/app/bin/migrate.sh"]}]}'
```

## Paso 6 — Primer llenado y prueba

```bash
# Lanza los jobs una vez (mismo patrón run-task con el command correspondiente):
#   /app/bin/catalog.sh   → da de alta cartas en alcance
#   /app/bin/price.sh      → snapshot de precios
#   /app/bin/analytics.sh  → métricas

# Prueba la API (API_KEY está en SSM):
KEY=$(aws ssm get-parameter --name /tcg-dev/api-key --with-decryption \
      --query Parameter.Value --output text)
curl -H "X-API-Key: $KEY" "<API_URL>/v1/games"
```

---

## Prende / apaga para el coste

Dos workflows replican el patrón de owm:

- **env-down** (cron 03:00 UTC, o manual) — escala la API a 0 y **borra el ALB**
  (mata su ~$16/mes). Aurora se auto-pausa sola. CloudFront se queda (dominio estable).
- **env-up** (cron 13:00 UTC, o manual) — `terraform apply` recrea el ALB y
  repunta CloudFront, y escala la API a 1.

Ajusta los cron a tu horario, o quita el de env-up si prefieres encender a mano.
Los **jobs siguen corriendo** aunque el entorno esté "apagado" (son tareas
puntuales que se auto-crean; Aurora se despierta unos minutos y se vuelve a pausar).

## Coste aproximado

Con el entorno encendido pocas horas/día: **~$5-15/mes** (ALB prorrateado +
Fargate Spot + Aurora activa unos minutos). Apagado casi todo el día se acerca al
límite bajo. Es más que el Lambda puro (~$1-5) pero con **DB privada y API no
expuesta** — el trade-off de seguridad que elegiste.

## Seguridad — pendiente para producción

- Sustituir el gate de API-key por **JWT de Cognito** cuando haya frontend.
- Acotar el rol de deploy (hoy PowerUser) a mínimo privilegio.
- `deletion_protection` + `skip_final_snapshot=false` en Aurora para prod.
