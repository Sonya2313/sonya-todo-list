import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import Layout from './components/Layout/Layout';
import DashboardPage from './pages/DashboardPage';
import TasksPage from './pages/TasksPage';
import CompletedPage from './pages/CompletedPage';
import SettingsPage from './pages/SettingsPage';
import useTasks from './hooks/useTasks';
import RegisterPage from './pages/RegisterPage.jsx';
import WelcomePage from './pages/WelcomePage.jsx';

function App() {
  const tasksData = useTasks();

  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route path="/layout" element={<Layout />}>
        <Route index element={<DashboardPage {...tasksData} />} />
        <Route path="tasks" element={<TasksPage {...tasksData} />} />
        <Route path="completed" element={<CompletedPage {...tasksData} />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
