import { useEffect, useState } from 'react';
import { getTasks, createTask, updateTask, removeTask } from '../api/tasksApi';

function useTasks() {
  const [tasks, setTasks] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchTasks() {
      try {
        setLoading(true);
        setError(null);

        const data = await getTasks();
        setTasks(data);
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }

    fetchTasks();
  }, []);

  async function handleAddTask(event) {
    event.preventDefault();

    const trimmedValue = inputValue.trim();
    if (!trimmedValue) return;

    const newTask = {
      title: trimmedValue,
      completed: false,
    };

    try {
      setError(null);

      const createdTask = await createTask(newTask);
      setTasks((prevTasks) => [...prevTasks, createdTask]);
      setInputValue('');
    } catch (error) {
      setError(error.message);
    }
  }

  async function handleDeleteTask(taskId) {
    try {
      setError(null);

      await removeTask(taskId);
      setTasks((prevTasks) => prevTasks.filter((task) => task.id !== taskId));
    } catch (error) {
      setError(error.message);
    }
  }

  async function handleToggleTask(taskId) {
    const currentTask = tasks.find((task) => task.id === taskId);
    if (!currentTask) return;

    try {
      setError(null);

      const updatedTask = await updateTask(taskId, {
        completed: !currentTask.completed,
      });

      setTasks((prevTasks) =>
        prevTasks.map((task) => (task.id === taskId ? updatedTask : task)),
      );
    } catch (error) {
      setError(error.message);
    }
  }

  async function handleEditTask(taskId, newTitle) {
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) return;

    try {
      setError(null);

      const updatedTask = await updateTask(taskId, {
        title: trimmedTitle,
      });

      setTasks((prevTasks) =>
        prevTasks.map((task) => (task.id === taskId ? updatedTask : task)),
      );
    } catch (error) {
      setError(error.message);
    }
  }

  function handleFilter(newFilter) {
    setFilter(newFilter);
  }

  const filteredTasks = tasks.filter((task) => {
    if (filter === 'active') return !task.completed;
    if (filter === 'completed') return task.completed;
    return true;
  });

  const totalTasksCount = tasks.length;
  const activeTasksCount = tasks.filter((task) => !task.completed).length;
  const completedTasksCount = tasks.filter((task) => task.completed).length;

  return {
    tasks,
    inputValue,
    setInputValue,
    filter,
    filteredTasks,
    totalTasksCount,
    activeTasksCount,
    completedTasksCount,
    loading,
    error,
    handleAddTask,
    handleDeleteTask,
    handleToggleTask,
    handleEditTask,
    handleFilter,
  };
}

export default useTasks;
