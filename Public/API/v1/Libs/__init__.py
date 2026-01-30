# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from KekikStream.Core import PluginManager, ExtractorManager, MediaManager, MovieInfo, SeriesInfo
from Settings         import PROXIES

extractor_manager = ExtractorManager()
plugin_manager    = PluginManager(ex_manager=extractor_manager, proxy=PROXIES)
media_manager     = MediaManager()
