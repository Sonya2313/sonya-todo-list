const BASE_URL = 'http://localhost:5050/tasks';

function getAuthHeaders() {
  const token = localStorage.getItem('token');

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}

export async function getTasks() {
  const response = await fetch(BASE_URL, {
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch tasks: ${response.status}`);
  }

  return response.json();
}

export async function createTask(newTask) {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(newTask),
  });

  if (!response.ok) {
    throw new Error(`Failed to create task: ${response.status}`);
  }

  return response.json();
}

export async function updateTask(taskId, updatedFields) {
  const response = await fetch(`${BASE_URL}/${taskId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(updatedFields),
  });

  if (!response.ok) {
    throw new Error(`Failed to update task: ${response.status}`);
  }

  return response.json();
}

export async function removeTask(taskId) {
  const response = await fetch(`${BASE_URL}/${taskId}`, {
    method: 'DELETE',
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete task: ${response.status}`);
  }

  return true;
}
