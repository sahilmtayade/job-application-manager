# JAM - Job Application Manager

A local-first CLI tool for managing, tracking, and analyzing job applications.

## Installation

### Using Conda (Recommended)

```bash
# Create a new conda environment
conda create -n jam python=3.12 -y

# Activate the environment
conda activate jam

# Install the package in development mode
pip install -e .
```

### Using pip

```bash
pip install -e .
```

## Quick Start

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

## Web UI

JAM includes a modern web interface built with Next.js.

### Quick Start

```bash
# Development mode (hot reload)
./scripts/start-dev.sh

# Production mode (built)
./scripts/start-prod.sh

# API only
./scripts/start-api.sh
```

Then open http://localhost:3000

## Commands

### Applications

| Command | Description |
|---------|-------------|
| `jam add` | Add a new job application |
| `jam list` | List applications (excludes deleted) |
| `jam list --all` | Include soft-deleted applications |
| `jam show ID` | Show full details of an application |
| `jam update ID` | Update application status or details |
| `jam delete ID` | Soft delete (preserves for stats) |
| `jam delete --hard ID` | Permanently remove |

### Companies

| Command | Description |
|---------|-------------|
| `jam company list` | List all known companies |
| `jam company merge FROM TO` | Merge duplicate companies |
| `jam company alias COMPANY ALIAS` | Add alias for matching |

### Goals

| Command | Description |
|---------|-------------|
| `jam goal set daily 5` | Set daily application goal |
| `jam goal set weekly 25` | Set weekly application goal |
| `jam goal status` | Show progress toward goals |

### Statistics

| Command | Description |
|---------|-------------|
| `jam stats` | Display summary statistics |
| `jam stats trends` | Show application trends |
| `jam stats trends --since 30d` | Trends for last 30 days |
| `jam stats trends --weekly` | Group by week |

### Export

| Command | Description |
|---------|-------------|
| `jam export out.csv` | Export all active applications |
| `jam export out.csv --all` | Include soft-deleted |
| `jam export out.csv --status rejected` | Filter by status |
| `jam export out.csv --since 30d` | Filter by date |

### Backup

| Command | Description |
|---------|-------------|
| `jam backup` | Create timestamped backup |
| `jam backup --list` | List available backups |
| `jam backup --restore FILE` | Restore from backup |

## Application Statuses

- `applied` - Initial application submitted
- `screening` - Phone/recruiter screen scheduled or completed
- `interviewing` - In interview process
- `offer` - Received offer
- `accepted` - Accepted offer
- `rejected` - Application rejected
- `withdrawn` - Withdrew application
- `ghosted` - No response after extended period

## Data Storage

All data is stored locally in `~/.jam/`:
- `jam.db` - SQLite database
- `backups/` - Timestamped backup files

You can override the data directory by setting the `JAM_DATA_DIR` environment variable.

## License

MIT
