from kafka import KafkaConsumer
import json
from kafka_config import KAFKA_BOOTSTRAP_SERVERS, KAFKA_TOPIC
from datetime import datetime, timezone
from pathlib import Path
import json as json_lib

NOTIFICATION_DB = Path("notifications.json")

def load_notifications():
    if NOTIFICATION_DB.exists():
        with open(NOTIFICATION_DB, "r") as f:
            return json_lib.load(f)
    return []

def save_notifications(notifications):
    with open(NOTIFICATION_DB, "w") as f:
        json_lib.dump(notifications[-100:], f, indent=4)  # Keep last 100 notifications

notification_consumer = KafkaConsumer(
    KAFKA_TOPIC,
    bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
    auto_offset_reset='earliest',
    enable_auto_commit=True,
    group_id='notification-group',
    value_deserializer=lambda x: json.loads(x.decode('utf-8'))
)

print("📨 Notification Consumer started...")

for message in notification_consumer:
    event = message.value
    notifications = load_notifications()
    
    payload = event.get('payload', {})
    event_type = event['event_type']
    
    notification = {
        'id': len(notifications) + 1,
        'type': 'info',
        'title': '',
        'message': '',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'read': False,
        'data': payload
    }
    
    if event_type == 'TIMER_STARTED':
        notification['type'] = 'timer'
        notification['title'] = 'Timer Started'
        notification['message'] = f"User {payload.get('user_id')} started working on: {payload.get('description', 'Unknown task')}"
        
    elif event_type == 'TIMER_STOPPED':
        notification['type'] = 'success'
        notification['title'] = 'Timer Stopped'
        notification['message'] = f"User {payload.get('user_id')} completed a timer session"
    
    notifications.append(notification)
    save_notifications(notifications)
    print(f"📨 Notification created: {notification['message']}")