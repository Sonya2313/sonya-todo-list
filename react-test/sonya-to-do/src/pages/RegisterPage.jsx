import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser } from '../api/authApi';
import { useAuth } from '../context/AuthContext';

function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { isAuth, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuth) {
      navigate('/tasks');
    }
  }, [isAuth, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setError('Заполни email и пароль');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const data = await registerUser({
        email: email.trim(),
        password,
      });

      login(data);
      navigate('/tasks');
    } catch (error) {
      setError(error.message || 'Не удалось зарегистрироваться');
    } finally {
      setLoading(false);
    }
  }
  return (
    <main>
      <h1>Регистрация</h1>

      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
          />
        </label>

        <label>
          Пароль
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Минимум 6 символов"
          />
        </label>

        {error && <p>{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Регистрация...' : 'Зарегистрироваться'}
        </button>
      </form>

      <p>
        Уже есть аккаунт? <Link to="/login">Войти</Link>
      </p>
    </main>
  );
}

export default RegisterPage;
