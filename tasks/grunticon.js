/*
 * grunticon
 * https://github.com/filamentgroup/grunticon
 *
 * Copyright (c) 2012 Scott Jehl, Filament Group, Inc
 * Licensed under the MIT license.
 */

/*global __dirname:true*/
/*global require:true*/

module.exports = function (grunt, undefined) {

	"use strict";

	var path = require('path');
	var os = require('os');

	var fs = require('fs-extra');
	var uglify = require('uglify-js');
	var RSVP = require('rsvp');

	var DirectoryColorfy = require('directory-colorfy');
	var DirectoryEncoder = require('directory-encoder');
	var svgToPng = require('svg-to-png');

	var helper = require(path.join('..', 'lib', 'grunticon-helper'));

	grunt.registerMultiTask('grunticon', 'A mystical CSS icon solution.', function () {
		var done = this.async();

		// get the config
		var config = this.options({
			datasvgcss: "icons.data.svg.css",
			datapngcss: "icons.data.png.css",
			urlpngcss: "icons.fallback.css",
			files: {
				loader: path.join(__dirname, 'grunticon', 'static', 'grunticon.loader.js'),
				banner: path.join(__dirname, 'grunticon', 'static', 'grunticon.loader.banner.js')
			},
			previewhtml: "preview.html",
			loadersnippet: "grunticon.loader.js",
			cssbasepath: path.sep,
			customselectors: {},
			cssprefix: ".icon-",
			defaultWidth: "400px",
			defaultHeight: "300px",
			colors: {},
			pngfolder: "png",
			pngpath: "",
			template: "",
			tmpDir: "grunticon-tmp",
			previewTemplate: path.join(__dirname, "..", "example", "preview.hbs"),
			dynamicColorOnly: true,
			stylesheet: '',
			lessprefix: '',
			preview: false,
			loader: false,
		});

		// just a quick starting message
		grunt.log.writeln("Look, it's a grunticon!");

		var files = this.files.filter(function (file) {
			return file.src[0].match(/png|svg/);
		});
		if (files.length === 0) {
			grunt.log.writeln("Grunticon has no files to read!");
			done();
			return;
		}

		files = files.map(function (file) {
			return file.src[0];
		});

		config.src = this.files[0].orig.cwd;
		config.dest = this.files[0].orig.dest;

		if (!config.dest || config.dest && config.dest === "") {
			grunt.fatal("The destination must be a directory");
		}

		// folder name (within the output folder) for generated png files
		var pngfolder = path.join.apply(null, config.pngfolder.split(path.sep));

		// create the output directory
		grunt.file.mkdir(config.dest);

		// minify the source of the grunticon loader and write that to the output
		if (config.loader) {
			grunt.log.writeln("grunticon now minifying the stylesheet loader source.");
			var banner = grunt.file.read(config.files.banner);
			config.min = banner + "\n" + uglify.minify(config.files.loader).code;
			grunt.file.write(path.join(config.dest, config.loadersnippet), config.min);
			grunt.log.writeln("grunticon loader file created.");
		}

		var svgToPngOpts = {
			pngfolder: pngfolder,
			defaultWidth: config.defaultWidth,
			defaultHeight: config.defaultHeight
		};

		var o = {
			pngfolder: pngfolder,
			customselectors: config.customselectors,
			template: path.resolve(config.template),
			previewTemplate: path.resolve(config.previewTemplate),
			noencodepng: false,
			prefix: config.cssprefix
		};

		var o2 = {
			pngfolder: pngfolder,
			pngpath: config.pngpath,
			customselectors: config.customselectors,
			template: path.resolve(config.template),
			previewTemplate: path.resolve(config.previewTemplate),
			noencodepng: true,
			prefix: config.cssprefix
		};
		//EBSCO - Parsing less file, parse function found on stackoverflow, question 11827453;

		var lessFilePath = path.join(process.cwd(), path.normalize(config.stylesheet)),
			lessFile, lessVars,
			getLessVars = function (lessStr) {
				var keyVar, lessVars, line, lines, _i, _len;
				lines = lessStr.split('\n');
				lessVars = {};
				for (_i = 0, _len = lines.length; _i < _len; _i++) {
					line = lines[_i];
					if (line.indexOf('@') === 0) {
						keyVar = line.split(';')[0].split(':');
						if (keyVar[1].indexOf('@') > -1) {
							lessVars[keyVar[0].trim()] = lessVars[keyVar[1].trim()];
						}
						else {
							lessVars[keyVar[0].trim()] = keyVar[1].trim();
						}
					}
				}
				return lessVars;
			};

		if (grunt.file.exists(lessFilePath) && !grunt.file.isDir(lessFilePath)) {
			lessFile = fs.readFileSync(lessFilePath).toString();
		}
		if (typeof lessFile === 'string') {
			lessVars = getLessVars(lessFile);

			var prefixLocation, colorName;
			for (var key in lessVars) {
				prefixLocation = key.indexOf(config.lessprefix);
				if (prefixLocation === 1) { // first character of less variables is '@'
					colorName = key.replace('@' + config.lessprefix, '');
					config.colors[colorName] = lessVars[key];
				}
			}
		}

		grunt.log.writeln("Coloring SVG files");
		// create the tmp directory
		var tmp = path.join(os.tmpDir(), config.tmpDir);
		if (grunt.file.exists(tmp)) {
			fs.removeSync(tmp);
		}
		grunt.file.mkdir(tmp);
		var colorFiles,
			isEmpty = function (obj) {
				for (var prop in obj) {
					if (obj.hasOwnProperty(prop)) {
						return false;
					}
				}

				return true;
			};

		try {
			var dc = new DirectoryColorfy(config.src, tmp, {
				colors: config.colors,
				dynamicColorOnly: isEmpty(config.colors) ? false : config.dynamicColorOnly
			});
			colorFiles = dc.convert();
		} catch (e) {
			grunt.fatal(e);
			done(false);
		}

		//copy non color config files into temp directory
		var transferFiles = this.files.filter(function (f) {
			return !f.src[0].match(/\.colors/);
		});

		transferFiles.forEach(function (f) {
			var filenameArr = f.src[0].split("/"),
				filename = filenameArr[filenameArr.length - 1];
			grunt.file.copy(f.src[0], path.join(tmp, filename));
		});

		grunt.log.writeln("Converting SVG to PNG");
		svgToPng.convert(tmp, config.dest, svgToPngOpts)
			.then(function (result, err) {
				if (err) {
					grunt.fatal(err);
				}

				var svgde = new DirectoryEncoder(tmp, path.join(config.dest, config.datasvgcss), o),
					pngde = new DirectoryEncoder(path.join(config.dest, pngfolder), path.join(config.dest, config.datapngcss), o),
					pngdefall = new DirectoryEncoder(path.join(config.dest, pngfolder), path.join(config.dest, config.urlpngcss), o2);

				grunt.log.writeln("Writing CSS");
				try {
					svgde.encode();
					pngde.encode();
					pngdefall.encode();
				} catch (e) {
					grunt.fatal(e);
					done(false);
				}
				if (config.preview === true) {
					grunt.log.writeln("Grunticon now creating Preview File");
					try {
						helper.createPreview(tmp, config);
					} catch (er) {
						grunt.fatal(er);
					}
				}

				grunt.log.writeln("Delete Temp Files");
				fs.removeSync(tmp);
				done();
			});

	});
};
