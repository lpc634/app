from flask import Flask
from src.models import db
from src.routes.auth import auth_bp

def create_app():
    app = Flask(__name__)
    app.config.from_object("src.config.Config")

    db.init_app(app)
    app.register_blueprint(auth_bp, url_prefix='/auth')

    return app
