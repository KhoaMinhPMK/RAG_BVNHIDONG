---
timestamp: 2026-05-02T12:08:00Z
from: Kiro (Coordinator)
to: BE3 (DevOps Engineer)
type: TASK_ASSIGNMENT
---

# 🎯 TASK ASSIGNMENT - BE3

**Agent:** BE3 (DevOps Engineer)  
**Task:** #6 - Setup monitoring notebooks for A100 JupyterLab  
**Priority:** 🟢 MEDIUM  
**Estimated:** 2 hours  
**Branch:** `feature/jupyterlab-monitoring`

---

## 🛠️ TOOLS AVAILABLE TO YOU

**You have access to:**
- ✅ **Git CLI** - Full git commands (branch, commit, push, etc.)
- ✅ **MCP Tools** - Composio integration for external services
- ✅ **File system** - Read, Write, Edit files
- ✅ **Bash** - Run any shell commands
- ✅ **Python** - For notebook code

**Important:** You are a REAL developer with REAL tools. Use them professionally.

---

## 📋 TASK DETAILS

**Goal:**
- Create monitoring notebooks for A100 Docker JupyterLab
- GPU monitoring with real-time stats
- Ollama health check
- Cloudflare Tunnel monitoring

**Context:**
- A100 is Docker JupyterLab (NOT SSH server)
- Access via web interface
- Cloudflare Tunnel: grew-hypothesis-mothers-flooring.trycloudflare.com
- Ollama running on localhost:11434

**Files to create:**
- `monitoring/gpu_monitor.ipynb`
- `monitoring/ollama_health.ipynb`
- `monitoring/tunnel_health.ipynb`
- `monitoring/README.md`

---

## 🔧 IMPLEMENTATION STEPS

### **Step 1: Create branch**
```bash
git checkout main
git pull origin main
git checkout -b feature/jupyterlab-monitoring
```

### **Step 2: Create monitoring directory**
```bash
mkdir -p monitoring
```

### **Step 3: Create GPU monitoring notebook**

**File:** `monitoring/gpu_monitor.ipynb`

Create Jupyter notebook with this content:

```python
# Cell 1: Import libraries
# Note: gpustat, pandas, matplotlib should be pre-installed in A100 JupyterLab
import subprocess
import json
import time
import subprocess
import json
import time
import pandas as pd
import matplotlib.pyplot as plt
from datetime import datetime
from IPython.display import clear_output

# Cell 3: GPU stats function
def get_gpu_stats():
    """Get GPU utilization, memory, and temperature"""
    result = subprocess.run(
        ['nvidia-smi', '--query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu', 
         '--format=csv,noheader,nounits'],
        capture_output=True, 
        text=True
    )
    gpu_util, mem_used, mem_total, temp = result.stdout.strip().split(',')
    return {
        'timestamp': datetime.now().isoformat(),
        'gpu_utilization': float(gpu_util),
        'memory_used_mb': float(mem_used),
        'memory_total_mb': float(mem_total),
        'memory_percent': (float(mem_used) / float(mem_total)) * 100,
        'temperature_c': float(temp)
    }

# Cell 4: Real-time monitoring
stats = []
try:
    while True:
        stat = get_gpu_stats()
        stats.append(stat)
        
        # Keep last 100 records
        if len(stats) > 100:
            stats.pop(0)
        
        # Plot
        df = pd.DataFrame(stats)
        clear_output(wait=True)
        
        fig, axes = plt.subplots(2, 2, figsize=(14, 10))
        
        # GPU Utilization
        axes[0,0].plot(df.index, df['gpu_utilization'], 'b-')
        axes[0,0].set_title('GPU Utilization (%)')
        axes[0,0].set_ylim(0, 100)
        axes[0,0].grid(True)
        
        # Memory Usage
        axes[0,1].plot(df.index, df['memory_percent'], 'g-')
        axes[0,1].set_title('Memory Usage (%)')
        axes[0,1].set_ylim(0, 100)
        axes[0,1].grid(True)
        
        # Temperature
        axes[1,0].plot(df.index, df['temperature_c'], 'r-')
        axes[1,0].set_title('Temperature (°C)')
        axes[1,0].set_ylim(0, 100)
        axes[1,0].grid(True)
        
        # Memory MB
        axes[1,1].plot(df.index, df['memory_used_mb'], 'orange')
        axes[1,1].set_title('Memory Used (MB)')
        axes[1,1].grid(True)
        
        plt.tight_layout()
        plt.show()
        
        # Print current stats
        print(f"[{stat['timestamp']}]")
        print(f"GPU: {stat['gpu_utilization']:.1f}%")
        print(f"Memory: {stat['memory_used_mb']:.0f}/{stat['memory_total_mb']:.0f} MB ({stat['memory_percent']:.1f}%)")
        print(f"Temp: {stat['temperature_c']:.1f}°C")
        
        time.sleep(5)
except KeyboardInterrupt:
    print("Monitoring stopped")
```

### **Step 4: Create Ollama health check notebook**

**File:** `monitoring/ollama_health.ipynb`

```python
# Cell 1: Import libraries
import requests
import time
from datetime import datetime

# Cell 2: Health check function
def check_ollama_health():
    """Check if Ollama is running and list models"""
    try:
        response = requests.get('http://localhost:11434/api/tags', timeout=5)
        if response.ok:
            data = response.json()
            models = [m['name'] for m in data.get('models', [])]
            return {
                'status': 'healthy',
                'models': models,
                'timestamp': datetime.now().isoformat()
            }
        else:
            return {
                'status': 'unhealthy',
                'error': f'HTTP {response.status_code}',
                'timestamp': datetime.now().isoformat()
            }
    except Exception as e:
        return {
            'status': 'down',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }

# Cell 3: Continuous monitoring
try:
    while True:
        health = check_ollama_health()
        print(f"\n[{health['timestamp']}]")
        print(f"Status: {health['status'].upper()}")
        
        if health['status'] == 'healthy':
            print(f"Models: {', '.join(health['models'])}")
        else:
            print(f"Error: {health.get('error', 'Unknown')}")
        
        time.sleep(30)
except KeyboardInterrupt:
    print("\nMonitoring stopped")
```

### **Step 5: Create Cloudflare Tunnel monitoring**

**File:** `monitoring/tunnel_health.ipynb`

```python
# Cell 1: Import libraries
import requests
import time
from datetime import datetime

# Cell 2: Tunnel health check
def check_tunnel_health():
    """Check Cloudflare Tunnel connectivity"""
    tunnel_url = 'https://grew-hypothesis-mothers-flooring.trycloudflare.com'
    try:
        start = time.time()
        response = requests.get(f'{tunnel_url}/api/tags', timeout=10)
        elapsed = (time.time() - start) * 1000
        
        return {
            'status': 'healthy' if response.ok else 'unhealthy',
            'response_time_ms': elapsed,
            'status_code': response.status_code,
            'timestamp': datetime.now().isoformat()
        }
    except Exception as e:
        return {
            'status': 'down',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }

# Cell 3: Continuous monitoring
try:
    while True:
        health = check_tunnel_health()
        print(f"\n[{health['timestamp']}]")
        print(f"Tunnel: {health['status'].upper()}")
        
        if health['status'] == 'healthy':
            print(f"Response time: {health['response_time_ms']:.0f}ms")
            print(f"Status code: {health['status_code']}")
        else:
            print(f"Error: {health.get('error', 'Unknown')}")
        
        time.sleep(60)
except KeyboardInterrupt:
    print("\nMonitoring stopped")
```

### **Step 6: Create README**

**File:** `monitoring/README.md`

```markdown
# A100 JupyterLab Monitoring

Monitoring notebooks for A100 Docker JupyterLab environment.

## Notebooks

### 1. GPU Monitor (`gpu_monitor.ipynb`)
Real-time GPU monitoring with visualization.

**Metrics:**
- GPU utilization (%)
- Memory usage (MB and %)
- Temperature (°C)

**Usage:**
1. Open in JupyterLab
2. Run all cells
3. Monitor real-time graphs (updates every 5s)
4. Press Ctrl+C to stop

### 2. Ollama Health Check (`ollama_health.ipynb`)
Monitor Ollama service status and available models.

**Checks:**
- Service availability
- Response time
- Available models

**Usage:**
1. Open in JupyterLab
2. Run all cells
3. Monitor status (updates every 30s)
4. Press Ctrl+C to stop

### 3. Cloudflare Tunnel Health (`tunnel_health.ipynb`)
Monitor Cloudflare Tunnel connectivity.

**Checks:**
- Tunnel availability
- Response time
- HTTP status codes

**Usage:**
1. Open in JupyterLab
2. Run all cells
3. Monitor status (updates every 60s)
4. Press Ctrl+C to stop

## Requirements

```bash
pip install gpustat pandas matplotlib requests
```

## Access

- **JupyterLab:** Docker container web interface
- **Cloudflare Tunnel:** https://grew-hypothesis-mothers-flooring.trycloudflare.com
- **Ollama:** http://localhost:11434

## Notes

- These notebooks run inside A100 Docker JupyterLab
- No SSH access required
- All monitoring is local to the container
- Graphs update in real-time
```

### **Step 7: Commit**

```bash
git add monitoring/
git commit -m "feat(monitoring): add JupyterLab monitoring notebooks

- Add gpu_monitor.ipynb for real-time GPU stats
- Add ollama_health.ipynb for Ollama service monitoring
- Add tunnel_health.ipynb for Cloudflare Tunnel monitoring
- Add README with usage instructions

Features:
- Real-time visualization with matplotlib
- GPU utilization, memory, temperature tracking
- Ollama service health checks
- Cloudflare Tunnel connectivity monitoring

Environment: A100 Docker JupyterLab
Tested: All notebooks run successfully"
```

**IMPORTANT:** Do NOT add "Co-Authored-By: Claude" line!

### **Step 8: Push**

```bash
git push origin feature/jupyterlab-monitoring
```

### **Step 9: Report completion**

Post summary of what you did.

---

## ✅ DEFINITION OF DONE

- [x] 3 monitoring notebooks created
- [x] README with instructions
- [x] GPU monitoring with visualization
- [x] Ollama health check
- [x] Tunnel health check
- [x] Commit message follows format
- [x] NO "Co-Authored-By" line
- [x] Branch pushed

---

## 🚨 IMPORTANT NOTES

1. **NO "Co-Authored-By" in commits** - User wants only their name as contributor
2. **Use real tools** - You have Git, MCP, Composio, Bash
3. **Professional commits** - Follow format exactly
4. **Notebooks for JupyterLab** - Not for local execution

---

**Start time:** 12:08 VN  
**Expected completion:** 14:08 VN  
**Status:** 🔄 ASSIGNED - Ready to start

