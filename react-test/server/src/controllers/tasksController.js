import pool from '../db/index.js';

export async function getAllTasks(req, res) {
  try {
    const result = await pool.query(
      'SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id],
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch tasks' });
  }
}

export async function createTask(req, res) {
  try {
    const { title } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const result = await pool.query(
      `
      INSERT INTO tasks (title, user_id)
      VALUES ($1, $2)
      RETURNING *
      `,
      [title.trim(), req.user.id],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create task' });
  }
}

export async function updateTask(req, res) {
  try {
    const taskId = Number(req.params.id);
    const { title, completed } = req.body;

    const existingTask = await pool.query(
      'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
      [taskId, req.user.id],
    );

    if (existingTask.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const currentTask = existingTask.rows[0];

    if (title !== undefined && !title.trim()) {
      return res.status(400).json({ message: 'Title cannot be empty' });
    }

    const newTitle = title !== undefined ? title.trim() : currentTask.title;
    const newCompleted =
      completed !== undefined ? completed : currentTask.completed;

    const result = await pool.query(
      `
      UPDATE tasks
      SET title = $1,
          completed = $2,
          updated_at = NOW()
      WHERE id = $3 AND user_id = $4
      RETURNING *
      `,
      [newTitle, newCompleted, taskId, req.user.id],
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update task' });
  }
}

export async function deleteTask(req, res) {
  try {
    const taskId = Number(req.params.id);

    const result = await pool.query(
      `
      DELETE FROM tasks
      WHERE id = $1 AND user_id = $2
      RETURNING *
      `,
      [taskId, req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete task' });
  }
}
