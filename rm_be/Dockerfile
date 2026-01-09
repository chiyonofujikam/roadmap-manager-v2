# Dockerfile for Roadmap Manager Backend (optional - for containerizing the API)
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install uv

# Copy dependency files
COPY pyproject.toml uv.lock* ./

# Install Python dependencies (without installing the project itself)
RUN uv sync --frozen --no-install-project

# Copy application code
COPY . .

# Install the project itself (dependencies already installed)
RUN uv sync

# Expose port
EXPOSE 8000

# Run the application
CMD ["uv", "run", "uvicorn", "rm_be.main:app", "--host", "0.0.0.0", "--port", "8000"]
