import TaskFilters from '../components/TaskFilter/TaskFilters';
import TaskList from '../components/TaskList/TaskList';

function TasksPage({
  loading,
  error,
  filteredTasks,
  handleDeleteTask,
  handleToggleTask,
  handleEditTask,
  filter,
  handleFilter,
}) {
  if (loading) {
    return <p>Loading tasks...</p>;
  }

  if (error) {
    return <p>Error: {error}</p>;
  }
  return (
    <>
      <TaskFilters currentFilter={filter} onFilterChange={handleFilter} />

      <TaskList
        tasks={filteredTasks}
        onDeleteTask={handleDeleteTask}
        onToggleTask={handleToggleTask}
        onEditTask={handleEditTask}
      />
    </>
  );
}

export default TasksPage;
