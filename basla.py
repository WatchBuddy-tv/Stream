# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from CLI          import cikis_yap, hata_yakala
from Core         import Motor
from build_assets import build_assets

if __name__ == "__main__":
    try:
        build_assets()
        Motor.basla()
        cikis_yap(False)
    except Exception as hata:
        hata_yakala(hata)
