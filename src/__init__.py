from flask import Flask
from src.extensions import db
from src.config import Config

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    db.init_app(app)

    # optionally with app.app_context():
    #     db.create_all()
    
    return app
