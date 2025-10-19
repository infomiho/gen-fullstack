import { useEffect, useState } from 'react';
import './App.css';

interface User {
  id: number;
  email: string;
  name?: string;
  createdAt: string;
}

export default function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    const response = await fetch('/api/users');
    const data = await response.json();
    setUsers(data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name }),
    });

    if (response.ok) {
      setEmail('');
      setName('');
      fetchUsers();
    } else {
      const data = await response.json();
      setError(data.error || 'Failed to create user');
    }
  }

  return (
    <div className="container">
      <h1 className="title">Full-Stack Template</h1>
      <p className="subtitle">Customize this template based on your requirements</p>

      <form className="form" onSubmit={handleSubmit}>
        <h2 className="form-title">Add User</h2>
        {error && <div className="error">{error}</div>}

        <div className="form-group">
          <label className="label">Email</label>
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="label">Name (optional)</label>
          <input
            type="text"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <button type="submit" className="button">
          Add User
        </button>
      </form>

      <div className="users-section">
        <h2 className="section-title">Users ({users.length})</h2>
        <div className="users-list">
          {users.length === 0 ? (
            <p className="empty">No users yet. Add one above!</p>
          ) : (
            users.map((user) => (
              <div key={user.id} className="user-card">
                <div className="user-email">{user.email}</div>
                {user.name && <div className="user-name">{user.name}</div>}
                <div className="user-date">{new Date(user.createdAt).toLocaleDateString()}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
