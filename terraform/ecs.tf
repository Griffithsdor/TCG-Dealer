# ECS Fargate (Spot) + ALB + CloudFront. La API no se expone directa: CloudFront
# (HTTPS) → ALB (solo con header secreto) → tarea Fargate (SG solo desde ALB).
# El ALB/servicio/etc. se gatean con var.enabled (encendido/apagado del entorno).

# Transición sin churn: al añadir count, estos recursos pasan a índice [0].
moved {
  from = aws_lb.api
  to   = aws_lb.api[0]
}
moved {
  from = aws_lb_target_group.api
  to   = aws_lb_target_group.api[0]
}
moved {
  from = aws_lb_listener.http
  to   = aws_lb_listener.http[0]
}
moved {
  from = aws_lb_listener_rule.from_cloudfront
  to   = aws_lb_listener_rule.from_cloudfront[0]
}
moved {
  from = aws_ecs_service.api
  to   = aws_ecs_service.api[0]
}

locals {
  image_uri = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"

  # Secretos inyectados por ECS (execution role los lee de SSM).
  container_secrets = [
    { name = "DATABASE_URL", valueFrom = aws_ssm_parameter.database_url.arn },
    { name = "TCGAPI_KEY", valueFrom = aws_ssm_parameter.tcgapi_key.arn },
    { name = "API_KEY", valueFrom = aws_ssm_parameter.api_key.arn },
  ]
}

resource "aws_ecs_cluster" "this" {
  name = "${local.name}-cluster"
}

resource "aws_ecs_cluster_capacity_providers" "this" {
  cluster_name       = aws_ecs_cluster.this.name
  capacity_providers = ["FARGATE_SPOT", "FARGATE"]
  default_capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight            = 1
  }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${local.name}-api"
  retention_in_days = 14
}

# ---- Task definition de la API ----
resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.fargate_cpu
  memory                   = var.fargate_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name         = "api"
    image        = local.image_uri
    essential    = true
    command      = ["/app/bin/api.sh"]
    portMappings = [{ containerPort = 8000, protocol = "tcp" }]
    environment = [
      { name = "COGNITO_REGION", value = var.aws_region },
      { name = "COGNITO_USER_POOL_ID", value = aws_cognito_user_pool.this.id },
      { name = "COGNITO_APP_CLIENT_ID", value = aws_cognito_user_pool_client.this.id },
    ]
    secrets = local.container_secrets
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.api.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "api"
      }
    }
  }])
}

resource "aws_ecs_service" "api" {
  count           = var.enabled ? 1 : 0
  name            = "${local.name}-api"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_desired_count

  capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight            = 1
  }

  network_configuration {
    subnets          = data.aws_subnets.default.ids
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = true # subredes públicas, sin NAT
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api[0].arn
    container_name   = "api"
    container_port   = 8000
  }

  depends_on = [aws_lb_listener.http, aws_ecs_cluster_capacity_providers.this]
}

# ---- ALB (gateado por var.enabled) ----
resource "aws_lb" "api" {
  count              = var.enabled ? 1 : 0
  name               = "${local.name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = data.aws_subnets.default.ids
}

resource "aws_lb_target_group" "api" {
  count       = var.enabled ? 1 : 0
  name        = "${local.name}-tg"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = data.aws_vpc.default.id
  target_type = "ip"

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }
}

# Por defecto 403; solo pasa si trae el header secreto de CloudFront.
resource "aws_lb_listener" "http" {
  count             = var.enabled ? 1 : 0
  load_balancer_arn = aws_lb.api[0].arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Forbidden"
      status_code  = "403"
    }
  }
}

resource "aws_lb_listener_rule" "from_cloudfront" {
  count        = var.enabled ? 1 : 0
  listener_arn = aws_lb_listener.http[0].arn
  priority     = 100
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api[0].arn
  }
  condition {
    http_header {
      http_header_name = "X-CloudFront-Secret"
      values           = [random_password.cf_secret.result]
    }
  }
}

# ---- CloudFront (HTTPS con el cert gratis *.cloudfront.net) ----
resource "random_password" "cf_secret" {
  length  = 40
  special = false
}

resource "aws_cloudfront_distribution" "api" {
  enabled         = true
  comment         = "${local.name} API"
  price_class     = "PriceClass_100"
  is_ipv6_enabled = true

  # Cuando el entorno está apagado (sin ALB), origen provisional válido. Al
  # encender, CloudFront repunta al ALB nuevo (propaga ~10-15 min).
  origin {
    domain_name = try(aws_lb.api[0].dns_name, "disabled.example.com")
    origin_id   = "alb"
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
    custom_header {
      name  = "X-CloudFront-Secret"
      value = random_password.cf_secret.result
    }
  }

  default_cache_behavior {
    target_origin_id       = "alb"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    forwarded_values {
      query_string = true
      headers      = ["*"]
      cookies { forward = "all" }
    }
    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }
  viewer_certificate {
    cloudfront_default_certificate = true
  }
}
