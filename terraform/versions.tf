terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.90" # Aurora Serverless v2 scale-to-zero (seconds_until_auto_pause)
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Backend remoto en S3 con bloqueo en DynamoDB.
  # Se inicializa con: terraform init -backend-config=backend.hcl
  # (el bucket/tabla se crean antes con la carpeta bootstrap/)
  backend "s3" {}
}
