import TaskItem from '../TaskItem/TaskItem';
import styles from './TaskList.module.css';

function TaskList({ tasks, onDeleteTask, onToggleTask, onEditTask }) {
  if (tasks.length === 0) {
    return <p> No tasks yet. </p>;
  }

  return (
    <ul className={styles.list}>
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onDeleteTask={onDeleteTask}
          onToggleTask={onToggleTask}
          onEditTask={onEditTask}
        />
      ))}
    </ul>
  );
}

export default TaskList;
