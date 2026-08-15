import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import { useAuth } from '../../context/AuthContext';
import styles from './Layout.module.css';

function Layout() {
  const { isAuth, user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function getNavLinkClass({ isActive }) {
    return isActive ? `${styles.link} ${styles.activeLink}` : styles.link;
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Link
            to="/"
            className={styles.brand}
            aria-label="Sonya ToDo List — главная"
          >
            <span className={styles.brandMark}>S</span>

            <span>
              <span className={styles.brandName}>Sonya</span>
              <span className={styles.brandSubtitle}>ToDo List</span>
            </span>
          </Link>

          <div className={styles.headerActions}>
            <ThemeToggle />

            {isAuth ? (
              <div className={styles.userActions}>
                <span className={styles.userEmail} title={user?.email}>
                  {user?.email}
                </span>

                <button
                  className={styles.logoutButton}
                  type="button"
                  onClick={handleLogout}
                >
                  Выйти
                </button>
              </div>
            ) : (
              <Link className={styles.loginLink} to="/login">
                Войти
              </Link>
            )}
          </div>
        </div>

        <nav className={styles.nav} aria-label="Основная навигация">
          <NavLink to="/" className={getNavLinkClass} end>
            Dashboard
          </NavLink>

          <NavLink to="/tasks" className={getNavLinkClass}>
            Tasks
          </NavLink>

          <NavLink to="/completed" className={getNavLinkClass}>
            Completed
          </NavLink>

          <NavLink to="/settings" className={getNavLinkClass}>
            Settings
          </NavLink>
        </nav>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
