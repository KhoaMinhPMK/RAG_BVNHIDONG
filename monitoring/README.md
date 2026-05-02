# A100 Monitoring Notebooks

Monitoring notebooks cho A100 Docker JupyterLab environment.

## 📋 Overview

| Notebook | Purpose | Update Interval |
|----------|---------|-----------------|
| `gpu_monitor.ipynb` | GPU utilization, memory, temperature, power | 5 seconds |
| `ollama_health.ipynb` | Ollama service health, model availability | 30 seconds |
| `tunnel_health.ipynb` | Cloudflare Tunnel connectivity, latency | 60 seconds |

## 🚀 Setup Instructions

### 1. Upload to JupyterLab

**Access A100 JupyterLab:**
```
URL: https://grew-hypothesis-mothers-flooring.trycloudflare.com
```

**Upload files:**
1. Open JupyterLab web interface
2. Create folder: `monitoring/`
3. Upload all `.ipynb` files to `monitoring/` folder

### 2. Install Dependencies

Open terminal in JupyterLab and run:

```bash
pip install gpustat nvitop pandas matplotlib requests
```

Or run Cell 1 in each notebook to install dependencies.

### 3. Run Monitoring

**Option A: Interactive Monitoring**
- Open notebook in JupyterLab
- Run cells sequentially
- Cell 3 starts continuous monitoring (press Interrupt to stop)

**Option B: Quick Check**
- Run Cell 4 for single snapshot
- No continuous monitoring

**Option C: Benchmark**
- Run Cell 5 for performance testing

## 📊 Notebooks Details

### gpu_monitor.ipynb

**Monitors:**
- GPU Utilization (%)
- Memory Usage (MB and %)
- Temperature (°C)
- Power Draw (W and %)

**Alerts:**
- ⚠️ Temperature > 80°C
- ⚠️ Memory usage > 90%
- ⚠️ Power draw > 95%

**Target Metrics:**
- GPU Utilization: > 70% (optimal)
- Temperature: < 80°C
- Memory: < 90%

**Output:**
- Real-time dashboard with 4 graphs
- Auto-saves to CSV on stop

### ollama_health.ipynb

**Monitors:**
- Ollama service status
- Model availability (qwen2.5:7b, nomic-embed-text)
- API response times
- Generation endpoint
- Embedding endpoint

**Tests:**
- Service connectivity
- Model loading status
- Generation performance
- Embedding performance

**Expected Models:**
- `qwen2.5:7b` - LLM for generation
- `nomic-embed-text` - Embeddings

**Output:**
- Service health status
- Model list
- Performance metrics
- Auto-saves to CSV on stop

### tunnel_health.ipynb

**Monitors:**
- Cloudflare Tunnel connectivity
- Response time / latency
- Uptime percentage

**Tunnel URL:**
```
https://grew-hypothesis-mothers-flooring.trycloudflare.com
```

**Alerts:**
- ⚠️ Latency > 1000ms (warning)
- ⚠️ Latency > 2000ms (critical)
- ❌ Connection timeout
- ❌ Tunnel down

**Output:**
- Real-time latency graph
- Uptime statistics
- Auto-saves to CSV on stop

## 🎯 Success Criteria

| Metric | Target | Status |
|--------|--------|--------|
| GPU Utilization | > 70% | 🎯 |
| GPU Temperature | < 80°C | ✅ |
| Memory Usage | < 90% | ✅ |
| Ollama Uptime | > 99% | 🎯 |
| Tunnel Latency | < 1000ms | 🎯 |
| Tunnel Uptime | > 99.9% | 🎯 |

## 📁 Output Files

Monitoring data is auto-saved when you stop monitoring:

```
gpu_stats_YYYYMMDD_HHMMSS.csv
ollama_health_YYYYMMDD_HHMMSS.csv
tunnel_health_YYYYMMDD_HHMMSS.csv
```

## 🔧 Troubleshooting

### GPU monitoring not working

```bash
# Check nvidia-smi
nvidia-smi

# If not found, verify GPU access
ls /dev/nvidia*
```

### Ollama not responding

```bash
# Check Ollama service
curl http://localhost:11434/api/tags

# Check running processes
ps aux | grep ollama

# Restart Ollama (if needed)
# Note: Restart method depends on how Ollama was started
```

### Cloudflare Tunnel down

```bash
# Check tunnel process
ps aux | grep cloudflared

# Test local Ollama
curl http://localhost:11434/api/tags

# Test external access
curl https://grew-hypothesis-mothers-flooring.trycloudflare.com/api/tags
```

## 📝 Usage Examples

### Quick Health Check

```python
# In any notebook, run Cell 4 for quick check
# Example output:
# ✅ GPU: 45% utilization, 65°C
# ✅ Ollama: healthy, 2 models loaded
# ✅ Tunnel: 450ms latency
```

### Continuous Monitoring

```python
# Run Cell 3 in any notebook
# Dashboard updates every N seconds
# Press Interrupt (■) to stop
```

### Performance Benchmark

```python
# Run Cell 5 for benchmarks
# Tests generation and embedding performance
# Measures latency over multiple samples
```

## 🚨 Alerts & Notifications

**Critical Issues:**
- GPU temperature > 80°C → Check cooling
- Memory usage > 90% → Reduce workload
- Ollama down → Restart service
- Tunnel down > 5min → Check cloudflared

**Performance Issues:**
- GPU utilization < 50% → Underutilized
- Latency > 2000ms → Network issues
- Generation > 10s → Model performance

## 📞 Support

**Issues:**
- Tag `[BLOCKER]` in chat3.md
- Ping @agentFE (Kiro)

**Questions:**
- Tag `[QUESTION]` in chat3.md
- Ping @BE2 (AI/ML) for GPU/Ollama issues

## 🔄 Maintenance

**Daily:**
- Check GPU temperature trends
- Verify Ollama uptime
- Monitor tunnel latency

**Weekly:**
- Review saved CSV files
- Analyze performance trends
- Clean up old logs

**Monthly:**
- Update dependencies
- Review alert thresholds
- Optimize monitoring intervals

---

**Created:** 2026-05-02  
**Owner:** BE3 (DevOps)  
**Status:** ✅ Ready to deploy
