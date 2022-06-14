import argparse
import logging
import os
import sys
from pbr import version

import bs4
import requests
from urllib import parse

from easy2use.globals import cliparser
from easy2use.globals import log


LOG = logging.getLogger(__name__)

HOME = os.path.abspath(os.path.dirname(os.path.pardir))


def download_statics_for_cdn():
    from jinja2 import PackageLoader, Environment                 # noqa
    from vstackboard.common import constants                      # noqa

    LOG.info('Check cdn static files')
    LOG.info('========================')
    env = Environment(loader=PackageLoader('vstackboard', 'templates'))
    template = env.get_template('requires.html')
    html = template.render(cdn=constants.CDN)
    links = []
    bs_html = bs4.BeautifulSoup(html,features="html.parser")
    for script in bs_html.find_all(name='script'):
        src = script.get('src')
        if not src or not src.startswith('http') or not src.endswith('.js'):
            continue
        links.extend((src, '{}.map'.format(src)))

    for script in bs_html.find_all(name='link'):
        src = script.get('href')
        if not src or not src.startswith('http'):
            continue
        if src.endswith('.css'):
            links.extend((src, '{}.map'.format(src)))
    for link in links:
        save_static_content(link)
    LOG.info('========================')


def save_static_content(link):
    url = parse.urlparse(link)
    local_path = os.path.join(HOME, 'static', 'cdn', url.path[1:])
    if os.path.exists(local_path):
        LOG.info('file exists: %s', local_path)
        return

    save_path = os.path.dirname(local_path)
    if not os.path.exists(save_path):
        os.makedirs(save_path)
    LOG.info('Download cdn src %s to %s', link, os.path.abspath(local_path))
    resp = requests.get(link)
    try:
        resp.raise_for_status()
    except requests.exceptions.HTTPError:
        if resp.status_code == 404 and link.endswith('.map'):
            LOG.warning('%s not found, mybe it is no need.', link)
            return

    with open(local_path, 'w') as f:
        data = resp.text if isinstance(resp.content, bytes) else resp.content
        f.write(data)


class Version(cliparser.CliBase):
    NAME = 'version'

    def __call__(self, args):
        from vstackboard.common import constants
        try:
            info = version.VersionInfo(constants.NAME)
        except ModuleNotFoundError:
            info = 'dev'
        print(info.version_string())


class Serve(cliparser.CliBase):
    NAME = 'serve'
    ARGUMENTS = [
         cliparser.Argument('--develop', action='store_true',
                            help="Run with develop mode"),
    ]

    def __call__(self, args):
        from vstackboard.common import conf                          # noqa
        from vstackboard import server                               # noqa

        conf.load_configs()

        level = (args.debug or
                 conf.CONF.debug) and logging.DEBUG or logging.INFO
        if args.develop:
            log.basic_config(level=level)
        else:
            log.basic_config(level=level, filename=conf.CONF.log_file)

        if args.develop:
            download_statics_for_cdn()

        # from gevent import monkey
        # monkey.patch_all()
        server.start(develop=args.develop)


def main():
    cli_parser = cliparser.SubCliParser('VStackBoard Command Client')
    cli_parser.register_clis(Version, Serve)
    cli_parser.call()


if __name__ == '__main__':
    DEVELOPMENT = True
    sys.path.insert(0, HOME)
    sys.exit(main())