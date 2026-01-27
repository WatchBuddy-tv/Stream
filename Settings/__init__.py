# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from pathlib import Path
from yaml    import load, FullLoader
from dotenv  import load_dotenv
import os

# .env yükleme
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# AYAR.yml yükleme
with open("AYAR.yml", "r", encoding="utf-8") as yaml_dosyasi:
    AYAR = load(yaml_dosyasi, Loader=FullLoader)

# Genel ayarlar
PROJE = AYAR["PROJE"]
HOST  = AYAR["APP"]["HOST"]
PORT  = AYAR["APP"]["PORT"]
