"""Database schema definitions and initialization for JAM"""

from jam.db.connection import get_cursor

SCHEMA_VERSION = 14

TABLES = """
-- Companies table
CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Company aliases for matching
CREATE TABLE IF NOT EXISTS company_aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    alias TEXT NOT NULL UNIQUE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Applications table with soft delete support
-- Note: status is tracked via application_events table (event sourcing)
CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    company_name_raw TEXT NOT NULL,
    position TEXT NOT NULL,
    applied_at DATE NOT NULL,
    source TEXT,
    url TEXT,
    notes TEXT,
    work_location TEXT,
    location_address TEXT,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT
);

-- Application events for tracking status changes (event sourcing)
-- Each application can only have one event per status (unique constraint)
CREATE TABLE IF NOT EXISTS application_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
    UNIQUE(application_id, to_status)
);

-- Goals table
CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_type TEXT NOT NULL,
    target_count INTEGER NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Application notes table
CREATE TABLE IF NOT EXISTS application_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);

-- User config table
CREATE TABLE IF NOT EXISTS user_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Banned companies table (for tracking scammy companies)
CREATE TABLE IF NOT EXISTS banned_companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Banned sources/platforms table (for tracking platforms to avoid)
CREATE TABLE IF NOT EXISTS banned_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Application files table (stores images as BLOBs)
CREATE TABLE IF NOT EXISTS application_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_data BLOB NOT NULL,
    file_size INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);

-- Job search results table (stores aggregated job listings with LLM analysis)
CREATE TABLE IF NOT EXISTS job_search_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    location TEXT,
    date_posted TEXT,
    job_url TEXT NOT NULL UNIQUE,
    site_source TEXT NOT NULL,
    description TEXT,
    company_logo TEXT,
    salary_min REAL,
    salary_max REAL,
    job_type TEXT,
    search_keywords TEXT,
    first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    llm_score INTEGER,
    llm_analysis TEXT,
    llm_notes TEXT,
    llm_analyzed_at TIMESTAMP,
    is_mismatch INTEGER DEFAULT 0,
    is_hidden INTEGER DEFAULT 0,
    is_applied INTEGER DEFAULT 0,
    applied_at TIMESTAMP,
    matched_skills TEXT,
    missing_skills TEXT,
    search_offset INTEGER DEFAULT 0
);

-- Job search learned filters table
CREATE TABLE IF NOT EXISTS job_search_filters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT NOT NULL,
    filter_type TEXT NOT NULL,
    weight REAL DEFAULT 1.0,
    source TEXT,
    match_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Suggested bans queue table
CREATE TABLE IF NOT EXISTS suggested_bans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT NOT NULL,
    reason TEXT,
    job_url TEXT,
    llm_confidence REAL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY
);
"""

INDEXES = """
-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_applications_company_id ON applications(company_id);
CREATE INDEX IF NOT EXISTS idx_applications_applied_at ON applications(applied_at);
CREATE INDEX IF NOT EXISTS idx_applications_is_deleted ON applications(is_deleted);
CREATE INDEX IF NOT EXISTS idx_applications_work_location ON applications(work_location);
CREATE INDEX IF NOT EXISTS idx_application_events_application_id ON application_events(application_id);
CREATE INDEX IF NOT EXISTS idx_application_events_timestamp ON application_events(application_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_application_notes_application_id ON application_notes(application_id);
CREATE INDEX IF NOT EXISTS idx_company_aliases_company_id ON company_aliases(company_id);
CREATE INDEX IF NOT EXISTS idx_company_aliases_alias ON company_aliases(alias);
CREATE INDEX IF NOT EXISTS idx_goals_period ON goals(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_banned_companies_name ON banned_companies(name);
CREATE INDEX IF NOT EXISTS idx_banned_sources_name ON banned_sources(name);
CREATE INDEX IF NOT EXISTS idx_application_files_application_id ON application_files(application_id);
"""


def init_db() -> None:
    """Initialize the database schema"""
    with get_cursor() as (conn, cursor):
        # Create tables
        cursor.executescript(TABLES)

        # Create indexes
        cursor.executescript(INDEXES)

        # Run migrations for existing databases
        _run_migrations(cursor)

        # Set schema version if not set
        cursor.execute("SELECT version FROM schema_version LIMIT 1")
        row = cursor.fetchone()
        if row is None:
            cursor.execute("INSERT INTO schema_version (version) VALUES (?)", (SCHEMA_VERSION,))
        else:
            # Update schema version
            cursor.execute("UPDATE schema_version SET version = ?", (SCHEMA_VERSION,))


def _run_migrations(cursor) -> None:
    """Run migrations for existing databases"""
    # Disable foreign keys during migration to avoid constraint issues
    cursor.execute("PRAGMA foreign_keys = OFF")

    # Get existing columns in applications table
    cursor.execute("PRAGMA table_info(applications)")
    columns = {row["name"] for row in cursor.fetchall()}

    # Migration: Add location_address column if missing (v3)
    if "location_address" not in columns:
        cursor.execute("ALTER TABLE applications ADD COLUMN location_address TEXT")

    # Migration v4: Event-sourced status tracking
    if "status" in columns:
        # Step 1: Backfill application_events for ALL applications from their current status
        # First, get all applications that need events
        cursor.execute("""
            SELECT id, status, created_at FROM applications
            WHERE id NOT IN (SELECT DISTINCT application_id FROM application_events)
        """)
        apps_to_backfill = cursor.fetchall()

        # Insert events one by one to ensure they're created
        for app in apps_to_backfill:
            app_id = app["id"]
            status = app["status"] or "applied"  # Default to applied if NULL
            created = app["created_at"]
            cursor.execute(
                """INSERT INTO application_events (application_id, from_status, to_status, timestamp)
                   VALUES (?, NULL, ?, ?)""",
                (app_id, status, created),
            )

        # Step 2: Create new applications table without status column
        cursor.execute("""
            CREATE TABLE applications_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER NOT NULL,
                company_name_raw TEXT NOT NULL,
                position TEXT NOT NULL,
                applied_at DATE NOT NULL,
                source TEXT,
                url TEXT,
                notes TEXT,
                work_location TEXT,
                location_address TEXT,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                deleted_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT
            )
        """)

        # Step 3: Copy data (excluding status column)
        cursor.execute("""
            INSERT INTO applications_new
            (id, company_id, company_name_raw, position, applied_at, source, url, notes,
             work_location, location_address, is_deleted, deleted_at, created_at, updated_at)
            SELECT id, company_id, company_name_raw, position, applied_at, source, url, notes,
                   work_location, location_address, is_deleted, deleted_at, created_at, updated_at
            FROM applications
        """)

        # Step 4: Drop old table and rename new table
        cursor.execute("DROP TABLE applications")
        cursor.execute("ALTER TABLE applications_new RENAME TO applications")

        # Step 5: Recreate the unique constraint on application_events if not exists
        # SQLite doesn't support ALTER TABLE ADD CONSTRAINT, so we recreate if needed
        # Check if unique constraint exists by looking at index columns
        cursor.execute("PRAGMA index_list(application_events)")
        indexes = cursor.fetchall()

        has_unique = False
        for idx in indexes:
            if idx["unique"] == 1:
                # Check what columns this unique index covers
                cursor.execute(f"PRAGMA index_info({idx['name']})")
                idx_columns = {row["name"] for row in cursor.fetchall()}
                if idx_columns == {"application_id", "to_status"}:
                    has_unique = True
                    break

        if not has_unique:
            # First, remove any duplicate (application_id, to_status) combinations
            # Keep only the most recent one (highest id)
            cursor.execute("""
                DELETE FROM application_events
                WHERE id NOT IN (
                    SELECT MAX(id) FROM application_events
                    GROUP BY application_id, to_status
                )
            """)

            # Recreate application_events with unique constraint
            cursor.execute("""
                CREATE TABLE application_events_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    application_id INTEGER NOT NULL,
                    from_status TEXT,
                    to_status TEXT NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    notes TEXT,
                    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
                    UNIQUE(application_id, to_status)
                )
            """)

            cursor.execute("""
                INSERT INTO application_events_new (id, application_id, from_status, to_status, timestamp, notes)
                SELECT id, application_id, from_status, to_status, timestamp, notes
                FROM application_events
            """)

            cursor.execute("DROP TABLE application_events")
            cursor.execute("ALTER TABLE application_events_new RENAME TO application_events")

    # Migration v7: Add banned_sources table
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='banned_sources'")
    if not cursor.fetchone():
        cursor.execute("""
            CREATE TABLE banned_sources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

    # Migration v8: Add job_search_results table
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='job_search_results'"
    )
    if not cursor.fetchone():
        cursor.execute("""
            CREATE TABLE job_search_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                company TEXT NOT NULL,
                location TEXT,
                date_posted TEXT,
                job_url TEXT NOT NULL UNIQUE,
                site_source TEXT NOT NULL,
                description TEXT,
                salary_min REAL,
                salary_max REAL,
                job_type TEXT,
                search_keywords TEXT,
                first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                llm_score INTEGER,
                llm_analysis TEXT,
                llm_analyzed_at TIMESTAMP,
                is_mismatch INTEGER DEFAULT 0,
                is_hidden INTEGER DEFAULT 0
            )
        """)

    # Migration v9: Add LLM columns to existing job_search_results table
    cursor.execute("PRAGMA table_info(job_search_results)")
    jsr_columns = {row["name"] for row in cursor.fetchall()}

    if "llm_score" not in jsr_columns:
        cursor.execute("ALTER TABLE job_search_results ADD COLUMN llm_score INTEGER")
    if "llm_analysis" not in jsr_columns:
        cursor.execute("ALTER TABLE job_search_results ADD COLUMN llm_analysis TEXT")
    if "llm_analyzed_at" not in jsr_columns:
        cursor.execute("ALTER TABLE job_search_results ADD COLUMN llm_analyzed_at TIMESTAMP")
    if "is_mismatch" not in jsr_columns:
        cursor.execute("ALTER TABLE job_search_results ADD COLUMN is_mismatch INTEGER DEFAULT 0")
    if "is_hidden" not in jsr_columns:
        cursor.execute("ALTER TABLE job_search_results ADD COLUMN is_hidden INTEGER DEFAULT 0")
    if "first_seen_at" not in jsr_columns:
        cursor.execute("ALTER TABLE job_search_results ADD COLUMN first_seen_at TIMESTAMP")
        # Populate from searched_at if it exists
        if "searched_at" in jsr_columns:
            cursor.execute(
                "UPDATE job_search_results SET first_seen_at = searched_at WHERE first_seen_at IS NULL"
            )
    if "last_seen_at" not in jsr_columns:
        cursor.execute("ALTER TABLE job_search_results ADD COLUMN last_seen_at TIMESTAMP")
        # Populate from searched_at if it exists
        if "searched_at" in jsr_columns:
            cursor.execute(
                "UPDATE job_search_results SET last_seen_at = searched_at WHERE last_seen_at IS NULL"
            )

    # Migration v10: Add llm_notes column for detailed reasoning
    if "llm_notes" not in jsr_columns:
        cursor.execute("ALTER TABLE job_search_results ADD COLUMN llm_notes TEXT")

    # Migration v11: Add is_applied and applied_at columns
    if "is_applied" not in jsr_columns:
        cursor.execute("ALTER TABLE job_search_results ADD COLUMN is_applied INTEGER DEFAULT 0")
    if "applied_at" not in jsr_columns:
        cursor.execute("ALTER TABLE job_search_results ADD COLUMN applied_at TIMESTAMP")

    # Migration v12: Add matched_skills and missing_skills columns for LLM analysis
    if "matched_skills" not in jsr_columns:
        cursor.execute("ALTER TABLE job_search_results ADD COLUMN matched_skills TEXT")
    if "missing_skills" not in jsr_columns:
        cursor.execute("ALTER TABLE job_search_results ADD COLUMN missing_skills TEXT")

    # Migration v13: Add search_offset column to track pagination offset used
    if "search_offset" not in jsr_columns:
        cursor.execute("ALTER TABLE job_search_results ADD COLUMN search_offset INTEGER DEFAULT 0")

    # Migration v14: Add company_logo column
    if "company_logo" not in jsr_columns:
        cursor.execute("ALTER TABLE job_search_results ADD COLUMN company_logo TEXT")

    # Migration v9: Add job_search_filters table
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='job_search_filters'"
    )
    if not cursor.fetchone():
        cursor.execute("""
            CREATE TABLE job_search_filters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                keyword TEXT NOT NULL,
                filter_type TEXT NOT NULL,
                weight REAL DEFAULT 1.0,
                source TEXT,
                match_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_job_search_filters_type ON job_search_filters(filter_type)"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_job_search_filters_keyword ON job_search_filters(keyword)"
        )

    # Migration v9: Add suggested_bans table
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='suggested_bans'")
    if not cursor.fetchone():
        cursor.execute("""
            CREATE TABLE suggested_bans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_name TEXT NOT NULL,
                reason TEXT,
                job_url TEXT,
                llm_confidence REAL,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_suggested_bans_status ON suggested_bans(status)"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_suggested_bans_company ON suggested_bans(company_name)"
        )

    # Create v9 indexes (these depend on columns added in migrations)
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_job_search_results_first_seen_at ON job_search_results(first_seen_at DESC)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_job_search_results_last_seen_at ON job_search_results(last_seen_at DESC)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_job_search_results_job_url ON job_search_results(job_url)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_job_search_results_llm_score ON job_search_results(llm_score DESC)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_job_search_results_is_hidden ON job_search_results(is_hidden)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_job_search_filters_type ON job_search_filters(filter_type)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_job_search_filters_keyword ON job_search_filters(keyword)"
    )
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_suggested_bans_status ON suggested_bans(status)")
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_suggested_bans_company ON suggested_bans(company_name)"
    )

    # Re-enable foreign keys after migration
    cursor.execute("PRAGMA foreign_keys = ON")


def get_schema_version() -> int:
    """Get the current schema version"""
    with get_cursor() as (conn, cursor):
        cursor.execute("SELECT version FROM schema_version LIMIT 1")
        row = cursor.fetchone()
        return row["version"] if row else 0
