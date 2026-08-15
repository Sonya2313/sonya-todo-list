import styles from './TaskStats.module.css';

function TaskStats({ totalTasksCount, activeTasksCount, completedTasksCount }) {
  return (
    <div className={styles.stats}>
      <p>Total: {totalTasksCount}</p>
      <p>Active: {activeTasksCount}</p>
      <p>Completed: {completedTasksCount}</p>
    </div>
  );
}

export default TaskStats;
