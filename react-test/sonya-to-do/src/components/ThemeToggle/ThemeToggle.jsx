import useTheme from '../../hooks/useTheme';
import styles from './ThemeToggle.module.css';

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button className={styles.button} onClick={toggleTheme}>
      {theme === 'light' ? 'Dark mode' : 'Light mode'}
    </button>
  );
}

export default ThemeToggle;
