import { useState } from 'react';
import styles from './TaskItem.module.css';

function TaskItem({ task, onDeleteTask, onToggleTask, onEditTask }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedValue, setEditedValue] = useState(task.title);
  const [error, setError] = useState('');

  function handleStartEditing() {
    setIsEditing(true);
    setEditedValue(task.title);
    setError('');
  }

  function handleCancelEditing() {
    setIsEditing(false);
    setEditedValue(task.title);
    setError('');
  }

  function handleChangeEditedValue(event) {
    setEditedValue(event.target.value);
    if (error) {
      setError('');
    }
  }

  function handleSubmitEdit(event) {
    event.preventDefault();

    const trimmedValue = editedValue.trim();

    if (!trimmedValue) {
      setError('Task text cannot be empty');
      return;
    }

    onEditTask(task.id, trimmedValue);
    setIsEditing(false);
    setError('');
  }

  return (
    <li className={styles.item}>
      {isEditing ? (
        <div className={styles.editBlock}>
          <form className={styles.editForm} onSubmit={handleSubmitEdit}>
            <input
              className={styles.editInput}
              type="text"
              value={editedValue}
              onChange={handleChangeEditedValue}
              placeholder="Edit your task"
            />

            <div className={styles.editActions}>
              <button className={styles.saveButton} type="submit">
                Save
              </button>

              <button
                className={styles.cancelButton}
                type="button"
                onClick={handleCancelEditing}
              >
                Cancel
              </button>
            </div>
          </form>

          {error && <p className={styles.error}>{error}</p>}
        </div>
      ) : (
        <>
          <div className={styles.left}>
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => onToggleTask(task.id)}
            />

            <span className={task.completed ? styles.completed : styles.text}>
              {task.title}
            </span>
          </div>

          <div className={styles.actions}>
            <button
              className={styles.editButton}
              type="button"
              onClick={handleStartEditing}
            >
              Edit
            </button>

            <button
              className={styles.deleteButton}
              type="button"
              onClick={() => onDeleteTask(task.id)}
            >
              Delete
            </button>
          </div>
        </>
      )}
    </li>
  );
}

export default TaskItem;
