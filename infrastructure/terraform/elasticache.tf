# ElastiCache Redis for TERI Model

# Create ElastiCache subnet group
resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}-cache-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${var.project_name}-${var.environment}-cache-subnet-group"
  }
}

# Create ElastiCache parameter group
resource "aws_elasticache_parameter_group" "main" {
  family = "redis7"
  name   = "${var.project_name}-${var.environment}-cache-params"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "timeout"
    value = "300"
  }

  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-cache-params"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Random password for Redis AUTH
resource "random_password" "redis_auth_token" {
  length  = 32
  special = false # Redis AUTH tokens cannot contain special characters
}

# Store Redis AUTH token in Secrets Manager
resource "aws_secretsmanager_secret" "redis_auth_token" {
  name                    = "${var.project_name}-${var.environment}-redis-auth-token"
  description             = "Redis AUTH token for TERI application"
  recovery_window_in_days = 7

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-auth-token"
  }
}

resource "aws_secretsmanager_secret_version" "redis_auth_token" {
  secret_id     = aws_secretsmanager_secret.redis_auth_token.id
  secret_string = random_password.redis_auth_token.result
}

# Create ElastiCache replication group
resource "aws_elasticache_replication_group" "main" {
  replication_group_id       = "${var.project_name}-${var.environment}-redis"
  description                = "Redis cluster for TERI ${var.environment} environment"

  # Node configuration
  node_type = var.redis_node_type
  port      = 6379

  # Cluster configuration
  num_cache_clusters = var.redis_num_cache_nodes
  
  # Parameter group
  parameter_group_name = aws_elasticache_parameter_group.main.name

  # Network configuration
  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.elasticache.id]

  # Security configuration
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.redis_auth_token.result

  # Backup configuration
  snapshot_retention_limit = var.environment == "prod" ? 7 : 1
  snapshot_window         = "03:00-05:00"
  maintenance_window      = "sun:05:00-sun:07:00"

  # Automatic failover for production
  automatic_failover_enabled = var.environment == "prod" && var.redis_num_cache_nodes > 1
  multi_az_enabled          = var.environment == "prod" && var.redis_num_cache_nodes > 1

  # Logging
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_slow_log.name
    destination_type = "cloudwatch-logs"
    log_format       = "text"
    log_type         = "slow-log"
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-redis"
    Environment = var.environment
  }

  lifecycle {
    ignore_changes = [auth_token]
  }
}

# CloudWatch log group for Redis slow logs
resource "aws_cloudwatch_log_group" "redis_slow_log" {
  name              = "/aws/elasticache/${var.project_name}-${var.environment}-redis/slow-log"
  retention_in_days = 7

  tags = {
    Name        = "${var.project_name}-${var.environment}-redis-slow-log"
    Environment = var.environment
  }
}