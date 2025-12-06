import { useState } from 'react';
import { User, UserRole } from '@emekteb/shared-types';
import { formatDate } from '@emekteb/shared-utils';
import './App.css';

function App() {
  const [count, setCount] = useState(0);

  const exampleUser: User = {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    role: UserRole.STUDENT,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>E-Mekteb</h1>
        <p>Welcome to E-Mekteb application</p>
        
        <div className="card">
          <button onClick={() => setCount((count) => count + 1)}>
            count is {count}
          </button>
          <p>
            Edit <code>src/App.tsx</code> and save to test HMR
          </p>
        </div>

        <div className="example">
          <h2>Shared Types Example</h2>
          <p>User: {exampleUser.name}</p>
          <p>Email: {exampleUser.email}</p>
          <p>Role: {exampleUser.role}</p>
          <p>Created: {formatDate(exampleUser.createdAt)}</p>
        </div>
      </header>
    </div>
  );
}

export default App;

