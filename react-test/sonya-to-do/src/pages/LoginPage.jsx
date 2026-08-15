import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser } from '../api/authApi';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

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
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-card__header">
          <span className="login-card__badge">TaskFlow</span>

          <h1 id="login-title">С возвращением</h1>

          <p>Войдите в аккаунт, чтобы продолжить работу с задачами.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-form__field" htmlFor="email">
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

          <label className="login-form__field" htmlFor="password">
            <span>Пароль</span>

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
            <p className="login-form__error" role="alert">
              {error}
            </p>
          )}

          <button
            className="login-form__submit"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Выполняем вход...' : 'Войти'}
          </button>
        </form>

        <p className="login-card__footer">
          Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
        </p>
      </section>
    </main>
  );
}

export default LoginPage;
