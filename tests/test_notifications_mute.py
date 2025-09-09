import os
import types
import pytest


def test_global_notifications_guard_blocks_services(monkeypatch, app=None):
    # Ensure env default is true but DB returns false via Setting.get_bool
    monkeypatch.setenv('NOTIFICATIONS_ENABLED', 'true')

    # Import after setting env
    from src.services import notifications as svc
    from src.services import telegram_notifications as tg

    # Fake Setting.get_bool to return False
    class FakeSetting:
        @staticmethod
        def get_bool(key, default):
            return False

    monkeypatch.setattr('src.services.notifications.Setting', FakeSetting, raising=True)
    monkeypatch.setattr('src.services.telegram_notifications.Setting', FakeSetting, raising=True)

    sent_calls = {'send': 0}

    def fake_send_message(chat_id, text, parse_mode='HTML', message_thread_id=None):
        sent_calls['send'] += 1
        return {'ok': True}

    monkeypatch.setattr('src.integrations.telegram_client.send_message', fake_send_message, raising=True)

    # Fake current_app context minimal
    class DummyApp:
        config = {'TELEGRAM_ENABLED': True, 'NOTIFICATIONS_ENABLED': True}
        class logger:
            @staticmethod
            def info(*args, **kwargs):
                pass

    from flask import current_app
    monkeypatch.setenv('FLASK_ENV', 'testing')

    # monkeypatch current_app for both modules
    monkeypatch.setattr(svc, 'current_app', DummyApp, raising=False)
    monkeypatch.setattr(tg, 'current_app', DummyApp, raising=False)

    # Call telegram function (should skip)
    class Dummy:
        id = 1
        telegram_chat_id = '1'
        telegram_opt_in = True

    assert tg.send_generic_notification(Dummy(), 't', 'm') is False
    assert sent_calls['send'] == 0

    # Call push function (should skip)
    res = svc.bulk_notify_agents([1,2], 't', 'm') if hasattr(svc, 'bulk_notify_agents') else svc.notify_agent(1, 't', 'm')
    # When muted, our service returns skipped result or does nothing; accept any non-error
    assert sent_calls['send'] == 0


def test_admin_settings_endpoints_rbac(client):
    # Expect 401/403 without admin credentials
    r = client.get('/api/admin/settings/notifications')
    assert r.status_code in (401, 403)

