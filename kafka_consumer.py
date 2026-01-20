from kafka import KafkaConsumer
import json
from kafka_config import KAFKA_BOOTSTRAP_SERVERS, KAFKA_TOPIC
from db_handler import load_entries, save_entries
from datetime import datetime, timezone

consumer = KafkaConsumer(
    KAFKA_TOPIC,
    bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
    auto_offset_reset='earliest',
    enable_auto_commit=True,
    group_id='timekeeping-group',
    value_deserializer=lambda x: json.loads(x.decode('utf-8'))
)

print("Kafka Consumer started...")

for message in consumer:
    event = message.value
    print("📥 EVENT RECEIVED:", event)

    entries = load_entries()
    payload = event.get('payload', {})

    if event['event_type'] == 'TIMER_STARTED':
        if not any(e['id'] == payload['id'] for e in entries):
            entries.append(payload)

    elif event['event_type'] == 'TIMER_STOPPED':
        for e in entries:
            if e['id'] == payload['id']:
                e['status'] = 'stopped'

                start = datetime.fromisoformat(e['start_time'])
                if start.tzinfo is None:
                    start = start.replace(tzinfo=timezone.utc)

                end_time_str = payload.get('end_time')
                end = datetime.fromisoformat(end_time_str)
                if end.tzinfo is None:
                    end = end.replace(tzinfo=timezone.utc)

                e['end_time'] = end.isoformat()

                duration_seconds = (end - start).total_seconds()
                e['duration'] = int(duration_seconds) 
                break

    save_entries(entries)
