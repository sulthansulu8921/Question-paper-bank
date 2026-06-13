#!/bin/bash
set -e

# Configuration
BACKUP_DIR="/home/ubuntu/study-partner/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/db_backup_${TIMESTAMP}.sql.gz"
CONTAINER_BACKUP_PATH="/tmp/backup.sql.gz"

# Ensure local backup directory exists
mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting database backup..."

# 1. Run pg_dump in the database container, compress it, and save it on the host
# Using docker exec without -t to avoid TTY issues in cron
docker exec qubook_db pg_dump -U postgres -d qubook_db | gzip > "${BACKUP_FILE}"
echo "[$(date)] Database dumped and compressed to ${BACKUP_FILE}"

# 2. Copy the backup file into the backend container for upload
docker cp "${BACKUP_FILE}" qubook_backend:"${CONTAINER_BACKUP_PATH}"

# 3. Create the upload script inside the backend container and execute it
docker exec -i -e BACKUP_KEY="backups/db_backup_${TIMESTAMP}.sql.gz" qubook_backend python - <<'INNER_EOF'
import os
import sys
sys.path.append('/app')
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.conf import settings
import boto3

s3 = boto3.client(
    's3',
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    endpoint_url=settings.AWS_S3_ENDPOINT_URL,
    region_name='auto'
)

local_path = "/tmp/backup.sql.gz"
r2_key = os.environ.get("BACKUP_KEY", "backups/db_backup_fallback.sql.gz")

try:
    print(f"Uploading {local_path} to R2 bucket {settings.AWS_STORAGE_BUCKET_NAME} as {r2_key}...")
    s3.upload_file(local_path, settings.AWS_STORAGE_BUCKET_NAME, r2_key)
    print(f"Successfully uploaded {r2_key} to R2 bucket {settings.AWS_STORAGE_BUCKET_NAME}")
except Exception as e:
    print(f"Failed to upload to R2: {str(e)}")
    sys.exit(1)
INNER_EOF

# 4. Clean up the backup file inside the container
docker exec qubook_backend rm -f "${CONTAINER_BACKUP_PATH}"

# 5. Keep only the last 7 days of backups locally on the EC2 host to save disk space
find "${BACKUP_DIR}" -name "db_backup_*.sql.gz" -mtime +7 -delete
echo "[$(date)] Backup process complete. Local clean up finished."
