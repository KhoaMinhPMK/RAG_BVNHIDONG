# Development Environment Setup

## 📋 Overview

This document describes the development environment setup for the WebRAG project - a RAG-based medical system for pediatric pneumonia diagnosis at Bệnh viện Nhi Đồng.

## 🛠 Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, TailwindCSS 4.x, Framer Motion
- **Backend:** Express.js, TypeScript, Supabase (PostgreSQL + pgvector)
- **LLM/ML:** Ollama (local), MiMo API (cloud), RAG pipeline
- **Monorepo:** apps/web (frontend) + apps/api (backend)

## 🔧 Environment Info

- **Node.js:** v24.15.0
- **npm:** 11.12.1
- **Git:** 2.43.0
- **Git User:** khoaminhPMK (pmkkhoaminh@gmail.com)
- **Current Branch:** main

## 🌐 Ports Configuration

| Service  | Port | URL                       |
|----------|------|---------------------------|
| Frontend | 3001 | http://localhost:3001     |
| Backend  | 3005 | http://localhost:3005     |

## 🚀 Quick Start

### Install Dependencies

```bash
# Install all dependencies (monorepo)
npm install

# Or install individually
cd apps/web && npm install
cd apps/api && npm install
```

### Run Development Servers

```bash
# Run frontend only
cd apps/web && npm run dev

# Run backend only
cd apps/api && npm run dev

# Run both (if you have concurrently setup)
npm run dev:all
```

### Environment Variables

**Frontend (.env.local):**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://mibtdruhmmcatccdzjjk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_lmqX6atRgaSLPrZdwexcMw_fJU0_04t
NEXT_PUBLIC_API_URL=http://localhost:3005
NEXT_PUBLIC_SKIP_AUTH=false
```

**Backend (.env):**
```bash
PORT=3005
NODE_ENV=development
SUPABASE_URL=https://mibtdruhmmcatccdzjjk.supabase.co
SUPABASE_ANON_KEY=sb_publishable_lmqX6atRgaSLPrZdwexcMw_fJU0_04t
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
OLLAMA_URL=https://grew-hypothesis-mothers-flooring.trycloudflare.com
OLLAMA_MODEL=qwen2.5:7b
MIMO_API_KEY=<your-mimo-key>
MIMO_BASE_URL=https://token-plan-sgp.xiaomimimo.com/v1
MIMO_MODEL_PRIMARY=mimo-v2.5-pro
SKIP_AUTH=true
CORS_ORIGIN=http://localhost:3001
LOG_LEVEL=debug
```

## 📝 Common Commands

### Development

```bash
npm run dev              # Run dev server (check package.json for specifics)
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run linter
npm run test             # Run tests
npm run test:watch       # Run tests in watch mode
```

### Git Operations

```bash
git status               # Check status
git add <files>          # Stage files
git commit -m "message"  # Commit with message
git push                 # Push to remote
```

**Note:** Git operations use your configured SSH key and user:
- User: khoaminhPMK
- Email: pmkkhoaminh@gmail.com

## 🔍 Project Structure

```
webrag/
├── apps/
│   ├── api/                 # Backend (Express + TypeScript)
│   │   ├── src/
│   │   │   ├── agents/      # AI agents (CAE, explainer, knowledge, reporter)
│   │   │   ├── routes/      # API routes
│   │   │   ├── middleware/  # Auth, RBAC, rate limiting
│   │   │   ├── lib/         # Utilities (supabase, mimo, ollama, embedding)
│   │   │   └── types/       # TypeScript types
│   │   └── package.json
│   └── web/                 # Frontend (Next.js 14)
│       ├── src/
│       │   ├── app/         # App Router pages
│       │   ├── components/  # React components
│       │   ├── lib/         # Client utilities
│       │   └── types/       # TypeScript types
│       └── package.json
├── docs/                    # Documentation
└── knowledge_base/          # Medical knowledge documents
```

## 🧪 Testing

### Backend Tests

```bash
cd apps/api
npm run test              # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage
```

### Frontend Tests

```bash
cd apps/web
npm run test              # Run all tests
npm run test:watch        # Watch mode
npm run test:ui           # Vitest UI
npm run test:coverage     # With coverage
```

## 🐛 Debugging

### VS Code Debug Configuration

The project includes `.vscode/launch.json` for debugging:

- **Debug Backend:** Attach to Node.js process on port 3005
- **Debug Frontend:** Attach to Next.js dev server

### Common Issues

#### Port Already in Use

```bash
# Find process using port
lsof -i :3001  # or :3005

# Kill process
kill -9 <PID>
```

#### Module Not Found

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Supabase Connection Issues

- Check `SUPABASE_URL` and keys in .env
- Verify network connectivity
- Check Supabase dashboard for service status

#### Ollama/MiMo API Issues

- Verify `OLLAMA_URL` is accessible
- Check `MIMO_API_KEY` is valid
- Test with curl:
  ```bash
  curl -X POST http://localhost:3005/api/health
  ```

## 🔐 Authentication

The system uses Supabase Auth with JWT tokens and RBAC:

**Roles:**
- `clinician` - Bác sĩ lâm sàng
- `radiologist` - Bác sĩ X-quang
- `researcher` - Nhà nghiên cứu
- `admin` - Quản trị viên

**Dev Mode:**
- Set `SKIP_AUTH=true` in backend .env to bypass auth
- Set `NEXT_PUBLIC_SKIP_AUTH=false` in frontend to enable auth UI

## 📊 Database

### Supabase Schema

Key tables:
- `documents` - Knowledge base documents
- `document_chunks` - Vector embeddings (768 dimensions)
- `episodes` - Patient cases
- `detection_results` - X-ray AI analysis
- `draft_reports` - CAE-generated reports
- `profiles` - User profiles with RBAC

### Migrations

```bash
# Run migrations (if using Supabase CLI)
supabase db push

# Reset database
supabase db reset
```

## 🤖 AI/LLM Components

### CAE (Clinical AI Engine)

- **Location:** `apps/api/src/agents/cae.ts`
- **Endpoints:** `/api/cae/brief`, `/api/cae/chat`, `/api/cae/tts`
- **Features:** Tool calling, SSE streaming, multi-provider (Ollama/MiMo)

### Other Agents

- **Explainer:** `apps/api/src/agents/explainer.ts` - Explains detection findings
- **Knowledge:** `apps/api/src/agents/knowledge.ts` - RAG queries
- **Reporter:** `apps/api/src/agents/reporter.ts` - Generates draft reports

## 📚 Documentation

- **CAE UX Spec:** `docs/cae_integrated_ux_behavior_spec.md`
- **CAE Advanced UX:** `docs/cae_dock_evidence_spatial_draft_ux_spec.md`
- **MVP UI/UX Plan:** `docs/mvp_ui_ux_plan.md`
- **PRD:** `docs/prd_ui_flow_y_te_rag.md`

## 🔄 Current Development Phase

**Phase 1: Structured Output Contract** (In Progress)

We're implementing structured output for CAE responses:
- ✅ Created types (`apps/api/src/types/cae-output.ts`)
- ✅ Created BlockRenderer component
- ✅ Created content parser
- 🔄 Integrating into CAE agent
- ⏳ Testing end-to-end

**Next Phases:**
- Phase 2: CAE Dock (sliding panel with state machine)
- Phase 3: Evidence Rail + Spatial Focus
- Phase 4: Draft Composer
- Phase 5: Task Cards + Inter-step Memory
- Phase 6: Polish & Cleanup

## 🎯 Development Workflow

1. **Pick a task** from the plan or create new one
2. **Create a branch** (optional): `git checkout -b feature/your-feature`
3. **Make changes** and test locally
4. **Run linter**: `npm run lint`
5. **Run tests**: `npm run test`
6. **Commit**: `git commit -m "feat: your feature"`
7. **Push**: `git push origin your-branch`
8. **Create PR** (if working with team)

## 💡 Tips

- Use `npm run dev` in separate terminals for frontend and backend
- Check `http://localhost:3005/api/health` to verify backend is running
- Frontend hot-reloads automatically on file changes
- Backend requires restart for most changes (unless using nodemon)
- Use VS Code extensions: ESLint, Prettier, Tailwind CSS IntelliSense
- Check browser console and terminal for errors

## 🆘 Getting Help

- Check this document first
- Review error messages carefully
- Check relevant documentation in `docs/`
- Search codebase for similar patterns
- Ask team members or create an issue

## 📝 Notes

- This is a medical application - test thoroughly before deploying
- CAE outputs are for clinical decision support only, not diagnosis
- Always have clinicians review AI-generated content
- Follow HIPAA/medical data privacy guidelines
- Keep sensitive keys out of version control

---

Last updated: 2026-05-03
