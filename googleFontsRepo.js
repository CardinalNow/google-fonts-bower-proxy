/**
 * Created by rweneck on 3/11/15.
 */
var port = process.env.PORT || 8090;
var express = require('express');
var bodyParser = require('body-parser');
var httpreq = require('httpreq');
var archiver = require('archiver');
var stringStream = require('string-stream');

console.log('Starting font repo server up on port ' + port);

var fontRouter = express.Router();
fontRouter.use(bodyParser.json());

fontRouter['get'](
    '/*',
    function(req, res) {
        var errors = [];
        var params, rep;

        var requestUrl = 'http://fonts.googleapis.com' + '/css'+req.originalUrl.substring(req.originalUrl.indexOf('?'));
        var requestedFontName = req.originalUrl.substring(req.originalUrl.indexOf('=')+1, req.originalUrl.indexOf(":"));
        requestedFontName = requestedFontName.replace("+", "");
        requestedFontName = requestedFontName.charAt(0).toLocaleLowerCase()+requestedFontName.substr(1);

        httpreq.get(requestUrl, function (err, response){
            if (err){
                console.log(err);
                res.send(500, {error:err});
            }else {
                if (response.statusCode !== 200) {
                    res.status(response.statusCode).send(response.body);
                    return
                }

                var cssString = response.body;
                var files = [];

                var completion = function(){
                    res.setHeader('Content-Type', 'application/octet-stream');
                    res.setHeader('Content-disposition', 'attachment; filename='+requestedFontName+'.zip');

                    var dl = archiver('zip');
                    dl.pipe(res);
                    dl.append(new stringStream(cssString), {name:requestedFontName+'.css'});
                    files.forEach(function(file){
                        dl.append(file.file, {name:file.name});
                    });
                    dl.finalize(function (err) {
                        if (err) res.send(500);
                    })
                };

                //get all the url's within the css
                var fontReferences = cssString.match(/url\(.*?\)/gi);
                fontReferences.forEach(function (fontReference) {
                    var reference = fontReference.substring(4, fontReference.length - 1);
                    var fontName = reference.substring(fontReference.lastIndexOf("/"));
                    cssString = cssString.replace(reference, fontName);

                    httpreq.get(reference, {binary: true}, function (err, response) {
                        if (err) {
                            console.log(err);
                        } else {
                            files.push({
                                name:fontName,
                                file:response.body
                            });
                        }
                        if(files.length === fontReferences.length){
                            completion();
                        }
                    });
                });
            }
        });
    });

var app = express()
app.use('/googleFonts', fontRouter);
app.listen(port);
console.log('Started font repo server up on port ' + port);