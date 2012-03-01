var request = require('request').defaults({json: true})
var _ = require('underscore')
var url = require('url')
var qs = require('querystring')
var config = JSON.parse(require('fs').readFileSync('./config.json'))
var db = config.db
var subredditURL = config.subreddit
var last = ""

function importSubredditYoutubes(subreddit, callback) {
  request(subreddit + "?after=" + last, function(e,r,body) {
    if (e) callback(e)
    last = body.data.after
    console.log(last)
    var youtubes = _.map(body.data.children, function(item) {
      if (!item.data.media) return
      var oembed = item.data.media.oembed
      if (!oembed || oembed.provider_name !== "YouTube") return
      if (!oembed.url) return
      item._id = qs.parse(url.parse(oembed.url).query).v
      item.type = "pendingDownload"
      return item
    })
    request.post({url: db + '/_bulk_docs', json: {"docs": _.compact(youtubes)}}, function(err, resp, responseBody) {
      if (err) return callback(err)
      callback(false, responseBody)
    })
  })
}

// reddit doesnt want more than 1 request per 2 seconds
(function loop() {
  importSubredditYoutubes(subredditURL, function(err, data) {
    if (err) return console.error(err)
    setTimeout(loop, 2000)
  })
})()