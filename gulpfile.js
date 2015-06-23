var _ = require('lodash'),
    Babel = require('babel'),
    ChildProcess = require('child_process'),
    del = require('del'),
    Gulp = require('gulp'),
    GUtil = require('gulp-util'),
    Path = require('path'),
    Through = require('through2'),
    Traceur = require('traceur'),
    webpack = require('webpack');

require('./tasks/report');
require('./tasks/sauce');
require('./tasks/server');

Gulp.task('test:node', ['build:tests'], function(callback) {
  ChildProcess.exec('node  --v8-options | grep "in progress"', function(err, stdout) {
    if (err && err.code !== 1) {
      throw new GUtil.PluginError('test:node', err);
    }

    // Run with everything enabled, per https://iojs.org/en/es6.html
    var args = _.compact(stdout.replace(/\n$/, '').split(/\n/g).map(function(line) {
      if (/(--\w+)/.exec(line)) {
        return RegExp.$1;
      }
    }));
    if (/^0/.test(process.versions.node)) {
      args.push('--harmony');
    } else {
      args.push('--es_staging');
    }
    args.push('lib/node');
    console.log(args);

    var test = ChildProcess.spawn('node', args, {stdio: 'inherit'});
    test.on('close', function(code) {
      if (code) {
        throw new GUtil.PluginError('test:node', 'Exited with code: ' + code);
      }

      callback();
    });
  });
});

Gulp.task('test', ['test:node']);

Gulp.task('build:webpack', function(callback) {
  webpack({
    entry: './lib/runner',
    output: {
      path: 'build/',
      filename: 'runner.js'
    },
    externals: {
      benchmark: 'Benchmark'
    },
    module: {
      loaders: [{
        test: /\.jsx?$/,
        exclude: /node_modules|vendor/,
        loader: 'babel-loader'
      }]
    }
  }, function(err, stats) {
      if (err) {
        throw new GUtil.PluginError('webpack', err);
      }
      GUtil.log('[webpack]', stats.toString());
      callback();
  });
});

Gulp.task('build:tests', function() {
  var scripts = [
    'runner.js'
  ];

  return Gulp.src('tests/*')
    .pipe(Through.obj(function(testDir, dirEnc, dirCallback) {
      if (!testDir.isDirectory()) {
        return dirCallback();
      }

      var testName = Path.basename(testDir.path);

      Gulp.src(testDir.path + '/*.*')
          .pipe(Through.obj(function(testFile, enc, fileCallback) {
            var ext = Path.extname(testFile.path).replace(/^\./, ''),
                content = testFile.contents.toString().replace(/\btest\(/g, 'suite.add(testType,');

            function createFile(testType, src) {
              var fileName = 'tests/' + testName + '-' + testType + '.js';

              src = 'function(suite, testName, testType, require) {' + src + '}';
              scripts.push(fileName);
              return new GUtil.File({
                path: fileName,
                contents: new Buffer(
                  '"use strict";\n'
                  + 'SixSpeed.tests[' + JSON.stringify(testName) + '] = SixSpeed.tests[' + JSON.stringify(testName) + '] || {};\n'
                  + 'SixSpeed.tests[' + JSON.stringify(testName) + '][' + JSON.stringify(testType) + '] = ' + src + ';\n')
              });
            }

            if (ext === 'es6') {
              this.push(createFile('babel', Babel.transform(content, {optional: ['runtime']}).code));
              this.push(createFile('traceur', Traceur.compile(content)));
            }
            this.push(createFile(ext, content));

            fileCallback();
          }.bind(this),
          function(cb) {
            cb();
            dirCallback();
          }));
    }))
    .pipe(Gulp.dest('build/'));
});

Gulp.task('build:browser-runner', function() {
  return Gulp.src(['lib/browser.js', require.resolve('benchmark'), require.resolve('traceur/bin/traceur-runtime')])
      .pipe(Gulp.dest('build'));
});

Gulp.task('build:browser', ['build:browser-runner', 'build:webpack', 'build:tests'], function() {
  var scripts = [
    'benchmark.js',
    'traceur-runtime.js',
    'runner.js'
  ];

  return Gulp.src('build/tests/*.*')
    .pipe(Through.obj(function(testDir, dirEnc, callback) {
      if (!testDir.isDirectory()) {
        scripts.push('tests/' + Path.basename(testDir.path));
      }
      return callback();
    },
    function(callback) {
      scripts.push('browser.js');

      this.push(new GUtil.File({
        path: 'index.html',
        contents: new Buffer(
          '<!doctype html>\n'
          + '<body>\n'
          + _.map(scripts, function(script) {
            return '<script src="' + script + '"></script>';
          }).join('\n')
          + '</body>'
        )
      }));

      // We need a special mime type to enable all of the features on Firefox.
      this.push(new GUtil.File({
        path: 'index-moz.html',
        contents: new Buffer(
          '<!doctype html>\n'
          + '<body>\n'
          + _.map(scripts, function(script) {
            return '<script src="' + script + '" type="application/javascript;version=1.7"></script>';
          }).join('\n')
          + '</body>'
        )
      }));
      callback();
    }))
    .pipe(Gulp.dest('build/'));
});

Gulp.task('build', ['build:browser']);

Gulp.task('watch', ['build'], function() {
  Gulp.watch(['lib/*.js', 'tests/**'], ['build']);
});

Gulp.task('clean', function(callback) {
  del(['build/**'], callback);
});