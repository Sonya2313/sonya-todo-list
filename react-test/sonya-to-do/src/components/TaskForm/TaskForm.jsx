import styles from './TaskForm.module.css';

function TaskForm({ inputValue, inputChange, addTask }) {
  return (
    <form className={styles.form} onSubmit={addTask}>
      <input
        className={styles.input}
        type="text"
        placeholder="Enter a task"
        value={inputValue}
        onChange={inputChange}
      />

      <button className={styles.button} type="submit">
        Add task
      </button>
    </form>
  );
}

export default TaskForm;
