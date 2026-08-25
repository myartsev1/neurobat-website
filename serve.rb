# NeuroBat Lab · local preview server
# HTML revalidates on every load; static assets (incl. video) cache normally so
# media range-streaming works. CSS/JS are safe to cache because their URLs are
# version-stamped on every change.
require 'webrick'

class PreviewFileHandler < WEBrick::HTTPServlet::FileHandler
  def do_GET(req, res)
    super
    if req.path.end_with?('.html') || req.path == '/'
      res['Cache-Control'] = 'no-cache, must-revalidate'
    else
      res['Cache-Control'] = 'public, max-age=3600'
    end
  end
end

server = WEBrick::HTTPServer.new(Port: 8317, AccessLog: [], Logger: WEBrick::Log.new(File::NULL))
server.mount('/', PreviewFileHandler, Dir.pwd, FancyIndexing: true)
trap('INT') { server.shutdown }
server.start
