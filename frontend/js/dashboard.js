// API Configuration
const API_URL = 'http://localhost:5000/api';
let currentUser = null;
let socket = null;
let currentPage = 1;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (!token) {
    window.location.href = 'index.html';
    return;
  }

  // Load user data
  await loadCurrentUser();
  
  // Initialize Socket.IO
  initializeSocket();
  
  // Load initial data
  await loadNotices();
  
  // Setup event listeners
  setupEventListeners();
  
  // Load theme preference
  loadThemePreference();
});

// Load current user
async function loadCurrentUser() {
  try {
    const response = await fetchWithAuth('/auth/me');
    currentUser = response;
    
    // Update UI
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('headerUserName').textContent = currentUser.name;
    document.getElementById('userRole').textContent = currentUser.role.toUpperCase();
    document.getElementById('userDept').textContent = currentUser.department.toUpperCase();
    
    // Show/hide menu items based on role
    if (currentUser.role === 'faculty' || currentUser.role === 'hod') {
      document.getElementById('createNoticeNav').style.display = 'flex';
      document.getElementById('myNoticesNav').style.display = 'flex';
    }
    
    if (currentUser.role === 'hod') {
      document.getElementById('analyticsNav').style.display = 'flex';
      document.getElementById('manageUsersNav').style.display = 'flex';
    }
    
    // Update create form for faculty (can only send to students)
    if (currentUser.role === 'faculty') {
      document.getElementById('facultyOption').style.display = 'none';
      document.getElementById('bothOption').style.display = 'none';
    }
    
  } catch (error) {
    console.error('Error loading user:', error);
    logout();
  }
}

// Initialize Socket.IO
function initializeSocket() {
  socket = io('http://localhost:5000');
  
  socket.on('connect', () => {
    console.log('Connected to socket server');
    socket.emit('join-room', {
      department: currentUser.department,
      role: currentUser.role
    });
  });
  
  socket.on('new-notice', (data) => {
    showToast(`New notice: ${data.notice.title}`, 'info');
    updateNotificationCount();
    loadNotices();
  });
  
  socket.on('department-notice', (data) => {
    showToast(`New notice for your department!`, 'info');
    loadNotices();
  });
}

// Fetch with authentication
async function fetchWithAuth(endpoint, options = {}) {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  
  const defaultOptions = {
    headers: {
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  };
  
  if (!(options.body instanceof FormData)) {
    defaultOptions.headers['Content-Type'] = 'application/json';
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, { ...options, ...defaultOptions });
  
  if (response.status === 401) {
    logout();
    throw new Error('Session expired');
  }
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }
  
  return data;
}

// Load notices
async function loadNotices(page = 1) {
  showLoading();
  
  try {
    const category = document.getElementById('categoryFilter').value;
    const priority = document.getElementById('priorityFilter').value;
    const tag = document.getElementById('tagFilter').value;
    const search = document.getElementById('searchInput').value;
    
    const params = new URLSearchParams({
      page,
      limit: 9,
      category,
      priority,
      tag,
      search
    });
    
    const data = await fetchWithAuth(`/notices?${params}`);
    
    document.getElementById('noticeCount').textContent = data.total;
    renderNotices(data.notices);
    renderPagination(data.totalPages, data.currentPage);
    
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

// Render notices
function renderNotices(notices) {
  const grid = document.getElementById('noticesGrid');
  
  if (notices.length === 0) {
    grid.innerHTML = `
      <div class="no-notices" style="grid-column: 1/-1; text-align: center; padding: 50px;">
        <i class="fas fa-inbox" style="font-size: 60px; color: var(--text-muted); margin-bottom: 20px;"></i>
        <h3>No notices found</h3>
        <p style="color: var(--text-secondary);">There are no notices matching your criteria.</p>
      </div>
    `;
    return;
  }
  
  grid.innerHTML = notices.map(notice => `
    <div class="notice-card ${notice.isPinned ? 'pinned' : ''}">
      <div class="notice-card-header">
        <span class="notice-priority priority-${notice.priority}">${notice.priority}</span>
        ${notice.isPinned ? '<i class="fas fa-thumbtack notice-pin"></i>' : ''}
      </div>
      <div class="notice-card-body">
        <h3 onclick="viewNotice('${notice._id}')">${notice.title}</h3>
        <p class="notice-content-preview">${notice.content}</p>
        <div class="notice-tags">
          ${notice.tags.map(tag => `<span class="notice-tag">@${tag}</span>`).join('')}
        </div>
      </div>
      <div class="notice-card-footer">
        <div class="notice-meta">
          <span><i class="fas fa-user"></i> ${notice.authorName}</span>
          <span><i class="fas fa-clock"></i> ${formatDate(notice.createdAt)}</span>
          <span><i class="fas fa-eye"></i> ${notice.views?.length || 0}</span>
        </div>
        <div class="notice-actions">
          <button onclick="toggleBookmark('${notice._id}')" title="Bookmark">
            <i class="fas fa-bookmark"></i>
          </button>
          <button onclick="viewNotice('${notice._id}')" title="View">
            <i class="fas fa-expand"></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

// Render pagination
function renderPagination(totalPages, currentPage) {
  const pagination = document.getElementById('pagination');
  
  if (totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }
  
  let html = '';
  
  if (currentPage > 1) {
    html += `<button onclick="loadNotices(${currentPage - 1})"><i class="fas fa-chevron-left"></i></button>`;
  }
  
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      html += `<button class="${i === currentPage ? 'active' : ''}" onclick="loadNotices(${i})">${i}</button>`;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += `<button disabled>...</button>`;
    }
  }
  
  if (currentPage < totalPages) {
    html += `<button onclick="loadNotices(${currentPage + 1})"><i class="fas fa-chevron-right"></i></button>`;
  }
  
  pagination.innerHTML = html;
}

// View notice detail
async function viewNotice(id) {
  showLoading();
  
  try {
    const notice = await fetchWithAuth(`/notices/${id}`);
    
    document.getElementById('modalNoticeTitle').textContent = notice.title;
    
    const expiryDate = new Date(notice.expiryDate);
    const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
    
    document.getElementById('modalNoticeBody').innerHTML = `
      <div class="notice-detail">
        <div class="notice-detail-meta">
          <span class="notice-priority priority-${notice.priority}">${notice.priority}</span>
          <span class="notice-category">${notice.category}</span>
          ${notice.isPinned ? '<span class="pinned-badge"><i class="fas fa-thumbtack"></i> Pinned</span>' : ''}
        </div>
        
        <div class="notice-detail-info">
          <div class="info-item">
            <i class="fas fa-user"></i>
            <span><strong>Posted by:</strong> ${notice.authorName} (${notice.authorRole})</span>
          </div>
          <div class="info-item">
            <i class="fas fa-calendar"></i>
            <span><strong>Posted on:</strong> ${formatDate(notice.createdAt)}</span>
          </div>
          <div class="info-item">
            <i class="fas fa-hourglass-half"></i>
            <span><strong>Expires:</strong> ${formatDate(notice.expiryDate)} (${daysLeft} days left)</span>
          </div>
          <div class="info-item">
            <i class="fas fa-users"></i>
            <span><strong>Target:</strong> ${notice.targetAudience}</span>
          </div>
        </div>
        
        <div class="notice-detail-tags">
          ${notice.tags.map(tag => `<span class="notice-tag">@${tag}</span>`).join('')}
        </div>
        
        <div class="notice-detail-content">
          ${notice.content.replace(/\n/g, '<br>')}
        </div>
        
        ${notice.attachments.length > 0 ? `
          <div class="notice-attachments">
            <h4><i class="fas fa-paperclip"></i> Attachments</h4>
            <div class="attachments-list">
              ${notice.attachments.map(att => `
                <a href="/uploads/notices/${att.filename}" target="_blank" class="attachment-item">
                  <i class="fas fa-file"></i>
                  <span>${att.originalName}</span>
                </a>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <div class="notice-stats">
          <span><i class="fas fa-eye"></i> ${notice.views.length} views</span>
          <span><i class="fas fa-check-circle"></i> ${notice.acknowledgements.length} acknowledgements</span>
        </div>
        
        <div class="notice-detail-actions">
          <button class="btn btn-primary" onclick="acknowledgeNotice('${notice._id}')">
            <i class="fas fa-check"></i> Acknowledge
          </button>
          <button class="btn btn-secondary" onclick="toggleBookmark('${notice._id}')">
            <i class="fas fa-bookmark"></i> Bookmark
          </button>
        </div>
        
        <div class="notice-comments">
          <h4><i class="fas fa-comments"></i> Comments (${notice.comments.length})</h4>
          <div class="comments-list">
            ${notice.comments.map(comment => `
              <div class="comment">
                <strong>${comment.userName}</strong>
                <span class="comment-date">${formatDate(comment.createdAt)}</span>
                <p>${comment.text}</p>
              </div>
            `).join('')}
          </div>
          <form class="comment-form" onsubmit="addComment(event, '${notice._id}')">
            <input type="text" id="commentText" placeholder="Add a comment..." required>
            <button type="submit" class="btn btn-primary">Post</button>
          </form>
        </div>
      </div>
    `;
    
    openModal('noticeModal');
    
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

// Create notice
document.getElementById('createNoticeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  showLoading();
  
  try {
    const formData = new FormData(e.target);
    
    // Get selected tags
    const tags = [];
    document.querySelectorAll('input[name="tags"]:checked').forEach(cb => {
      tags.push(cb.value);
    });
    
    formData.delete('tags');
    formData.append('tags', tags.join(','));
    
    await fetchWithAuth('/notices', {
      method: 'POST',
      body: formData,
      headers: {} // Let browser set content-type for FormData
    });
    
    showToast('Notice created successfully!', 'success');
    e.target.reset();
    showPage('notices');
    loadNotices();
    
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
});

// Toggle bookmark
async function toggleBookmark(noticeId) {
  try {
    const data = await fetchWithAuth(`/notices/${noticeId}/bookmark`, {
      method: 'POST'
    });
    
    showToast(data.message, 'success');
    
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Acknowledge notice
async function acknowledgeNotice(noticeId) {
  try {
    const data = await fetchWithAuth(`/notices/${noticeId}/acknowledge`, {
      method: 'POST'
    });
    
    showToast('Notice acknowledged!', 'success');
    viewNotice(noticeId); // Refresh the modal
    
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Add comment
async function addComment(e, noticeId) {
  e.preventDefault();
  
  const text = document.getElementById('commentText').value;
  
  try {
    await fetchWithAuth(`/notices/${noticeId}/comment`, {
      method: 'POST',
      body: JSON.stringify({ text })
    });
    
    showToast('Comment added!', 'success');
    viewNotice(noticeId); // Refresh the modal
    
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Load my notices
async function loadMyNotices() {
  showLoading();
  
  try {
    const notices = await fetchWithAuth('/notices/user/my-notices');
    
    const grid = document.getElementById('myNoticesGrid');
    grid.innerHTML = notices.map(notice => `
      <div class="notice-card ${notice.isPinned ? 'pinned' : ''}">
        <div class="notice-card-header">
          <span class="notice-priority priority-${notice.priority}">${notice.priority}</span>
          ${notice.isExpired ? '<span class="expired-badge">Expired</span>' : ''}
        </div>
        <div class="notice-card-body">
          <h3>${notice.title}</h3>
          <p class="notice-content-preview">${notice.content}</p>
        </div>
        <div class="notice-card-footer">
          <div class="notice-meta">
            <span><i class="fas fa-eye"></i> ${notice.views?.length || 0}</span>
            <span><i class="fas fa-check"></i> ${notice.acknowledgements?.length || 0}</span>
          </div>
          <div class="notice-actions">
            <button onclick="editNotice('${notice._id}')" title="Edit">
              <i class="fas fa-edit"></i>
            </button>
            <button onclick="deleteNotice('${notice._id}')" title="Delete">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');
    
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

// Load analytics
async function loadAnalytics() {
  showLoading();
  
  try {
    const data = await fetchWithAuth('/notices/analytics/stats');
    
    document.getElementById('totalNotices').textContent = data.totalNotices;
    document.getElementById('activeNotices').textContent = data.activeNotices;
    document.getElementById('expiredNotices').textContent = data.expiredNotices;
    document.getElementById('totalUsers').textContent = data.totalUsers;
    
    // Render simple bar charts
    renderSimpleChart('categoryChart', data.noticesByCategory);
    renderSimpleChart('departmentChart', data.noticesByDepartment);
    renderSimpleChart('priorityChart', data.noticesByPriority);
    
    // Render recent notices
    document.getElementById('recentNoticesList').innerHTML = data.recentNotices.map(notice => `
      <div class="recent-item">
        <strong>${notice.title}</strong>
        <span>${formatDate(notice.createdAt)}</span>
      </div>
    `).join('');
    
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

// Simple bar chart renderer
function renderSimpleChart(containerId, data) {
  const container = document.getElementById(containerId);
  const maxValue = Math.max(...data.map(d => d.count));
  
  container.innerHTML = data.map(item => `
    <div class="chart-bar-container">
      <span class="chart-label">${item._id}</span>
      <div class="chart-bar" style="width: ${(item.count / maxValue) * 100}%">
        <span class="chart-value">${item.count}</span>
      </div>
    </div>
  `).join('');
}

// Load users (HOD only)
async function loadUsers() {
  showLoading();
  
  try {
    const role = document.getElementById('userRoleFilter').value;
    const department = document.getElementById('userDeptFilter').value;
    
    const params = new URLSearchParams();
    if (role) params.append('role', role);
    if (department) params.append('department', department);
    
    const users = await fetchWithAuth(`/auth/users?${params}`);
    
    document.getElementById('usersTableBody').innerHTML = users.map(user => `
      <tr>
        <td>${user.userId}</td>
        <td>${user.name}</td>
        <td>${user.email}</td>
        <td><span class="role-badge role-${user.role}">${user.role}</span></td>
        <td>${user.department.toUpperCase()}</td>
        <td><span class="status-badge ${user.isActive ? 'active' : 'inactive'}">${user.isActive ? 'Active' : 'Inactive'}</span></td>
        <td>
          <button class="btn-icon" title="Edit"><i class="fas fa-edit"></i></button>
        </td>
      </tr>
    `).join('');
    
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

// Add user
document.getElementById('addUserForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  showLoading();
  
  try {
    await fetchWithAuth('/auth/create-user', {
      method: 'POST',
      body: JSON.stringify({
        userId: document.getElementById('newUserId').value,
        name: document.getElementById('newUserName').value,
        email: document.getElementById('newUserEmail').value,
        password: document.getElementById('newUserPassword').value,
        role: document.getElementById('newUserRole').value,
        department: document.getElementById('newUserDept').value,
        phone: document.getElementById('newUserPhone').value
      })
    });
    
    showToast('User created successfully!', 'success');
    closeModal('addUserModal');
    e.target.reset();
    loadUsers();
    
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
});

// Upload users from Excel
document.getElementById('uploadUsersForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  showLoading();
  
  try {
    const formData = new FormData(e.target);
    
    const response = await fetchWithAuth('/auth/upload-users', {
      method: 'POST',
      body: formData,
      headers: {}
    });
    
    showToast(response.message, 'success');
    closeModal('uploadUsersModal');
    e.target.reset();
    loadUsers();
    
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
});

// Setup event listeners
function setupEventListeners() {
  // Navigation
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      showPage(page);
    });
  });
  
  // Filters
  document.querySelectorAll('.filter-select').forEach(select => {
    select.addEventListener('change', () => loadNotices());
  });
  
  // Search with debounce
  let searchTimeout;
  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadNotices(), 500);
  });
  
  // File upload preview
  document.getElementById('attachments').addEventListener('change', (e) => {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = Array.from(e.target.files).map(file => `
      <div class="file-item">
        <i class="fas fa-file"></i>
        <span>${file.name}</span>
      </div>
    `).join('');
  });
  
  // Settings forms
  document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await fetchWithAuth('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name: document.getElementById('settingsName').value,
          phone: document.getElementById('settingsPhone').value
        })
      });
      showToast('Profile updated!', 'success');
      loadCurrentUser();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
  
  document.getElementById('passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match!', 'error');
      return;
    }
    
    try {
      await fetchWithAuth('/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword: document.getElementById('currentPassword').value,
          newPassword
        })
      });
      showToast('Password changed successfully!', 'success');
      e.target.reset();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
}

// Navigation
function showPage(pageName) {
  // Update nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.page === pageName) {
      item.classList.add('active');
    }
  });
  
  // Update pages
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  
  const targetPage = document.getElementById(`${pageName}Page`);
  if (targetPage) {
    targetPage.classList.add('active');
  }
  
  // Load page-specific data
  switch (pageName) {
    case 'notices':
      loadNotices();
      break;
    case 'my-notices':
      loadMyNotices();
      break;
    case 'bookmarks':
      loadBookmarks();
      break;
    case 'analytics':
      loadAnalytics();
      break;
    case 'manage-users':
      loadUsers();
      break;
    case 'settings':
      loadSettings();
      break;
  }
  
  // Close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');
}

// Load bookmarks
async function loadBookmarks() {
  showLoading();
  
  try {
    const bookmarks = await fetchWithAuth('/notices/user/bookmarks');
    
    const grid = document.getElementById('bookmarksGrid');
    
    if (bookmarks.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 50px;">
          <i class="fas fa-bookmark" style="font-size: 60px; color: var(--text-muted); margin-bottom: 20px;"></i>
          <h3>No bookmarks yet</h3>
          <p style="color: var(--text-secondary);">Start bookmarking notices to see them here.</p>
        </div>
      `;
    } else {
      grid.innerHTML = bookmarks.map(notice => `
        <div class="notice-card">
          <div class="notice-card-header">
            <span class="notice-priority priority-${notice.priority}">${notice.priority}</span>
          </div>
          <div class="notice-card-body">
            <h3 onclick="viewNotice('${notice._id}')">${notice.title}</h3>
            <p class="notice-content-preview">${notice.content}</p>
          </div>
          <div class="notice-card-footer">
            <div class="notice-meta">
              <span><i class="fas fa-user"></i> ${notice.authorName || 'Unknown'}</span>
            </div>
            <div class="notice-actions">
              <button onclick="toggleBookmark('${notice._id}')" class="bookmarked">
                <i class="fas fa-bookmark"></i>
              </button>
            </div>
          </div>
        </div>
      `).join('');
    }
    
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

// Load settings
function loadSettings() {
  if (currentUser) {
    document.getElementById('settingsName').value = currentUser.name || '';
    document.getElementById('settingsPhone').value = currentUser.phone || '';
  }
}

// Delete notice
async function deleteNotice(noticeId) {
  if (!confirm('Are you sure you want to delete this notice?')) return;
  
  try {
    await fetchWithAuth(`/notices/${noticeId}`, {
      method: 'DELETE'
    });
    
    showToast('Notice deleted successfully!', 'success');
    loadMyNotices();
    
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Toggle sidebar
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// Toggle notifications
function toggleNotifications() {
  const dropdown = document.getElementById('notificationsDropdown');
  dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
  document.getElementById('userMenuDropdown').style.display = 'none';
}

// Toggle user menu
function toggleUserMenu() {
  const dropdown = document.getElementById('userMenuDropdown');
  dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
  document.getElementById('notificationsDropdown').style.display = 'none';
}

// Toggle theme
function toggleTheme() {
  const body = document.body;
  const currentTheme = body.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  body.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  
  const icon = document.getElementById('themeIcon');
  icon.classList.toggle('fa-moon');
  icon.classList.toggle('fa-sun');
}

// Load theme preference
function loadThemePreference() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    document.body.setAttribute('data-theme', savedTheme);
    if (savedTheme === 'dark') {
      const icon = document.getElementById('themeIcon');
      icon.classList.replace('fa-moon', 'fa-sun');
    }
  }
}

// Modal functions
function openModal(modalId) {
  document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('show');
}

function showAddUserModal() {
  openModal('addUserModal');
}

function showUploadUsersModal() {
  openModal('uploadUsersModal');
}

// Click outside to close modals
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('show');
  }
  
  // Close dropdowns
  if (!e.target.closest('.notification-bell') && !e.target.closest('.notifications-dropdown')) {
    document.getElementById('notificationsDropdown').style.display = 'none';
  }
  if (!e.target.closest('.header-user') && !e.target.closest('.user-menu-dropdown')) {
    document.getElementById('userMenuDropdown').style.display = 'none';
  }
});

// Logout
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  window.location.href = 'index.html';
}
// Utility functions
function formatDate(dateString) {
  const options = { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return new Date(dateString).toLocaleDateString('en-US', options);
}

function formatDateShort(dateString) {
  const options = { month: 'short', day: 'numeric', year: 'numeric' };
  return new Date(dateString).toLocaleDateString('en-US', options);
}

function getRelativeTime(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)} weeks ago`;
  
  return formatDateShort(dateString);
}

function getDaysRemaining(expiryDate) {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Show loading overlay
function showLoading() {
  document.getElementById('loadingOverlay').style.display = 'flex';
}

// Hide loading overlay
function hideLoading() {
  document.getElementById('loadingOverlay').style.display = 'none';
}

// Show toast notification
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle'
  };
  
  toast.innerHTML = `
    <i class="fas ${icons[type]}"></i>
    <span>${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">
      <i class="fas fa-times"></i>
    </button>
  `;
  
  container.appendChild(toast);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.animation = 'slideOut 0.3s ease forwards';
      setTimeout(() => {
        if (toast.parentElement) {
          toast.remove();
        }
      }, 300);
    }
  }, 5000);
}

// Update notification count
function updateNotificationCount() {
  const count = document.getElementById('notificationCount');
  const currentCount = parseInt(count.textContent) || 0;
  count.textContent = currentCount + 1;
  
  // Add notification to list
  addNotificationToList({
    title: 'New Notice',
    message: 'A new notice has been posted',
    time: new Date()
  });
}

// Add notification to the dropdown list
function addNotificationToList(notification) {
  const list = document.getElementById('notificationsList');
  const noNotifications = list.querySelector('.no-notifications');
  
  if (noNotifications) {
    noNotifications.remove();
  }
  
  const notificationItem = document.createElement('div');
  notificationItem.className = 'notification-item unread';
  notificationItem.innerHTML = `
    <h5>${notification.title}</h5>
    <p>${notification.message}</p>
    <time>${getRelativeTime(notification.time)}</time>
  `;
  
  list.insertBefore(notificationItem, list.firstChild);
}

// Clear all notifications
function clearNotifications() {
  const list = document.getElementById('notificationsList');
  list.innerHTML = '<p class="no-notifications">No new notifications</p>';
  document.getElementById('notificationCount').textContent = '0';
}

// Edit notice function
async function editNotice(noticeId) {
  showLoading();
  
  try {
    const notice = await fetchWithAuth(`/notices/${noticeId}`);
    
    // Populate form with existing data
    document.getElementById('noticeTitle').value = notice.title;
    document.getElementById('noticeContent').value = notice.content;
    document.getElementById('targetAudience').value = notice.targetAudience;
    document.getElementById('noticeCategory').value = notice.category;
    document.getElementById('noticePriority').value = notice.priority;
    document.getElementById('expiryDays').value = notice.expiryDays || 7;
    document.getElementById('isPinned').checked = notice.isPinned;
    
    // Set tags
    document.querySelectorAll('input[name="tags"]').forEach(checkbox => {
      checkbox.checked = notice.tags.includes(checkbox.value);
    });
    
    // Change form to edit mode
    const form = document.getElementById('createNoticeForm');
    form.dataset.editId = noticeId;
    form.dataset.mode = 'edit';
    
    // Update button text
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Notice';
    
    // Show page header update
    document.querySelector('#createPage .page-header h2').textContent = 'Edit Notice';
    
    showPage('create');
    
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

// Reset create form to add mode
function resetCreateForm() {
  const form = document.getElementById('createNoticeForm');
  form.reset();
  delete form.dataset.editId;
  form.dataset.mode = 'create';
  
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Publish Notice';
  
  document.querySelector('#createPage .page-header h2').textContent = 'Create New Notice';
  
  // Reset file list
  document.getElementById('fileList').innerHTML = '';
  
  // Reset tags to default
  document.querySelectorAll('input[name="tags"]').forEach(checkbox => {
    checkbox.checked = checkbox.value === 'all';
  });
}

// Update create notice form handler to support edit
const originalFormHandler = document.getElementById('createNoticeForm');
originalFormHandler.removeEventListener('submit', () => {});

document.getElementById('createNoticeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  showLoading();
  
  try {
    const form = e.target;
    const formData = new FormData(form);
    const isEdit = form.dataset.mode === 'edit';
    const noticeId = form.dataset.editId;
    
    // Get selected tags
    const tags = [];
    document.querySelectorAll('input[name="tags"]:checked').forEach(cb => {
      tags.push(cb.value);
    });
    
    if (tags.length === 0) {
      showToast('Please select at least one tag', 'warning');
      hideLoading();
      return;
    }
    
    formData.delete('tags');
    formData.append('tags', tags.join(','));
    
    const endpoint = isEdit ? `/notices/${noticeId}` : '/notices';
    const method = isEdit ? 'PUT' : 'POST';
    
    await fetchWithAuth(endpoint, {
      method: method,
      body: formData,
      headers: {}
    });
    
    showToast(isEdit ? 'Notice updated successfully!' : 'Notice created successfully!', 'success');
    resetCreateForm();
    showPage('notices');
    loadNotices();
    
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
});

// Archive notice
async function archiveNotice(noticeId) {
  try {
    const data = await fetchWithAuth(`/notices/${noticeId}/archive`, {
      method: 'POST'
    });
    
    showToast(data.message, 'success');
    loadMyNotices();
    
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Download attachment
function downloadAttachment(filename, originalName) {
  const link = document.createElement('a');
  link.href = `/uploads/notices/${filename}`;
  link.download = originalName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Print notice
function printNotice() {
  const content = document.getElementById('modalNoticeBody').innerHTML;
  const title = document.getElementById('modalNoticeTitle').textContent;
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title} - Digital Notice Board</title>
      <style>
        body { 
          font-family: 'Segoe UI', Arial, sans-serif; 
          padding: 40px;
          max-width: 800px;
          margin: 0 auto;
          color: #333;
        }
        h1 {
          color: #4f46e5;
          border-bottom: 2px solid #4f46e5;
          padding-bottom: 10px;
        }
        .notice-detail-meta { 
          margin-bottom: 20px;
          display: flex;
          gap: 10px;
        }
        .notice-priority {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: bold;
        }
        .priority-urgent { background: #fef2f2; color: #dc2626; }
        .priority-high { background: #fff7ed; color: #ea580c; }
        .priority-normal { background: #f0fdf4; color: #16a34a; }
        .priority-low { background: #f1f5f9; color: #64748b; }
        .notice-tag { 
          display: inline-block; 
          padding: 4px 10px; 
          background: #818cf8; 
          color: white;
          border-radius: 20px; 
          margin-right: 5px;
          font-size: 12px;
        }
        .notice-detail-info {
          background: #f8fafc;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
        }
        .info-item {
          padding: 8px 0;
          border-bottom: 1px solid #e2e8f0;
        }
        .info-item:last-child {
          border-bottom: none;
        }
        .notice-detail-content {
          background: #f8fafc;
          padding: 20px;
          border-radius: 8px;
          line-height: 1.8;
          margin: 20px 0;
        }
        .notice-detail-actions,
        .notice-comments,
        .comment-form {
          display: none !important;
        }
        .notice-attachments {
          margin-top: 20px;
        }
        .attachment-item {
          display: inline-block;
          padding: 8px 15px;
          background: #e0e7ff;
          border-radius: 6px;
          margin: 5px;
          color: #4f46e5;
          text-decoration: none;
        }
        @media print {
          body { padding: 20px; }
        }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      ${content}
      <script>
        window.onload = function() {
          window.print();
        }
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// Share notice
async function shareNotice(noticeId, title) {
  const shareUrl = `${window.location.origin}/dashboard.html?notice=${noticeId}`;
  
  if (navigator.share) {
    try {
      await navigator.share({
        title: `Notice: ${title}`,
        text: `Check out this notice: ${title}`,
        url: shareUrl
      });
      showToast('Shared successfully!', 'success');
    } catch (error) {
      if (error.name !== 'AbortError') {
        copyToClipboard(shareUrl);
      }
    }
  } else {
    copyToClipboard(shareUrl);
  }
}

// Copy to clipboard
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Link copied to clipboard!', 'success');
  }).catch(() => {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showToast('Link copied to clipboard!', 'success');
  });
}

// Check URL for notice parameter on load
function checkUrlForNotice() {
  const urlParams = new URLSearchParams(window.location.search);
  const noticeId = urlParams.get('notice');
  
  if (noticeId) {
    viewNotice(noticeId);
    // Clear the URL parameter
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

// Export notices to CSV (for HOD)
async function exportNoticesToCSV() {
  showLoading();
  
  try {
    const data = await fetchWithAuth('/notices?limit=1000');
    const notices = data.notices;
    
    if (notices.length === 0) {
      showToast('No notices to export', 'warning');
      return;
    }
    
    // Create CSV content
    const headers = ['Title', 'Author', 'Category', 'Priority', 'Tags', 'Target', 'Created', 'Expires', 'Views', 'Acknowledgements'];
    const rows = notices.map(notice => [
      `"${notice.title.replace(/"/g, '""')}"`,
      notice.authorName,
      notice.category,
      notice.priority,
      notice.tags.join('; '),
      notice.targetAudience,
      formatDateShort(notice.createdAt),
      formatDateShort(notice.expiryDate),
      notice.views?.length || 0,
      notice.acknowledgements?.length || 0
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    
    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `notices_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Notices exported successfully!', 'success');
    
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + K for search
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    document.getElementById('searchInput').focus();
  }
  
  // Escape to close modals
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.show').forEach(modal => {
      modal.classList.remove('show');
    });
    // Also close dropdowns
    document.getElementById('notificationsDropdown').style.display = 'none';
    document.getElementById('userMenuDropdown').style.display = 'none';
  }
  
  // Ctrl/Cmd + N for new notice (if faculty/hod)
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    if (currentUser && (currentUser.role === 'faculty' || currentUser.role === 'hod')) {
      e.preventDefault();
      resetCreateForm();
      showPage('create');
    }
  }
});

// Handle tag selection logic
document.querySelectorAll('input[name="tags"]').forEach(checkbox => {
  checkbox.addEventListener('change', (e) => {
    const allCheckbox = document.querySelector('input[name="tags"][value="all"]');
    const otherCheckboxes = document.querySelectorAll('input[name="tags"]:not([value="all"])');
    
    if (e.target.value === 'all' && e.target.checked) {
      // If "all" is checked, uncheck others
      otherCheckboxes.forEach(cb => cb.checked = false);
    } else if (e.target.value !== 'all' && e.target.checked) {
      // If any specific tag is checked, uncheck "all"
      allCheckbox.checked = false;
    }
    
    // Ensure at least one is checked
    const anyChecked = document.querySelectorAll('input[name="tags"]:checked').length > 0;
    if (!anyChecked) {
      allCheckbox.checked = true;
    }
  });
});

// File upload drag and drop
const fileUpload = document.querySelector('.file-upload');
if (fileUpload) {
  fileUpload.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileUpload.classList.add('dragover');
  });
  
  fileUpload.addEventListener('dragleave', () => {
    fileUpload.classList.remove('dragover');
  });
  
  fileUpload.addEventListener('drop', (e) => {
    e.preventDefault();
    fileUpload.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    const input = document.getElementById('attachments');
    
    // Create a new FileList-like object
    const dataTransfer = new DataTransfer();
    
    // Add existing files
    if (input.files) {
      Array.from(input.files).forEach(file => dataTransfer.items.add(file));
    }
    
    // Add new files
    Array.from(files).forEach(file => dataTransfer.items.add(file));
    
    input.files = dataTransfer.files;
    
    // Update file list display
    updateFileList(input.files);
  });
}

// Update file list display
function updateFileList(files) {
  const fileList = document.getElementById('fileList');
  
  if (!files || files.length === 0) {
    fileList.innerHTML = '';
    return;
  }
  
  fileList.innerHTML = Array.from(files).map((file, index) => `
    <div class="file-item">
      <i class="fas ${getFileIcon(file.type)}"></i>
      <span>${file.name}</span>
      <span class="file-size">(${formatFileSize(file.size)})</span>
      <button type="button" onclick="removeFile(${index})" class="file-remove">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `).join('');
}

// Get file icon based on type
function getFileIcon(mimeType) {
  if (mimeType.startsWith('image/')) return 'fa-file-image';
  if (mimeType === 'application/pdf') return 'fa-file-pdf';
  if (mimeType.includes('word')) return 'fa-file-word';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'fa-file-excel';
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'fa-file-powerpoint';
  return 'fa-file';
}

// Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Remove file from list
function removeFile(index) {
  const input = document.getElementById('attachments');
  const dataTransfer = new DataTransfer();
  
  Array.from(input.files).forEach((file, i) => {
    if (i !== index) {
      dataTransfer.items.add(file);
    }
  });
  
  input.files = dataTransfer.files;
  updateFileList(input.files);
}

// Initialize file input change handler
document.getElementById('attachments').addEventListener('change', (e) => {
  updateFileList(e.target.files);
});

// Auto-refresh notices every 5 minutes
let autoRefreshInterval;

function startAutoRefresh() {
  autoRefreshInterval = setInterval(() => {
    const activePage = document.querySelector('.page.active');
    if (activePage && activePage.id === 'noticesPage') {
      loadNotices(currentPage);
    }
  }, 5 * 60 * 1000); // 5 minutes
}

function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
  }
}

// Start auto-refresh when page loads
startAutoRefresh();

// Stop auto-refresh when page is hidden, restart when visible
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopAutoRefresh();
  } else {
    startAutoRefresh();
    // Also refresh notices when tab becomes visible
    const activePage = document.querySelector('.page.active');
    if (activePage && activePage.id === 'noticesPage') {
      loadNotices(currentPage);
    }
  }
});

// Handle browser back/forward buttons
window.addEventListener('popstate', (e) => {
  if (e.state && e.state.page) {
    showPage(e.state.page);
  }
});

// Update showPage to handle browser history
const originalShowPage = showPage;
showPage = function(pageName) {
  // Push state to history
  if (window.history.state?.page !== pageName) {
    window.history.pushState({ page: pageName }, '', `#${pageName}`);
  }
  
  // Call original function
  originalShowPage(pageName);
};

// Check for hash on page load
function checkHashOnLoad() {
  const hash = window.location.hash.slice(1);
  if (hash && ['notices', 'bookmarks', 'create', 'my-notices', 'analytics', 'manage-users', 'settings'].includes(hash)) {
    showPage(hash);
  }
}

// Initialize tooltips for elements with title attribute
function initTooltips() {
  document.querySelectorAll('[data-tooltip]').forEach(el => {
    el.addEventListener('mouseenter', (e) => {
      const tooltip = document.createElement('div');
      tooltip.className = 'tooltip';
      tooltip.textContent = e.target.dataset.tooltip;
      document.body.appendChild(tooltip);
      
      const rect = e.target.getBoundingClientRect();
      tooltip.style.top = `${rect.top - tooltip.offsetHeight - 8}px`;
      tooltip.style.left = `${rect.left + (rect.width - tooltip.offsetWidth) / 2}px`;
      
      e.target._tooltip = tooltip;
    });
    
    el.addEventListener('mouseleave', (e) => {
      if (e.target._tooltip) {
        e.target._tooltip.remove();
        delete e.target._tooltip;
      }
    });
  });
}

// Service Worker registration for PWA support (optional)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Uncomment to enable service worker
    // navigator.serviceWorker.register('/sw.js')
    //   .then(reg => console.log('Service Worker registered'))
    //   .catch(err => console.log('Service Worker registration failed'));
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  checkHashOnLoad();
  checkUrlForNotice();
  initTooltips();
});

// Console welcome message
console.log('%c🎓 Digital Notice Board', 'font-size: 24px; font-weight: bold; color: #4f46e5;');
console.log('%cWelcome to the Digital Notice Board System!', 'font-size: 14px; color: #64748b;');
console.log('%cKeyboard Shortcuts:', 'font-size: 12px; font-weight: bold; color: #10b981;');
console.log('%c  Ctrl+K - Search\n  Ctrl+N - New Notice\n  Escape - Close Modals', 'font-size: 12px; color: #64748b;');

/* ===== Additional Styles for Complete Features ===== */

/* File Upload Drag Over State */
.file-upload.dragover {
  border-color: var(--primary-color);
  background: rgba(79, 70, 229, 0.1);
}

/* File Item Styles */
.file-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 15px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  font-size: 13px;
}

.file-item i {
  color: var(--primary-color);
  font-size: 16px;
}

.file-size {
  color: var(--text-muted);
  font-size: 11px;
}

.file-remove {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--danger-color);
  cursor: pointer;
  padding: 5px;
  border-radius: 4px;
  transition: var(--transition);
}

.file-remove:hover {
  background: rgba(239, 68, 68, 0.1);
}

/* Toast Close Button */
.toast-close {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 5px;
  margin-left: auto;
  opacity: 0.7;
  transition: var(--transition);
}

.toast-close:hover {
  opacity: 1;
}

/* Notification Item */
.notification-item {
  padding: 15px 20px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: var(--transition);
}

.notification-item:hover {
  background: var(--bg-tertiary);
}

.notification-item.unread {
  background: rgba(79, 70, 229, 0.05);
  border-left: 3px solid var(--primary-color);
}

.notification-item h5 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 5px;
  color: var(--text-primary);
}

.notification-item p {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 5px;
}

.notification-item time {
  font-size: 11px;
  color: var(--text-muted);
}

/* Tooltip Styles */
.tooltip {
  position: fixed;
  background: var(--text-primary);
  color: var(--bg-secondary);
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 12px;
  z-index: 10000;
  pointer-events: none;
  white-space: nowrap;
  box-shadow: var(--shadow-lg);
}

.tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: var(--text-primary);
}

/* Slide Out Animation */
@keyframes slideOut {
  to {
    transform: translateX(120%);
    opacity: 0;
  }
}

/* Expired Badge in Modal */
.expired-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  background: #fef2f2;
  color: #dc2626;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

/* Expiry Warning */
.expiry-warning {
  color: var(--warning-color);
  font-weight: 600;
}

.expiry-danger {
  color: var(--danger-color);
  font-weight: 600;
}

/* Print Button in Modal */
.notice-detail-actions .btn-print {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.notice-detail-actions .btn-print:hover {
  background: var(--border-color);
}

/* Share Button */
.notice-detail-actions .btn-share {
  background: #1DA1F2;
  color: white;
}

.notice-detail-actions .btn-share:hover {
  background: #1a8cd8;
}

/* Loading dots animation */
@keyframes loadingDots {
  0%, 20% { content: '.'; }
  40% { content: '..'; }
  60%, 100% { content: '...'; }
}

.loading-text::after {
  animation: loadingDots 1.5s infinite;
  content: '';
}

/* Skeleton loading */
.skeleton {
  background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--border-color) 50%, var(--bg-tertiary) 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 4px;
}

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.skeleton-card {
  height: 250px;
  border-radius: var(--border-radius);
}

.skeleton-text {
  height: 16px;
  margin-bottom: 10px;
}

.skeleton-text.short {
  width: 60%;
}

/* Notice card hover effects */
.notice-card {
  transform: translateY(0);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.notice-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
}

/* Pulse animation for new notices */
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(79, 70, 229, 0); }
  100% { box-shadow: 0 0 0 0 rgba(79, 70, 229, 0); }
}

.notice-card.new {
  animation: pulse 2s infinite;
}

/* Quick action buttons */
.quick-actions {
  position: fixed;
  bottom: 30px;
  right: 30px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 100;
}

.quick-action-btn {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: var(--primary-color);
  color: white;
  font-size: 20px;
  cursor: pointer;
  box-shadow: var(--shadow-lg);
  transition: var(--transition);
}

.quick-action-btn:hover {
  transform: scale(1.1);
  background: var(--primary-dark);
}

.quick-action-btn.secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

/* Scroll to top button */
#scrollToTop {
  position: fixed;
  bottom: 30px;
  right: 30px;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: var(--primary-color);
  color: white;
  border: none;
  cursor: pointer;
  opacity: 0;
  visibility: hidden;
  transition: var(--transition);
  z-index: 99;
  box-shadow: var(--shadow-lg);
}

#scrollToTop.visible {
  opacity: 1;
  visibility: visible;
}

#scrollToTop:hover {
  transform: translateY(-3px);
  background: var(--primary-dark);
}

/* Empty state animations */
.empty-state i {
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

/* Success checkmark animation */
@keyframes checkmark {
  0% { stroke-dashoffset: 100; }
  100% { stroke-dashoffset: 0; }
}

.success-checkmark {
  stroke-dasharray: 100;
  stroke-dashoffset: 100;
  animation: checkmark 0.5s ease forwards;
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .quick-actions {
    bottom: 20px;
    right: 20px;
  }
  
  .quick-action-btn {
    width: 50px;
    height: 50px;
    font-size: 18px;
  }
  
  .toast-container {
    left: 10px;
    right: 10px;
    bottom: 10px;
  }
  
  .toast {
    width: 100%;
  }
  
  .modal-content {
    margin: 10px;
    max-height: calc(100vh - 20px);
  }
}