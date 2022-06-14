import os
import logging

from tornado import ioloop
from tornado import httpserver
from tornado import web

from vstackboard import views
from vstackboard.common import conf


LOG = logging.getLogger('tornado.application')

CONF = conf.CONF
ROOT = os.path.dirname(os.path.abspath(__file__))
ROUTES = [
    (r'/', views.Index),
    (r'/dashboard', views.Dashboard),
    (r'/[computing|image|networking|volume](.*)',
     views.OpenstackProxy),
]


def start(develop=False):
    template_path = os.path.join(ROOT, 'templates')
    static_path = os.path.join(ROOT, 'static')
    app = web.Application(ROUTES, debug=develop, template_path=template_path,
                          static_path=static_path)

    LOG.info('Staring server ...')
    views.init()
    views.PROXY.update_auth_token()

    if develop:
        app.listen(CONF.port)
    else:
        server = httpserver.HTTPServer(app)
        server.bind(CONF.port)
        server.start(num_processes=CONF.workers)
    ioloop.IOLoop.instance().start()
