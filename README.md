# Simple Timekeeping System

A distributed timekeeping system using Apache Kafka for processing employee check-ins/check-outs, notifications, and analytics.

## Prerequisites

- Python 3.13.2 or latest
- Java Runtime Environment 21.0.2 or latest(for Kafka)
- Apache Kafka 2.14-3.1.0 or latest
- Follow the [Apache Kafka Quickstart Guide](https://kafka.apache.org/41/getting-started/quickstart/) to install and run Kafka.

## Setup Instructions
```bash
### 1. git clone https://github.com/Silverwolf0707/SimpleTimekeepingSystem.git
```
```bash
### 2. cd timekeeping-app
```
run on separate terminals
```bash
### 3. python app.py  python kafka_consumer.py  notification_consumer.py  analytics_consumer.py
```
