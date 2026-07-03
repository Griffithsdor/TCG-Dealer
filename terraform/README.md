# Infraestructura (Terraform) — mínimo coste, 100% AWS

Infra serverless optimizada para coste. Ver el razonamiento y la estimación en
[`../docs/03-aws-costos.md`](../docs/03-aws-costos.md). El `apply` corre con tus
credenciales AWS (local) o desde **GitHub Actions vía OIDC**.

## Qué crea

- **Aurora Serverless v2 (PostgreSQL)** con **mín. 0 ACU** (scale-to-zero): se
  pausa en reposo → solo pagas almacenamiento. En la **VPC por defecto**,
  públicamente accesible (TLS + contraseña) para **evitar NAT**.
- **S3** para imágenes y data lake.
- **SSM Parameter Store** (gratis): `DATABASE_URL` y la API key de tcgapi.
- **SQS + DLQ** y **reglas EventBridge** (ingesta diaria, catálogo semanal).
- **Rol de ejecución Lambda** (mínimo privilegio) y **rol OIDC de GitHub**.

Sin VPC propia, sin NAT Gateway, sin API Gateway → coste fijo ~$0.

## Coste estimado

**≈ $1–5/mes** en uso personal (casi todo es la BD activa unos minutos al día).
Detalle en `docs/03-aws-costos.md`.

## Despliegue (primera vez)

```bash
# 0. Terraform >= 1.6 y credenciales AWS (aws configure / SSO).

# 1. Bootstrap del state remoto (una sola vez)
cd terraform/bootstrap
terraform init && terraform apply     # crea bucket S3 + tabla DynamoDB
# anota state_bucket y lock_table

# 2. Backend + variables
cd ..
cp backend.hcl.example backend.hcl    # rellena con el paso 1
cp terraform.tfvars.example terraform.tfvars

# 3. Infra
terraform init -backend-config=backend.hcl
terraform plan
terraform apply
```

## Tras el apply

1. **Pon tu API key** de tcgapi.dev en el parámetro SSM (output `tcgapi_key_param`):
   ```bash
   aws ssm put-parameter --name /tcg-dev/tcgapi-key --type SecureString \
     --overwrite --value tcg_live_TU_KEY
   ```
2. **Aplica el esquema** a la BD (coge la cadena del parámetro `database-url`):
   ```bash
   DB=$(aws ssm get-parameter --name /tcg-dev/database-url --with-decryption \
        --query Parameter.Value --output text)
   psql "$DB" -f ../db/schema.sql
   psql "$DB" -f ../db/seed_games.sql
   ```
3. **GitHub Actions:** guarda el output `github_actions_role_arn` como secreto
   `AWS_ROLE_ARN` del repo (Settings → Secrets → Actions).

## Seguridad — pendiente antes de producción

- La BD es públicamente accesible para evitar NAT. Restríngela a tu IP con
  `db_allowed_cidr` mientras seas solo tú. Para SaaS: Lambdas en VPC + RDS Proxy
  + BD privada.
- El rol de GitHub usa `PowerUserAccess`; cambiar por mínimo privilegio.
