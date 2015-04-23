var fs = require('fs');

var join = require('path').join;

var express = require('express');
var hbs = require('hbs');
var async = require('async');
var multer = require('multer');
var morgan = require('morgan');

var app = express();

app.set('view engine', 'hbs');
app.set('views', __dirname);

var ROOTDIR = '/tmp/.block';

app.use(multer({
  dest: ROOTDIR,
  rename: function(fieldname, filename) {
    return filename;
  },
  changeDest: function(dest, req, res) {
    return dest + '/' + req.url;
  }
}));

app.use(morgan('combined'));

app.use(function(req, res, next) {
  if ('/favicon.ico' == req.url) {
    res.send('');
  } else {
    next();
  }
});

var files = [{
  permissions: 'permissions',
  filesize: 'filesize',
  path: 'path',
  name: 'name',
  owner: 'foo',
  dateCreated: '2015-04-23T00:58:44-04:00',
  dateModified: '2015-04-23T00:59:12-04:00'
}];

function lintFilesize(bytes) {
  if (bytes < 1024) {
    return bytes + 'B';
  } else if (bytes < 1048576) {
    return (bytes / 1024).toFixed(1) + 'k';
  } else if (bytes < 1073741824) {
    return (bytes / 1048576).toFixed(1) + 'M';
  } else if (bytes < 1099511627776) {
    return (bytes / 1073741824).toFixed(1) + 'G';
  } else if (bytes < 1125899906842624) {
    return (bytes / 1099511627776).toFixed(1) + 'T';
  } else {
    return (bytes / 1125899906842624).toFixed(1) + 'P';
  }
}

function alphaArray(a, b) {
  if (a.name < b.name) return -1;
  if (a.name > b.name) return 1;
  return 0;
}

function AlphaArray(a, b) {
  if (a.name < b.name) return 1;
  if (a.name > b.name) return -1;
  return 0;
}

function getSymbolic(dec) {
  var block = [];

  var octal = (dec & 07777).toString(8);
  var digits = octal.split('');

  digits.forEach(function(v, i, a) {
    var symbol = '';
    symbol += (v & 4) ? 'r' : '-';
    symbol += (v & 2) ? 'w' : '-';
    symbol += (v & 1) ? 'x' : '-';

    block[i] = symbol;
  });

  return block.join('');
}

function getFiles(path, cb) {
  var dirs = [];
  var files = [];

  var qpath = path.replace(ROOTDIR, '');
  if (qpath === '/') {
    qpath = '';
  }

  fs.readdir(path, function(err, data) {
    async.each(data, function(v, next) {

      var file = {
        permissions: '',
        filesize: '',
        path: '',
        name: '',
        owner: 'foo',
        dateCreated: '',
        dateModified: ''
      };


      fs.stat(path + '/' + v, function(err, stats) {
        file.name = stats.isDirectory() ? v + '/' : v;
        file.path = qpath + '/' + v;
        var symb = getSymbolic(stats.mode);
        file.permissions = stats.isDirectory() ? 'd' + symb : '-' + symb;
        file.filesize = stats.isDirectory() ? '' : lintFilesize(stats.size);
        file.dateCreated = stats.birthtime;
        file.dateModified = stats.ctime;

        if (stats.isDirectory()) {
          dirs.push(file);
        } else {
          files.push(file);
        }

        next();
      });
    }, function(err) {

      dirs = dirs.sort(alphaArray);
      files = files.sort(AlphaArray);

      return cb(dirs.concat(files));
    });
  });


}

app.get('/*', function(req, res) {
  var path = req.url || '/';
  path = join(ROOTDIR, path);

  if (fs.existsSync(path)) {
    if (fs.lstatSync(path).isDirectory()) {

      getFiles(path, function(files) {
        res.render('template', {
          path: '/',
          files: files,
          engine: 'Node.js',
          version: '1.7.1',
          server: 'ecstatic',
          address: 'localhost'
        });
      });

    } else {
      res.sendFile(path, {
        dotfiles: 'allow'
      });
    }
  } else {
    res.status(404).end('Not found');
  }
});

app.post('/*', function(req, res) {
  // inject proper logging here
  res.send(req.files);
});

app.listen(80);
