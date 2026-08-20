import os

from dotenv import load_dotenv

load_dotenv()

# El disco de un contenedor en Railway es efímero: se borra en cada redeploy.
# UPLOADS_DIR permite apuntar esto a un volumen persistente montado aparte;
# sin la variable, cae en app/uploads como en desarrollo local de siempre.
UPLOADS_DIR = os.getenv("UPLOADS_DIR") or os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
