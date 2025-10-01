# CloudWatch Alarms for TERI Model monitoring

# SNS Topic for alerts
resource "aws_sns_topic" "alerts" {
  name = var.sns_topic_name

  tags = {
    Name = "${var.project_name}-${var.environment}-alerts"
  }
}

# SNS Topic subscription
resource "aws_sns_topic_subscription" "email_alerts" {
  count = var.alert_email != null ? 1 : 0
  
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# Application Load Balancer Alarms
resource "aws_cloudwatch_metric_alarm" "alb_high_4xx_errors" {
  alarm_name          = "${var.project_name}-${var.environment}-alb-high-4xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HTTPCode_Target_4XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "50"
  alarm_description   = "This metric monitors 4xx errors on ALB"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions         = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-alb-4xx-errors"
  }
}

resource "aws_cloudwatch_metric_alarm" "alb_high_5xx_errors" {
  alarm_name          = "${var.project_name}-${var.environment}-alb-high-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This metric monitors 5xx errors on ALB"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions         = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-alb-5xx-errors"
  }
}

resource "aws_cloudwatch_metric_alarm" "alb_high_response_time" {
  alarm_name          = "${var.project_name}-${var.environment}-alb-high-response-time"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Average"
  threshold           = "2.0"
  alarm_description   = "This metric monitors ALB response time"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions         = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-alb-response-time"
  }
}

# ECS Service Alarms
resource "aws_cloudwatch_metric_alarm" "ecs_cpu_high" {
  count = length(local.services)
  
  alarm_name          = "${var.project_name}-${var.environment}-${local.services[count.index]}-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ECS CPU utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions         = [aws_sns_topic.alerts.arn]

  dimensions = {
    ServiceName = "${var.project_name}-${var.environment}-${local.services[count.index]}"
    ClusterName = aws_ecs_cluster.main.name
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-${local.services[count.index]}-cpu"
  }
}

resource "aws_cloudwatch_metric_alarm" "ecs_memory_high" {
  count = length(local.services)
  
  alarm_name          = "${var.project_name}-${var.environment}-${local.services[count.index]}-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ECS memory utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions         = [aws_sns_topic.alerts.arn]

  dimensions = {
    ServiceName = "${var.project_name}-${var.environment}-${local.services[count.index]}"
    ClusterName = aws_ecs_cluster.main.name
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-${local.services[count.index]}-memory"
  }
}

# RDS Alarms
resource "aws_cloudwatch_metric_alarm" "rds_cpu_high" {
  alarm_name          = "${var.project_name}-${var.environment}-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors RDS CPU utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions         = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-rds-cpu"
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_connections_high" {
  alarm_name          = "${var.project_name}-${var.environment}-rds-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors RDS database connections"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions         = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-rds-connections"
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_free_memory_low" {
  alarm_name          = "${var.project_name}-${var.environment}-rds-free-memory-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "FreeableMemory"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "100000000" # 100MB in bytes
  alarm_description   = "This metric monitors RDS free memory"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions         = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-rds-memory"
  }
}

# ElastiCache Alarms
resource "aws_cloudwatch_metric_alarm" "redis_cpu_high" {
  alarm_name          = "${var.project_name}-${var.environment}-redis-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ElastiCache CPU utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions         = [aws_sns_topic.alerts.arn]

  dimensions = {
    CacheClusterId = "${aws_elasticache_replication_group.main.replication_group_id}-001"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-cpu"
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_memory_high" {
  alarm_name          = "${var.project_name}-${var.environment}-redis-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ElastiCache memory usage"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions         = [aws_sns_topic.alerts.arn]

  dimensions = {
    CacheClusterId = "${aws_elasticache_replication_group.main.replication_group_id}-001"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-memory"
  }
}

# Custom Application Metrics Alarms
resource "aws_cloudwatch_metric_alarm" "translator_error_rate" {
  alarm_name          = "${var.project_name}-${var.environment}-translator-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "TranslatorErrorRate"
  namespace           = "TERI/Application"
  period              = "300"
  statistic           = "Average"
  threshold           = "5" # 5% error rate
  alarm_description   = "This metric monitors translator service error rate"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions         = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    Service = "translator"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-translator-errors"
  }
}

resource "aws_cloudwatch_metric_alarm" "mediator_error_rate" {
  alarm_name          = "${var.project_name}-${var.environment}-mediator-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MediatorErrorRate"
  namespace           = "TERI/Application"
  period              = "300"
  statistic           = "Average"
  threshold           = "5" # 5% error rate
  alarm_description   = "This metric monitors mediator service error rate"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions         = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    Service = "mediator"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-mediator-errors"
  }
}

# Log-based alarms
resource "aws_cloudwatch_log_metric_filter" "application_errors" {
  name           = "${var.project_name}-${var.environment}-application-errors"
  log_group_name = aws_cloudwatch_log_group.ecs.name
  pattern        = "[timestamp, request_id, level=\"ERROR\", ...]"

  metric_transformation {
    name      = "ApplicationErrors"
    namespace = "TERI/Application"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "application_error_rate" {
  alarm_name          = "${var.project_name}-${var.environment}-application-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ApplicationErrors"
  namespace           = "TERI/Application"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This metric monitors application error rate from logs"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions         = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"

  tags = {
    Name = "${var.project_name}-${var.environment}-app-errors"
  }
}

# Composite alarm for overall system health
resource "aws_cloudwatch_composite_alarm" "system_health" {
  alarm_name      = "${var.project_name}-${var.environment}-system-health"
  alarm_rule      = "ALARM(${aws_cloudwatch_metric_alarm.alb_high_5xx_errors.alarm_name}) OR ALARM(${aws_cloudwatch_metric_alarm.rds_cpu_high.alarm_name}) OR ALARM(${aws_cloudwatch_metric_alarm.application_error_rate.alarm_name})"
  alarm_actions   = [aws_sns_topic.alerts.arn]
  ok_actions     = [aws_sns_topic.alerts.arn]
  
  alarm_description = "Overall system health composite alarm"

  tags = {
    Name = "${var.project_name}-${var.environment}-system-health"
  }
}

# Local variables for services
locals {
  services = [
    "api-gateway",
    "auth",
    "training",
    "games",
    "progress",
    "notifications",
    "translator",
    "mediator"
  ]
}