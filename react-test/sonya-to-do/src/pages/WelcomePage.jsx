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

        <h1 className={styles.title}>
          EVERYTHING CAN BE
          <span> SIMPLE.</span>
          <br />
          TO - DO LIST.
        </h1>

        <p className={styles.description}>
          Планируй задачи, сохраняй фокус и отмечай важное. Один спокойный
          список — для всех твоих дел.
        </p>
        <div className={styles.actions}>
          <Link to="/tasks" className={styles.primaryButton}>
            Начать планировать
            <span aria-hidden="true">↗</span>
          </Link>

          <Link to="/login" className={styles.secondaryButton}>
            Уже есть аккаунт
          </Link>
        </div>
      </section>

      <div className={styles.taskCard}>
        <div className={styles.cardTop}>
          <span className={styles.cardLabel}>TODAY’S FOCUS</span>
          <span className={styles.cardDate}>01</span>
        </div>

        <h2>
          make your day
          <br />a little easier.
        </h2>

        <ul className={styles.taskList}>
          <li>
            <span className={styles.check}>✓</span>
            Plan the next task
          </li>
          <li>
            <span className={styles.check}>✓</span>
            Take a coffee break
          </li>
          <li>
            <span className={styles.emptyCheck} />
            Finish what matters
          </li>
        </ul>
      </div>

      <footer className={styles.footer}>
        <span>MAKE SPACE FOR WHAT MATTERS</span>
        <span>© 2026 SONYA TASKS</span>
      </footer>
    </main>
  );
}

export default WelcomePage;
