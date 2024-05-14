var argv;
var yargs = require('yargs');
var fs = require('fs');
var art = require('../ascii-art');
const v1 = yargs.usage('Usage: $0 <command> [options] <target>');
v1;
const v2 = yargs.command('image', 'convert an image to ascii');
const v3 = v2.command('art', 'get some ascii art from various sites');
const v4 = v3.command('text', 'add styles and/or font rendering to text');
const v5 = v4.demand(2);
const v6 = v5.example('$0 art textfiles.com/spock.art ', 'request the file "spock.art" remotely from "textfiles.com"');
const v7 = v6.example('$0 install Font.flf ', 'install a figlet font');
const v8 = v7.example('$0 image foo.jpg ', 'output foo.jpg as inline ascii text with ansi colors');
const v9 = v8.example('$0 text -F Doom "Some Titles"', 'outputs "Some Titles" in the Doom font');
const v10 = v9.example('$0 text -s red+underline "Some Titles"', 'outputs "Some Titles" with a red and underlined terminal style');
const v11 = v10.example('$0 text -F Doom "Some Titles"', 'outputs "Some Titles" in the Doom font');
const v12 = v11.example('$0 list all', 'show all fonts available at figlet.org');
const v13 = v12.example('$0 preview weird', 'visit the prieview page for weird.flf at figlet.org');
const v14 = v13.example('$0 install weird', 'install weird.flf into the local "/Fonts" directory');
const v15 = v14.example('$0 install weird -g', 'install weird.flf into the currently executing ascii-art instance');
const v16 = v15.alias('s', 'style');
const v17 = v16.nargs('s', 1);
const v18 = v17.describe('s', 'render a ansi style onto a string');
const v19 = v18.alias('F', 'font');
const v20 = v19.nargs('F', 1);
const v21 = v20.describe('F', 'render the output in the specified font');
const v22 = v21.alias('g', 'global');
const v23 = v22.nargs('g', 0);
const v24 = v23.describe('g', 'install the font globally');
const v25 = v24.alias('o', 'output');
const v26 = v25.nargs('o', 1);
const v27 = v26.describe('o', 'Save to a file');
const v28 = v27.alias('a', 'alphabet');
const v29 = v28.alias('a', 'alpha');
const v30 = v29.nargs('a', 1);
const v31 = art.valueScales;
const v32 = Object.keys(v31);
const v33 = v30.choices('a', v32);
const v34 = v33.describe('a', 'Which alphabet to use');
const v35 = v34.help('h');
const v36 = v35.alias('h', 'help');
const v37 = v36.epilog('\xA92016 - Abbey Hawk Sparrow');
v37;
argv = yargs.argv;
const v38 = argv._;
var action = v38.shift();
const v39 = argv._;
var target = v39.pop();
var ftp;
var request;
switch (action) {
case 'image':
    var options = {};
    options.filepath = target;
    const v40 = argv.a;
    if (v40) {
        const v41 = argv.a;
        options.alphabet = v41;
    }
    const v42 = process.stdout;
    const v43 = process && v42;
    const v44 = process.stdout;
    const v45 = v44.columns;
    const v46 = v43 && v45;
    if (v46) {
        const v47 = process.stdout;
        const v48 = v47.columns;
        options.width = v48;
    }
    var image = new art.Image(options);
    const v53 = function (err, rendered) {
        const v49 = argv.o;
        if (v49) {
            const v50 = argv.o;
            const v51 = fs.writeFile(v50, rendered);
            v51;
        } else {
            const v52 = console.log(rendered);
            v52;
        }
    };
    const v54 = image.write(v53);
    v54;
    break;
case 'art':
    const v55 = target || '';
    var parts = v55.split('/');
    const v56 = !request;
    if (v56) {
        request = require('request');
    }
    const page2List = function (text, base, omit) {
        const v57 = text.match(/<A(.*?)<\/A>/g);
        const v61 = function (i) {
            const v58 = i.indexOf('?');
            const v59 = -1;
            const v60 = v58 === v59;
            return v60;
        };
        const v62 = v57.filter(v61);
        const v75 = function (line) {
            const v63 = line.match(/".*?"/);
            const v64 = v63[0];
            var name = v64 || '';
            const v65 = line.match(/>.*?</);
            const v66 = v65[0];
            var file = v66 || '';
            const v67 = name.length;
            const v68 = v67 - 1;
            const v69 = name.substring(1, v68);
            const v70 = file.length;
            const v71 = v70 - 1;
            const v72 = file.substring(1, v71);
            const v73 = base + v72;
            const v74 = {};
            v74.name = v69;
            v74.file = v73;
            return v74;
        };
        const v76 = v62.map(v75);
        const v93 = function (i) {
            const v77 = [];
            const v78 = omit || v77;
            const v79 = i.name;
            const v80 = v78.indexOf(v79);
            const v81 = -1;
            const v82 = v80 === v81;
            const v83 = i.name;
            const v84 = v83.indexOf('://');
            const v85 = -1;
            const v86 = v84 === v85;
            const v87 = v82 && v86;
            const v88 = i.name;
            const v89 = v88.toUpperCase();
            const v90 = i.name;
            const v91 = v89 !== v90;
            const v92 = v87 && v91;
            return v92;
        };
        var matches = v76.filter(v93);
        return matches;
    };
    var exclusions = [
        '/apple',
        '/bbs',
        'LOGOS',
        'SEQ',
        '../archives/asciiart.zip',
        'NFOS',
        'LOGOS',
        'RTTY',
        '/piracy'
    ];
    const v94 = parts[0];
    switch (v94) {
    case 'textfiles.com':
        const v95 = parts[1];
        if (v95) {
            var pre = '';
            var post = '';
            const v96 = parts[1];
            switch (v96) {
            case 'NFOS':
                post = 'asciiart/';
            case 'asciiart':
                pre = 'artscene.';
                break;
            case 'LOGOS':
            case 'DECUS':
                post = 'art/';
                break;
            case 'RAZOR':
            case 'FAIRLIGHT':
            case 'DREAMTEAM':
            case 'HUMBLE':
            case 'HYBRID':
            case 'PRESTIGE':
            case 'INC':
            case 'TDUJAM':
            case 'ANSI':
                post = 'piracy/';
                break;
            }
            const v97 = parts[2];
            if (v97) {
                const v98 = 'http://' + pre;
                const v99 = v98 + 'textfiles.com/';
                const v100 = v99 + post;
                const v101 = parts[1];
                const v102 = v100 + v101;
                const v103 = v102 + '/';
                const v104 = parts[2];
                const v105 = v103 + v104;
                const v107 = function (err, req, data) {
                    const v106 = console.log(data);
                    v106;
                };
                const v108 = request(v105, v107);
                v108;
            } else {
                const v109 = 'http://' + pre;
                const v110 = v109 + 'textfiles.com/';
                const v111 = v110 + post;
                const v112 = parts[1];
                const v113 = v111 + v112;
                var base = v113 + '/';
                const v118 = function (err, req, data) {
                    if (err) {
                        throw err;
                    }
                    var text = data.toString();
                    var matches = page2List(text, base, exclusions);
                    const v114 = { data: matches };
                    const v116 = function (rendered) {
                        const v115 = console.log(rendered);
                        v115;
                    };
                    const v117 = art.table(v114, v116);
                    v117;
                };
                const v119 = request(base, v118);
                v119;
            }
        } else {
            const v120 = {
                name: 'asciiart',
                detail: 'community shared'
            };
            const v121 = {
                name: 'art',
                detail: 'classic files'
            };
            const v122 = {
                name: 'RTTY',
                detail: 'Teletype Art'
            };
            const v123 = {
                name: 'LOGOS',
                detail: 'Classic Logos'
            };
            const v124 = {
                name: 'DECUS',
                detail: 'Printer Art'
            };
            const v125 = {
                name: 'RAZOR',
                detail: 'Cracking Group'
            };
            const v126 = {
                name: 'FAIRLIGHT',
                detail: 'Cracking Group'
            };
            const v127 = {
                name: 'DREAMTEAM',
                detail: 'Cracking Group'
            };
            const v128 = {
                name: 'HUMBLE',
                detail: 'Cracking Group'
            };
            const v129 = {
                name: 'HYBRID',
                detail: 'Cracking Group'
            };
            const v130 = {
                name: 'PRESTIGE',
                detail: 'Cracking Group'
            };
            const v131 = {
                name: 'INC',
                detail: 'Cracking Group'
            };
            const v132 = {
                name: 'TDUJAM',
                detail: 'Cracking Group'
            };
            const v133 = {
                name: 'ANSI',
                detail: 'Misc ANSI Files'
            };
            const v134 = {
                name: 'NFOS',
                detail: 'Misc NFO Files'
            };
            const v135 = [
                v120,
                v121,
                v122,
                v123,
                v124,
                v125,
                v126,
                v127,
                v128,
                v129,
                v130,
                v131,
                v132,
                v133,
                v134
            ];
            const v136 = { data: v135 };
            const v138 = function (rendered) {
                const v137 = console.log(rendered);
                v137;
            };
            const v139 = art.table(v136, v138);
            v139;
        }
        break;
    case '':
        break;
    default:
        const v140 = parts[0];
        const v141 = 'unknown art source:' + v140;
        const v142 = new Error(v141);
        throw v142;
    }
    var options = {};
    options.filepath = target;
    break;
case 'text':
    var output = function (result) {
        const v143 = console.log(result);
        v143;
    };
    const v144 = argv.F;
    if (v144) {
        const v145 = argv.s;
        if (v145) {
            const v146 = argv.F;
            const v147 = argv.s;
            const v148 = art.font(target, v146, v147, output);
            v148;
        } else {
            const v149 = argv.F;
            const v150 = art.font(target, v149, output);
            v150;
        }
    } else {
        const v151 = argv.s;
        const v152 = v151 || '';
        const v153 = art.style(target, v152, true);
        const v154 = console.log(v153);
        v154;
    }
    break;
case 'list':
    var JSFtp = ftp || (ftp = require('jsftp'));
    const v155 = { host: 'ftp.figlet.org' };
    var client = new JSFtp(v155);
    var results = [];
    const v178 = function (err, res) {
        const v156 = !err;
        if (v156) {
            const v159 = function (item) {
                const v157 = item.name;
                const v158 = 'ours/' + v157;
                return v158;
            };
            const v160 = res.map(v159);
            results = results.concat(v160);
        }
        const v176 = function (err, res) {
            const v161 = !err;
            if (v161) {
                const v164 = function (item) {
                    const v162 = item.name;
                    const v163 = 'contributed/' + v162;
                    return v163;
                };
                const v165 = res.map(v164);
                results = results.concat(v165);
            }
            const v166 = client.raw;
            const v174 = function (err, data) {
                if (err) {
                    const v167 = console.error(err);
                    return v167;
                }
                const v172 = function (path) {
                    const v168 = path.split('/');
                    const v169 = v168.pop();
                    const v170 = v169.split('.');
                    const v171 = v170.shift();
                    return v171;
                };
                var names = results.map(v172);
                const v173 = console.log(names);
                v173;
            };
            const v175 = v166.quit(v174);
            v175;
        };
        const v177 = client.ls('pub/figlet/fonts/contributed', v176);
        v177;
    };
    const v179 = client.ls('pub/figlet/fonts/ours', v178);
    v179;
    break;
case 'preview':
    const v180 = require('child_process');
    var exec = v180.exec;
    const v181 = target.toLowerCase();
    const v182 = 'open "http://www.figlet.org/fontdb_example.cgi?font=' + v181;
    const v183 = v182 + '.flf"';
    const v184 = exec(v183);
    v184;
    break;
case 'install':
    var JSFtp = ftp || (ftp = require('jsftp'));
    const v185 = { host: 'ftp.figlet.org' };
    var ftp = new JSFtp(v185);
    var subdir = 'contributed';
    const v186 = 'pub/figlet/fonts/' + subdir;
    const v187 = v186 + '/';
    const v188 = target.toLowerCase();
    const v189 = v187 + v188;
    var url = v189 + '.flf';
    const v212 = function (err, socket) {
        if (err) {
            return;
        }
        var str = '';
        const v190 = function (d) {
            str += d.toString();
        };
        const v191 = socket.on('data', v190);
        v191;
        const v209 = function (err) {
            if (err) {
                const v192 = 'There was an error retrieving the font ' + target;
                const v193 = console.error(v192);
                v193;
            } else {
                let dir;
                const v194 = argv.g;
                const v195 = process.cwd();
                const v196 = v195 + '/Fonts/';
                const v197 = __dirname + '/../Fonts/';
                if (v194) {
                    dir = v196;
                } else {
                    dir = v197;
                }
                const v198 = target.toLowerCase();
                const v199 = dir + v198;
                const v200 = v199 + '.flf';
                const v207 = function (err) {
                    const v201 = ftp.raw;
                    const v205 = function (err, data) {
                        if (err) {
                            const v202 = console.error(err);
                            return v202;
                        }
                        const v203 = target + ' written';
                        const v204 = console.log(v203);
                        v204;
                    };
                    const v206 = v201.quit(v205);
                    v206;
                };
                const v208 = fs.writeFile(v200, str, v207);
                v208;
            }
        };
        const v210 = socket.on('close', v209);
        v210;
        const v211 = socket.resume();
        v211;
    };
    const v213 = ftp.get(url, v212);
    v213;
    break;
default:
    const v214 = 'unknown action: ' + action;
    const v215 = new Error(v214);
    throw v215;
}