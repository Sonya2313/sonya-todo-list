import styles from './TaskFilters.module.css';

function TaskFilters({ currentFilter, onFilterChange }) {
  return (
    <div className={styles.filters}>
      <button
        className={currentFilter === 'all' ? styles.active : styles.button}
        onClick={() => onFilterChange('all')}
      >
        All
      </button>

      <button
        className={currentFilter === 'active' ? styles.active : styles.button}
        onClick={() => onFilterChange('active')}
      >
        Active
      </button>

      <button
        className={
          currentFilter === 'completed' ? styles.active : styles.button
        }
        onClick={() => onFilterChange('completed')}
      >
        Completed
      </button>
    </div>
  );
}

export default TaskFilters;
