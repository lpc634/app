from datetime import datetime
from src.extensions import db


class AdminMessage(db.Model):
    __tablename__ = 'admin_messages'

    id = db.Column(db.Integer, primary_key=True)
    admin_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    message = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

    deliveries = db.relationship('AdminMessageDelivery', back_populates='message_ref', cascade='all, delete-orphan', lazy=True)


class AdminMessageDelivery(db.Model):
    __tablename__ = 'admin_message_deliveries'

    id = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(db.Integer, db.ForeignKey('admin_messages.id'), nullable=False, index=True)
    agent_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    status = db.Column(db.String(20), nullable=False, index=True)  # success | failed | not_linked
    telegram_message_id = db.Column(db.String(64), nullable=True)
    error = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

    message_ref = db.relationship('AdminMessage', back_populates='deliveries', lazy=True)


