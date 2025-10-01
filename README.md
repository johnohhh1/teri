# TERI Model - Infrastructure & DevOps

Complete infrastructure and DevOps setup for the Truth Empowered Relationships mobile application.

## 📋 Overview

This repository contains the complete infrastructure as code (IaC) and DevOps configuration for the TERI Model application, as specified in the Product Requirements Document (PRD). The infrastructure supports:

- **Microservices Architecture**: API Gateway, Auth, Training, Games, Progress, Notifications
- **AI/ML Services**: Translator (TES/TEL), Mediator (ASR + LLM)
- **Database Layer**: PostgreSQL (primary), Redis (cache), ChromaDB (vector)
- **Storage**: S3 for audio files and media
- **Monitoring**: CloudWatch dashboards, alarms, and logging

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│           Mobile Apps (Native)              │
│     iOS (Swift/SwiftUI) + Android (Kotlin)  │
└────────────────┬────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────┐
│            API Gateway (REST)               │
│         JWT Authentication + Rate Limiting   │
└────────────────┬────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────┐
│          Microservices Layer                │
├─────────────────────────────────────────────┤
│  • Auth Service                             │
│  • Training Service                         │
│  • Translator Service (→ LLM)              │
│  • Mediator Service (→ ASR + LLM)          │
│  • Games Service                            │
│  • Progress Service                         │
│  • Notification Service                     │
└────────────────┬────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────┐
│            Data Layer                       │
├─────────────────────────────────────────────┤
│  • PostgreSQL (primary)                     │
│  • Redis (sessions/cache)                   │
│  • ChromaDB (embeddings)                    │
│  • S3 (media storage)                       │
└─────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Local Development

1. **Prerequisites**:
   ```bash
   - Docker and Docker Compose
   - Node.js 18+
   - Python 3.11+
   - Git
   ```

2. **Clone and Start**:
   ```bash
   git clone <repository-url>
   cd teri-model
   
   # Copy environment template
   cp .env.example .env
   
   # Start all services
   docker-compose up -d
   
   # Initialize ChromaDB
   python scripts/setup-chromadb.py
   ```

3. **Verify Setup**:
   ```bash
   # Check service health
   curl http://localhost:3000/health  # API Gateway
   curl http://localhost:8001/health  # Translator
   curl http://localhost:8002/health  # Mediator
   ```

### AWS Deployment

1. **Prerequisites**:
   ```bash
   - AWS CLI configured
   - Terraform 1.6+
   - Docker
   ```

2. **Deploy Infrastructure**:
   ```bash
   cd infrastructure/terraform
   
   # Initialize Terraform
   terraform init
   
   # Plan deployment
   terraform plan -var="environment=dev"
   
   # Apply infrastructure
   terraform apply
   ```

3. **Deploy Application**:
   ```bash
   # Build and push images
   make build-and-push
   
   # Deploy to ECS
   make deploy
   ```

## 📁 Project Structure

```
teri-model/
├── .github/workflows/          # CI/CD pipeline
│   └── ci-cd.yml
├── infrastructure/             # Infrastructure as Code
│   └── terraform/
│       ├── main.tf            # Main Terraform config
│       ├── variables.tf       # Variable definitions
│       ├── vpc.tf            # VPC and networking
│       ├── security.tf       # Security groups and WAF
│       ├── rds.tf            # PostgreSQL database
│       ├── elasticache.tf    # Redis cache
│       └── s3.tf             # S3 storage
├── monitoring/                 # Monitoring and alerting
│   ├── cloudwatch-dashboards.json
│   └── cloudwatch-alarms.tf
├── scripts/                   # Setup and utility scripts
│   ├── init-db.sql           # Database initialization
│   └── setup-chromadb.py     # ChromaDB setup
├── services/                  # Microservices (to be created) must hav hot girl voice korkoro

│   ├── api-gateway/
│   ├── auth/
│   ├── training/
│   ├── translator/
│   ├── mediator/
│   ├── games/
│   ├── progress/
│   └── notifications/
├── docker-compose.yml         # Local development
├── Dockerfile.api            # Node.js services
├── Dockerfile.ml             # Python ML services
└── README.md
```

## 🛠️ Services

### API Services (Node.js)
- **API Gateway**: Request routing, authentication, rate limiting
- **Auth Service**: User authentication, JWT tokens, pairing
- **Training Service**: Content delivery, progress tracking
- **Games Service**: Game library, suggestions, sessions
- **Progress Service**: Analytics, milestones, reporting
- **Notifications Service**: Push notifications, email alerts

### ML Services (Python)
- **Translator Service**: TES/TEL translation using trained LLM
- **Mediator Service**: Audio transcription + analysis

## 💾 Data Layer

### PostgreSQL
- **Primary database** for user data, progress, sessions
- **Multi-AZ deployment** in production
- **Automated backups** and point-in-time recovery
- **Performance Insights** enabled

### Redis
- **Session storage** and caching
- **ElastiCache** with encryption
- **Multi-AZ** for production

### ChromaDB
- **Vector database** for semantic search
- **Relationship themes** for context matching
- **Game recommendations** based on similarity

### S3
- **Audio file storage** with lifecycle policies
- **Media content** delivery via CloudFront
- **Automatic cleanup** of temporary files

## 🔐 Security

### Network Security
- **VPC** with public/private subnets
- **Security groups** with least privilege
- **WAF** with managed rules
- **VPC endpoints** for AWS services

### Data Security
- **Encryption at rest** (AES-256)
- **Encryption in transit** (TLS 1.3)
- **JWT authentication** with refresh tokens
- **Secrets Manager** for API keys

### Compliance
- **GDPR compliance** for EU users
- **Data retention policies** (90 days for audio)
- **Audit logging** for all operations

## 📊 Monitoring

### CloudWatch Dashboards
- **Application metrics**: Request count, latency, errors
- **Infrastructure metrics**: CPU, memory, disk usage
- **Business metrics**: User registrations, game sessions

### Alarms
- **High error rates** (>1%)
- **High latency** (>2s p95)
- **Resource utilization** (>80%)
- **Custom application metrics**

### Logging
- **Centralized logging** via CloudWatch Logs
- **Structured JSON** format
- **Log aggregation** and search
- **Error tracking** and alerting

## 🚀 CI/CD Pipeline

### GitHub Actions Workflow
1. **Security Scanning**: Trivy, Checkov
2. **Unit Tests**: Jest (Node.js), pytest (Python)
3. **Integration Tests**: Full service testing
4. **Build & Push**: Docker images to ECR
5. **Deploy Infrastructure**: Terraform apply
6. **Deploy Application**: ECS service updates
7. **Post-deployment Tests**: Smoke and performance tests
8. **Notifications**: Slack alerts

### Environments
- **Development**: Local Docker Compose
- **Staging**: AWS with test data
- **Production**: AWS with full monitoring

## 📈 Scalability

### Auto Scaling
- **ECS Services**: CPU/memory-based scaling
- **RDS**: Storage auto-scaling
- **ElastiCache**: Read replicas

### Performance
- **CloudFront CDN** for static assets
- **Connection pooling** for databases
- **Caching strategies** with Redis
- **Async processing** for ML tasks

## 🔧 Configuration

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379
CHROMA_URL=http://host:8000

# Storage
S3_BUCKET=teri-media-bucket
S3_REGION=us-west-2

# API Keys
JWT_SECRET=your-secret-key
LLM_API_KEY=your-llm-key
WHISPER_API_KEY=your-whisper-key

# Monitoring
SENTRY_DSN=your-sentry-dsn
```

## 🧪 Testing

### Test Types
- **Unit Tests**: Individual service testing
- **Integration Tests**: Service-to-service communication
- **End-to-end Tests**: Full user journeys
- **Load Tests**: Performance and scalability

### Test Commands
```bash
# Unit tests
npm run test:unit
pytest tests/unit

# Integration tests
npm run test:integration

# Load tests
npm run test:load
```

## 📚 Documentation

- **API Documentation**: OpenAPI/Swagger specs
- **Architecture Decision Records**: `/docs/adr/`
- **Runbooks**: `/docs/runbooks/`
- **Incident Response**: `/docs/incident-response/`

## 🤝 Contributing

1. **Create feature branch** from `develop`
2. **Implement changes** with tests
3. **Run quality checks** locally
4. **Create pull request** with description
5. **Wait for CI/CD** to pass
6. **Request review** from team

## 🆘 Support

### Health Checks
```bash
# Service health
curl http://localhost:3000/health

# Database connectivity
curl http://localhost:3000/health/db

# External dependencies
curl http://localhost:3000/health/external
```

### Troubleshooting
- **Logs**: `docker-compose logs -f <service>`
- **Metrics**: CloudWatch dashboards
- **Alerts**: Check SNS notifications
- **Status**: Service health endpoints

### Emergency Contacts
- **On-call Engineer**: Pager duty rotation
- **Infrastructure Team**: Slack #infrastructure
- **Security Team**: Slack #security

## 📋 Deployment Checklist

### Pre-deployment
- [ ] All tests passing
- [ ] Security scan clean
- [ ] Database migrations ready
- [ ] Configuration updated
- [ ] Monitoring configured

### Post-deployment
- [ ] Health checks passing
- [ ] Metrics flowing
- [ ] Alerts configured
- [ ] Smoke tests passed
- [ ] Team notified

## 🔄 Maintenance

### Regular Tasks
- **Weekly**: Review metrics and alerts
- **Monthly**: Security updates and patches
- **Quarterly**: Infrastructure cost review
- **Annually**: Disaster recovery testing

### Backup and Recovery
- **Database backups**: Daily automated
- **Configuration backups**: Version controlled
- **Disaster recovery**: Cross-region replication
- **RTO/RPO**: 4 hours / 1 hour

---

**Infrastructure Status**: ✅ **COMPLETE**

*Generated with Claude Code for TERI Model Swarm Agent #5*