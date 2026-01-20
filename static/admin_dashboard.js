// Admin Dashboard JavaScript

let hourlyChart = null;
let projectChart = null;

async function loadAnalytics() {
    try {
        const response = await fetch('/admin/analytics');
        const data = await response.json();
        
        // Update stats cards
        document.getElementById('total-hours').textContent = 
            data.total_hours_formatted || '0s';
        document.getElementById('total-sessions').textContent = 
            data.total_sessions;
        document.getElementById('active-users').textContent = 
            Object.keys(data.user_stats).length;
        document.getElementById('total-projects').textContent = 
            Object.keys(data.project_stats).length;
        
        // Update charts
        updateHourlyChart(data.hourly_activity_hours || {});
        updateProjectChart(data.project_stats);
        
        // Update user activity
        updateUserActivity(data.user_stats);
        
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

function updateHourlyChart(hourlyData) {
    const ctx = document.getElementById('hourlyChart').getContext('2d');
    
    // Create hours array (0-23)
    const hours = Array.from({length: 24}, (_, i) => i);
    
    // Get data for each hour, default to 0
    const data = hours.map(hour => {
        const hourKey = hour.toString();
        return hourlyData[hourKey] || 0;
    });
    
    if (hourlyChart) {
        hourlyChart.destroy();
    }
    
    hourlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: hours.map(h => {
                if (h === 0) return '12 AM';
                if (h < 12) return `${h} AM`;
                if (h === 12) return '12 PM';
                return `${h-12} PM`;
            }),
            datasets: [{
                label: 'Hours',
                data: data,
                backgroundColor: 'rgba(16, 185, 129, 0.3)',
                borderColor: '#10b981',
                borderWidth: 1,
                borderRadius: 4,
                hoverBackgroundColor: 'rgba(16, 185, 129, 0.5)'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            if (value < 0.1) {
                                const minutes = value * 60;
                                const seconds = Math.round(minutes * 60);
                                return `${seconds}s`;
                            } else if (value < 1) {
                                const minutes = Math.round(value * 60 * 10) / 10;
                                return `${minutes}m`;
                            }
                            return `${value.toFixed(2)}h`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Hours',
                        font: {
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        callback: function(value) {
                            if (value < 0.1) {
                                const minutes = value * 60;
                                const seconds = Math.round(minutes * 60);
                                return `${seconds}s`;
                            } else if (value < 1) {
                                const minutes = Math.round(value * 60 * 10) / 10;
                                return `${minutes}m`;
                            }
                            return `${value}h`;
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Hour of Day',
                        font: {
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        maxRotation: 45
                    }
                }
            }
        }
    });
}

function updateProjectChart(projectData) {
    const ctx = document.getElementById('projectChart').getContext('2d');
    
    const projects = Object.keys(projectData);
    const hours = projects.map(project => {
        const seconds = projectData[project].total_seconds || 0;
        return seconds / 3600; // Convert to hours
    });
    
    // Generate colors
    const colors = generateColors(projects.length);
    
    if (projectChart) {
        projectChart.destroy();
    }
    
    projectChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: projects,
            datasets: [{
                data: hours,
                backgroundColor: colors,
                borderWidth: 1,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const seconds = value * 3600;
                            
                            if (seconds < 60) {
                                return `${context.label}: ${Math.round(seconds)}s`;
                            } else if (seconds < 3600) {
                                const minutes = Math.round(seconds / 60);
                                return `${context.label}: ${minutes}m`;
                            } else if (value < 1) {
                                const minutes = Math.round(value * 60 * 10) / 10;
                                return `${context.label}: ${minutes}m`;
                            }
                            return `${context.label}: ${value.toFixed(2)}h`;
                        }
                    }
                }
            }
        }
    });
}

function generateColors(count) {
    const colors = [
        '#8b5cf6', '#10b981', '#3b82f6', '#f59e0b', 
        '#ef4444', '#ec4899', '#06b6d4', '#84cc16',
        '#f97316', '#64748b', '#a855f7', '#0ea5e9'
    ];
    
    // If we need more colors than available, generate some
    if (count <= colors.length) {
        return colors.slice(0, count);
    }
    
    // Generate additional colors
    const generated = [...colors];
    for (let i = colors.length; i < count; i++) {
        const hue = (i * 137.508) % 360; // Golden angle approximation
        generated.push(`hsl(${hue}, 70%, 65%)`);
    }
    return generated;
}

function updateUserActivity(userStats) {
    const tbody = document.getElementById('user-activity-body');
    const users = Object.entries(userStats);
    
    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    No user activity yet
                </td>
            </tr>
        `;
        return;
    }
    
    // Sort users by total time (descending)
    users.sort((a, b) => {
        return (b[1].total_seconds || 0) - (a[1].total_seconds || 0);
    });
    
    tbody.innerHTML = users.map(([userId, stats]) => {
        const totalTime = stats.total_time_formatted || formatDurationFromSeconds(stats.total_seconds || 0);
        const sessions = stats.sessions || 0;
        const lastActive = stats.last_active;
        
        return `
        <tr>
            <td>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div style="width: 8px; height: 8px; background: #10b981; border-radius: 50%;"></div>
                    <div>
                        <strong>User ${userId}</strong>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">
                            ${stats.sessions || 0} session${stats.sessions !== 1 ? 's' : ''}
                        </div>
                    </div>
                </div>
            </td>
            <td>
                <span style="font-weight: 600; color: var(--text-primary);">
                    ${totalTime}
                </span>
                ${stats.total_hours_decimal ? `
                    <div style="font-size: 0.8rem; color: var(--text-muted);">
                        (${stats.total_hours_decimal}h)
                    </div>
                ` : ''}
            </td>
            <td>
                <span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #6366f1; padding: 0.25rem 0.75rem; border-radius: 0.375rem;">
                    ${sessions} session${sessions !== 1 ? 's' : ''}
                </span>
            </td>
            <td>
                ${formatDate(lastActive) || '<span style="color: var(--text-muted);">Never</span>'}
            </td>
            <td>
                <span class="status-badge ${isUserActive(lastActive) ? 'status-active' : 'status-inactive'}">
                    ${isUserActive(lastActive) ? '● Active' : '○ Inactive'}
                </span>
            </td>
        </tr>
        `;
    }).join('');
}

function formatDurationFromSeconds(seconds) {
    if (!seconds || seconds === 0) return "0s";
    
    seconds = Math.round(seconds);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

function isUserActive(lastActive) {
    if (!lastActive) return false;
    
    const lastActiveDate = new Date(lastActive);
    const now = new Date();
    const diffHours = (now - lastActiveDate) / (1000 * 60 * 60);
    
    return diffHours < 1; // Active if last activity was less than 1 hour ago
}

function formatDate(isoString) {
    if (!isoString) return null;
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = diffMs / (1000 * 60);
    const diffHours = diffMinutes / 60;
    const diffDays = diffHours / 24;
    
    if (diffMinutes < 1) {
        return 'Just now';
    } else if (diffMinutes < 60) {
        return `${Math.floor(diffMinutes)}m ago`;
    } else if (diffHours < 24) {
        return `${Math.floor(diffHours)}h ago`;
    } else if (diffDays < 7) {
        return `${Math.floor(diffDays)}d ago`;
    } else {
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
        });
    }
}

async function loadNotifications() {
    try {
        const response = await fetch('/admin/notifications');
        const notifications = await response.json();
        displayNotifications(notifications);
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

function displayNotifications(notifications) {
    const container = document.getElementById('notifications-list');
    
    if (notifications.length === 0) {
        container.innerHTML = `
            <div class="notification-item">
                <div class="notification-content">
                    <div class="notification-title">No notifications yet</div>
                    <div class="notification-message">Notifications will appear here when users start/stop timers</div>
                </div>
            </div>
        `;
        return;
    }
    
    // Show newest first
    notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    container.innerHTML = notifications.map(notif => `
        <div class="notification-item ${notif.read ? '' : 'unread'}">
            <div class="notification-icon ${notif.type}">
                ${getNotificationIcon(notif.type)}
            </div>
            <div class="notification-content">
                <div class="notification-title">
                    <strong>${notif.title}</strong>
                    ${notif.read ? '' : '<span class="unread-badge">NEW</span>'}
                </div>
                <div class="notification-message">${notif.message}</div>
                <div class="notification-time">${formatDate(notif.timestamp)}</div>
            </div>
            ${!notif.read ? `
                <button onclick="markAsRead(${notif.id})" class="btn-mark-read">
                    Mark as read
                </button>
            ` : ''}
        </div>
    `).join('');
}

function getNotificationIcon(type) {
    const icons = {
        'timer': '⏱️',
        'success': '✅',
        'info': 'ℹ️',
        'warning': '⚠️'
    };
    return icons[type] || '📨';
}

async function markAsRead(notificationId) {
    try {
        await fetch(`/admin/notifications/${notificationId}/read`, {
            method: 'POST'
        });
        loadNotifications();
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

async function markAllAsRead() {
    try {
        await fetch('/admin/notifications/read-all', {
            method: 'POST'
        });
        loadNotifications();
    } catch (error) {
        console.error('Error marking all as read:', error);
    }
}

// Initialize real-time updates
function initializeAdminStreams() {
    // Analytics stream
    const analyticsSource = new EventSource("/admin/analytics/stream");
    analyticsSource.onmessage = function(e) {
        const data = JSON.parse(e.data);
        if (data.type === 'analytics_update') {
            loadAnalytics();
            showNotification('Analytics updated', 'info');
        }
    };
    
    // Notifications stream
    const notifSource = new EventSource("/admin/notifications/stream");
    notifSource.onmessage = function(e) {
        const data = JSON.parse(e.data);
        if (data.type === 'notification_update') {
            loadNotifications();
            showNotification(data.message, 'info');
        }
    };
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 2rem;
        right: 2rem;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 
                     type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 
                     'rgba(99, 102, 241, 0.2)'};
        color: ${type === 'success' ? '#10b981' : 
                type === 'error' ? '#ef4444' : 
                '#6366f1'};
        border: 1px solid ${type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 
                          type === 'error' ? 'rgba(239, 68, 68, 0.4)' : 
                          'rgba(99, 102, 241, 0.4)'};
        border-radius: 0.5rem;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
        font-weight: 500;
        backdrop-filter: blur(10px);
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadAnalytics();
    loadNotifications();
    initializeAdminStreams();
    
    // Refresh data every 30 seconds
    setInterval(() => {
        loadAnalytics();
        loadNotifications();
    }, 30000);
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateX(20px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes fadeOut {
        from {
            opacity: 1;
        }
        to {
            opacity: 0;
        }
    }
    
    .status-inactive {
        background: rgba(107, 114, 128, 0.15);
        color: #6b7280;
    }
`;
document.head.appendChild(style);