from flask import Flask, render_template, request, redirect, url_for, session, jsonify, Response, stream_with_context
from kafka_producer import send_event
import time
import json
from pathlib import Path

app = Flask(__name__)
app.secret_key = 'supersecretkey'

USERS = {
    "admin": {"username": "admin", "password": "admin123", "role": "admin", "id": 1},
    "user": {"username": "user", "password": "user123", "role": "user", "id": 2}
}

def format_duration(seconds):
    """Convert seconds to human-readable format"""
    if not seconds:
        return "0s"
    
    seconds = int(seconds)
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    
    if hours > 0:
        return f"{hours}h {minutes}m {secs}s"
    elif minutes > 0:
        return f"{minutes}m {secs}s"
    else:
        return f"{secs}s"

def format_duration_decimal(seconds):
    """Convert seconds to decimal hours with 2 decimal places"""
    if not seconds:
        return 0.0
    return round(seconds / 3600, 2)

@app.route('/', methods=['GET', 'POST'])
def login():
    error = None
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        user = USERS.get(username)
        if user and user['password'] == password:
            # Add username to session user dict for template access
            session['user'] = {
                'username': username,
                'role': user['role'],
                'id': user['id']
            }
            
            # Redirect based on role
            if user['role'] == 'admin':
                return redirect(url_for('admin_dashboard'))
            else:
                return redirect(url_for('dashboard'))
        error = "Invalid username or password"
    return render_template('login.html', error=error)

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/dashboard')
def dashboard():
    user = session.get('user')
    if not user:
        return redirect(url_for('login'))
    return render_template('dashboard.html', user=user)

@app.route('/admin')
def admin_dashboard():
    user = session.get('user')
    if not user:
        return redirect(url_for('login'))
    
    # Check if user is admin
    if user['role'] != 'admin':
        # Redirect non-admin users to regular dashboard
        return redirect(url_for('dashboard'))
    
    return render_template('admin_dashboard.html', user=user)

# Add navigation endpoint for switching between dashboards
@app.route('/switch-dashboard')
def switch_dashboard():
    user = session.get('user')
    if not user:
        return redirect(url_for('login'))
    
    if user['role'] == 'admin':
        # If on admin dashboard, go to user dashboard, and vice versa
        current_route = request.args.get('from', 'user')
        if current_route == 'admin':
            return redirect(url_for('dashboard'))
        else:
            return redirect(url_for('admin_dashboard'))
    else:
        return redirect(url_for('dashboard'))

ENTRY_COUNTER = 1

@app.route('/timer/start', methods=['POST'])
def start_timer():
    global ENTRY_COUNTER
    user = session.get('user')
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json
    entry = {
        'id': ENTRY_COUNTER,
        'user_id': user['id'],
        'description': data.get('description', ''),
        'project': data.get('project', 'General'),
        'start_time': __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
        'end_time': None,
        'duration': 0, 
        'status': 'active'
    }
    ENTRY_COUNTER += 1

    send_event("TIMER_STARTED", entry)

    return jsonify({'success': True, 'entry': entry})

@app.route('/timer/stop/<int:entry_id>', methods=['POST'])
def stop_timer(entry_id):
    user = session.get('user')
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    stop_time = __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()
    send_event("TIMER_STOPPED", {"id": entry_id, "user_id": user['id'], "end_time": stop_time})

    return jsonify({'success': True})

@app.route('/entries/stream')
def stream_entries():
    def event_stream():
        last_entries = []
        while True:
            from db_handler import load_entries
            entries = load_entries()
            if entries != last_entries:
                last_entries = entries
                yield f"data: {json.dumps(entries)}\n\n"
            time.sleep(1)
    return Response(stream_with_context(event_stream()), mimetype='text/event-stream')

# Admin API routes
@app.route('/admin/analytics')
def get_analytics():
    user = session.get('user')
    if not user or user['role'] != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
    
    from db_handler import load_entries
    entries = load_entries()
    
    # Load analytics from file
    analytics_file = Path("analytics.json")
    if analytics_file.exists():
        with open(analytics_file, "r") as f:
            analytics = json.load(f)
    else:
        # Calculate basic analytics if file doesn't exist
        total_seconds = sum(e.get('duration', 0) for e in entries)
        analytics = {
            'total_seconds': total_seconds,
            'total_sessions': len(entries),
            'user_stats': {},
            'project_stats': {},
            'hourly_activity': {},
            'daily_stats': {}
        }
    
    # Add formatted versions for frontend
    analytics['total_hours_formatted'] = format_duration(analytics.get('total_seconds', 0))
    analytics['total_hours_decimal'] = format_duration_decimal(analytics.get('total_seconds', 0))
    
    # Format user stats
    for user_id, stats in analytics.get('user_stats', {}).items():
        stats['total_time_formatted'] = format_duration(stats.get('total_seconds', 0))
        stats['total_hours_decimal'] = format_duration_decimal(stats.get('total_seconds', 0))
    
    # Format project stats
    for project, stats in analytics.get('project_stats', {}).items():
        stats['total_time_formatted'] = format_duration(stats.get('total_seconds', 0))
        stats['total_hours_decimal'] = format_duration_decimal(stats.get('total_seconds', 0))
    
    # Format daily stats
    for date, stats in analytics.get('daily_stats', {}).items():
        stats['time_formatted'] = format_duration(stats.get('seconds', 0))
        stats['hours_decimal'] = format_duration_decimal(stats.get('seconds', 0))
    
    # Format hourly activity for chart
    hourly_data = {}
    for hour_str, seconds in analytics.get('hourly_activity', {}).items():
        hourly_data[hour_str] = seconds / 3600  # Convert to hours for chart
    
    analytics['hourly_activity_hours'] = hourly_data
    
    return jsonify(analytics)

@app.route('/admin/notifications')
def get_notifications():
    user = session.get('user')
    if not user or user['role'] != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
    
    notifications_file = Path("notifications.json")
    if notifications_file.exists():
        with open(notifications_file, "r") as f:
            notifications = json.load(f)
    else:
        notifications = []
    
    return jsonify(notifications)

@app.route('/admin/notifications/<int:notification_id>/read', methods=['POST'])
def mark_notification_read(notification_id):
    user = session.get('user')
    if not user or user['role'] != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
    
    notifications_file = Path("notifications.json")
    if notifications_file.exists():
        with open(notifications_file, "r") as f:
            notifications = json.load(f)
        
        for notif in notifications:
            if notif['id'] == notification_id:
                notif['read'] = True
                break
        
        with open(notifications_file, "w") as f:
            json.dump(notifications, f, indent=4)
    
    return jsonify({'success': True})

@app.route('/admin/notifications/read-all', methods=['POST'])
def mark_all_notifications_read():
    user = session.get('user')
    if not user or user['role'] != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
    
    notifications_file = Path("notifications.json")
    if notifications_file.exists():
        with open(notifications_file, "r") as f:
            notifications = json.load(f)
        
        for notif in notifications:
            notif['read'] = True
        
        with open(notifications_file, "w") as f:
            json.dump(notifications, f, indent=4)
    
    return jsonify({'success': True})

@app.route('/admin/analytics/stream')
def stream_analytics():
    def event_stream():
        last_analytics = None
        while True:
            analytics_file = Path("analytics.json")
            if analytics_file.exists():
                with open(analytics_file, "r") as f:
                    analytics = json.load(f)
                
                # Add formatted versions
                analytics['total_hours_formatted'] = format_duration(analytics.get('total_seconds', 0))
                
                if analytics != last_analytics:
                    last_analytics = analytics
                    yield f"data: {json.dumps({'type': 'analytics_update', 'data': analytics})}\n\n"
            time.sleep(5)
    return Response(stream_with_context(event_stream()), mimetype='text/event-stream')

@app.route('/admin/notifications/stream')
def stream_notifications():
    def event_stream():
        last_notifications = []
        while True:
            notifications_file = Path("notifications.json")
            if notifications_file.exists():
                with open(notifications_file, "r") as f:
                    notifications = json.load(f)
                
                if notifications != last_notifications:
                    last_notifications = notifications
                    unread = [n for n in notifications if not n.get('read')]
                    if unread:
                        yield f"data: {json.dumps({'type': 'notification_update', 'message': f'{len(unread)} new notifications'})}\n\n"
            time.sleep(2)
    return Response(stream_with_context(event_stream()), mimetype='text/event-stream')

if __name__ == '__main__':
    app.run(debug=True, threaded=True)