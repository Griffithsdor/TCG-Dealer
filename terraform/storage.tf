# S3 (imágenes + data lake) y parámetros SSM (config/secretos, gratis).

resource "aws_s3_bucket" "data" {
  bucket = "${local.name}-data-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_public_access_block" "data" {
  bucket                  = aws_s3_bucket.data.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "data" {
  bucket = aws_s3_bucket.data.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "data" {
  bucket = aws_s3_bucket.data.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# --- SSM Parameter Store (SecureString) — inyectados en las tareas por ECS ---

resource "aws_ssm_parameter" "database_url" {
  name  = "/${local.name}/database-url"
  type  = "SecureString"
  value = "postgresql://tcg_admin:${random_password.db.result}@${aws_rds_cluster.this.endpoint}:5432/${var.db_name}?sslmode=require"
}

# API key de tcgapi.dev (placeholder; edita el VALOR en la consola de SSM).
resource "aws_ssm_parameter" "tcgapi_key" {
  name  = "/${local.name}/tcgapi-key"
  type  = "SecureString"
  value = "PLACEHOLDER"
  lifecycle {
    ignore_changes = [value]
  }
}

# Clave de acceso a la API (auth interina por header X-API-Key).
resource "aws_ssm_parameter" "api_key" {
  name  = "/${local.name}/api-key"
  type  = "SecureString"
  value = random_password.api_key.result
  lifecycle {
    ignore_changes = [value]
  }
}

resource "random_password" "api_key" {
  length  = 40
  special = false
}
