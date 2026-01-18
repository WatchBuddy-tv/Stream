# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from KekikStream.Core import PluginManager, ExtractorManager, MediaManager, MovieInfo, SeriesInfo

proxies = {
  "http"  : "http://foo:bar@kekik-sv1:3128",
  "https" : "http://foo:bar@kekik-sv1:3128",
}

plugin_manager    = PluginManager(proxy=proxies)
extractor_manager = ExtractorManager()
media_manager     = MediaManager()
