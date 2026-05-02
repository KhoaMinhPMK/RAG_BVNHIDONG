---
noteId: "be3-devops-guide-20260502"
tags: ["devops", "infrastructure", "guide", "be3"]
created: 2026-05-02T11:18:49Z
assignee: BE3 (DevOps Engineer)
priority: HIGH
---

# 👤 BE3 (DEVOPS ENGINEER) - HƯỚNG DẪN CÔNG VIỆC

## Vai trò:
DevOps Engineer chịu trách nhiệm toàn bộ hạ tầng, deployment, monitoring và bảo mật cho dự án RAG_BVNHIDONG.

## Môi trường làm việc:
- **A100 Server:** Docker JupyterLab container (không có SSH)
- **Access:** JupyterLab web interface
- **Cloudflare Tunnel:** grew-hypothesis-mothers-flooring.trycloudflare.com
- **Supabase:** https://mibtdruhmmcatccdzjjk.supabase.co
- **Backend:** Express.js on port 3005
- **Frontend:** Next.js on port 3001
- **Ollama:** qwen2.5:7b + nomic-embed-text models (running in Docker)

---

## 📋 NHIỆM VỤ CHI TIẾT

### **PHASE 1: Infrastructure Setup (2 ngày)**

#### **Task 1.1: A100 Docker JupyterLab Management (0.5 ngày)**

**Access A100 via JupyterLab:**
```
URL: https://grew-hypothesis-mothers-flooring.trycloudflare.com
Interface: JupyterLab web UI
Container: Docker with A100 GPU
```

**1. Verify GPU Status (via JupyterLab Terminal):**
```bash
# Open Terminal in JupyterLab
nvidia-smi  # Verify A100 GPU status
```

**2. Ollama Verification:**
```bash
# Check Ollama service
curl http://localhost:11434/api/tags

# Verify models
ollama list
# Expected: qwen2.5:7b, nomic-embed-text
```

**3. GPU Monitoring Setup:**
```bash
# Install monitoring tools in JupyterLab
pip install gpustat nvitop

# Create monitoring notebook
# File: monitoring/gpu_monitor.ipynb
```

**4. Cloudflare Tunnel Verification:**
```bash
# Check tunnel status
ps aux | grep cloudflared

# Test external access
curl https://grew-hypothesis-mothers-flooring.trycloudflare.com/api/tags
```

**5. Container Health Check:**
```bash
# Check disk space
df -h

# Check memory
free -m

# Check running processes
htop
```

**Deliverables:**
- ✅ JupyterLab access verified
- ✅ GPU monitoring notebook created
- ✅ Cloudflare tunnel confirmed working
- ✅ Container health dashboard setup

---

#### **Task 1.2: CI/CD Pipeline Setup (1 ngày)**

**Deployment Strategy cho Docker JupyterLab:**

**Option 1: Deploy Backend/Frontend riêng biệt (RECOMMENDED)**
- Backend API: Deploy to Vercel/Railway/Render
- Frontend: Deploy to Vercel/Netlify
- A100 JupyterLab: Chỉ chạy Ollama service
- Kết nối: Backend → Cloudflare Tunnel → Ollama

**Option 2: Deploy trong JupyterLab Container**
- Chạy backend API trong JupyterLab
- Expose qua Cloudflare Tunnel
- Frontend deploy riêng
- ⚠️ Không recommended (JupyterLab không stable cho production)

**Option 3: Local Server + Reverse Proxy**
- Backend/Frontend chạy trên local server
- Nginx reverse proxy
- Kết nối A100 qua Cloudflare Tunnel

---

**File:** `.github/workflows/deploy-backend.yml`

```yaml
name: Deploy Backend
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: cd apps/api && yarn install --frozen-lockfile
      
      - name: Build
        run: cd apps/api && yarn build
      
      - name: Type check
        run: cd apps/api && yarn typecheck
      
      - name: Deploy to Vercel/Railway
        run: |
          # Deploy to hosting platform
          # Set OLLAMA_URL to Cloudflare Tunnel URL
          # OLLAMA_URL=https://grew-hypothesis-mothers-flooring.trycloudflare.com
```
```

**File:** `.github/workflows/deploy-frontend.yml`

```yaml
name: Deploy Frontend
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: cd apps/web && yarn install --frozen-lockfile
      
      - name: Build
        run: cd apps/web && yarn build
      
      - name: Deploy
        run: |
          # Deploy to hosting
```

**File:** `.github/workflows/test.yml`

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: yarn install
      - run: yarn test
      - run: yarn lint
```

**Files cần tạo:**
1. `.github/workflows/deploy-backend.yml`
2. `.github/workflows/deploy-frontend.yml`
3. `.github/workflows/test.yml`
4. `Dockerfile` cho backend API
5. `docker-compose.yml` cho toàn bộ stack
6. `deploy.sh` script

---

#### **Task 1.3: Logging & Monitoring (0.5 ngày)**

**Monitoring cho Docker JupyterLab:**

**1. GPU Monitoring Notebook**

**File:** `monitoring/gpu_monitor.ipynb` (tạo trong JupyterLab)

```python
# Cell 1: Install dependencies
!pip install gpustat nvitop pandas matplotlib

# Cell 2: GPU monitoring function
import subprocess
import json
import time
from datetime import datetime

def get_gpu_stats():
    result = subprocess.run(['nvidia-smi', '--query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu', '--format=csv,noheader,nounits'], 
                          capture_output=True, text=True)
    gpu_util, mem_used, mem_total, temp = result.stdout.strip().split(',')
    return {
        'timestamp': datetime.now().isoformat(),
        'gpu_utilization': float(gpu_util),
        'memory_used_mb': float(mem_used),
        'memory_total_mb': float(mem_total),
        'temperature_c': float(temp)
    }

# Cell 3: Continuous monitoring
import pandas as pd
import matplotlib.pyplot as plt
from IPython.display import clear_output

stats = []
while True:
    stat = get_gpu_stats()
    stats.append(stat)
    
    # Keep last 100 records
    if len(stats) > 100:
        stats.pop(0)
    
    # Plot
    df = pd.DataFrame(stats)
    clear_output(wait=True)
    
    fig, axes = plt.subplots(2, 2, figsize=(12, 8))
    df.plot(x='timestamp', y='gpu_utilization', ax=axes[0,0], title='GPU Utilization %')
    df.plot(x='timestamp', y='memory_used_mb', ax=axes[0,1], title='Memory Used (MB)')
    df.plot(x='timestamp', y='temperature_c', ax=axes[1,0], title='Temperature (C)')
    plt.tight_layout()
    plt.show()
    
    time.sleep(5)
```

**2. Ollama Health Check Notebook**

**File:** `monitoring/ollama_health.ipynb`

```python
# Cell 1: Ollama health check
import requests
import time
from datetime import datetime

def check_ollama_health():
    try:
        # Check if Ollama is running
        response = requests.get('http://localhost:11434/api/tags', timeout=5)
        if response.ok:
            models = response.json().get('models', [])
            return {
                'status': 'healthy',
                'models': [m['name'] for m in models],
                'timestamp': datetime.now().isoformat()
            }
        else:
            return {'status': 'unhealthy', 'error': f'HTTP {response.status_code}'}
    except Exception as e:
        return {'status': 'down', 'error': str(e)}

# Cell 2: Continuous health monitoring
while True:
    health = check_ollama_health()
    print(f"[{health['timestamp']}] Ollama: {health['status']}")
    if health['status'] == 'healthy':
        print(f"  Models: {', '.join(health['models'])}")
    else:
        print(f"  Error: {health.get('error')}")
    time.sleep(30)
```

**3. Cloudflare Tunnel Monitoring**

**File:** `monitoring/tunnel_health.ipynb`

```python
# Cell 1: Tunnel health check
import requests

def check_tunnel_health():
    tunnel_url = 'https://grew-hypothesis-mothers-flooring.trycloudflare.com'
    try:
        response = requests.get(f'{tunnel_url}/api/tags', timeout=10)
        return {
            'status': 'healthy' if response.ok else 'unhealthy',
            'response_time_ms': response.elapsed.total_seconds() * 1000,
            'status_code': response.status_code
        }
    except Exception as e:
        return {'status': 'down', 'error': str(e)}

# Cell 2: Monitor tunnel
while True:
    health = check_tunnel_health()
    print(f"Tunnel: {health['status']} - {health.get('response_time_ms', 'N/A')}ms")
    time.sleep(60)
```

**4. Backend API Monitoring**

**File:** `apps/api/src/lib/monitoring/metrics.ts`

```typescript
export class MetricsCollector {
  // API Response times
  // GPU utilization (via Ollama)
  // Database query times
  // Error rates
  // Credit usage tracking (MiMo API)
}
```

**Setup:**
1. **Winston Logger** (đã có) - cấu hình file rotation
2. **Prometheus/Grafana** cho metrics dashboard (optional)
3. **Health check endpoints** cho tất cả services
4. **Alert system** cho critical errors (email/Slack)

**Endpoints cần tạo:**
```typescript
GET /health - Basic health check
GET /health/detailed - Detailed service status
GET /metrics - Prometheus metrics
GET /health/gpu - GPU status (via Ollama)
GET /health/ollama - Ollama connection
GET /health/supabase - Database connection
GET /health/mimo - MiMo API status
```

---

### **PHASE 2: Performance Optimization (1-2 ngày)**

#### **Task 2.1: Database Optimization**

```sql
-- Review existing indexes
SELECT * FROM pg_indexes WHERE schemaname = 'public';

-- Add missing indexes
CREATE INDEX idx_documents_content_hash ON documents(content_hash);
CREATE INDEX idx_chunks_embedding ON chunks USING ivfflat (embedding vector_cosine_ops);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM match_document_chunks(...);

-- Setup connection pooling (Supabase PgBouncer)
```

---

#### **Task 2.2: Caching Layer**

**File:** `apps/api/src/lib/cache/redis.ts`

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function getOrSetCache(
  key: string, 
  fetchFn: () => Promise<any>, 
  ttl: number = 300
) {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);
  
  const data = await fetchFn();
  await redis.set(key, JSON.stringify(data), 'EX', ttl);
  return data;
}
```

**Setup Redis cho:**
- API response caching
- Session storage
- Rate limiting
- Vector search results

---

#### **Task 2.3: Load Balancing**

**File:** `apps/api/nginx.conf`

```nginx
upstream backend {
  server localhost:3005;
  server localhost:3006;  # For scaling
}

server {
  listen 80;
  location /api/ {
    proxy_pass http://backend;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

---

### **PHASE 3: Security Hardening (1 ngày)**

#### **Task 3.1: Security Audit**

```bash
# 1. Scan dependencies
npm audit
yarn audit

# 2. Check for exposed secrets
grep -r "SUPABASE_SERVICE_ROLE_KEY" . --include="*.ts" --include="*.js"
grep -r "MIMO_API_KEY" . --include="*.ts" --include="*.js"

# 3. Check file permissions
ls -la apps/api/.env
ls -la apps/web/.env.local
```

---

#### **Task 3.2: Security Implementation**

**1. Rate Limiting:**

```typescript
// apps/api/src/middleware/rate-limit.ts
import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.'
});
```

**2. Security Headers:**
- Helmet.js (đã có) - cấu hình CSP headers
- CORS - whitelist domains
- Environment variables - ensure no secrets in code
- SSL/TLS - enforce HTTPS
- Input validation - Zod schemas (đã có)

---

#### **Task 3.3: Compliance**

- HIPAA compliance checklist (medical data)
- GDPR compliance (user data)
- Audit logging (đã có)
- Data encryption at rest

---

## 🛠️ TOOLS & TECHNOLOGIES

| Tool | Purpose | Priority |
|------|---------|----------|
| Docker | Containerization | HIGH |
| JupyterLab | A100 container interface | HIGH |
| GitHub Actions | CI/CD | HIGH |
| Nginx | Reverse proxy | MEDIUM |
| Redis | Caching | HIGH |
| Prometheus | Metrics | MEDIUM |
| Grafana | Dashboard | MEDIUM |
| Cloudflare Tunnel | A100 remote access | HIGH |
| gpustat/nvitop | GPU monitoring | HIGH |
| Winston | Logging | MEDIUM |
| Vercel/Railway | Backend hosting | HIGH |

---

## 📊 SUCCESS CRITERIA

- ✅ CI/CD pipeline hoạt động (push → auto deploy)
- ✅ Monitoring notebooks active trong JupyterLab
- ✅ Redis caching giảm API latency 50%
- ✅ Security audit pass (0 critical vulnerabilities)
- ✅ 99.9% uptime cho A100 Docker container
- ✅ GPU utilization > 70%
- ✅ Database queries < 100ms (p95)
- ✅ Cloudflare Tunnel stable connection

---

## 💬 COMMUNICATION

**Daily updates vào chat3.md:**

```
[TIME] BE3 → ALL
[UPDATE] Task X - Infrastructure

✅ Done: <what>
🔄 Doing: <what>
🚫 Blocked: <what>
📋 Next: <what>
⏱️ ETA: <time>
```

**Blockers:** Tag `[BLOCKER]` + ping @agentFE  
**Questions:** Tag `[QUESTION]` + ping @agentFE

---

## 🤝 COORDINATION VỚI TEAM

| Với ai | Nội dung |
|--------|----------|
| Kiro (agentFE) | Báo cáo progress, request resources |
| BE1 (agentBE) | Deploy backend code, optimize APIs |
| BE2 (AI/ML) | Setup A100 environment, GPU monitoring |
| FE (agentUI) | CDN setup, static assets optimization |
| User | Security reports, infrastructure costs |

---

## 📝 TIMELINE

**Week 1:**
- Day 1-2: Infrastructure setup
- Day 3-4: Performance optimization
- Day 5: Security hardening

**Week 2:**
- Monitoring & alerting
- Documentation
- Training team

**Ongoing:**
- Server maintenance
- Performance tuning
- Security updates

---

## ⚠️ LƯU Ý QUAN TRỌNG VỀ DOCKER JUPYTERLAB

### **A100 Environment:**

**✅ Có thể làm:**
- Access qua JupyterLab web interface
- Chạy Python notebooks cho monitoring
- Verify GPU status với `nvidia-smi`
- Check Ollama service
- Install Python packages với `pip`
- Run terminal commands trong JupyterLab
- Monitor GPU/Memory/Temperature

**❌ Không thể làm:**
- SSH vào container (không có SSH server)
- Deploy production backend trong container (không stable)
- Cài đặt system packages (không có root access)
- Restart Docker container từ bên trong
- Setup systemd services

### **Recommended Architecture:**

```
┌─────────────────────────────────────────────┐
│  Production Environment                     │
├─────────────────────────────────────────────┤
│                                             │
│  Frontend (Vercel/Netlify)                 │
│      ↓                                      │
│  Backend API (Vercel/Railway/Render)       │
│      ↓                                      │
│  Cloudflare Tunnel                          │
│      ↓                                      │
│  A100 Docker JupyterLab                     │
│    - Ollama (qwen2.5:7b)                   │
│    - nomic-embed-text                       │
│    - GPU monitoring notebooks               │
│                                             │
└─────────────────────────────────────────────┘
```

### **Deployment Strategy:**

1. **Backend API:** Deploy to cloud platform
   - Vercel (recommended for Next.js API routes)
   - Railway (recommended for Express.js)
   - Render
   - Set `OLLAMA_URL=https://grew-hypothesis-mothers-flooring.trycloudflare.com`

2. **Frontend:** Deploy to CDN
   - Vercel (recommended)
   - Netlify
   - Cloudflare Pages

3. **A100 JupyterLab:** Keep as-is
   - Only run Ollama service
   - Monitoring notebooks
   - Model training (future PCXR)
   - Expose via Cloudflare Tunnel

### **Monitoring Strategy:**

- **GPU Monitoring:** JupyterLab notebooks (real-time)
- **API Monitoring:** Backend platform dashboard
- **Uptime Monitoring:** UptimeRobot / Pingdom
- **Error Tracking:** Sentry
- **Logs:** Platform-native logging

### **Backup Strategy:**

- **Code:** Git repository (already done)
- **Database:** Supabase automatic backups
- **Models:** Download from Ollama if needed
- **Notebooks:** Export from JupyterLab regularly

---

**Status:** 📋 Ready to start  
**Priority:** 🔴 HIGH  
**Estimated:** 4-5 days setup + ongoing maintenance

**Note:** A100 là Docker JupyterLab, không phải SSH server. Deployment strategy cần điều chỉnh cho phù hợp.
