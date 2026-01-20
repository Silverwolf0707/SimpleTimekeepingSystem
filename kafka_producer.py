from kafka import KafkaProducer
import json
from datetime import datetime, timezone
from kafka_config import KAFKA_BOOTSTRAP_SERVERS, KAFKA_TOPIC

producer = KafkaProducer(
    bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
    value_serializer=lambda v: json.dumps(v).encode('utf-8')
)

def send_event(event_type, payload, topic=KAFKA_TOPIC):
    event = {
        "event_type": event_type,
        "payload": payload,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    producer.send(topic, event)
    producer.flush()
