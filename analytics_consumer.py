from kafka import KafkaConsumer
import json
from kafka_config import KAFKA_BOOTSTRAP_SERVERS, KAFKA_TOPIC
from datetime import datetime, timezone
from pathlib import Path
import json as json_lib

ANALYTICS_DB = Path("analytics.json")

def load_analytics():
    if ANALYTICS_DB.exists():
        with open(ANALYTICS_DB, "r") as f:
            return json_lib.load(f)
    return {
        'daily_stats': {},
        'user_stats': {},
        'project_stats': {},
        'hourly_activity': {},
        'total_seconds': 0,  # Store total seconds instead of hours
        'total_sessions': 0,
        'last_updated': None
    }

def save_analytics(data):
    data['last_updated'] = datetime.now(timezone.utc).isoformat()
    with open(ANALYTICS_DB, "w") as f:
        json_lib.dump(data, f, indent=4)

analytics_consumer = KafkaConsumer(
    KAFKA_TOPIC,
    bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
    auto_offset_reset='earliest',
    enable_auto_commit=True,
    group_id='analytics-group',
    value_deserializer=lambda x: json.loads(x.decode('utf-8'))
)

print("📊 Analytics Consumer started...")

for message in analytics_consumer:
    event = message.value
    analytics = load_analytics()
    
    payload = event.get('payload', {})
    event_type = event['event_type']
    
    if event_type == 'TIMER_STOPPED':
        # Find the complete entry from db_handler to get full data
        from db_handler import load_entries
        entries = load_entries()
        entry = next((e for e in entries if e['id'] == payload['id']), None)
        
        if entry and entry.get('duration', 0) > 0:
            duration_seconds = entry['duration']
            
            # Update analytics in seconds
            analytics['total_sessions'] += 1
            analytics['total_seconds'] += duration_seconds
            
            # User statistics
            user_id = entry['user_id']
            if str(user_id) not in analytics['user_stats']:
                analytics['user_stats'][str(user_id)] = {
                    'total_seconds': 0,
                    'sessions': 0,
                    'last_active': None
                }
            analytics['user_stats'][str(user_id)]['total_seconds'] += duration_seconds
            analytics['user_stats'][str(user_id)]['sessions'] += 1
            analytics['user_stats'][str(user_id)]['last_active'] = entry.get('end_time')
            
            # Project statistics
            project = entry['project']
            if project not in analytics['project_stats']:
                analytics['project_stats'][project] = {
                    'total_seconds': 0,
                    'sessions': 0,
                    'users': []
                }
            
            analytics['project_stats'][project]['total_seconds'] += duration_seconds
            analytics['project_stats'][project]['sessions'] += 1
            
            # Add user to users list if not already there
            if user_id not in analytics['project_stats'][project]['users']:
                analytics['project_stats'][project]['users'].append(user_id)
            
            # Daily statistics
            date = entry['start_time'][:10]  # YYYY-MM-DD
            if date not in analytics['daily_stats']:
                analytics['daily_stats'][date] = {
                    'seconds': 0,
                    'sessions': 0
                }
            analytics['daily_stats'][date]['seconds'] += duration_seconds
            analytics['daily_stats'][date]['sessions'] += 1
            
            # Hourly activity (store in seconds)
            try:
                hour = datetime.fromisoformat(entry['start_time']).hour
                hour_key = str(hour)
                analytics['hourly_activity'][hour_key] = analytics['hourly_activity'].get(hour_key, 0) + duration_seconds
            except (ValueError, KeyError):
                # Skip if can't parse time
                pass
    
    save_analytics(analytics)
    print(f"📊 Analytics updated: {event_type}")