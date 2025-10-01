# S3 Configuration for TERI Model

# Random suffix for bucket name uniqueness
resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# S3 bucket for media storage
resource "aws_s3_bucket" "media" {
  bucket = var.s3_bucket_name != null ? var.s3_bucket_name : "${var.project_name}-${var.environment}-media-${random_id.bucket_suffix.hex}"

  tags = {
    Name        = "${var.project_name}-${var.environment}-media"
    Environment = var.environment
    Purpose     = "Media storage for audio files and content"
  }
}

# S3 bucket versioning
resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id
  versioning_configuration {
    status = var.enable_s3_versioning ? "Enabled" : "Suspended"
  }
}

# S3 bucket encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# S3 bucket public access block
resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 bucket lifecycle configuration
resource "aws_s3_bucket_lifecycle_configuration" "media" {
  count = var.s3_lifecycle_enabled ? 1 : 0
  
  bucket = aws_s3_bucket.media.id

  rule {
    id     = "audio_lifecycle"
    status = "Enabled"

    filter {
      prefix = "audio/"
    }

    expiration {
      days = 90
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }

  rule {
    id     = "temp_files_cleanup"
    status = "Enabled"

    filter {
      prefix = "temp/"
    }

    expiration {
      days = 1
    }
  }

  rule {
    id     = "multipart_upload_cleanup"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }

  rule {
    id     = "intelligent_tiering"
    status = "Enabled"

    filter {
      prefix = "content/"
    }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }
  }
}

# S3 bucket notification for processing
resource "aws_s3_bucket_notification" "media" {
  bucket = aws_s3_bucket.media.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.audio_processor.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "audio/uploads/"
    filter_suffix       = ".m4a"
  }

  lambda_function {
    lambda_function_arn = aws_lambda_function.audio_processor.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "audio/uploads/"
    filter_suffix       = ".mp3"
  }

  lambda_function {
    lambda_function_arn = aws_lambda_function.audio_processor.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "audio/uploads/"
    filter_suffix       = ".wav"
  }

  depends_on = [aws_lambda_permission.s3_invoke_audio_processor]
}

# Lambda function for audio processing
resource "aws_lambda_function" "audio_processor" {
  filename         = "audio_processor.zip"
  function_name    = "${var.project_name}-${var.environment}-audio-processor"
  role            = aws_iam_role.lambda_audio_processor.arn
  handler         = "index.handler"
  runtime         = "python3.11"
  timeout         = 300
  memory_size     = 512

  environment {
    variables = {
      S3_BUCKET = aws_s3_bucket.media.bucket
      WHISPER_API_KEY_SECRET = aws_secretsmanager_secret.whisper_api_key.name
    }
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-audio-processor"
    Environment = var.environment
  }
}

# Lambda permission for S3 to invoke function
resource "aws_lambda_permission" "s3_invoke_audio_processor" {
  statement_id  = "AllowExecutionFromS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.audio_processor.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = "${aws_s3_bucket.media.arn}/*"
}

# IAM role for Lambda audio processor
resource "aws_iam_role" "lambda_audio_processor" {
  name = "${var.project_name}-${var.environment}-lambda-audio-processor"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-lambda-audio-processor"
  }
}

# IAM policy for Lambda audio processor
resource "aws_iam_role_policy" "lambda_audio_processor" {
  name = "${var.project_name}-${var.environment}-lambda-audio-processor-policy"
  role = aws_iam_role.lambda_audio_processor.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.media.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.whisper_api_key.arn
        ]
      }
    ]
  })
}

# Secret for Whisper API key
resource "aws_secretsmanager_secret" "whisper_api_key" {
  name                    = "${var.project_name}-${var.environment}-whisper-api-key"
  description             = "API key for OpenAI Whisper service"
  recovery_window_in_days = 7

  tags = {
    Name = "${var.project_name}-${var.environment}-whisper-api-key"
  }
}

# CloudFront OAI for S3 access
resource "aws_cloudfront_origin_access_identity" "media" {
  comment = "OAI for ${var.project_name} ${var.environment} media bucket"
}

# S3 bucket policy for CloudFront access
resource "aws_s3_bucket_policy" "media" {
  bucket = aws_s3_bucket.media.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontAccess"
        Effect = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.media.iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.media.arn}/*"
      }
    ]
  })
}