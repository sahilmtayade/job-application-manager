# JAM - Job Application Manager

A modern job application management system with AI-powered features, gamification, and comprehensive analytics. Combines a sophisticated web interface with powerful CLI capabilities for the ultimate job search experience.

## Web Interface

JAM features a modern, responsive web interface built with Next.js, React, and TypeScript. The web UI provides the complete job search management experience with AI-powered features, gamification, and comprehensive analytics.

### Quick Start

First, install the required dependencies for both the backend and frontend:

```bash
# 1. Setup Python environment (using uv)
uv sync
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# 2. Setup Web environment
cd web
npm install
cd ..
```

Once installed, you can start the application:

```bash
# Development mode (hot reload)
./scripts/start-dev.sh
# or simply
cd web && npm run dev
# Production mode (built)
./scripts/start-prod.sh

# API only
uv run serve
```

Then open http://localhost:3000

### Technology Stack

- **Framework**: Next.js 16 with React 19
- **Language**: TypeScript with strict configuration
- **Styling**: Tailwind CSS with custom components
- **UI Library**: Radix UI components
- **Charts**: Recharts for analytics
- **State Management**: React Query (TanStack Query)
- **Theme**: Dark/light mode support

### Pages & Navigation

- **Dashboard** - Central hub with gamification, streak tracking, and activity overview
- **Applications** - Main application management with table and Kanban board views
- **Job Search** (β) - Automated job discovery across multiple platforms with AI scoring
- **Job Fit** (β) - AI-powered resume/job compatibility analysis
- **Companies** - Company management with alias and merge capabilities
- **Analytics** - Comprehensive insights and statistics
- **Goals** - Set and track daily/weekly application targets
- **Settings** - Configuration management
- **Banned** - Quick reference for companies and platforms to avoid

### Core Features

#### Application Management

- **Dual View Modes**: Switch between table and Kanban board layouts
- **Status Tracking**: 8 detailed statuses with visual indicators
- **File Attachments**: Upload and manage application documents
- **Notes System**: Add detailed notes with timestamps
- **Event History**: Complete audit trail of application journey
- **Bulk Operations**: Efficient multi-item management

#### Analytics & Insights

- **Dashboard Overview**: Real-time statistics and activity trends
- **Funnel Analysis**: Track conversion through application stages
- **Source Performance**: Success rates by job platform
- **Temporal Insights**: Activity patterns and trends over time
- **Response Rate Tracking**: Communication effectiveness metrics
- **Visual Charts**: Interactive charts and progress visualizations

#### Gamification & Motivation

- **Streak Tracking**: Daily application streaks with risk warnings
- **Achievement System**: Multiple achievement categories (applications, streaks, progress, time-based, combos)
- **Goal Setting**: Daily and weekly application targets with visual progress
- **Celebration Effects**: Confetti animations for milestones and achievements
- **Progress Visualization**: Weekly comparisons and activity trends
- **Motivational Dashboard**: Personalized job search journey tracking

### AI-Powered Features (Beta)

#### Job Fit Analyzer

- **Resume Analysis**: Upload resume screenshots for compatibility checking
- **Compatibility Scoring**: 0-100 match scores with detailed breakdowns
- **Skills Gap Analysis**: Matched, missing, and bonus skills identification
- **Scam Detection**: AI-powered risk assessment for job postings
- **Experience Validation**: Check if requirements match your profile
- **Actionable Recommendations**: Personalized improvement suggestions

#### Automated Job Search

- **Multi-Platform Integration**: LinkedIn, Indeed, Glassdoor, ZipRecruiter, Google, Bayt, BDJobs, Naukri
- **Intelligent Filtering**: Entry-level detection, experience requirements, keyword matching
- **AI Scoring**: LLM-based job compatibility analysis
- **Bulk Operations**: Hide, apply, delete, and analyze multiple jobs
- **Progress Tracking**: Real-time search progress with ETA
- **Export Functionality**: Export filtered results to CSV

### Smart Management

#### Company Intelligence

- **Duplicate Detection**: Automatic identification of duplicate companies
- **Company Aliases**: Add alternate names for better matching
- **Merge Functionality**: Combine duplicate company records
- **Company History**: Track all interactions with specific companies

#### Banned Lists

- **Company Blacklist**: Maintain list of scam or problematic companies
- **Platform Filtering**: Exclude low-quality job platforms
- **Quick Reference**: Easy access to avoid wasting time on bad opportunities

### Data & Privacy

- **Local-First**: All data stored locally on your machine
- **SQLite Database**: Fast, reliable local storage with ACID compliance
- **Backup System**: Automated database backups with restore functionality
- **No Cloud Dependencies**: Complete control over your sensitive information
- **Bi-Directional Sync**: Seamless data sharing between web and CLI interfaces

## CLI Interface

The CLI provides powerful command-line functionality for automation, scripting, and quick operations. Ideal for power users who prefer terminal-based workflows.

### Installation

#### Using uv (Recommended)

```bash
# Create a virtual environment
uv venv

# Activate the environment
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install the package in development mode
uv pip install -e .
```

#### Using Conda

```bash
# Create a new conda environment
conda create -n jam python=3.12 -y

# Activate the environment
conda activate jam

# Install the package in development mode
pip install -e .
```

#### Using pip

```bash
pip install -e .
```

### Quick Start

```bash
# Add a new application
jam add

# List all applications
jam list

# Update application status
jam update 1 --status interviewing

# View application details
jam show 1

# Check your goals
jam goal status

# View statistics
jam stats
jam stats trends --since 30d
```

## CLI Commands

### Applications

| Command                | Description                          |
| ---------------------- | ------------------------------------ |
| `jam add`              | Add a new job application            |
| `jam list`             | List applications (excludes deleted) |
| `jam list --all`       | Include soft-deleted applications    |
| `jam show ID`          | Show full details of an application  |
| `jam update ID`        | Update application status or details |
| `jam delete ID`        | Soft delete (preserves for stats)    |
| `jam delete --hard ID` | Permanently remove                   |

### Companies

| Command                           | Description               |
| --------------------------------- | ------------------------- |
| `jam company list`                | List all known companies  |
| `jam company merge FROM TO`       | Merge duplicate companies |
| `jam company alias COMPANY ALIAS` | Add alias for matching    |

### Goals

| Command                  | Description                 |
| ------------------------ | --------------------------- |
| `jam goal set daily 5`   | Set daily application goal  |
| `jam goal set weekly 25` | Set weekly application goal |
| `jam goal status`        | Show progress toward goals  |

### Statistics

| Command                        | Description                |
| ------------------------------ | -------------------------- |
| `jam stats`                    | Display summary statistics |
| `jam stats trends`             | Show application trends    |
| `jam stats trends --since 30d` | Trends for last 30 days    |
| `jam stats trends --weekly`    | Group by week              |

### Export

| Command                                | Description                    |
| -------------------------------------- | ------------------------------ |
| `jam export out.csv`                   | Export all active applications |
| `jam export out.csv --all`             | Include soft-deleted           |
| `jam export out.csv --status rejected` | Filter by status               |
| `jam export out.csv --since 30d`       | Filter by date                 |

### Backup

| Command                     | Description               |
| --------------------------- | ------------------------- |
| `jam backup`                | Create timestamped backup |
| `jam backup --list`         | List available backups    |
| `jam backup --restore FILE` | Restore from backup       |

### CLI Advantages

- **Scripting & Automation**: Perfect for automated workflows and cron jobs
- **Quick Operations**: Fast terminal-based interactions
- **Data Integration**: Easy integration with other tools and scripts
- **Remote Access**: SSH-friendly for remote server usage
- **Power User Features**: Advanced filtering and bulk operations
- **Offline Usage**: Full functionality without web interface

## Application Statuses

- `applied` - Initial application submitted
- `screening` - Phone/recruiter screen scheduled or completed
- `interviewing` - In interview process
- `offer` - Received offer
- `accepted` - Accepted offer
- `rejected` - Application rejected
- `withdrawn` - Withdrew application
- `ghosted` - No response after extended period

## AI Setup (Local Models)

JAM uses **local LLMs** for all AI features — no API keys, no cloud. You need two models running locally: a **vision model** (reads job posting screenshots) and a **text model** (scoring and analysis). The configuration lives in `config/llm.yaml`.

### Recommended Models

| Role                 | Model                              | Size      | Notes                                 |
| -------------------- | ---------------------------------- | --------- | ------------------------------------- |
| Vision               | `qwen/qwen2.5vl:7b`                | ~5 GB     | Best accuracy for reading screenshots |
| Vision (lightweight) | `qwen/qwen2.5vl:3b`                | ~2.5 GB   | Good for 8 GB RAM machines            |
| Text                 | `qwen/qwen2.5:7b` or `llama3.2:3b` | ~5 / 2 GB | Fast, accurate scoring                |

> **PDF resumes** skip the vision model entirely — text is extracted directly, so a text-only model is sufficient for resume analysis.

---

### Option A: Ollama

Ollama is the easiest way to run local models. It installs as a background service.

#### Linux

```bash
curl -fsSL https://ollama.com/install.sh | sh

# Pull the models you want to use
ollama pull qwen2.5vl:7b       # vision model
ollama pull qwen2.5:7b         # text model

# Ollama starts automatically; verify it's running
ollama list
```

#### macOS

```bash
# Install via Homebrew or download from https://ollama.com
brew install ollama

ollama serve &   # start the server (or launch Ollama.app)
ollama pull qwen2.5vl:7b
ollama pull qwen2.5:7b
```

#### Windows

1. Download the installer from [ollama.com](https://ollama.com/download)
2. Run the installer — Ollama starts automatically as a system tray app
3. Open a terminal (PowerShell or CMD):

```powershell
ollama pull qwen2.5-vl:7b
ollama pull llama3.2:3b
```

#### Configure JAM for Ollama

Edit `config/llm.yaml`:

```yaml
server:
  url: "http://localhost:11434"

models:
  vision: "qwen2.5-vl:7b" # must match `ollama list` name exactly
  text: "llama3.2:3b"

api_mode: "ollama"
```

---

### Option B: LM Studio

LM Studio provides a GUI for downloading and running models. Good choice if you prefer a visual interface or want to try different models easily.

1. Download from [lmstudio.ai](https://lmstudio.ai) (available for Linux, macOS, Windows)
2. Search for and download your models inside the app (search "qwen2.5-vl" for vision)
3. Go to **Local Server** tab → load your model → click **Start Server**
4. The server runs on `http://localhost:1234` by default

#### Configure JAM for LM Studio

```yaml
server:
  url: "http://localhost:1234"

models:
  vision: "qwen/qwen2.5-vl-7b" # use the LM Studio model ID shown in the app
  text: "bartowski/llama-3.2-3b-instruct"

api_mode: "openai" # LM Studio uses OpenAI-compatible API
```

---

### Verifying the Setup

Start JAM and open [Settings](http://localhost:3000/settings) — the LLM status panel shows whether the server is reachable and which models are loaded. You can also update the URL and model names from the UI without editing the YAML.

### Performance Tips

- **GPU is strongly recommended.** CPU inference is very slow for vision models.
- For **8 GB VRAM**, use the 3B vision model + 3B text model.
- For **16 GB VRAM**, 7B vision + 7B text works well.
- Lower `analysis.concurrency` in `llm.yaml` if you run out of VRAM during job search.

---

## Configuration

- **Resume for AI features**: Copy `config/resume.txt.example` to `config/resume.txt` and fill in your own details. This file is used by the Job Fit analyzer and job search scoring. Do not commit `config/resume.txt` (it is gitignored).

## Data Storage

All data is stored locally in `~/.jam/`:

- `jam.db` - SQLite database
- `backups/` - Timestamped backup files

You can override the data directory by setting the `JAM_DATA_DIR` environment variable.

## License

MIT
