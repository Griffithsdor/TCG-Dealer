# Aurora Serverless v2 (PostgreSQL) — PRIVADA y con scale-to-zero.
# publicly_accessible=false + SG solo desde las tareas → no alcanzable desde
# internet. Auto-pausa (mín. 0 ACU) → casi $0 en reposo.

resource "aws_db_subnet_group" "this" {
  name       = "${local.name}-db"
  subnet_ids = data.aws_subnets.default.ids
}

resource "random_password" "db" {
  length  = 28
  special = false
}

resource "aws_rds_cluster" "this" {
  cluster_identifier = "${local.name}-aurora"
  engine             = "aurora-postgresql"
  engine_mode        = "provisioned"
  engine_version     = "16.6"

  database_name   = var.db_name
  master_username = "tcg_admin"
  master_password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.db.id]
  storage_encrypted      = true
  skip_final_snapshot    = true
  deletion_protection    = false

  serverlessv2_scaling_configuration {
    min_capacity             = 0
    max_capacity             = var.aurora_max_acu
    seconds_until_auto_pause = var.aurora_seconds_until_auto_pause
  }
}

resource "aws_rds_cluster_instance" "this" {
  identifier          = "${local.name}-aurora-1"
  cluster_identifier  = aws_rds_cluster.this.id
  instance_class      = "db.serverless"
  engine              = aws_rds_cluster.this.engine
  engine_version      = aws_rds_cluster.this.engine_version
  publicly_accessible = false # PRIVADA
}
