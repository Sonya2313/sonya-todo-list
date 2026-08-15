import TaskList from '../components/TaskList/TaskList';

function CompletedPage({
  tasks,
  handleDeleteTask,
  handleToggleTask,
  handleEditTask,
  loading,
  error,
}) {
  const completedTasks = tasks.filter((task) => task.completed);
  if (loading) {
    return <p>Loading tasks...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }
  return (
    <TaskList
      tasks={completedTasks}
      onDeleteTask={handleDeleteTask}
      onToggleTask={handleToggleTask}
      onEditTask={handleEditTask}
    />
  );
}

export default CompletedPage;
