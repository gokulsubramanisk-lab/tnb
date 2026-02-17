// API Base URL
const API_URL = 'http://localhost:5000/api';

// Check if already logged in
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (token) {
    window.location.href = 'dashboard.html';
  }
});

// Toggle password visibility
function togglePassword() {
  const passwordInput = document.getElementById('password');
  const toggleIcon = document.getElementById('toggleIcon');
  
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    toggleIcon.classList.replace('fa-eye', 'fa-eye-slash');
  } else {
    passwordInput.type = 'password';
    toggleIcon.classList.replace('fa-eye-slash', 'fa-eye');
  }
}

// Handle login form submission
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const userId = document.getElementById('userId').value.trim();
  const password = document.getElementById('password').value;
  const rememberMe = document.getElementById('rememberMe').checked;
  
  const loadingOverlay = document.getElementById('loadingOverlay');
  const errorMessage = document.getElementById('loginError');
  
  loadingOverlay.style.display = 'flex';
  errorMessage.style.display = 'none';
  
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }
    
    // Store token and user data
    if (rememberMe) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    } else {
      sessionStorage.setItem('token', data.token);
      sessionStorage.setItem('user', JSON.stringify(data.user));
    }
    
    // Redirect to dashboard
    window.location.href = 'dashboard.html';
    
  } catch (error) {
    errorMessage.querySelector('span').textContent = error.message;
    errorMessage.style.display = 'flex';
  } finally {
    loadingOverlay.style.display = 'none';
  }
});

// Check for saved credentials
document.addEventListener('DOMContentLoaded', () => {
  const savedUserId = localStorage.getItem('savedUserId');
  if (savedUserId) {
    document.getElementById('userId').value = savedUserId;
    document.getElementById('rememberMe').checked = true;
  }
});