# Grupos de seguridad — cadena ALB → tareas → BD (nada expuesto de más).

# ALB de cara a internet: 80 abierto, pero el listener solo reenvía peticiones
# con el header secreto de CloudFront (ver ecs.tf).
resource "aws_security_group" "alb" {
  name        = "${local.name}-alb"
  description = "ALB de la API TCG"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Tareas Fargate (API + jobs): solo aceptan el puerto 8000 desde el ALB.
resource "aws_security_group" "app" {
  name        = "${local.name}-app"
  description = "Tareas Fargate de TCG"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description     = "API desde el ALB"
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Aurora: PRIVADA. Solo acepta 5432 desde el SG de las tareas (SG-a-SG).
resource "aws_security_group" "db" {
  name        = "${local.name}-db"
  description = "Aurora Postgres, solo desde las tareas"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description     = "Postgres desde las tareas Fargate"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
