output "api_url" {
  description = "URL pública de la API (CloudFront, HTTPS)"
  value       = "https://${aws_cloudfront_distribution.api.domain_name}"
}

output "db_endpoint" {
  description = "Endpoint (privado) de Aurora"
  value       = aws_rds_cluster.this.endpoint
}

output "database_url_param" {
  description = "Parámetro SSM con la cadena de conexión a la BD"
  value       = aws_ssm_parameter.database_url.name
}

output "tcgapi_key_param" {
  description = "Parámetro SSM donde poner tu API key de tcgapi.dev"
  value       = aws_ssm_parameter.tcgapi_key.name
}

output "api_key_param" {
  description = "Parámetro SSM con la API key de acceso (header X-API-Key)"
  value       = aws_ssm_parameter.api_key.name
}

output "data_bucket" {
  description = "Bucket S3 de datos/imágenes"
  value       = aws_s3_bucket.data.bucket
}

output "ecr_repository_url" {
  description = "URL del repositorio ECR"
  value       = aws_ecr_repository.app.repository_url
}

output "ecs_cluster" {
  description = "Nombre del cluster ECS (para env-up/env-down)"
  value       = aws_ecs_cluster.this.name
}

output "enabled" {
  description = "Estado del entorno caro (ALB + Fargate)"
  value       = var.enabled
}

output "alb_name" {
  description = "Nombre del ALB (null si el entorno está apagado)"
  value       = try(aws_lb.api[0].name, null)
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.this.id
}

output "cognito_app_client_id" {
  value = aws_cognito_user_pool_client.this.id
}
