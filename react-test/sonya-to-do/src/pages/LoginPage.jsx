import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser } from '../api/authApi';
import { useAuth } from '../context/AuthContext';
import styles from './LoginPage.module.css';

function LoginPage() {
  const { login, isAuth } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuth) {
      navigate('/tasks');
    }
  }, [isAuth, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Email and password are required');
      return;
    }

    try {
      setLoading(true);

      const data = await loginUser({ email, password });
      login(data);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.loginPage}>
      <div className={`${styles.loginBlob} ${styles.loginBlobPink}`} />
      <div className={`${styles.loginBlob} ${styles.loginBlobRed}`} />
      <div className={`${styles.loginBlob} ${styles.loginBlobPurple}`} />

      <Link className={styles.loginLogo} to="/">
        SONYA.TASKS
      </Link>

      <section className={styles.loginCard} aria-labelledby="login-title">
        <div className={styles.loginCardHeader}>
          <span className={styles.loginCardEyebrow}>WELCOME BACK</span>

          <h1 id="login-title">Let’s make today simple.</h1>

          <p>Войдите в свой аккаунт.</p>
        </div>

        <form className={styles.loginForm} onSubmit={handleSubmit}>
          <label className={styles.loginFormField} htmlFor="email">
            <span>Email</span>

            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={loading}
            />
          </label>

          <label className={styles.loginFormField} htmlFor="password">
            <span>Password</span>

            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Введите пароль"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={loading}
            />
          </label>

          {error && (
            <p className={styles.loginFormError} role="alert">
              {error}
            </p>
          )}

          <button
            className={styles.loginFormSubmit}
            type="submit"
            disabled={loading}
          >
            {loading ? 'Выполняем вход...' : 'SIGN IN'}
            {!loading && <span aria-hidden="true"></span>}
          </button>
        </form>

        <p className={styles.loginCardFooter}>
          Нет аккаунта? <Link to="/register">Создать аккаунт</Link>
        </p>
      </section>

      <p className={styles.loginNote}>MAKE SPACE FOR WHAT MATTERS</p>
    </main>
  );
}

export default LoginPage;
