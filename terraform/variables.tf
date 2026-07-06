variable "aws_region" {
  description = "Región AWS"
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Nombre corto del proyecto (prefijo de recursos)"
  type        = string
  default     = "tcg"
}

variable "env" {
  description = "Entorno (dev|staging|prod)"
  type        = string
  default     = "dev"
}

variable "db_name" {
  description = "Nombre de la base de datos"
  type        = string
  default     = "tcg"
}

variable "aurora_max_acu" {
  description = "Capacidad máxima de Aurora Serverless v2 (ACU). Min es 0 (scale-to-zero)."
  type        = number
  default     = 4
}

variable "aurora_seconds_until_auto_pause" {
  description = "Segundos de inactividad antes de pausar la BD (300–86400)."
  type        = number
  default     = 3600
}

variable "fargate_cpu" {
  description = "CPU de las tareas Fargate (256 = 0.25 vCPU)"
  type        = string
  default     = "256"
}

variable "fargate_memory" {
  description = "Memoria de las tareas Fargate (MB)"
  type        = string
  default     = "512"
}

variable "api_desired_count" {
  description = "Réplicas de la API. El cron env-up/env-down lo mueve entre 1 y 0."
  type        = number
  default     = 1
}

variable "image_tag" {
  description = "Tag de la imagen de contenedor en ECR (lo pone el CI = git sha)."
  type        = string
  default     = "latest"
}

variable "enabled" {
  description = <<-EOT
    Interruptor de encendido/apagado del entorno "caro". true = API arriba
    (ALB + tarea Fargate + IPs públicas). false = destruye ALB, target group,
    listener y el servicio ECS → sin ALB, sin IPv4, sin cómputo Fargate.
    Aurora (BD), S3, SSM, ECR y CloudFront NO se tocan (datos y dominio estables).
    Lo mueven los workflows env-up (true) / env-down (false).
  EOT
  type        = bool
  default     = true
}

variable "github_org" {
  description = "Organización/usuario de GitHub dueño del repo"
  type        = string
  default     = "Griffithsdor"
}

variable "github_repo" {
  description = "Nombre del repositorio"
  type        = string
  default     = "TCG-Dealer"
}
