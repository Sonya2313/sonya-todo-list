import { Link } from 'react-router-dom';
import styles from './WelcomePage.module.css';

function WelcomePage() {
  return (
    <main className={styles.page}>
      <div className={`${styles.blob} ${styles.blobPink}`} />
      <div className={`${styles.blob} ${styles.blobRed}`} />
      <div className={`${styles.blob} ${styles.blobPurple}`} />

      <header className={styles.header}>
        <Link to="/" className={styles.logo}>
          SONYA.TASKS
        </Link>

        <div className={styles.headerLinks}>
          <Link to="/login">Войти</Link>
          <Link to="/register" className={styles.registerLink}>
            Регистрация
          </Link>
        </div>
      </header>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>YOUR PERSONAL SPACE FOR FOCUS</p>
      </section>
    </main>
  );
}

export default WelcomePage;
