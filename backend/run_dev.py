"""
VaidyaAI Backend — Development Server Runner

Starts uvicorn with hot reload restricted to source directories only.
Excludes virtual environments, caches, and non-source trees from WatchFiles
to prevent reload storms on iCloud Drive.

Usage:
    cd backend
    .venv/bin/python run_dev.py
"""
import os
import uvicorn

if __name__ == "__main__":
    # Ensure current working directory is the backend directory
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(backend_dir)

    print("🚀 Starting VaidyaAI Development Server with restricted reload monitoring...")
    print("  • Monitored Source Directories: api/, agents/, database/, models/, prompts/, services/, tasks/, utils/")
    print("  • Excluded Paths: .venv, .ga_venv, __pycache__, .pytest_cache, .mypy_cache, node_modules, .next, tests")

    reload_enabled = os.getenv("UVICORN_RELOAD", "true").lower() in ("true", "1", "yes")

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=reload_enabled,
        reload_dirs=[
            os.path.join(backend_dir, d) for d in [
                "api",
                "agents",
                "database",
                "models",
                "prompts",
                "services",
                "tasks",
                "utils",
            ]
        ] if reload_enabled else None,
        reload_includes=[
            "*.py",
        ] if reload_enabled else None,
        reload_excludes=[
            # uvicorn 0.29 FileFilter: entries that are existing directories
            # (relative to CWD) become path-prefix exclusions.
            ".venv",
            ".ga_venv",
            "__pycache__",
            ".pytest_cache",
            ".mypy_cache",
            "tests",
            "alembic",
            "*.pyc",
            "*.db",
            "*.db-journal",
            "*.log",
            "*.sqlite*",
            "*.ipc",
        ] if reload_enabled else None,
    )
