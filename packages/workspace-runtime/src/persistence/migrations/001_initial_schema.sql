CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  agent TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  workflow_label TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  current_attempt_id TEXT
);

CREATE TABLE IF NOT EXISTS task_attempts (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  agent TEXT NOT NULL,
  status TEXT NOT NULL,
  stage TEXT NOT NULL,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  termination_reason TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_task_attempts_task_id
  ON task_attempts (task_id);

CREATE TABLE IF NOT EXISTS task_events (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_task_events_task_id
  ON task_events (task_id, occurred_at);

CREATE TABLE IF NOT EXISTS workspace_session (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  workspace_path TEXT NOT NULL,
  opened_at TEXT NOT NULL
);

