# StateSet MCP Server - Production Deployments

This directory contains production-ready deployment configurations for the StateSet MCP Server.

## 📁 Directory Structure

```
deployments/
├── docker/                 # Docker Compose configurations
│   ├── docker-compose.yml  # Full stack with Redis & monitoring
│   └── prometheus.yml      # Prometheus configuration
├── kubernetes/             # Kubernetes manifests
│   ├── deployment.yaml     # Main server deployment with HPA & PDB
│   ├── redis-statefulset.yaml  # Redis StatefulSet
│   └── ingress.yaml        # Ingress configuration (optional)
└── README.md              # This file
```

---

## 🐳 Docker Compose Deployment

### Quick Start

```bash
# Navigate to docker directory
cd deployments/docker

# Create .env file
cat > .env << EOF
STATESET_API_KEY=your_api_key_here
STATESET_BASE_URL=https://api.stateset.io/v1
GRAFANA_PASSWORD=secure_password
EOF

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f mcp-server
```

### Services Included

| Service | Port | Description |
|---------|------|-------------|
| **mcp-server** | 8081 | MCP Server (WebSocket) |
| | 9464 | Metrics endpoint |
| **redis** | 6379 | Redis cache |
| **prometheus** | 9090 | Metrics collection (optional) |
| **grafana** | 3000 | Dashboards (optional) |

### Optional Monitoring

To enable Prometheus and Grafana:

```bash
# Start with monitoring profile
docker-compose --profile monitoring up -d

# Access Grafana
open http://localhost:3000
# Login: admin / <GRAFANA_PASSWORD>
```

### Scaling

```bash
# Scale MCP server instances
docker-compose up -d --scale mcp-server=5

# Check Redis stats
docker-compose exec redis redis-cli INFO stats
```

### Maintenance

```bash
# Backup Redis data
docker-compose exec redis redis-cli BGSAVE

# View Redis keys
docker-compose exec redis redis-cli KEYS "stateset:mcp:*"

# Clear cache
docker-compose exec redis redis-cli FLUSHDB

# Update containers
docker-compose pull
docker-compose up -d
```

---

## ☸️ Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (v1.24+)
- `kubectl` configured
- Persistent storage provisioner

### Quick Start

```bash
# Navigate to kubernetes directory
cd deployments/kubernetes

# Create namespace
kubectl create namespace stateset-mcp

# Apply Redis StatefulSet
kubectl apply -f redis-statefulset.yaml -n stateset-mcp

# Wait for Redis to be ready
kubectl wait --for=condition=ready pod/redis-0 -n stateset-mcp --timeout=120s

# Update API key in secret (or use external secrets)
kubectl create secret generic stateset-secrets \
  --from-literal=api-key=your_api_key_here \
  -n stateset-mcp

# Deploy MCP server
kubectl apply -f deployment.yaml -n stateset-mcp

# Check status
kubectl get pods -n stateset-mcp -w
```

### Verify Deployment

```bash
# Check all resources
kubectl get all -n stateset-mcp

# View logs
kubectl logs -f deployment/stateset-mcp-server -n stateset-mcp

# Check HPA status
kubectl get hpa -n stateset-mcp

# Test health check
kubectl port-forward svc/stateset-mcp-service 9464:9464 -n stateset-mcp
curl http://localhost:9464/health
```

### Scaling

The deployment includes:
- **HPA (Horizontal Pod Autoscaler)**: Automatically scales 3-10 pods based on CPU/memory
- **PDB (Pod Disruption Budget)**: Ensures minimum 2 pods during updates

```bash
# Manual scaling
kubectl scale deployment stateset-mcp-server --replicas=5 -n stateset-mcp

# Check HPA metrics
kubectl get hpa stateset-mcp-hpa -n stateset-mcp --watch

# View autoscaling events
kubectl describe hpa stateset-mcp-hpa -n stateset-mcp
```

### Monitoring

```bash
# Check Prometheus scraping
kubectl port-forward svc/stateset-mcp-service 9464:9464 -n stateset-mcp
curl http://localhost:9464/metrics

# View pod metrics
kubectl top pods -n stateset-mcp

# Check Redis stats
kubectl exec -it redis-0 -n stateset-mcp -- redis-cli INFO stats
```

### Updates & Rollbacks

```bash
# Update image
kubectl set image deployment/stateset-mcp-server \
  mcp-server=stateset/mcp-server:v2.0.0 \
  -n stateset-mcp

# Check rollout status
kubectl rollout status deployment/stateset-mcp-server -n stateset-mcp

# Rollback if needed
kubectl rollout undo deployment/stateset-mcp-server -n stateset-mcp

# View rollout history
kubectl rollout history deployment/stateset-mcp-server -n stateset-mcp
```

### Production Best Practices

#### 1. **Use External Secrets**

Instead of storing API keys in Secrets, use external secret managers:

```yaml
# Using AWS Secrets Manager
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: stateset-secrets
spec:
  secretStoreRef:
    name: aws-secrets-manager
  target:
    name: stateset-secrets
  data:
    - secretKey: api-key
      remoteRef:
        key: stateset/mcp/api-key
```

#### 2. **Enable Network Policies**

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: stateset-mcp-netpol
spec:
  podSelector:
    matchLabels:
      app: stateset-mcp-server
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: ingress-controller
      ports:
        - protocol: TCP
          port: 8081
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: redis
      ports:
        - protocol: TCP
          port: 6379
```

#### 3. **Resource Quotas**

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: stateset-mcp-quota
spec:
  hard:
    requests.cpu: "10"
    requests.memory: 20Gi
    limits.cpu: "20"
    limits.memory: 40Gi
    persistentvolumeclaims: "5"
```

#### 4. **Pod Security Standards**

```yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: stateset-mcp-psp
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  runAsUser:
    rule: MustRunAsNonRoot
  seLinux:
    rule: RunAsAny
  fsGroup:
    rule: RunAsAny
```

---

## 🔐 Security Considerations

### API Key Management

**DON'T**:
```yaml
# Bad: Hardcoded in manifest
env:
  - name: STATESET_API_KEY
    value: "sk-1234567890abcdef"
```

**DO**:
```yaml
# Good: From secret
env:
  - name: STATESET_API_KEY
    valueFrom:
      secretKeyRef:
        name: stateset-secrets
        key: api-key
```

### TLS/SSL

For WebSocket connections, use TLS:

```yaml
# Ingress with TLS
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: stateset-mcp-ingress
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
    - hosts:
        - mcp.example.com
      secretName: mcp-tls
  rules:
    - host: mcp.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: stateset-mcp-service
                port:
                  number: 8081
```

---

## 📊 Monitoring & Observability

### Prometheus Metrics

Available metrics endpoints:
- `/metrics` - Prometheus-compatible metrics
- `/health` - Health check
- `/ready` - Readiness check

Key metrics to monitor:
- `mcp_requests_total` - Total requests
- `mcp_request_duration_seconds` - Request latency
- `mcp_cache_hits_total` - Cache performance
- `mcp_circuit_breaker_state` - Circuit breaker status
- `mcp_redis_operations_total` - Redis operations

### Grafana Dashboards

Import the provided dashboard:
```bash
# Import dashboard JSON
kubectl create configmap grafana-dashboard \
  --from-file=dashboard.json=grafana/dashboards/mcp-dashboard.json \
  -n monitoring
```

### Logging

Centralize logs with Fluentd/Fluent Bit:

```yaml
# Fluent Bit DaemonSet snippet
filter:
  - name: kubernetes
    match: kube.*
    K8S-Logging.Parser: "On"
    K8S-Logging.Exclude: "Off"
  - name: grep
    match: kube.*
    regex: kubernetes.labels.app stateset-mcp-server
```

---

## 🚀 Performance Tuning

### Redis Optimization

```bash
# Increase max connections
kubectl exec -it redis-0 -n stateset-mcp -- redis-cli CONFIG SET maxclients 10000

# Monitor slow queries
kubectl exec -it redis-0 -n stateset-mcp -- redis-cli SLOWLOG GET 10

# Check memory usage
kubectl exec -it redis-0 -n stateset-mcp -- redis-cli INFO memory
```

### MCP Server Tuning

```yaml
# Increase resources for high load
resources:
  requests:
    cpu: 500m
    memory: 1Gi
  limits:
    cpu: 2000m
    memory: 2Gi

# Adjust rate limits
env:
  - name: REQUESTS_PER_HOUR
    value: "20000"
  - name: REQUESTS_PER_MINUTE
    value: "1000"
```

---

## 🧪 Testing

### Load Testing

```bash
# Using K6
kubectl run k6-test --image=grafana/k6:latest --rm -it --restart=Never -- \
  run --vus 100 --duration 5m /scripts/load-test.js

# Using Apache Bench
kubectl run ab-test --image=httpd:alpine --rm -it --restart=Never -- \
  ab -n 10000 -c 100 http://stateset-mcp-service:9464/health
```

### Chaos Engineering

```bash
# Simulate pod failure
kubectl delete pod -l app=stateset-mcp-server --force --grace-period=0

# Watch recovery
kubectl get pods -w -n stateset-mcp
```

---

## 📚 Additional Resources

- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
- [Redis Kubernetes Operator](https://github.com/spotahome/redis-operator)
- [Prometheus Operator](https://github.com/prometheus-operator/prometheus-operator)
- [StateSet API Documentation](https://docs.stateset.io)

---

## 🆘 Troubleshooting

### Common Issues

**Pods not starting**:
```bash
kubectl describe pod <pod-name> -n stateset-mcp
kubectl logs <pod-name> -n stateset-mcp
```

**Redis connection issues**:
```bash
kubectl exec -it <mcp-pod> -n stateset-mcp -- nc -zv redis-service 6379
```

**High memory usage**:
```bash
# Check top consumers
kubectl top pods -n stateset-mcp --sort-by=memory

# Adjust cache limits
kubectl set env deployment/stateset-mcp-server \
  REDIS_HYBRID_L1_SIZE=500 \
  -n stateset-mcp
```

---

**For more help**, visit our [Troubleshooting Guide](../docs/troubleshooting.md) or [open an issue](https://github.com/stateset/mcp-server/issues).
