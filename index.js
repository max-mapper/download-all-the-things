var youtubedl = require('youtube-dl')
var url = require('url')
var _ = require('underscore')
var follow = require('follow')
var txn = require('txn')
var async = require('async')
var config = JSON.parse(require('fs').readFileSync('./config.json'))
var db = config.db

function download(doc, callback) {
  var dl = youtubedl.download('http://www.youtube.com/watch?v=' + doc._id,
    config.output,
    ['--max-quality=18'])

  dl.on('download', function(data) {
    console.log('Download started')
    console.log('filename: ' + data.filename)
    console.log('size: ' + data.size)
  });

  dl.on('progress', function(data) {
    process.stdout.write(data.eta + ' ' + data.percent + '% at ' + data.speed + '\r')
  });

  dl.on('error', callback)

  dl.on('end', function(data) {
    doc.download = data
    doc.type = "download"
    callback()
  })
}

var q = async.queue(function (change, callback) {
  txn({"uri": db + '/' + change.id, "timeout": 1960000}, download, function(err, doc) {
    if (err) return callback('download error on ' + change.id + JSON.stringify(err))
    console.log('\nDownload finished!')
    console.log('Filename: ' + doc.download.filename)
    console.log('Size: ' + doc.download.size)
    console.log('Time Taken: ' + doc.download.timeTaken)
    console.log('Average Speed: ' + doc.download.averageSpeed)
    return callback()
  })
}, config.concurrency);

q.drain = function() {
  console.log('queue is empty');
}

console.log('listening for tasks on ' + db)
var feed = new follow.Feed({db: db, include_docs: true})

feed.filter = function(doc, req) {
  if (doc.type === "pendingDownload") return true
  return false
}

feed.on('change', q.push)

feed.on('error', function(err) {
  throw err
})

feed.follow()