import TaskForm from '../components/TaskForm/TaskForm';
import TaskStats from '../components/TaskStats/TaskStats';

function DashboardPage({
  inputValue,
  setInputValue,
  handleAddTask,
  totalTasksCount,
  activeTasksCount,
  completedTasksCount,
}) {
  function handleInputValue(event) {
    setInputValue(event.target.value);
  }

  return (
    <>
      <TaskForm
        inputValue={inputValue}
        inputChange={handleInputValue}
        addTask={handleAddTask}
      />

      <TaskStats
        totalTasksCount={totalTasksCount}
        activeTasksCount={activeTasksCount}
        completedTasksCount={completedTasksCount}
      />
    </>
  );
}

export default DashboardPage;
