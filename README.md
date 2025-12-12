# AK-Flow - Advanced Cognitive Kernel

A biologically-inspired cognitive architecture implementing autonomous consciousness, emotional homeostasis, and multi-modal intelligence.

## 🚀 Quick Start

```bash
npm install
npm run dev
```

## 📚 Documentation

- [System Manifest](docs/SYSTEM_MANIFEST.md) - Complete system overview
- [AGI Vision Roadmap](docs/agi_vision_roadmap.md) - Development roadmap and feature status
- [Daily Reports](docs/daily_reports/) - Development progress logs
- [Architecture](docs/architecture/) - Technical architecture documentation
- [RLS Diagnostics Guide](docs/engineering/RLS_DIAGNOSTICS_GUIDE.md) - Supabase RLS troubleshooting

## 🧠 Core Systems

- **Soma System** - Energy, sleep/wake cycles, biological clock
- **Limbic System** - Emotional states with homeostasis
- **Volition System** - Decision-making with GABA inhibition
- **Cortex System** - Executive function, RAG, structured dialogue
- **Event Loop** - Central cognitive cycle orchestrator

## 🗄️ Database

Database schemas and migrations are in the `database/` directory.

## 🔍 RLS Diagnostics

The system now includes comprehensive RLS (Row-Level Security) diagnostics for Supabase:

- **Automatic detection** of authorization issues vs logical errors
- **Query wrapping** with `.withRLSDiagnostics()` method
- **Comprehensive reports** with `RLSDiagnostics.generateDiagnosticReport()`
- **User role detection** and table access testing

See the [RLS Diagnostics Guide](docs/engineering/RLS_DIAGNOSTICS_GUIDE.md) for detailed usage.

## 🧪 Testing

```bash
npm test
```

## 📊 Current Status

- **Version:** 4.1
- **AGI Progress:** 6.5/10
- **Feature Coverage:** 47% (14/30 features)
- **Last Updated:** 2025-12-01

## 🎯 Next Steps

1. Goal Formation System
2. Multi-Step Reasoning
3. Theory of Mind
4. Temporal Abstraction

---

Built with ❤️ using TypeScript, React, Vite, Gemini AI, and Supabase.
