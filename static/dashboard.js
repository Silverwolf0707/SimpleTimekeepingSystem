async function startTimer() {
    const description = document.getElementById('description').value;
    const project = document.getElementById('project').value;
    
    if (!description.trim()) {
        showNotification('Please enter a description', 'warning');
        return;
    }
    
    const startBtn = document.getElementById('start-btn');
    startBtn.disabled = true;
    startBtn.innerHTML = '<span>Starting...</span>';
    
    try {
        const response = await fetch('/timer/start', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({description, project})
        });
        
        if (response.ok) {
            document.getElementById('description').value = '';
            showNotification('Timer started successfully! 🎉', 'success');
        }
    } catch (error) {
        showNotification('Failed to start timer', 'error');
    } finally {
        startBtn.disabled = false;
        startBtn.innerHTML = '<span>Start Timer</span><span style="font-size: 1.1rem;">▶</span>';
    }
}

async function stopTimer(entryId) {
    const confirmed = confirm('Stop this timer?');
    if (!confirmed) return;
    
    try {
        await fetch('/timer/stop/' + entryId, {method: 'POST'});
        showNotification('Timer stopped! ⏹️', 'success');
    } catch (error) {
        showNotification('Failed to stop timer', 'error');
    }
}

function formatDate(isoString) {
    if (!isoString) return '<span style="color: var(--text-muted);">—</span>';
    const date = new Date(isoString);
    const options = { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit'
    };
    return date.toLocaleString('en-US', options);
}

function formatDuration(seconds, status, start_time) {
    if (status === 'active' && start_time) {
        const start = new Date(start_time);
        const now = new Date();
        seconds = Math.floor((now - start) / 1000);
    }

    if (!seconds || seconds === 0) return '<span style="color: var(--text-muted);">0s</span>';
    
    // Convert to human-readable format
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `<span style="color: var(--primary-light); font-weight: 600;">${hours}h</span> 
                <span style="color: var(--text-secondary);">${minutes}m</span> 
                <span style="color: var(--text-muted);">${secs}s</span>`;
    } else if (minutes > 0) {
        return `<span style="color: var(--text-secondary); font-weight: 600;">${minutes}m</span> 
                <span style="color: var(--text-muted);">${secs}s</span>`;
    } else {
        return `<span style="color: var(--text-secondary);">${secs}s</span>`;
    }
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
        background: ${type === 'success' ? 'rgba(16, 185, 129, 0.2)' : type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'};
        color: ${type === 'success' ? '#6ee7b7' : type === 'error' ? '#fca5a5' : '#fcd34d'};
        border: 1px solid ${type === 'success' ? 'rgba(16, 185, 129, 0.4)' : type === 'error' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)'};
        border-radius: 0.5rem;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
        font-weight: 500;
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function initializeEntriesStream() {
    
    const evtSource = new EventSource("/entries/stream");
    evtSource.onmessage = function(e) {
        const entries = JSON.parse(e.data);
        const tbody = document.getElementById('entries-body');
        
        if (entries.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 3rem;">
                        <div class="empty-state">
                            <div class="empty-state-icon">📋</div>
                            <h3>No time entries yet</h3>
                            <p>Start tracking your time to see entries here</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = '';
        for (let entry of entries) {
            const tr = document.createElement('tr');
            tr.style.animation = 'fadeInUp 0.3s ease-out';
            tr.innerHTML = `
                <td><span style="font-family: monospace; font-weight: 600;">#${entry.id}</span></td>
                <td><strong style="color: var(--text-primary);">${entry.description || '<em style="color: var(--text-muted);">No description</em>'}</strong></td>
                <td>
                    <span style="background: rgba(99, 102, 241, 0.15); color: var(--primary-light); padding: 0.25rem 0.75rem; border-radius: 0.375rem; font-size: 0.85rem; font-weight: 500;">
                        ${entry.project}
                    </span>
                </td>
                <td>${formatDate(entry.start_time)}</td>
                <td>${formatDate(entry.end_time)}</td>
                <td>${formatDuration(entry.duration, entry.status, entry.start_time)}</td>
                <td>
                    <span class="status-badge ${entry.status === 'active' ? 'status-active' : 'status-completed'}">
                        ${entry.status === 'active' ? '● Live' : '✓ Done'}
                    </span>
                </td>
                <td>
                    ${entry.status === 'active' 
                        ? `<button onclick="stopTimer(${entry.id})" class="btn btn-danger btn-sm">Stop ⏹</button>` 
                        : '<span style="color: var(--text-muted); font-size: 0.85rem;">—</span>'}
                </td>
            `;
            tbody.appendChild(tr);
        }
    };
}

function initializeKeyboardShortcuts() {
    
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'Enter') {
            startTimer();
        }
    });
}


document.addEventListener('DOMContentLoaded', function() {
    initializeEntriesStream();
    initializeKeyboardShortcuts();
});
