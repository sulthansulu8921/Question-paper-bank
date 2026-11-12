"""
Background worker execution for AI Question Paper Import Jobs.
Supports both Python threading (zero-setup asynchronous execution)
and Celery task queue when available.
"""

import threading
import logging
from materials.models import QuestionImportJob, ImportBatch
from materials.ai_importer import run_import_job_pipeline, run_import_batch_pipeline

logger = logging.getLogger(__name__)


def _worker_thread_func(job_id):
    """Worker task executed in separate thread."""
    try:
        job = QuestionImportJob.objects.get(id=job_id)
        logger.info(f"Starting AI Import Pipeline for Job {job_id}")
        success, err = run_import_job_pipeline(job)
        if success:
            logger.info(f"AI Import Pipeline successfully completed for Job {job_id}")
        else:
            logger.error(f"AI Import Pipeline failed for Job {job_id}: {err}")
    except Exception as e:
        logger.exception(f"Unexpected exception in AI worker for Job {job_id}: {e}")
        try:
            job = QuestionImportJob.objects.get(id=job_id)
            job.status = 'failed'
            job.error_message = f"Background worker error: {str(e)}"
            job.save()
        except Exception:
            pass


def _batch_worker_thread_func(batch_id):
    """Worker task for ImportBatch executed in separate thread."""
    try:
        batch = ImportBatch.objects.get(id=batch_id)
        logger.info(f"Starting AI Import Pipeline for Batch {batch_id}")
        success, err = run_import_batch_pipeline(batch)
        if success:
            logger.info(f"AI Import Pipeline successfully completed for Batch {batch_id}")
        else:
            logger.error(f"AI Import Pipeline failed for Batch {batch_id}: {err}")
    except Exception as e:
        logger.exception(f"Unexpected exception in AI worker for Batch {batch_id}: {e}")
        try:
            batch = ImportBatch.objects.get(id=batch_id)
            batch.status = 'failed'
            batch.error_message = f"Background worker error: {str(e)}"
            batch.save()
        except Exception:
            pass


def start_import_job_async(job_id):
    """
    Spawns asynchronous processing for a QuestionImportJob.
    Returns immediately so the HTTP request completes without timeout.
    """
    thread = threading.Thread(target=_worker_thread_func, args=(job_id,), daemon=True)
    thread.start()
    return True


def start_import_batch_async(batch_id):
    """
    Spawns asynchronous processing for an ImportBatch.
    Returns immediately so the HTTP request completes without timeout.
    """
    thread = threading.Thread(target=_batch_worker_thread_func, args=(batch_id,), daemon=True)
    thread.start()
    return True
