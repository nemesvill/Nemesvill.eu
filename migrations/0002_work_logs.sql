CREATE TABLE IF NOT EXISTS work_logs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  work_date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  task_description TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_work_logs_job_date ON work_logs(job_id, work_date DESC, created_at DESC);
