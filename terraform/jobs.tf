# Jobs programados como tareas Fargate puntuales (EventBridge → ECS RunTask).
# Sin coste en reposo: la tarea arranca, corre unos minutos y termina.

resource "aws_cloudwatch_log_group" "jobs" {
  name              = "/ecs/${local.name}-jobs"
  retention_in_days = 14
}

resource "aws_ecs_task_definition" "jobs" {
  family                   = "${local.name}-jobs"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.fargate_cpu
  memory                   = var.fargate_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "job"
    image     = local.image_uri
    essential = true
    command   = ["/app/bin/analytics.sh"] # se sobreescribe por regla
    secrets   = local.container_secrets
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.jobs.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "job"
      }
    }
  }])
}

locals {
  jobs_network = {
    subnets          = data.aws_subnets.default.ids
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = true
  }

  # Reglas: nombre → (cron, comando del contenedor)
  job_schedules = {
    price = {
      schedule = "cron(0 6 * * ? *)" # ingesta diaria 06:00 UTC
      command  = ["/app/bin/price.sh"]
    }
    analytics = {
      schedule = "cron(30 6 * * ? *)" # análisis 06:30 UTC
      command  = ["/app/bin/analytics.sh"]
    }
    catalog = {
      schedule = "cron(0 5 ? * MON *)" # catálogo lunes 05:00 UTC
      command  = ["/app/bin/catalog.sh"]
    }
  }
}

resource "aws_cloudwatch_event_rule" "jobs" {
  for_each            = local.job_schedules
  name                = "${local.name}-${each.key}"
  description         = "Job ${each.key}"
  schedule_expression = each.value.schedule
}

resource "aws_cloudwatch_event_target" "jobs" {
  for_each = local.job_schedules
  rule     = aws_cloudwatch_event_rule.jobs[each.key].name
  arn      = aws_ecs_cluster.this.arn
  role_arn = aws_iam_role.events_run_task.arn

  ecs_target {
    task_definition_arn = aws_ecs_task_definition.jobs.arn
    task_count          = 1
    launch_type         = "FARGATE"
    network_configuration {
      subnets          = local.jobs_network.subnets
      security_groups  = local.jobs_network.security_groups
      assign_public_ip = local.jobs_network.assign_public_ip
    }
  }

  # Sobreescribe el comando del contenedor para este job concreto.
  input = jsonencode({
    containerOverrides = [{
      name    = "job"
      command = each.value.command
    }]
  })
}
