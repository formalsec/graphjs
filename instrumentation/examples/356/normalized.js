var os = require('os');
var fs = require('fs');
var p = require('path');
const v1 = require('child_process');
var exec = v1.exec;
const v2 = require('child_process');
var spawn = v2.spawn;
var helpers = require('./helpers');
const v3 = require('util');
var format = v3.format;
const v4 = {};
const v22 = function (pid, options, done) {
    var self = this;
    const v5 = this.cpu;
    const v6 = v5 !== null;
    if (v6) {
        const v16 = function (err, uptime) {
            if (err) {
                const v7 = done(err, null);
                return v7;
            }
            const v8 = uptime === undefined;
            if (v8) {
                const v9 = console.error('[pidusage] We couldn\'t find uptime from /proc/uptime');
                v9;
                const v11 = os.uptime();
                v10.uptime = v11;
            } else {
                const v12 = self.cpu;
                const v13 = uptime.split(' ');
                const v14 = v13[0];
                v12.uptime = v14;
            }
            const v15 = self.proc_calc(pid, options, done);
            return v15;
        };
        const v17 = fs.readFile('/proc/uptime', 'utf8', v16);
        v17;
    } else {
        const v20 = function (err, cpu) {
            if (err) {
                const v18 = done(err, null);
                return v18;
            }
            self.cpu = cpu;
            const v19 = self.proc_calc(pid, options, done);
            return v19;
        };
        const v21 = helpers.cpu(v20);
        v21;
    }
};
const v83 = function (pid, options, done) {
    let history;
    const v23 = this.history;
    const v24 = v23[pid];
    const v25 = this.history;
    const v26 = v25[pid];
    const v27 = {};
    if (v24) {
        history = v26;
    } else {
        history = v27;
    }
    var cpu = this.cpu;
    var self = this;
    const v28 = '' + pid;
    const v29 = p.join('/proc', v28, 'stat');
    const v81 = function (err, infos) {
        if (err) {
            const v30 = done(err, null);
            return v30;
        }
        var index = infos.lastIndexOf(')');
        const v31 = index + 2;
        const v32 = infos.substr(v31);
        infos = v32.split(' ');
        const v33 = infos[11];
        const v34 = parseFloat(v33);
        const v35 = infos[12];
        const v36 = parseFloat(v35);
        const v37 = infos[13];
        const v38 = parseFloat(v37);
        const v39 = infos[14];
        const v40 = parseFloat(v39);
        const v41 = infos[19];
        const v42 = parseFloat(v41);
        const v43 = cpu.clock_tick;
        const v44 = v42 / v43;
        const v45 = infos[21];
        const v46 = parseFloat(v45);
        var stat = {};
        stat.utime = v34;
        stat.stime = v36;
        stat.cutime = v38;
        stat.cstime = v40;
        stat.start = v44;
        stat.rss = v46;
        let childrens;
        const v47 = options.childrens;
        const v48 = stat.cutime;
        const v49 = stat.cstime;
        const v50 = v48 + v49;
        if (v47) {
            childrens = v50;
        } else {
            childrens = 0;
        }
        const v51 = stat.stime;
        const v52 = history.stime;
        const v53 = v52 || 0;
        const v54 = v51 - v53;
        const v55 = stat.utime;
        const v56 = v54 + v55;
        const v57 = history.utime;
        const v58 = v57 || 0;
        const v59 = v56 - v58;
        var total = v59 + childrens;
        const v60 = cpu.clock_tick;
        total = total / v60;
        let seconds;
        const v61 = history.uptime;
        const v62 = v61 !== undefined;
        const v63 = cpu.uptime;
        const v64 = history.uptime;
        const v65 = v63 - v64;
        const v66 = stat.start;
        const v67 = cpu.uptime;
        const v68 = v66 - v67;
        if (v62) {
            seconds = v65;
        } else {
            seconds = v68;
        }
        seconds = Math.abs(seconds);
        const v69 = seconds === 0;
        if (v69) {
            seconds = 1;
        } else {
            seconds = seconds;
        }
        const v70 = self.history;
        v70[pid] = stat;
        const v71 = self.history;
        const v72 = v71[pid];
        const v73 = cpu.uptime;
        v72.uptime = v73;
        const v74 = total / seconds;
        const v75 = v74 * 100;
        const v76 = stat.rss;
        const v77 = cpu.pagesize;
        const v78 = v76 * v77;
        const v79 = {
            cpu: v75,
            memory: v78
        };
        const v80 = done(null, v79);
        return v80;
    };
    const v82 = fs.readFile(v29, 'utf8', v81);
    v82;
};
const v102 = function (pid, options, done) {
    var cmd = 'ps -o pcpu,rss -p ';
    const v84 = os.platform();
    const v85 = v84 == 'aix';
    if (v85) {
        cmd = 'ps -o pcpu,rssize -p ';
    }
    const v86 = cmd + pid;
    const v100 = function (err, stdout, stderr) {
        if (err) {
            const v87 = done(err, null);
            return v87;
        }
        const v88 = os.EOL;
        const v89 = stdout.split(v88);
        stdout = v89[1];
        const v90 = stdout.replace(/^\s+/, '');
        const v91 = v90.replace(/\s\s+/g, ' ');
        stdout = v91.split(' ');
        const v92 = stdout[0];
        const v93 = v92.replace(',', '.');
        const v94 = parseFloat(v93);
        const v95 = stdout[1];
        const v96 = parseFloat(v95);
        const v97 = v96 * 1024;
        const v98 = {
            cpu: v94,
            memory: v97
        };
        const v99 = done(null, v98);
        return v99;
    };
    const v101 = exec(v86, v100);
    v101;
};
const v175 = function (pid, options, done) {
    let history;
    const v103 = this.history;
    const v104 = v103[pid];
    const v105 = this.history;
    const v106 = v105[pid];
    const v107 = {};
    if (v104) {
        history = v106;
    } else {
        history = v107;
    }
    const v108 = 'PROCESS ' + pid;
    var args = v108 + ' get workingsetsize,usermodetime,kernelmodetime';
    const v109 = args.split(' ');
    const v110 = { detached: true };
    var wmic = spawn('wmic', v109, v110);
    var stdout = '';
    var stderr = '';
    var self = this;
    var uptime = os.uptime();
    const v111 = wmic.stdout;
    const v112 = function (d) {
        stdout += d.toString();
    };
    const v113 = v111.on('data', v112);
    v113;
    const v114 = wmic.stderr;
    const v115 = function (d) {
        stderr += d.toString();
    };
    const v116 = v114.on('data', v115);
    v116;
    const v120 = function (err) {
        const v117 = '[pidusage] Command "wmic ' + args;
        const v118 = v117 + '" failed with error %s';
        const v119 = console.error(v118, err);
        v119;
    };
    const v121 = wmic.on('error', v120);
    v121;
    const v171 = function (code) {
        stdout = stdout.trim();
        stderr = stderr.trim();
        const v122 = !stdout;
        const v123 = code !== 0;
        const v124 = v122 || v123;
        if (v124) {
            const v125 = new Date();
            const v126 = v125.toString();
            const v127 = os.EOL;
            var error = format('%s Wmic errored, please open an issue on https://github.com/soyuka/pidusage with this message.%s', v126, v127);
            const v128 = os.EOL;
            const v129 = os.EOL;
            const v130 = os.release();
            const v131 = os.EOL;
            const v132 = os.type();
            const v133 = os.EOL;
            error += format('Command was "wmic %s" %s System informations: %s - release: %s %s - type %s %s', args, v128, v129, v130, v131, v132, v133);
            const v134 = format('Wmic reported the following error: %s.', stderr);
            let v135;
            if (stderr) {
                v135 = v134;
            } else {
                v135 = 'Wmic reported no errors (stderr empty).';
            }
            stderr = error + v135;
            const v136 = os.EOL;
            const v137 = os.EOL;
            stderr = format('%s%s%sWmic exited with code %d.', v136, stderr, v137, code);
            const v138 = os.EOL;
            let v139;
            if (stdout) {
                v139 = stdout;
            } else {
                v139 = 'empty';
            }
            stderr = format('%s%sStdout was %s', stderr, v138, v139);
            const v140 = new Error(stderr, null);
            const v141 = done(v140);
            return v141;
        }
        const v142 = os.EOL;
        const v143 = stdout.split(v142);
        const v144 = v143[1];
        const v145 = v144.replace(/\s\s+/g, ' ');
        stdout = v145.split(' ');
        const v146 = stdout[0];
        const v147 = parseFloat(v146);
        const v148 = stdout[1];
        const v149 = parseFloat(v148);
        var stats = {};
        stats.kernelmodetime = v147;
        stats.usermodetime = v149;
        const v150 = stdout[2];
        var workingsetsize = parseFloat(v150);
        const v151 = stats.kernelmodetime;
        const v152 = history.kernelmodetime;
        const v153 = v152 || 0;
        const v154 = v151 - v153;
        const v155 = stats.usermodetime;
        const v156 = v154 + v155;
        const v157 = history.usermodetime;
        const v158 = v157 || 0;
        var total = v156 - v158;
        total = total / 10000000;
        let seconds;
        const v159 = history.uptime;
        const v160 = v159 !== undefined;
        const v161 = history.uptime;
        const v162 = uptime - v161;
        if (v160) {
            seconds = v162;
        } else {
            seconds = 0;
        }
        seconds = Math.abs(seconds);
        const v163 = seconds === 0;
        if (v163) {
            seconds = 1;
        } else {
            seconds = seconds;
        }
        const v164 = self.history;
        v164[pid] = stats;
        const v165 = self.history;
        const v166 = v165[pid];
        v166.uptime = uptime;
        const v167 = total / seconds;
        const v168 = v167 * 100;
        const v169 = {
            cpu: v168,
            memory: workingsetsize
        };
        const v170 = done(null, v169);
        return v170;
    };
    const v172 = wmic.on('close', v171);
    v172;
    const v173 = wmic.stdin;
    const v174 = v173.end();
    v174;
};
var stats = {};
stats.history = v4;
stats.cpu = null;
stats.proc = v22;
stats.proc_calc = v83;
stats.ps = v102;
stats.win = v175;
module.exports = stats;