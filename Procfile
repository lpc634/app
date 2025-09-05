web: gunicorn main:app --bind 0.0.0.0:$PORT --workers 2 --timeout 60
release: FLASK_APP=main.py flask db upgrade